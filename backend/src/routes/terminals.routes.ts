import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";
import { MerchantSettingsService } from "@/services/merchant-settings.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function sanitizeTerminal(t: typeof schema.paymentTerminals.$inferSelect) {
  return {
    ...t,
    adyenApiKey: undefined,
    adyenApiKeyMasked: maskSecret(t.adyenApiKey),
    adyenApiKeySet: !!t.adyenApiKey,
  };
}

/**
 * GET /api/terminals
 * Includes merchant-level Adyen credentials summary.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, req.merchantId!),
    });
    const settings = await MerchantSettingsService.getMerchantSettings(req.merchantId!);
    res.json({
      success: true,
      terminals: terminals.map(sanitizeTerminal),
      adyen: {
        merchantAccount: settings.adyenMerchantAccount,
        apiKeyMasked: settings.adyenApiKeyMasked,
        apiKeySet: settings.adyenApiKeySet,
        clientId: settings.adyenClientId,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list terminals" });
  }
});

/**
 * PUT /api/terminals/adyen-credentials
 * Store merchant-level Adyen merchant account, API key, and client ID.
 */
router.put("/adyen-credentials", async (req: Request, res: Response) => {
  try {
    const { adyenMerchantAccount, adyenApiKey, adyenClientId } = req.body;
    const settings = await MerchantSettingsService.updateMerchantSettings(req.merchantId!, {
      adyenMerchantAccount,
      adyenApiKey,
      adyenClientId,
    });
    res.json({
      success: true,
      adyen: {
        merchantAccount: settings.adyenMerchantAccount,
        apiKeyMasked: settings.adyenApiKeyMasked,
        apiKeySet: settings.adyenApiKeySet,
        clientId: settings.adyenClientId,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save Adyen credentials" });
  }
});

/**
 * POST /api/terminals
 * Register Adyen payment terminal at store level.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      terminalId,
      terminalName,
      serialNumber,
      adyenMerchantAccount,
      adyenApiKey,
      adyenClientId,
    } = req.body;
    if (!terminalId || !terminalName) {
      return res.status(400).json({ error: "terminalId and terminalName are required" });
    }
    const db = getDb();
    const [terminal] = await db
      .insert(schema.paymentTerminals)
      .values({
        merchantId: req.merchantId!,
        terminalId,
        terminalName,
        serialNumber,
        adyenMerchantAccount: adyenMerchantAccount || null,
        adyenApiKey: adyenApiKey && !String(adyenApiKey).includes("••••") ? adyenApiKey : null,
        adyenClientId: adyenClientId || null,
        status: "active",
      })
      .returning();
    res.status(201).json({ success: true, terminal: sanitizeTerminal(terminal) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register terminal" });
  }
});

/**
 * PUT /api/terminals/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const patch: Record<string, unknown> = {};
    if (req.body.terminalName !== undefined) patch.terminalName = req.body.terminalName;
    if (req.body.serialNumber !== undefined) patch.serialNumber = req.body.serialNumber;
    if (req.body.status !== undefined) patch.status = req.body.status;
    if (req.body.adyenMerchantAccount !== undefined) patch.adyenMerchantAccount = req.body.adyenMerchantAccount;
    if (req.body.adyenClientId !== undefined) patch.adyenClientId = req.body.adyenClientId;
    if (req.body.adyenApiKey && !String(req.body.adyenApiKey).includes("••••")) {
      patch.adyenApiKey = req.body.adyenApiKey;
    }

    const [terminal] = await db
      .update(schema.paymentTerminals)
      .set(patch)
      .where(
        and(
          eq(schema.paymentTerminals.id, req.params.id),
          eq(schema.paymentTerminals.merchantId, req.merchantId!)
        )
      )
      .returning();
    if (!terminal) return res.status(404).json({ error: "Terminal not found" });
    res.json({ success: true, terminal: sanitizeTerminal(terminal) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update terminal" });
  }
});

/**
 * DELETE /api/terminals/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db
      .delete(schema.paymentTerminals)
      .where(
        and(
          eq(schema.paymentTerminals.id, req.params.id),
          eq(schema.paymentTerminals.merchantId, req.merchantId!)
        )
      );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete terminal" });
  }
});

export default router;
