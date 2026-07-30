import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { AdyenService } from "@/services/adyen.service";
import { AdyenTerminalPoiService } from "@/services/adyen-terminal-poi.service";

const router = Router();

// Apply merchant middleware
router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * POST /api/payment/initialize
 * Initialize payment session
 */
router.post("/initialize", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId, amount, currency, returnUrl } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!orderId || !amount) {
      return res.status(400).json({ error: "Order ID and amount are required" });
    }

    const session = await AdyenService.initializePaymentSession(
      merchantId,
      orderId,
      amount,
      currency || "USD",
      returnUrl
    );

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Error initializing payment:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to initialize payment" });
  }
});

/**
 * POST /api/payment/card
 * Process card payment
 */
router.post("/card", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId, amount, paymentMethod, currency } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!orderId || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Order ID, amount, and payment method are required" });
    }

    const result = await AdyenService.processCardPayment(
      merchantId,
      orderId,
      amount,
      paymentMethod,
      currency || "USD"
    );

    // Record transaction
    if (result.resultCode === "Authorised" || result.resultCode === "Received") {
      await AdyenService.recordPaymentTransaction(
        merchantId,
        orderId,
        amount,
        "card",
        result.pspReference,
        "completed"
      );
    }

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error processing card payment:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to process payment" });
  }
});

/**
 * POST /api/payment/terminal
 * Process terminal payment
 */
router.post("/terminal", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId, amount, terminalId, currency } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!orderId || !amount || !terminalId) {
      return res.status(400).json({ error: "Order ID, amount, and terminal ID are required" });
    }

    const result = await AdyenService.processTerminalPayment(
      merchantId,
      orderId,
      amount,
      terminalId,
      currency || "USD"
    );

    // Record transaction
    if (result.resultCode === "Authorised" || result.resultCode === "Received") {
      await AdyenService.recordPaymentTransaction(
        merchantId,
        orderId,
        amount,
        "terminal",
        result.pspReference,
        "completed"
      );
    }

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error processing terminal payment:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to process payment" });
  }
});

/**
 * POST /api/payment/terminal/poi
 * Adyen Terminal API (SaleToPOI) — same flow as Android POS terminal payments
 */
router.post("/terminal/poi", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { amount, terminalId, currency, saleRef } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }
    if (amount == null || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const result = await AdyenTerminalPoiService.processTerminalPayment(merchantId, Number(amount), {
      terminalId,
      currency: currency || "CHF",
    });

    if (result.status === "approved" && saleRef) {
      await AdyenService.recordPaymentTransaction(
        merchantId,
        String(saleRef),
        Number(amount),
        "terminal",
        result.reference || `terminal-${Date.now()}`,
        "completed"
      );
    }

    res.json({ success: result.status === "approved", result });
  } catch (error) {
    console.error("Error processing terminal POI payment:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Terminal payment failed" });
  }
});

/**
 * POST /api/payment/refund
 * Refund payment
 */
router.post("/refund", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { transactionId, amount } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    const result = await AdyenService.refundPayment(merchantId, transactionId, amount);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error refunding payment:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to refund payment" });
  }
});

/**
 * GET /api/payment/methods
 * Get available payment methods
 */
router.get("/methods", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const methods = await AdyenService.getMerchantPaymentMethods(merchantId);

    res.json({
      success: true,
      methods,
    });
  } catch (error) {
    console.error("Error getting payment methods:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get payment methods" });
  }
});

/**
 * GET /api/payment/transactions
 * Get transaction history
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const transactions = await AdyenService.getTransactionHistory(merchantId, page, limit, status);

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
 * GET /api/payment/summary
 * Get payment summary
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const summary = await AdyenService.getPaymentSummary(merchantId, startDate, endDate);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error getting payment summary:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get payment summary" });
  }
});

export default router;
