import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { SyncService } from "@/services/sync.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/sync/pull?since=ISO
 * Pull catalog + terminals for offline POS.
 */
router.get("/pull", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;
    const data = await SyncService.pullCatalog(merchantId, since);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Sync pull failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Sync pull failed" });
  }
});

/**
 * POST /api/sync/push-catalog
 * Push offline-created categories/products.
 */
router.post("/push-catalog", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const maps = await SyncService.pushCatalog(merchantId, req.body || {});
    res.json({ success: true, ...maps });
  } catch (error) {
    console.error("Sync push-catalog failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Sync push failed" });
  }
});

/**
 * POST /api/sync/push-sales
 * Push offline sales/orders (idempotent by clientId).
 */
router.post("/push-sales", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const sales = Array.isArray(req.body?.sales) ? req.body.sales : [];
    const result = await SyncService.pushSales(merchantId, sales);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Sync push-sales failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Sync sales failed" });
  }
});

export default router;
