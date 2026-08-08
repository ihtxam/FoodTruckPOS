import { Router, Request, Response } from "express";
import {
  verifyToken,
  requireMerchant,
  setMerchantContext,
} from "@/middleware/auth.middleware";
import { requireEditionFeature } from "@/middleware/edition.middleware";
import { GiftCardService } from "@/services/gift-card.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(requireEditionFeature("gift_cards", "pos_gift_cards"));

/**
 * GET /api/gift-cards/settings
 */
router.get("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const settings = await GiftCardService.getSettings(merchantId);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get settings",
    });
  }
});

/**
 * PUT /api/gift-cards/settings
 */
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const body = req.body || {};
    const settings = await GiftCardService.updateSettings(merchantId, {
      enabled: body.enabled,
      presetDenominations: body.presetDenominations,
      minAmount: body.minAmount,
      maxAmount: body.maxAmount,
      reloadEnabled: body.reloadEnabled,
      customAmountEnabled: body.customAmountEnabled,
    });
    res.json({ success: true, message: "Gift card settings saved", settings });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save settings",
    });
  }
});

/**
 * GET /api/gift-cards
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const result = await GiftCardService.listCards(merchantId, {
      page: parseInt(String(req.query.page || "1"), 10) || 1,
      limit: parseInt(String(req.query.limit || "50"), 10) || 50,
      status: req.query.status as string | undefined,
      q: req.query.q as string | undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list cards",
    });
  }
});

/**
 * POST /api/gift-cards
 * Create / issue a physical or e-card (e-card stub)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const card = await GiftCardService.createCard(merchantId, {
      cardNumber: req.body.cardNumber || req.body.rfidCode,
      cardMediaType: req.body.cardMediaType,
      initialBalance: req.body.initialBalance,
      membershipEnabled: req.body.membershipEnabled,
      holderName: req.body.holderName || req.body.name,
      holderEmail: req.body.holderEmail || req.body.email,
      holderPhone: req.body.holderPhone || req.body.phone,
      ecardEmail: req.body.ecardEmail,
      customerId: req.body.customerId,
    });
    res.status(201).json({ success: true, card });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create card",
    });
  }
});

/**
 * GET /api/gift-cards/lookup/:code
 */
router.get("/lookup/:code", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const mediaType =
      req.query.mediaType === "e_card" ? "e_card" : ("physical" as const);
    const card = await GiftCardService.lookup(
      merchantId,
      req.params.code,
      mediaType
    );
    res.json({ success: true, card });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Card not found",
    });
  }
});

/**
 * POST /api/gift-cards/credit
 * Sell or reload after POS payment success
 */
router.post("/credit", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const type = req.body.type === "reload" ? "reload" : "sell";
    const card = await GiftCardService.credit(merchantId, {
      cardId: req.body.cardId,
      cardNumber: req.body.cardNumber || req.body.rfidCode,
      cardMediaType: req.body.cardMediaType,
      amount: Number(req.body.amount),
      type,
      orderId: req.body.orderId,
      createIfMissing: req.body.createIfMissing !== false,
    });
    res.json({ success: true, card });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to credit card",
    });
  }
});

/**
 * POST /api/gift-cards/redeem
 * Pay with gift card (partial allowed by default for POS)
 */
router.post("/redeem", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const result = await GiftCardService.redeem(merchantId, {
      cardId: req.body.cardId,
      cardNumber: req.body.cardNumber || req.body.rfidCode,
      ecardCode: req.body.ecardCode,
      amount: Number(req.body.amount),
      orderId: req.body.orderId,
      allowPartial: req.body.allowPartial !== false,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to redeem",
    });
  }
});

/**
 * GET /api/gift-cards/:cardId
 */
router.get("/:cardId", async (req: Request, res: Response) => {
  try {
    const card = await GiftCardService.getById(req.merchantId!, req.params.cardId);
    res.json({ success: true, card });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Card not found",
    });
  }
});

/**
 * GET /api/gift-cards/:cardId/transactions
 */
router.get("/:cardId/transactions", async (req: Request, res: Response) => {
  try {
    const transactions = await GiftCardService.getTransactions(
      req.merchantId!,
      req.params.cardId,
      parseInt(String(req.query.page || "1"), 10) || 1,
      parseInt(String(req.query.limit || "30"), 10) || 30
    );
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Failed to get transactions",
    });
  }
});

/**
 * POST /api/gift-cards/:cardId/membership
 */
router.post("/:cardId/membership", async (req: Request, res: Response) => {
  try {
    const card = await GiftCardService.attachMembership(
      req.merchantId!,
      req.params.cardId,
      {
        name: req.body.name || req.body.holderName,
        email: req.body.email || req.body.holderEmail,
        phone: req.body.phone || req.body.holderPhone,
        customerId: req.body.customerId,
      }
    );
    res.json({ success: true, card });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to attach membership",
    });
  }
});

/**
 * POST /api/gift-cards/:cardId/suspend
 */
router.post("/:cardId/suspend", async (req: Request, res: Response) => {
  try {
    const card = await GiftCardService.suspend(
      req.merchantId!,
      req.params.cardId,
      req.body.reason
    );
    res.json({ success: true, card });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to suspend card",
    });
  }
});

/**
 * POST /api/gift-cards/:cardId/reactivate
 */
router.post("/:cardId/reactivate", async (req: Request, res: Response) => {
  try {
    const card = await GiftCardService.reactivate(
      req.merchantId!,
      req.params.cardId
    );
    res.json({ success: true, card });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reactivate card",
    });
  }
});

export default router;
