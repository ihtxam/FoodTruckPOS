import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { MarketingService } from "@/services/marketing.service";
import { EmailService } from "@/services/email.service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/merchant/marketing/audience
 */
router.get("/audience", async (req: Request, res: Response) => {
  try {
    const audience = await MarketingService.listAudience(req.merchantId!);
    res.json({ success: true, audience });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/merchant/marketing/campaigns
 */
router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaigns = await MarketingService.listCampaigns(req.merchantId!);
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/merchant/marketing/campaigns — create/update draft
 */
router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaign = await MarketingService.saveCampaign(req.merchantId!, {
      id: req.body.id,
      title: req.body.title,
      subject: req.body.subject,
      bodyHtml: req.body.bodyHtml,
      audience: req.body.audience,
      selectedEmails: req.body.selectedEmails,
    });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/merchant/marketing/campaigns/:id/send
 */
router.post("/campaigns/:id/send", async (req: Request, res: Response) => {
  try {
    const campaign = await MarketingService.sendCampaign(req.merchantId!, req.params.id);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send" });
  }
});

/**
 * GET /api/merchant/marketing/email-status
 */
router.get("/email-status", async (req: Request, res: Response) => {
  try {
    const status = await EmailService.status(req.merchantId!);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/merchant/marketing/test-email
 */
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const to = String(req.body.to || "").trim();
    if (!to.includes("@")) return res.status(400).json({ error: "Valid email required" });
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, req.merchantId!),
    });
    await EmailService.send({
      merchantId: req.merchantId!,
      to,
      subject: `Test email from ${merchant?.name || "ChaslayReborn"}`,
      html: `<p>This is a test message from your SMTP / email settings.</p><p>${new Date().toISOString()}</p>`,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Send failed" });
  }
});

export default router;
