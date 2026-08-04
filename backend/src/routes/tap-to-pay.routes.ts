import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";
import { createSoftPosSession, buildSaleRequest } from "@/services/adyen-softpos.service";

/**
 * Adyen Tap to Pay (SoftPOS) endpoints for the Android POS, mounted at
 * /api/tap-to-pay. Guarded by the merchant dashboard JWT (same token the app
 * stores at online login) and scoped to the caller's merchant.
 *
 * Re-implemented for FoodTruckPOS from the Laravel adyen-api reference; that
 * project is untouched.
 */
const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

async function loadMerchant(merchantId: string) {
  const db = getDb();
  return db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });
}

const sessionSchema = z.object({
  setup_token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

/**
 * POST /api/tap-to-pay/sessions
 * Exchange a Mobile-SDK setupToken for sdkData + installationId.
 */
router.post("/sessions", async (req: Request, res: Response) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const merchant = await loadMerchant(req.merchantId!);
  if (!merchant) {
    return res.status(422).json({ error: "No merchant account." });
  }

  try {
    const session = await createSoftPosSession(merchant, parsed.data.setup_token);
    return res.json({
      sdk_data: session.sdkData,
      installation_id: session.installationId,
    });
  } catch (error) {
    return res.status(422).json({
      error: error instanceof Error ? error.message : "SoftPOS session failed.",
    });
  }
});

const saleSchema = z.object({
  amount_minor: z.number().int().min(1),
  currency: z.string().length(3),
  reference: z.string().max(80).optional(),
  platform: z.enum(["ios", "android"]),
  installation_id: z.string().max(128),
});

/**
 * POST /api/tap-to-pay/sale
 * Build (not submit) the nexo Terminal API envelope for the mobile SDK.
 */
router.post("/sale", async (req: Request, res: Response) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const merchant = await loadMerchant(req.merchantId!);
  if (!merchant) {
    return res.status(422).json({ error: "No merchant account." });
  }

  const { amount_minor, currency, reference, installation_id } = parsed.data;
  const built = buildSaleRequest(
    merchant,
    installation_id,
    amount_minor,
    currency.toUpperCase(),
    reference ?? "",
  );

  return res.json({
    terminal_api_request: built.request,
    service_id: built.serviceId,
    transaction_id: built.transactionId,
  });
});

export default router;
