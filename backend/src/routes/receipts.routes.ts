import { Router, Request, Response } from "express";
import { getDb, schema } from "@/db";
import { eq, or } from "drizzle-orm";

const router = Router();

/**
 * GET /api/receipts/:ref
 * Public digital receipt lookup by order UUID, orderNumber, or POS clientId.
 */
router.get("/:ref", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref || "").trim();
    if (!ref || ref.length > 120) {
      return res.status(400).json({ error: "Invalid receipt reference" });
    }

    const db = getDb();
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);

    const order = await db.query.orders.findFirst({
      where: looksLikeUuid
        ? or(
            eq(schema.orders.id, ref),
            eq(schema.orders.orderNumber, ref),
            eq(schema.orders.clientId, ref)
          )
        : or(eq(schema.orders.orderNumber, ref), eq(schema.orders.clientId, ref)),
      with: {
        items: true,
        merchant: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json({
      success: true,
      receipt: {
        id: order.id,
        clientId: order.clientId,
        orderNumber: order.orderNumber,
        businessName: order.merchant?.name,
        address: [order.merchant?.address, order.merchant?.city].filter(Boolean).join(", "),
        phone: order.merchant?.phone,
        channel: order.fulfillmentChannel,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        discountAmount: order.discountAmount,
        total: order.total,
        tipAmount: order.tipAmount,
        tableLabel: order.tableLabel,
        guestCount: order.guestCount,
        notes: order.notes,
        completedAt: order.completedAt || order.createdAt,
        items: (order.items || []).map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.totalPrice,
          seatNumber: (i as any).seatNumber ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("Error loading receipt:", error);
    res.status(500).json({ error: "Failed to load receipt" });
  }
});

export default router;
