import { Router, Request, Response } from "express";
import { verifyToken, requireReseller } from "@/middleware/auth.middleware";
import { ResellerService } from "@/services/reseller.service";
import { EditionService } from "@/services/edition.service";
import { AuthService } from "@/services/auth.service";
import { EDITION_FEATURE_GROUPS, ALL_EDITION_FEATURES } from "@/lib/edition-features";

const router = Router();

router.use(verifyToken);
router.use(requireReseller);

function resellerId(req: Request): string {
  return req.user!.resellerId!;
}

/**
 * GET /api/reseller/me
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const me = await ResellerService.getById(resellerId(req));
    if (!me) return res.status(404).json({ error: "Reseller not found" });
    res.json({ success: true, reseller: me });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/overview
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const merchants = await ResellerService.listMerchants(resellerId(req));
    const active = merchants.filter((m) => m.status === "active" || m.status === "trial").length;
    res.json({
      success: true,
      overview: {
        merchantCount: merchants.length,
        activeCount: active,
        suspendedCount: merchants.filter((m) => m.status === "suspended").length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/merchants
 */
router.get("/merchants", async (req: Request, res: Response) => {
  try {
    const merchants = await ResellerService.listMerchants(resellerId(req), {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/merchants
 */
router.post("/merchants", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      businessName,
      phone,
      address,
      city,
      country,
      editionId,
      businessCategory,
      shopEnabled,
      deviceSeats,
      licenseType,
      customDays,
      sendInvite,
    } = req.body || {};
    if (!email || !businessName || !editionId) {
      return res.status(400).json({ error: "Email, business name, and edition are required" });
    }
    const merchant = await ResellerService.createMerchantForReseller(resellerId(req), {
      email,
      password,
      businessName,
      phone,
      address,
      city,
      country,
      editionId,
      businessCategory,
      shopEnabled,
      deviceSeats: deviceSeats != null ? Number(deviceSeats) : 0,
      licenseType,
      customDays: customDays != null ? Number(customDays) : undefined,
      sendInvite,
    });
    res.status(201).json({ success: true, merchant });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
  }
});

/**
 * POST /api/reseller/merchants/:merchantId/impersonate
 */
router.post("/merchants/:merchantId/impersonate", async (req: Request, res: Response) => {
  try {
    const m = await ResellerService.assertOwnsMerchant(resellerId(req), req.params.merchantId);
    if (m.status === "suspended" || m.status === "expired") {
      return res.status(400).json({ error: `Cannot open panel while merchant is ${m.status}` });
    }
    const result = await AuthService.impersonateMerchant(req.user!.id, req.params.merchantId);
    res.json({
      success: true,
      token: result.token,
      merchant: result.merchant,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to impersonate" });
  }
});

/**
 * GET /api/reseller/editions/catalog
 */
router.get("/editions/catalog", (_req: Request, res: Response) => {
  res.json({
    success: true,
    groups: EDITION_FEATURE_GROUPS,
    allFeatures: ALL_EDITION_FEATURES,
  });
});

/**
 * GET /api/reseller/editions
 */
router.get("/editions", async (req: Request, res: Response) => {
  try {
    const editions = await EditionService.list({
      forResellerId: resellerId(req),
      includeInactive: req.query.all === "1",
    });
    res.json({ success: true, editions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/editions
 */
router.post("/editions", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.create({
      name: req.body?.name,
      note: req.body?.note,
      businessCategory: req.body?.businessCategory,
      features: req.body?.features,
      ownerType: "reseller",
      ownerId: resellerId(req),
    });
    res.status(201).json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/editions/:id/clone
 */
router.post("/editions/:id/clone", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.cloneForReseller(
      req.params.id,
      resellerId(req),
      req.body?.name
    );
    res.status(201).json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * PUT /api/reseller/editions/:id
 */
router.put("/editions/:id", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.update(
      req.params.id,
      {
        name: req.body?.name,
        note: req.body?.note,
        businessCategory: req.body?.businessCategory,
        features: req.body?.features,
        isActive: req.body?.isActive,
      },
      { requireOwnerType: "reseller", requireOwnerId: resellerId(req) }
    );
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * DELETE /api/reseller/editions/:id
 */
router.delete("/editions/:id", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.softDelete(req.params.id, {
      requireOwnerType: "reseller",
      requireOwnerId: resellerId(req),
    });
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

export default router;
