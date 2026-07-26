import { getDb, schema } from "@/db";
import { eq, and, desc, asc, gt, or, like, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { MerchantSettingsService, type FulfillmentChannel } from "@/services/merchant-settings.service";

export class WebShopService {
  /**
   * Get public merchant shop info
   */
  static async getShopInfo(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      return {
        id: merchant.id,
        name: merchant.name,
        address: merchant.address,
        city: merchant.city,
        country: merchant.country,
        phone: merchant.phone,
        email: merchant.email,
      };
    } catch (error) {
      console.error("Error getting shop info:", error);
      throw error;
    }
  }

  /**
   * Get public products for web shop
   */
  static async getPublicProducts(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    categoryId?: string,
    search?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [
        eq(schema.products.merchantId, merchantId),
        gt(schema.products.stock, 0), // Only show in-stock products
      ];

      if (categoryId) {
        whereConditions.push(eq(schema.products.categoryId, categoryId));
      }

      if (search) {
        whereConditions.push(
          or(
            like(schema.products.name, `%${search}%`),
            like(schema.products.description, `%${search}%`)
          )
        );
      }

      const products = await db.query.products.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          category: true,
        },
        limit,
        offset,
        orderBy: [asc(schema.products.sortOrder), desc(schema.products.createdAt)],
      });

      return products;
    } catch (error) {
      console.error("Error getting public products:", error);
      throw error;
    }
  }

  /**
   * Get public categories
   */
  static async getPublicCategories(merchantId: string) {
    const db = getDb();

    try {
      const categories = await db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchantId),
        orderBy: [asc(schema.categories.sortOrder), desc(schema.categories.createdAt)],
      });

      return categories;
    } catch (error) {
      console.error("Error getting public categories:", error);
      throw error;
    }
  }

  /**
   * Create web shop order
   */
  static async createWebShopOrder(
    merchantId: string,
    items: Array<{ productId: string; quantity: number }>,
    customerEmail: string,
    customerPhone?: string,
    customerName?: string,
    shippingAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    },
    notes?: string,
    fulfillmentChannel: FulfillmentChannel = "delivery"
  ) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      if (!merchant) throw new Error("Merchant not found");

      const taxRate = MerchantSettingsService.channelTaxRate(merchant, fulfillmentChannel);
      let subtotal = 0;
      let taxAmount = 0;
      const orderItems: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        taxAmount: number;
      }> = [];

      for (const item of items) {
        const product = await db.query.products.findFirst({
          where: and(
            eq(schema.products.id, item.productId),
            eq(schema.products.merchantId, merchantId)
          ),
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        const unitPrice = parseFloat(product.price.toString());
        const itemTotal = unitPrice * item.quantity;
        const lineTax = product.isTaxable ? (itemTotal * taxRate) / 100 : 0;

        subtotal += itemTotal;
        taxAmount += lineTax;

        orderItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice: itemTotal,
          taxAmount: lineTax,
        });
      }

      const total = subtotal + taxAmount;

      let customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.merchantId, merchantId),
          eq(schema.customers.email, customerEmail)
        ),
      });

      if (!customer) {
        const newCustomer = await db
          .insert(schema.customers)
          .values({
            merchantId,
            email: customerEmail,
            phone: customerPhone,
            firstName: customerName?.split(" ")[0],
            lastName: customerName?.split(" ").slice(1).join(" ") || undefined,
            loyaltyPoints: 0,
            totalSpent: "0",
          })
          .returning();

        customer = newCustomer[0];
      }

      const orderNumber = `WEB-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const order = await db
        .insert(schema.orders)
        .values({
          merchantId,
          orderNumber,
          customerId: customer.id,
          orderType: "web_shop",
          fulfillmentChannel,
          status: "pending",
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: "0",
          total: total.toFixed(2),
          paymentMethod: "online",
          paymentStatus: "pending",
          notes,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
        })
        .returning();

      for (const item of orderItems) {
        await db.insert(schema.orderItems).values({
          orderId: order[0].id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toFixed(2),
          totalPrice: item.totalPrice.toFixed(2),
          taxAmount: item.taxAmount.toFixed(2),
        });
      }

      return order[0];
    } catch (error) {
      console.error("Error creating web shop order:", error);
      throw error;
    }
  }

  /**
   * Get web shop orders
   */
  static async getWebShopOrders(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.orderType, "web_shop"),
      ];

      if (status) {
        whereConditions.push(eq(schema.orders.status, status));
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
      console.error("Error getting web shop orders:", error);
      throw error;
    }
  }

  /**
   * Update order shipping status
   */
  static async updateShippingStatus(
    merchantId: string,
    orderId: string,
    shippingStatus: "pending" | "processing" | "shipped" | "delivered"
  ) {
    const db = getDb();

    try {
      // Map shipping status onto order status for POS visibility
      const statusMap: Record<string, string> = {
        pending: "pending",
        processing: "pending",
        shipped: "completed",
        delivered: "completed",
      };
      const order = await db
        .update(schema.orders)
        .set({
          status: statusMap[shippingStatus] || "pending",
          notes: `shipping:${shippingStatus}`,
          completedAt: shippingStatus === "delivered" || shippingStatus === "shipped" ? new Date() : undefined,
        })
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
      console.error("Error updating shipping status:", error);
      throw error;
    }
  }

  /**
   * Get web shop analytics
   */
  static async getWebShopAnalytics(merchantId: string, startDate?: Date, endDate?: Date) {
    const db = getDb();

    try {
      let whereConditions: any[] = [
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.orderType, "web_shop"),
      ];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.orders.createdAt, startDate));
        whereConditions.push(lte(schema.orders.createdAt, endDate));
      }

      const orders = await db.query.orders.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total.toString()), 0);
      const completedOrders = orders.filter((o) => o.status === "completed").length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const byStatus = orders.reduce(
        (acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalOrders,
        completedOrders,
        totalRevenue,
        averageOrderValue,
        byStatus,
      };
    } catch (error) {
      console.error("Error getting web shop analytics:", error);
      throw error;
    }
  }

  /**
   * Sync web shop order to POS
   */
  static async syncOrderToPOS(merchantId: string, orderId: string) {
    const db = getDb();

    try {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.orderType, "web_shop")
        ),
        with: {
          items: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Mark as synced
      const syncedOrder = await db
        .update(schema.orders)
        .set({
          syncedToPOS: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId))
        .returning();

      return syncedOrder[0];
    } catch (error) {
      console.error("Error syncing order to POS:", error);
      throw error;
    }
  }
}
