import { Router, Request, Response } from "express";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, tenantSlug } = req.body ?? {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await ChaslayCompatService.posLogin(
      email.trim(),
      password,
      tenantSlug?.trim() || req.header("X-Tenant-Slug")?.trim() || null
    );
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Invalid credentials" });
  }
});

export default router;
