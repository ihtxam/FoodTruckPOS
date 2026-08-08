import { Request, Response, NextFunction } from "express";
import type { EditionFeatureKey } from "@/lib/edition-features";
import { EditionEntitlementsService } from "@/services/edition-entitlements.service";

/**
 * Require merchant edition to include a feature. Null edition = legacy full access.
 */
export function requireEditionFeature(...features: EditionFeatureKey[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchantId || req.user?.merchantId;
      if (!merchantId) {
        return res.status(400).json({ error: "Merchant ID is required" });
      }
      const granted = await EditionEntitlementsService.getFeatures(merchantId);
      if (granted == null) return next();
      const ok = features.some((f) => granted.includes(f));
      if (!ok) {
        return res.status(403).json({
          error: "Your POS edition does not include this feature",
          requiredFeatures: features,
        });
      }
      next();
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Edition check failed",
      });
    }
  };
}
