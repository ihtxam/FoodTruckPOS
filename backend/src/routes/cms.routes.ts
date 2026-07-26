import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { CmsService, type CmsTemplateKey } from "@/services/cms.service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/merchant/cms/templates
 */
router.get("/templates", async (_req: Request, res: Response) => {
  res.json({ success: true, templates: CmsService.listTemplates() });
});

/**
 * GET /api/merchant/cms/site
 */
router.get("/site", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) return res.status(404).json({ error: "Merchant not found" });
    res.json({
      success: true,
      site: {
        customDomain: merchant.customDomain || null,
        cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
        shopEnabled: !!merchant.shopEnabled,
        slug: merchant.slug,
        subdomain: merchant.subdomain,
        name: merchant.name,
        shopLogoUrl: merchant.shopLogoUrl,
        shopBannerUrl: merchant.shopBannerUrl,
        shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load site" });
  }
});

/**
 * PUT /api/merchant/cms/site
 */
router.put("/site", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const site = await CmsService.updateSiteSettings(merchantId, {
      customDomain: req.body.customDomain,
      cmsHomepageEnabled: req.body.cmsHomepageEnabled,
    });
    res.json({ success: true, site });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update site" });
  }
});

/**
 * GET /api/merchant/cms/pages
 */
router.get("/pages", async (req: Request, res: Response) => {
  try {
    const pages = await CmsService.listPages(req.merchantId!);
    res.json({ success: true, pages });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list pages" });
  }
});

/**
 * POST /api/merchant/cms/pages
 */
router.post("/pages", async (req: Request, res: Response) => {
  try {
    const page = await CmsService.createPage(req.merchantId!, {
      title: req.body.title,
      slug: req.body.slug,
      isHomepage: req.body.isHomepage,
      templateKey: req.body.templateKey as CmsTemplateKey | undefined,
      blocks: req.body.blocks,
      seoTitle: req.body.seoTitle,
      seoDescription: req.body.seoDescription,
      status: req.body.status,
    });
    res.status(201).json({ success: true, page });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create page" });
  }
});

/**
 * GET /api/merchant/cms/pages/:pageId
 */
router.get("/pages/:pageId", async (req: Request, res: Response) => {
  try {
    const page = await CmsService.getPage(req.merchantId!, req.params.pageId);
    res.json({ success: true, page });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Page not found" });
  }
});

/**
 * PUT /api/merchant/cms/pages/:pageId
 */
router.put("/pages/:pageId", async (req: Request, res: Response) => {
  try {
    const page = await CmsService.updatePage(req.merchantId!, req.params.pageId, {
      title: req.body.title,
      slug: req.body.slug,
      isHomepage: req.body.isHomepage,
      blocks: req.body.blocks,
      seoTitle: req.body.seoTitle,
      seoDescription: req.body.seoDescription,
      status: req.body.status,
      templateKey: req.body.templateKey,
    });
    res.json({ success: true, page });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update page" });
  }
});

/**
 * DELETE /api/merchant/cms/pages/:pageId
 */
router.delete("/pages/:pageId", async (req: Request, res: Response) => {
  try {
    await CmsService.deletePage(req.merchantId!, req.params.pageId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete page" });
  }
});

export default router;
