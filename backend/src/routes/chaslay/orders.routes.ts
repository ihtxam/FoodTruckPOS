import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";

const router = Router();

router.get("/incoming", requireChaslayApiKey, async (req: Request, res: Response) => {
  try {
    const since = Number(req.query.since || 0);
    const data = await ChaslayCompatService.incomingOrders(req.chaslayMerchantId!, since);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Incoming orders failed" });
  }
});

router.post("/:id/ack", requireChaslayApiKey, async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.ackOrder(req.chaslayMerchantId!, req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Ack failed" });
  }
});

export default router;
