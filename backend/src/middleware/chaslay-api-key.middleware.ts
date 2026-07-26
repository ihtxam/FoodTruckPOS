import { Request, Response, NextFunction } from "express";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      chaslayMerchantId?: string;
      chaslayMerchant?: typeof schema.merchants.$inferSelect;
    }
  }
}

/**
 * Resolve merchant from Chaslay Android POS `X-Api-Key` header.
 * Falls back to global API_KEY env mapped to default merchant slug.
 */
export async function requireChaslayApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = String(req.header("X-Api-Key") || req.header("x-api-key") || "").trim();
    if (!apiKey) {
      return res.status(401).json({ error: "Missing X-Api-Key" });
    }

    const db = getDb();
    let merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.syncApiKey, apiKey),
    });

    if (!merchant && process.env.API_KEY && apiKey === process.env.API_KEY) {
      const defaultSlug = process.env.DEFAULT_TENANT_SLUG || process.env.DEFAULT_MERCHANT_SLUG || "demo";
      merchant =
        (await db.query.merchants.findFirst({
          where: eq(schema.merchants.slug, defaultSlug),
        })) ||
        (await db.query.merchants.findFirst());
    }

    if (!merchant) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.chaslayMerchantId = merchant.id;
    req.chaslayMerchant = merchant;
    next();
  } catch (error) {
    console.error("Chaslay API key auth failed:", error);
    res.status(500).json({ error: "Auth failed" });
  }
}

export async function resolveChaslayMerchantBySlug(slug?: string | null) {
  const db = getDb();
  if (slug) {
    const m = await db.query.merchants.findFirst({
      where: eq(schema.merchants.slug, slug),
    });
    if (m) return m;
  }
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG || process.env.DEFAULT_MERCHANT_SLUG;
  if (defaultSlug) {
    const m = await db.query.merchants.findFirst({
      where: eq(schema.merchants.slug, defaultSlug),
    });
    if (m) return m;
  }
  return db.query.merchants.findFirst();
}
