import { Router, Request, Response } from "express";
import { AuthService } from "@/services/auth.service";
import { verifyToken, requireMerchant, requireSuperadmin } from "@/middleware/auth.middleware";

const router = Router();

/**
 * POST /api/auth/merchant/register
 * Register a new merchant account
 */
router.post("/merchant/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, businessName } = req.body;

    if (!email || !password || !name || !businessName) {
      return res.status(400).json({ error: "Email, password, name, and business name are required" });
    }

    const merchant = await AuthService.registerMerchant(email, password, name, businessName);

    res.status(201).json({
      success: true,
      message: "Merchant registered successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error registering merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register merchant" });
  }
});

/**
 * POST /api/auth/merchant/login
 * Login merchant account
 */
router.post("/merchant/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await AuthService.loginMerchant(email, password);

    res.json({
      success: true,
      token: result.token,
      merchant: result.merchant,
      isOwner: result.isOwner !== false,
    });
  } catch (error) {
    console.error("Error logging in merchant:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/superadmin/register
 * Register a new superadmin account (protected)
 */
router.post("/superadmin/register", verifyToken, requireSuperadmin, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const superadmin = await AuthService.registerSuperadmin(email, password, name);

    res.status(201).json({
      success: true,
      message: "Superadmin registered successfully",
      superadmin,
    });
  } catch (error) {
    console.error("Error registering superadmin:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register superadmin" });
  }
});

/**
 * POST /api/auth/superadmin/login
 * Login superadmin account
 */
router.post("/superadmin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await AuthService.loginSuperadmin(email, password);

    res.json({
      success: true,
      token: result.token,
      superadmin: result.superadmin,
    });
  } catch (error) {
    console.error("Error logging in superadmin:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * POST /api/auth/reseller/login
 */
router.post("/reseller/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const { ResellerService } = await import("@/services/reseller.service");
    const result = await ResellerService.login(email, password);
    res.json({ success: true, token: result.token, reseller: result.reseller });
  } catch (error) {
    console.error("Error logging in reseller:", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "Failed to login" });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get("/me", verifyToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user.role === "merchant") {
      const merchant = await AuthService.getMerchantById(req.user.id);
      res.json({ user: merchant, role: "merchant" });
    } else {
      res.json({ user: { id: req.user.id, email: req.user.email }, role: "superadmin" });
    }
  } catch (error) {
    console.error("Error getting user info:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get user info" });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for merchant
 */
router.post("/change-password", verifyToken, requireMerchant, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await AuthService.updateMerchantPassword(req.user.id, newPassword);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to change password" });
  }
});

/**
 * GET /api/auth/invite/:token
 * Preview invite (public) — used by set-password page
 */
router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const { MerchantInviteService } = await import("@/services/merchant-invite.service");
    const invite = await MerchantInviteService.getInvitePreview(req.params.token);
    res.json({ success: true, invite });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid or expired invite link",
    });
  }
});

/**
 * POST /api/auth/set-password
 * Accept invite token and set merchant password (public)
 */
router.post("/set-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "token and password are required" });
    }
    const { MerchantInviteService } = await import("@/services/merchant-invite.service");
    const merchant = await MerchantInviteService.acceptInvite(token, password);
    res.json({
      success: true,
      message: "Password created. You can sign in now.",
      merchant,
    });
  } catch (error) {
    console.error("Error setting password from invite:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to set password",
    });
  }
});

export default router;
