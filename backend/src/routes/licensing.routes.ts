import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { LicensingService } from "@/services/licensing.service";

const router = Router();

/**
 * POST /api/licensing/device/register
 * Register a new device and create trial license
 */
router.post("/device/register", verifyToken, requireMerchant, setMerchantContext, async (req: Request, res: Response) => {
  try {
    const { deviceName, deviceType, osVersion, appVersion } = req.body;
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!deviceName || !deviceType) {
      return res.status(400).json({ error: "Device name and type are required" });
    }

    const result = await LicensingService.registerDevice(
      merchantId,
      deviceName,
      deviceType,
      osVersion,
      appVersion
    );

    res.json({
      success: true,
      device: result.device,
      license: result.license,
    });
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to register device" });
  }
});

/**
 * POST /api/licensing/activate
 * Activate a license with license code
 */
router.post("/activate", verifyToken, requireMerchant, setMerchantContext, async (req: Request, res: Response) => {
  try {
    const { deviceId, licenseCode } = req.body;
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!deviceId || !licenseCode) {
      return res.status(400).json({ error: "Device ID and license code are required" });
    }

    const result = await LicensingService.activateLicense(merchantId, deviceId, licenseCode);

    res.json(result);
  } catch (error) {
    console.error("Error activating license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to activate license" });
  }
});

/**
 * GET /api/licensing/status
 * Check license status for current device
 */
router.get("/status", verifyToken, requireMerchant, setMerchantContext, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    const status = await LicensingService.checkLicenseStatus(merchantId, deviceId as string);

    res.json(status);
  } catch (error) {
    console.error("Error checking license status:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check license status" });
  }
});

/**
 * POST /api/licensing/renew
 * Generate renewal license
 */
router.post("/renew", verifyToken, requireMerchant, setMerchantContext, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    const result = await LicensingService.generateRenewalLicense(merchantId, deviceId);

    res.json(result);
  } catch (error) {
    console.error("Error generating renewal license:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate renewal license" });
  }
});

/**
 * GET /api/licensing/licenses
 * Get all licenses for merchant
 */
router.get("/licenses", verifyToken, requireMerchant, setMerchantContext, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const licenses = await LicensingService.getMerchantLicenses(merchantId);

    res.json({
      success: true,
      licenses,
    });
  } catch (error) {
    console.error("Error getting licenses:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get licenses" });
  }
});

export default router;
