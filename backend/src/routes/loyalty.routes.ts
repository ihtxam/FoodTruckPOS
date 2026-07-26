import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { LoyaltyService } from "@/services/loyalty.service";

const router = Router();

// Apply merchant middleware
router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * POST /api/loyalty/cards
 * Create loyalty card
 */
router.post("/cards", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardType, customerId, initialBalance, cardNumber, rfidCode } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!cardType) {
      return res.status(400).json({ error: "Card type is required" });
    }

    const card = await LoyaltyService.createLoyaltyCard(
      merchantId,
      cardType,
      customerId,
      initialBalance,
      cardNumber || rfidCode
    );

    res.status(201).json({
      success: true,
      message: "Loyalty card created successfully",
      card,
    });
  } catch (error) {
    console.error("Error creating loyalty card:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create card" });
  }
});

/**
 * GET /api/loyalty/cards
 * Get all loyalty cards
 */
router.get("/cards", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const cardType = req.query.cardType as string;
    const status = req.query.status as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const cards = await LoyaltyService.getLoyaltyCards(merchantId, page, limit, cardType, status);

    res.json({
      success: true,
      cards,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting loyalty cards:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get cards" });
  }
});

/**
 * GET /api/loyalty/cards/rfid/:rfidCode
 * Get card by RFID code
 */
router.get("/cards/rfid/:rfidCode", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { rfidCode } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const card = await LoyaltyService.getCardByRFID(merchantId, rfidCode);

    res.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error("Error getting card by RFID:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
  }
});

/**
 * GET /api/loyalty/cards/number/:cardNumber
 * Get card by card number
 */
router.get("/cards/number/:cardNumber", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardNumber } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const card = await LoyaltyService.getCardByNumber(merchantId, cardNumber);

    res.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error("Error getting card by number:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/add-balance
 * Add balance to card
 */
router.post("/cards/:cardId/add-balance", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const { amount } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const card = await LoyaltyService.addBalance(merchantId, cardId, amount);

    res.json({
      success: true,
      message: `Added ${amount} to card balance`,
      card,
    });
  } catch (error) {
    console.error("Error adding balance:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add balance" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/redeem
 * Redeem balance from card
 */
router.post("/cards/:cardId/redeem", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const { amount, orderId } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const card = await LoyaltyService.redeemBalance(merchantId, cardId, amount, orderId);

    res.json({
      success: true,
      message: `Redeemed ${amount} from card`,
      card,
    });
  } catch (error) {
    console.error("Error redeeming balance:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem balance" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/add-points
 * Add loyalty points to card
 */
router.post("/cards/:cardId/add-points", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const { points } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!points || points <= 0) {
      return res.status(400).json({ error: "Valid points value is required" });
    }

    const card = await LoyaltyService.addPoints(merchantId, cardId, points);

    res.json({
      success: true,
      message: `Added ${points} loyalty points`,
      card,
    });
  } catch (error) {
    console.error("Error adding points:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add points" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/redeem-points
 * Redeem loyalty points from card
 */
router.post("/cards/:cardId/redeem-points", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const { points, orderId } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!points || points <= 0) {
      return res.status(400).json({ error: "Valid points value is required" });
    }

    const card = await LoyaltyService.redeemPoints(merchantId, cardId, points, orderId);

    res.json({
      success: true,
      message: `Redeemed ${points} loyalty points`,
      card,
    });
  } catch (error) {
    console.error("Error redeeming points:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem points" });
  }
});

/**
 * GET /api/loyalty/cards/:cardId/transactions
 * Get card transaction history
 */
router.get("/cards/:cardId/transactions", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const transactions = await LoyaltyService.getCardTransactions(merchantId, cardId, page, limit);

    res.json({
      success: true,
      transactions,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting transactions:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get transactions" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/suspend
 * Suspend loyalty card
 */
router.post("/cards/:cardId/suspend", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;
    const { reason } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const card = await LoyaltyService.suspendCard(merchantId, cardId, reason);

    res.json({
      success: true,
      message: "Card suspended successfully",
      card,
    });
  } catch (error) {
    console.error("Error suspending card:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to suspend card" });
  }
});

/**
 * POST /api/loyalty/cards/:cardId/reactivate
 * Reactivate loyalty card
 */
router.post("/cards/:cardId/reactivate", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { cardId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const card = await LoyaltyService.reactivateCard(merchantId, cardId);

    res.json({
      success: true,
      message: "Card reactivated successfully",
      card,
    });
  } catch (error) {
    console.error("Error reactivating card:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reactivate card" });
  }
});

/**
 * GET /api/loyalty/statistics
 * Get loyalty program statistics
 */
router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const stats = await LoyaltyService.getLoyaltyStatistics(merchantId);

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error getting statistics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
  }
});

/**
 * GET /api/loyalty/expiring-gift-cards
 * Get expiring gift cards
 */
router.get("/expiring-gift-cards", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const daysThreshold = parseInt(req.query.days as string) || 30;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const cards = await LoyaltyService.getExpiringGiftCards(merchantId, daysThreshold);

    res.json({
      success: true,
      cards,
      threshold: `${daysThreshold} days`,
    });
  } catch (error) {
    console.error("Error getting expiring gift cards:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get cards" });
  }
});

/**
 * GET /api/loyalty/analytics
 * Get loyalty program analytics
 */
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const analytics = await LoyaltyService.getLoyaltyAnalytics(merchantId, startDate, endDate);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
  }
});

export default router;
