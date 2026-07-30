import { getDb, schema } from "@/db";
import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { POS_CANCEL_REASONS } from "@/lib/pos-print-settings";
import { roundMoney2 } from "@/lib/money";

export class PosOrdersService {
  static cancelReasons() {
    return POS_CANCEL_REASONS;
  }

  static async listPosOrders(
    merchantId: string,
    opts: {
      status?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {}
  ) {
    const db = getDb();
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const conditions = [
      eq(schema.orders.merchantId, merchantId),
      eq(schema.orders.orderType, "pos"),
    ];

    if (opts.status && opts.status !== "all") {
      conditions.push(eq(schema.orders.status, opts.status));
    }
    if (opts.from) {
      conditions.push(gte(schema.orders.createdAt, new Date(`${opts.from}T00:00:00`)));
    }
    if (opts.to) {
      conditions.push(lte(schema.orders.createdAt, new Date(`${opts.to}T23:59:59.999`)));
    }

    const rows = await db.query.orders.findMany({
      where: and(...conditions),
      with: { items: true },
      orderBy: [desc(schema.orders.createdAt)],
      limit,
    });

    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      clientId: o.clientId,
      status: o.status,
      channel: o.fulfillmentChannel,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      subtotal: Number(o.subtotal),
      taxAmount: Number(o.taxAmount),
      total: Number(o.total),
      refundAmount: Number(o.refundAmount || 0),
      cancelReason: o.cancelReason,
      cancelledAt: o.cancelledAt,
      refundedAt: o.refundedAt,
      notes: o.notes,
      tableLabel: o.tableLabel,
      guestCount: o.guestCount,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      items: (o.items || []).map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.productName,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        selectedExtras: i.selectedExtras || [],
        comboSelections: i.comboSelections || [],
      })),
    }));
  }

  static async cancelOrder(merchantId: string, orderId: string, reason: string) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Order already cancelled");
    if (order.status === "refunded") throw new Error("Order already refunded");

    const reasonText = String(reason || "").trim().slice(0, 500);
    if (!reasonText) throw new Error("Cancel reason is required");

    const [updated] = await db
      .update(schema.orders)
      .set({
        status: "cancelled",
        paymentStatus: "cancelled",
        cancelReason: reasonText,
        cancelledAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  }

  static async refundOrder(
    merchantId: string,
    orderId: string,
    amount?: number
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Cannot refund a cancelled order");

    const total = Number(order.total) || 0;
    const already = Number(order.refundAmount || 0) || 0;
    const remaining = roundMoney2(total - already);
    if (remaining <= 0) throw new Error("Nothing left to refund");

    const refund = amount != null ? roundMoney2(Number(amount)) : remaining;
    if (!Number.isFinite(refund) || refund <= 0) throw new Error("Invalid refund amount");
    if (refund > remaining + 0.001) throw new Error("Refund exceeds remaining amount");

    const newRefundTotal = roundMoney2(already + refund);
    const fully = newRefundTotal >= total - 0.001;

    const [updated] = await db
      .update(schema.orders)
      .set({
        refundAmount: newRefundTotal.toFixed(2),
        refundedAt: new Date(),
        status: fully ? "refunded" : "partially_refunded",
        paymentStatus: fully ? "refunded" : "partially_refunded",
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return { order: updated, refunded: refund, refundTotal: newRefundTotal };
  }

  static async listHeld(merchantId: string) {
    const db = getDb();
    return db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, ["held", "sent_to_kitchen"])
      ),
      orderBy: [desc(schema.heldOrders.updatedAt)],
    });
  }

  static async holdOrder(
    merchantId: string,
    body: {
      label?: string;
      channel?: string;
      cartJson: unknown;
      notes?: string;
      staffId?: string;
      staffName?: string;
      sendToKitchen?: boolean;
    }
  ) {
    const db = getDb();
    if (body.cartJson == null) throw new Error("cartJson is required");
    const [row] = await db
      .insert(schema.heldOrders)
      .values({
        merchantId,
        label: (body.label || "").trim().slice(0, 120) || null,
        status: body.sendToKitchen ? "sent_to_kitchen" : "held",
        channel: body.channel || "takeaway",
        cartJson: body.cartJson,
        notes: body.notes || null,
        staffId: body.staffId || null,
        staffName: body.staffName || null,
      })
      .returning();
    return row;
  }

  static async deleteHeld(merchantId: string, id: string) {
    const db = getDb();
    const existing = await db.query.heldOrders.findFirst({
      where: and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Held order not found");
    await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
    return { ok: true };
  }

  static async resumeHeld(merchantId: string, id: string) {
    const db = getDb();
    const existing = await db.query.heldOrders.findFirst({
      where: and(eq(schema.heldOrders.id, id), eq(schema.heldOrders.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Held order not found");
    await db.delete(schema.heldOrders).where(eq(schema.heldOrders.id, id));
    return existing;
  }
}
