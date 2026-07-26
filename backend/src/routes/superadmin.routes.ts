import { Router, Request, Response } from "express";
import { verifyToken, requireSuperadmin } from "@/middleware/auth.middleware";
import { MerchantService } from "@/services/merchant.service";
import { LicenseAdminService } from "@/services/license-admin.service";
import { AnalyticsService } from "@/services/analytics.service";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";
import { PlatformSettingsService } from "@/services/platform-settings.service";
import { getDb, schema } from "@/db";
import { desc } from "drizzle-orm";

const router = Router();

// Apply superadmin middleware to all routes
router.use(verifyToken);
router.use(requireSuperadmin);

// ============================================================================
// MERCHANT MANAGEMENT
// ============================================================================

/**
 * GET /api/superadmin/merchants
 * Get all merchants with pagination
 */
router.get("/merchants", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const merchants = await MerchantService.getAllMerchants(page, limit, search);

    res.json({
      success: true,
      merchants,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting merchants:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get merchants" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId
 * Get merchant details
 */
router.get("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const merchant = await MerchantService.getMerchantById(merchantId);

    res.json({
      success: true,
      merchant,
    });
  } catch (error) {
    console.error("Error getting merchant:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Merchant not found" });
  }
});

/**
 * POST /api/superadmin/merchants
 * Create new merchant (+ optional device license seats)
 */
router.post("/merchants", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      businessName,
      contactName,
      phone,
      address,
      city,
      country,
      slug,
      shopEnabled,
      subscriptionPlan,
      status,
      deviceSeats,
      licenseType,
      customDays,
    } = req.body;

    if (!email || !password || !businessName) {
      return res.status(400).json({ error: "Email, password, and business name are required" });
    }

    const merchant = await MerchantService.createMerchant(
      email,
      password,
      businessName,
      contactName,
      phone,
      address,
      city,
      country,
      {
        slug,
        shopEnabled,
        subscriptionPlan,
        status,
        deviceSeats: deviceSeats != null ? Number(deviceSeats) : 0,
        licenseType,
        customDays: customDays != null ? Number(customDays) : undefined,
      }
    );

    res.status(201).json({
      success: true,
      message: "Merchant created successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error creating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
  }
});

/**
 * DELETE /api/superadmin/merchants/:merchantId
 * Soft-delete (suspend) merchant
 */
router.delete("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const merchant = await MerchantService.deleteMerchant(merchantId);
    res.json({ success: true, message: "Merchant deleted (suspended)", merchant });
  } catch (error) {
    console.error("Error deleting merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete merchant" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId/devices
 * List devices for a merchant
 */
router.get("/merchants/:merchantId/devices", async (req: Request, res: Response) => {
  try {
    const devices = await LicenseAdminService.getMerchantDevices(req.params.merchantId);
    res.json({ success: true, devices });
  } catch (error) {
    console.error("Error listing devices:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list devices" });
  }
});

/**
 * PUT /api/superadmin/merchants/:merchantId
 * Update merchant details
 */
router.put("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const updates = req.body;

    const merchant = await MerchantService.updateMerchant(merchantId, updates);

    res.json({
      success: true,
      message: "Merchant updated successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error updating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update merchant" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/suspend
 * Suspend merchant account
 */
router.post("/merchants/:merchantId/suspend", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { reason } = req.body;

    const merchant = await MerchantService.suspendMerchant(merchantId, reason);

    res.json({
      success: true,
      message: "Merchant suspended successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error suspending merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to suspend merchant" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/reactivate
 * Reactivate merchant account
 */
router.post("/merchants/:merchantId/reactivate", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const merchant = await MerchantService.reactivateMerchant(merchantId);

    res.json({
      success: true,
      message: "Merchant reactivated successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error reactivating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reactivate merchant" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId/analytics
 * Get merchant analytics
 */
router.get("/merchants/:merchantId/analytics", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const analytics = await MerchantService.getMerchantAnalytics(merchantId);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting merchant analytics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/upgrade
 * Upgrade merchant subscription
 */
router.post("/merchants/:merchantId/upgrade", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { plan } = req.body;

    if (!plan || !["starter", "professional", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "Invalid subscription plan" });
    }

    const merchant = await MerchantService.upgradeMerchantSubscription(merchantId, plan);

    res.json({
      success: true,
      message: "Subscription upgraded successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upgrade subscription" });
  }
});

// ============================================================================
// LICENSE MANAGEMENT
// ============================================================================

/**
 * GET /api/superadmin/licenses/statistics
 * Get license statistics (must be before :licenseId)
 */
router.get("/licenses/statistics", async (_req: Request, res: Response) => {
  try {
    const stats = await LicenseAdminService.getLicenseStatistics();
    res.json({ success: true, statistics: stats });
  } catch (error) {
    console.error("Error getting license statistics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
  }
});

/**
 * GET /api/superadmin/licenses/expiring-soon
 * Get licenses expiring soon (must be before :licenseId)
 */
router.get("/licenses/expiring-soon", async (req: Request, res: Response) => {
  try {
    const daysThreshold = parseInt(req.query.days as string) || 35;
    const licenses = await LicenseAdminService.getLicensesExpiringSoon(daysThreshold);
    res.json({ success: true, licenses, threshold: `${daysThreshold} days` });
  } catch (error) {
    console.error("Error getting expiring licenses:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get expiring licenses" });
  }
});

/**
 * POST /api/superadmin/licenses/generate
 * Generate license for an existing device
 */
router.post("/licenses/generate", async (req: Request, res: Response) => {
  try {
    const { merchantId, deviceId, licenseType, customDays } = req.body;

    if (!merchantId || !deviceId) {
      return res.status(400).json({ error: "Merchant ID and device ID are required" });
    }

    const result = await LicenseAdminService.generateLicenseForMerchant(
      merchantId,
      deviceId,
      licenseType || "yearly",
      customDays
    );

    res.json(result);
  } catch (error) {
    console.error("Error generating license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to generate license" });
  }
});

/**
 * POST /api/superadmin/licenses/issue-seats
 * Create placeholder POS devices + license keys for a merchant
 */
router.post("/licenses/issue-seats", async (req: Request, res: Response) => {
  try {
    const { merchantId, seats, licenseType, customDays, deviceType } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const issued = await LicenseAdminService.issueDeviceSeats(
      merchantId,
      Number(seats) || 1,
      licenseType || "yearly",
      customDays != null ? Number(customDays) : undefined,
      deviceType || "tablet"
    );

    res.status(201).json({
      success: true,
      message: `Issued ${issued.length} device license(s)`,
      licenses: issued,
    });
  } catch (error) {
    console.error("Error issuing seats:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue licenses" });
  }
});

/**
 * POST /api/superadmin/licenses/issue-for-device
 * Issue activation code bound to the Android POS device ID (shown in the app)
 */
router.post("/licenses/issue-for-device", async (req: Request, res: Response) => {
  try {
    const { merchantId, posDeviceId, deviceId, licenseType, customDays, deviceType } = req.body;
    const androidId = posDeviceId || deviceId;
    if (!merchantId || !androidId) {
      return res.status(400).json({ error: "merchantId and posDeviceId (from POS app) are required" });
    }

    const issued = await LicenseAdminService.issueForPosDeviceId(
      merchantId,
      String(androidId),
      licenseType || "yearly",
      customDays != null ? Number(customDays) : undefined,
      deviceType || "tablet"
    );

    res.status(201).json({
      success: true,
      message: issued.reused
        ? "Existing active license for this device"
        : "Activation code issued for device",
      license: issued,
      licenses: [issued],
    });
  } catch (error) {
    console.error("Error issuing device license:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to issue device license",
    });
  }
});

/**
 * GET /api/superadmin/licenses
 * Get all licenses
 */
router.get("/licenses", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const merchantId = req.query.merchantId as string;

    const licenses = await LicenseAdminService.getAllLicenses(page, limit, status, merchantId);

    res.json({
      success: true,
      licenses,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting licenses:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get licenses" });
  }
});

/**
 * GET /api/superadmin/licenses/:licenseId
 * Get license details
 */
router.get("/licenses/:licenseId", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const license = await LicenseAdminService.getLicenseDetails(licenseId);
    res.json({ success: true, license });
  } catch (error) {
    console.error("Error getting license:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "License not found" });
  }
});

/**
 * POST /api/superadmin/licenses/:licenseId/revoke
 * Revoke license
 */
router.post("/licenses/:licenseId/revoke", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const license = await LicenseAdminService.revokeLicense(licenseId);
    res.json({ success: true, message: "License revoked successfully", license });
  } catch (error) {
    console.error("Error revoking license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to revoke license" });
  }
});

/**
 * POST /api/superadmin/licenses/:licenseId/extend
 * Extend license expiry
 */
router.post("/licenses/:licenseId/extend", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      return res.status(400).json({ error: "Additional days must be greater than 0" });
    }

    const license = await LicenseAdminService.extendLicense(licenseId, additionalDays);
    res.json({ success: true, message: "License extended successfully", license });
  } catch (error) {
    console.error("Error extending license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to extend license" });
  }
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /api/superadmin/analytics/overview
 * Get platform overview
 */
router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const overview = await AnalyticsService.getPlatformOverview();

    res.json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error("Error getting overview:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get overview" });
  }
});

/**
 * GET /api/superadmin/analytics/revenue
 * Get revenue analytics
 */
router.get("/analytics/revenue", async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const analytics = await AnalyticsService.getRevenueAnalytics(startDate, endDate);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting revenue analytics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
  }
});

/**
 * GET /api/superadmin/analytics/top-merchants
 * Get top merchants by revenue
 */
router.get("/analytics/top-merchants", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const merchants = await AnalyticsService.getTopMerchantsByRevenue(limit);

    res.json({
      success: true,
      merchants,
    });
  } catch (error) {
    console.error("Error getting top merchants:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get top merchants" });
  }
});

/**
 * GET /api/superadmin/analytics/subscription-distribution
 * Get subscription plan distribution
 */
router.get("/analytics/subscription-distribution", async (req: Request, res: Response) => {
  try {
    const distribution = await AnalyticsService.getSubscriptionDistribution();

    res.json({
      success: true,
      distribution,
    });
  } catch (error) {
    console.error("Error getting subscription distribution:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get distribution" });
  }
});

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlansService.listAll(true);
    res.json({ success: true, plans });
  } catch (error) {
    console.error("Error listing plans:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
  }
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlansService.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create plan" });
  }
});

router.put("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlansService.update(req.params.planId, req.body);
    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan" });
  }
});

router.delete("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlansService.remove(req.params.planId);
    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete plan" });
  }
});

// ============================================================================
// PLATFORM ADYEN (subscription payments settle here)
// ============================================================================

router.get("/platform-settings/adyen", async (_req: Request, res: Response) => {
  try {
    const adyen = await PlatformSettingsService.getAdyenSettingsPublic();
    res.json({ success: true, adyen });
  } catch (error) {
    console.error("Error getting platform Adyen settings:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get Adyen settings",
    });
  }
});

router.put("/platform-settings/adyen", async (req: Request, res: Response) => {
  try {
    const adyen = await PlatformSettingsService.updateAdyenSettings(req.body || {});
    res.json({ success: true, adyen });
  } catch (error) {
    console.error("Error updating platform Adyen settings:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update Adyen settings",
    });
  }
});

router.get("/subscription-payments", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
    const db = getDb();
    const payments = await db.query.subscriptionPayments.findMany({
      orderBy: [desc(schema.subscriptionPayments.createdAt)],
      limit,
      with: { plan: true, merchant: true },
    });
    res.json({
      success: true,
      payments: payments.map((p) => ({
        ...p,
        merchant: p.merchant
          ? { id: p.merchant.id, name: p.merchant.name, email: p.merchant.email }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error listing subscription payments:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list payments",
    });
  }
});


export default router;
