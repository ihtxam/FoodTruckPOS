import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";

const router = Router();

router.use(requireChaslayApiKey);

router.get("/bootstrap", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.syncBootstrap(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Bootstrap failed" });
  }
});

router.get("/menu", async (req: Request, res: Response) => {
  try {
    const since = Number(req.query.since || 0);
    const data = await ChaslayCompatService.syncMenuChanges(req.chaslayMerchantId!, since);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Menu sync failed" });
  }
});

router.get("/payment-config", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.getPaymentConfig(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Payment config sync failed" });
  }
});

router.post("/terminals", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.pushTerminalsFromDevice(req.chaslayMerchantId!, req.body || {});
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Terminal sync failed" });
  }
});

export default router;
