import { Request, Response, NextFunction } from "express";
import { AuthService, JWTPayload } from "@/services/auth.service";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      merchantId?: string;
    }
  }
}

/**
 * Middleware to verify JWT token
 */
export function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    req.user = payload;
    if (payload.merchantId) {
      req.merchantId = payload.merchantId;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware to check if user is superadmin
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  next();
}

/**
 * Middleware to check if user is merchant
 */
export function requireMerchant(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "merchant") {
    return res.status(403).json({ error: "Merchant access required" });
  }

  next();
}

/**
 * Middleware to verify merchant access to their own data
 */
export function verifyMerchantAccess(req: Request, res: Response, next: NextFunction) {
  const requestedMerchantId = req.params.merchantId || req.body.merchantId;

  if (!req.user || req.user.role !== "merchant") {
    return res.status(403).json({ error: "Merchant access required" });
  }

  if (requestedMerchantId && requestedMerchantId !== req.user.merchantId) {
    return res.status(403).json({ error: "Access denied: cannot access other merchant data" });
  }

  next();
}

/**
 * Middleware to set merchant context
 */
export function setMerchantContext(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.role === "merchant" && req.user.merchantId) {
    req.merchantId = req.user.merchantId;
  }

  next();
}
