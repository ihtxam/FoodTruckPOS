export type PosCheckoutDiscountPreset = {
  id: string;
  name: string;
  percent: number;
};

export type CourseSendMode = 'fire_per_course' | 'send_all_once';

export type PosCheckoutSettings = {
  tipsEnabled: boolean;
  tipPresetsPercent: number[];
  allowCustomTip: boolean;
  discountsEnabled: boolean;
  discountPresets: PosCheckoutDiscountPreset[];
  roundingStep: number;
  quickCashEnabled: boolean;
  quickCashDenominations: number[];
  splitBillsEnabled: boolean;
  maxSplitParts: number;
  vatIncludedInPrice: boolean;
  /** Kitchen course firing mode for WebPOS / POS */
  courseSendMode: CourseSendMode;
};

export const DEFAULT_POS_CHECKOUT: PosCheckoutSettings = {
  tipsEnabled: true,
  tipPresetsPercent: [0, 5, 10, 15],
  allowCustomTip: true,
  discountsEnabled: true,
  discountPresets: [
    { id: 'none', name: 'None', percent: 0 },
    { id: 'staff', name: 'Staff', percent: 10 },
    { id: 'vip', name: 'VIP', percent: 15 },
  ],
  roundingStep: 0.05,
  quickCashEnabled: true,
  quickCashDenominations: [10, 20, 50, 100],
  splitBillsEnabled: true,
  maxSplitParts: 8,
  vatIncludedInPrice: false,
  courseSendMode: 'fire_per_course',
};

export function normalizePosCheckoutSettings(raw: unknown): PosCheckoutSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const tipPresets = Array.isArray(src.tipPresetsPercent)
    ? src.tipPresetsPercent.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    : DEFAULT_POS_CHECKOUT.tipPresetsPercent;
  const dens = Array.isArray(src.quickCashDenominations)
    ? src.quickCashDenominations.map(Number).filter((n) => n > 0)
    : DEFAULT_POS_CHECKOUT.quickCashDenominations;
  const presets = Array.isArray(src.discountPresets)
    ? src.discountPresets.map((p, i) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          id: String(o.id || `d${i}`),
          name: String(o.name || `${Number(o.percent) || 0}%`),
          percent: Math.max(0, Math.min(100, Number(o.percent) || 0)),
        };
      })
    : DEFAULT_POS_CHECKOUT.discountPresets;
  let roundingStep = Number(src.roundingStep);
  if (![0, 0.05, 0.1, 0.5, 1].includes(roundingStep)) roundingStep = 0.05;
  return {
    tipsEnabled: src.tipsEnabled !== false,
    tipPresetsPercent: tipPresets.length ? tipPresets : DEFAULT_POS_CHECKOUT.tipPresetsPercent,
    allowCustomTip: src.allowCustomTip !== false,
    discountsEnabled: src.discountsEnabled !== false,
    discountPresets: presets,
    roundingStep,
    quickCashEnabled: src.quickCashEnabled !== false,
    quickCashDenominations: dens.length ? dens : DEFAULT_POS_CHECKOUT.quickCashDenominations,
    splitBillsEnabled: src.splitBillsEnabled !== false,
    maxSplitParts: Math.max(2, Math.min(20, Number(src.maxSplitParts) || 8)),
    vatIncludedInPrice: src.vatIncludedInPrice === true,
    courseSendMode: src.courseSendMode === 'send_all_once' ? 'send_all_once' : 'fire_per_course',
  };
}
