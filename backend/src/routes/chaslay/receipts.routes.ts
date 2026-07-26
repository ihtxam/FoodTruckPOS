import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";
import { SyncService } from "@/services/sync.service";

const router = Router();

router.post("/", requireChaslayApiKey, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const id = String(body.id || body.transaction_number || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? body.total ?? 0);
    const taxTotal = Number(body.tax_total ?? 0);
    const total = Number(body.total ?? subtotal + taxTotal);

    await SyncService.pushSales(req.chaslayMerchantId!, [
      {
        clientId: id,
        paymentMethod: String(body.payment_method || "cash"),
        paymentStatus: "completed",
        subtotal,
        taxAmount: taxTotal,
        total,
        completedAt: body.created_at || Date.now(),
        items: items.map((item: any) => ({
          productName: item.product_name || item.productName || "Item",
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
          totalPrice: Number(item.line_total ?? item.lineTotal ?? 0),
        })),
      },
    ]);

    const url = ChaslayCompatService.receiptPublicUrl(id);
    res.status(201).json({ id, url });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Receipt publish failed" });
  }
});

router.post("/:id/email", requireChaslayApiKey, async (_req: Request, res: Response) => {
  res.json({ success: true, message: "Receipt email queued" });
});

export default router;
