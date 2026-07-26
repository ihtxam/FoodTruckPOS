import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayFloorService } from "@/services/chaslay-floor.service";

const router = Router();

router.use(requireChaslayApiKey);

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceName, role, lanHost, appVersion } = req.body ?? {};
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId required" });
    }
    const data = await ChaslayFloorService.registerDevice(req.chaslayMerchantId!, {
      deviceId,
      deviceName,
      role,
      lanHost,
      appVersion,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Register failed" });
  }
});

router.get("/main-pos", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayFloorService.getMainPos(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Main POS lookup failed" });
  }
});

router.get("/orders", async (req: Request, res: Response) => {
  try {
    const since = Number(req.query.since || 0);
    const data = await ChaslayFloorService.listOrders(req.chaslayMerchantId!, since);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Orders fetch failed" });
  }
});

router.put("/orders/:localOrderId", async (req: Request, res: Response) => {
  try {
    const localOrderId = req.params.localOrderId;
    if (!localOrderId) {
      return res.status(400).json({ error: "localOrderId required" });
    }
    const data = await ChaslayFloorService.upsertOrder(
      req.chaslayMerchantId!,
      localOrderId,
      req.body ?? {}
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Order upsert failed" });
  }
});

router.post("/print-jobs", async (req: Request, res: Response) => {
  try {
    const { jobType, payload, sourceDeviceId, orderId } = req.body ?? {};
    if (!jobType || !payload) {
      return res.status(400).json({ error: "jobType and payload required" });
    }
    const data = await ChaslayFloorService.createPrintJob(req.chaslayMerchantId!, {
      jobType,
      payload,
      sourceDeviceId,
      orderId,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Print job create failed" });
  }
});

router.get("/print-jobs/pending", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const data = await ChaslayFloorService.listPendingPrintJobs(req.chaslayMerchantId!, limit);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Print jobs fetch failed" });
  }
});

router.post("/print-jobs/:id/ack", async (req: Request, res: Response) => {
  try {
    const status = req.body?.status === "FAILED" ? "FAILED" : "DONE";
    const data = await ChaslayFloorService.ackPrintJob(
      req.chaslayMerchantId!,
      req.params.id,
      status
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Ack failed" });
  }
});

export default router;
