import { Router, Request, Response } from "express";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";

const router = Router();

router.post("/activate", async (req: Request, res: Response) => {
  try {
    const { deviceId, activationCode, appVersion, deviceModel, tenantSlug } = req.body ?? {};
    if (!deviceId || !activationCode) {
      return res.status(400).json({ error: "deviceId and activationCode are required" });
    }
    const result = await ChaslayCompatService.activateLicense({
      deviceId,
      activationCode,
      appVersion,
      deviceModel,
      tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Activation failed" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { deviceId, appVersion, tenantSlug } = req.body ?? {};
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    const result = await ChaslayCompatService.validateLicense({
      deviceId,
      appVersion,
      tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
    });
    res.json(result);
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "Validation failed" });
  }
});

export default router;
