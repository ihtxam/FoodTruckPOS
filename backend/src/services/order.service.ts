import { getDb, schema } from "@/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { roundMoney2, roundTo005 } from "@/lib/money";

export class OrderService {
  /**
   * Create order
   */
  static async createOrder(
    merchantId: string,
    items: Array<{ productId: string; quantity: number; unitPrice: number }>,
    customerId?: string,
    orderType: "pos" | "web_shop" = "pos",
    paymentMethod?: string,
    discountAmount: number = 0,
    notes?: string
  ) {
    const db = getDb();

    try {
      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;

      for (const item of items) {
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const itemTotal = roundMoney2(item.unitPrice * item.quantity);
        subtotal += itemTotal;

        if (product.isTaxable) {
          // Get merchant VAT rate
          const merchant = await db.query.merchants.findFirst({
            where: eq(schema.merchants.id, merchantId),
          });

          const vatRate = merchant?.vatRate ? parseFloat(merchant.vatRate.toString()) : 0;
          taxAmount += roundMoney2((itemTotal * vatRate) / 100);
        }
      }

      subtotal = roundMoney2(subtotal);
      taxAmount = roundMoney2(taxAmount);
      discountAmount = roundMoney2(discountAmount);
      const total = roundTo005(subtotal + taxAmount - discountAmount);

      // Create order
      const orderNumber = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const order = await db
        .insert(schema.orders)
        .values({
          merchantId,
          orderNumber,
          customerId,
          orderType,
          status: "pending",
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod,
          paymentStatus: "pending",
          notes,
        })
        .returning();

      // Create order items
      for (const item of items) {
        const itemTotal = item.unitPrice * item.quantity;

        await db.insert(schema.orderItems).values({
          orderId: order[0].id,
          productId: item.productId,
          productName: undefined,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: itemTotal.toString(),
          taxAmount: (itemTotal * 0.1).toString(), // Simplified tax
        });

        // Update product stock
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        if (product) {
          await db
            .update(schema.products)
            .set({ stock: product.stock - item.quantity })
            .where(eq(schema.products.id, item.productId));
        }
      }

      return order[0];
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  /**
   * Get all orders for merchant
   */
  static async getOrders(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.orders.merchantId, merchantId)];

      if (status) {
        whereConditions.push(eq(schema.orders.status, status));
      }

      if (startDate && endDate) {
        whereConditions.push(gte(schema.orders.createdAt, startDate));
        whereConditions.push(lte(schema.orders.createdAt, endDate));
      }

      const orders = await db.query.orders.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          items: {
            with: {
              product: true,
            },
          },
          customer: true,
        },
        limit,
        offset,
        orderBy: desc(schema.orders.createdAt),
      });

      return orders;
    } catch (error) {
      console.error("Error getting orders:", error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  static async getOrderById(merchantId: string, orderId: string) {
    const db = getDb();

    try {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.merchantId, merchantId)
        ),
        with: {
          items: {
            with: {
              product: true,
            },
          },
          customer: true,
          paymentTransactions: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      return order;
    } catch (error) {
      console.error("Error getting order:", error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    merchantId: string,
    orderId: string,
    status: string
  ) {
    const db = getDb();

    try {
      const updates: Record<string, unknown> = { status };

      if (status === "completed") {
        updates.completedAt = new Date();
      }

      const order = await db
        .update(schema.orders)
        .set(updates)
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.merchantId, merchantId)
          )
        )
        .returning();

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      return order[0];
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  }

  /**
   * Online / POS lifecycle actions for web_shop (and optionally POS) orders.
   *
   * Flow:
   *  pending|pending_approval → accept → preparing (ASAP) or accepted (scheduled)
   *  accepted → start_preparing → preparing
   *  preparing → mark_ready → ready
   *  ready + delivery → out_for_delivery
   *  collect_payment → paymentStatus completed
   *  complete → completed (pickup/dine_in from ready; delivery from out_for_delivery)
   *  reject → cancelled
   */
  static async applyOrderAction(
    merchantId: string,
    orderId: string,
    action: string
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");

    const status = order.status || "pending";
    const channel = order.fulfillmentChannel || "takeaway";
    const awaitingApproval = status === "pending" || status === "pending_approval";
    const paymentDone =
      order.paymentStatus === "completed" || order.paymentStatus === "paid";
    const isCash =
      order.paymentMethod === "cash" ||
      order.paymentMethod === "pay_later" ||
      order.paymentMethod === "pay-later" ||
      order.paymentStatus === "cash" ||
      order.paymentStatus === "awaiting_payment";

    const set = async (patch: Record<string, unknown>) => {
      const [updated] = await db
        .update(schema.orders)
        .set(patch)
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)))
        .returning();
      return updated;
    };

    switch (action) {
      case "accept": {
        if (!awaitingApproval) throw new Error("Order is not awaiting approval");
        // ASAP → kitchen starts immediately; scheduled → accepted until prep time
        const asap = !order.scheduledFor;
        return set({ status: asap ? "preparing" : "accepted" });
      }
      case "start_preparing": {
        if (status !== "accepted" && !awaitingApproval) {
          throw new Error("Order cannot start preparing from current status");
        }
        return set({ status: "preparing" });
      }
      case "mark_ready": {
        if (status !== "preparing" && status !== "accepted") {
          throw new Error("Order is not being prepared");
        }
        return set({ status: "ready" });
      }
      case "out_for_delivery": {
        if (channel !== "delivery") throw new Error("Only delivery orders can go out for delivery");
        if (status !== "ready") throw new Error("Order must be ready before delivery");
        return set({ status: "out_for_delivery" });
      }
      case "collect_payment": {
        if (paymentDone) throw new Error("Payment already completed");
        return set({
          paymentStatus: "completed",
          paymentMethod: order.paymentMethod || "cash",
        });
      }
      case "complete": {
        if (channel === "delivery") {
          if (status !== "out_for_delivery" && status !== "ready") {
            throw new Error("Delivery order must be out for delivery (or ready) to complete");
          }
        } else if (status !== "ready" && status !== "preparing") {
          throw new Error("Order must be ready to complete");
        }
        // Cash / pay-later: require payment collection first (unless already paid)
        if (!paymentDone && isCash) {
          throw new Error("Collect payment before completing this order");
        }
        return set({ status: "completed", completedAt: new Date() });
      }
      case "complete_and_collect": {
        // Convenience for pickup cash / pay-later programmed orders
        if (
          status !== "ready" &&
          status !== "out_for_delivery" &&
          status !== "preparing" &&
          status !== "accepted"
        ) {
          throw new Error("Order is not ready to complete");
        }
        return set({
          status: "completed",
          paymentStatus: "completed",
          paymentMethod:
            order.paymentMethod === "pay_later" || order.paymentMethod === "pay-later"
              ? "cash"
              : order.paymentMethod || "cash",
          completedAt: new Date(),
        });
      }
      case "reject":
      case "cancel": {
        if (status === "completed") throw new Error("Cannot cancel a completed order");
        return set({ status: "cancelled" });
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    merchantId: string,
    orderId: string,
    paymentStatus: "pending" | "completed" | "failed"
  ) {
    const db = getDb();

    try {
      const order = await db
        .update(schema.orders)
        .set({ paymentStatus })
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.merchantId, merchantId)
          )
        )
        .returning();

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      return order[0];
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw error;
    }
  }

  /**
   * Get daily sales
   */
  static async getDailySales(merchantId: string, date: Date) {
    const db = getDb();

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.status, "completed"),
          gte(schema.orders.createdAt, startOfDay),
          lte(schema.orders.createdAt, endOfDay)
        ),
      });

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
      const totalTax = orders.reduce((sum, order) => sum + parseFloat(order.taxAmount.toString()), 0);
      const totalDiscount = orders.reduce((sum, order) => sum + parseFloat(order.discountAmount.toString()), 0);

      return {
        date,
        orderCount: orders.length,
        totalRevenue,
        totalTax,
        totalDiscount,
        netRevenue: totalRevenue - totalDiscount,
      };
    } catch (error) {
      console.error("Error getting daily sales:", error);
      throw error;
    }
  }

  /**
   * Get sales by payment method
   */
  static async getSalesByPaymentMethod(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      let whereConditions: any[] = [
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.status, "completed"),
      ];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.orders.createdAt, startDate));
        whereConditions.push(lte(schema.orders.createdAt, endDate));
      }

      const orders = await db.query.orders.findMany({
        where: and(...whereConditions),
      });

      const breakdown: Record<string, number> = {};

      orders.forEach((order) => {
        const method = order.paymentMethod || "unknown";
        breakdown[method] = (breakdown[method] || 0) + parseFloat(order.total.toString());
      });

      return breakdown;
    } catch (error) {
      console.error("Error getting sales by payment method:", error);
      throw error;
    }
  }

  /**
   * Cancel order and restore stock
   */
  static async cancelOrder(merchantId: string, orderId: string) {
    const db = getDb();

    try {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.merchantId, merchantId)
        ),
        with: {
          items: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Restore stock
      for (const item of order.items) {
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, item.productId),
        });

        if (product) {
          await db
            .update(schema.products)
            .set({ stock: product.stock + item.quantity })
            .where(eq(schema.products.id, item.productId));
        }
      }

      // Update order status
      const updatedOrder = await db
        .update(schema.orders)
        .set({ status: "cancelled" })
        .where(eq(schema.orders.id, orderId))
        .returning();

      return updatedOrder[0];
    } catch (error) {
      console.error("Error cancelling order:", error);
      throw error;
    }
  }
}
