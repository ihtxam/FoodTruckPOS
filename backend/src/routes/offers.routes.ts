import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { OffersService } from "@/services/offers.service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(verifyToken, requireMerchant, setMerchantContext);

router.get("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const offers = await OffersService.list(merchantId);
    res.json({ success: true, offers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list offers" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    if (!req.body?.name) return res.status(400).json({ error: "Name is required" });
    const offer = await OffersService.create(merchantId, req.body);
    res.status(201).json({ success: true, offer });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create offer" });
  }
});

router.post("/ensure-category", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const category = await OffersService.ensureOffersCategory(merchantId);
    res.json({ success: true, category });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/seed-demos", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const db = getDb();
    const cats = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });
    const foodish = cats.filter((c) => !c.isOffersCategory).map((c) => c.id);
    const offers = await OffersService.seedDemoOffers(merchantId, foodish);
    res.json({ success: true, offers });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to seed" });
  }
});

router.put("/:offerId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const offer = await OffersService.update(merchantId, req.params.offerId, req.body || {});
    res.json({ success: true, offer });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update" });
  }
});

router.delete("/:offerId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    await OffersService.remove(merchantId, req.params.offerId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete" });
  }
});

export default router;
