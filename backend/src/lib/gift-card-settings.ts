export type GiftCardSettings = {
  enabled: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  reloadEnabled: boolean;
  customAmountEnabled: boolean;
};

export const DEFAULT_GIFT_CARD_SETTINGS: GiftCardSettings = {
  enabled: false,
  presetDenominations: [20, 50, 100, 150],
  minAmount: 5,
  maxAmount: 500,
  reloadEnabled: true,
  customAmountEnabled: true,
};

function roundMoney2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizeGiftCardSettings(raw: unknown): GiftCardSettings {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const presetsRaw = Array.isArray(src.presetDenominations)
    ? src.presetDenominations
    : DEFAULT_GIFT_CARD_SETTINGS.presetDenominations;

  const presets = [
    ...new Set(
      presetsRaw
        .map((v) => roundMoney2(Number(v)))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ].sort((a, b) => a - b);

  let minAmount = roundMoney2(
    Number(src.minAmount ?? DEFAULT_GIFT_CARD_SETTINGS.minAmount)
  );
  let maxAmount = roundMoney2(
    Number(src.maxAmount ?? DEFAULT_GIFT_CARD_SETTINGS.maxAmount)
  );
  if (!Number.isFinite(minAmount) || minAmount < 0) minAmount = DEFAULT_GIFT_CARD_SETTINGS.minAmount;
  if (!Number.isFinite(maxAmount) || maxAmount < minAmount) {
    maxAmount = Math.max(minAmount, DEFAULT_GIFT_CARD_SETTINGS.maxAmount);
  }

  return {
    enabled: src.enabled === true,
    presetDenominations: presets.length
      ? presets
      : [...DEFAULT_GIFT_CARD_SETTINGS.presetDenominations],
    minAmount,
    maxAmount,
    reloadEnabled: src.reloadEnabled !== false,
    customAmountEnabled: src.customAmountEnabled !== false,
  };
}

export function validateGiftAmount(
  amount: number,
  settings: GiftCardSettings
): { ok: true; amount: number } | { ok: false; error: string } {
  const n = roundMoney2(Number(amount));
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Valid amount is required" };
  }
  if (n < settings.minAmount || n > settings.maxAmount) {
    return {
      ok: false,
      error: `Amount must be between CHF ${settings.minAmount.toFixed(2)} and CHF ${settings.maxAmount.toFixed(2)}`,
    };
  }
  return { ok: true, amount: n };
}
