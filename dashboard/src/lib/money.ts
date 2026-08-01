/**
 * Swiss cash rounding to 0.05 (5 Rappen / 5 centimes).
 * Intermediate amounts use 0.01; payable totals use 0.05.
 */

export function roundMoney2(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Round to nearest 0.05 CHF. */
export function roundTo005(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 20) / 20;
}

/** Round to an arbitrary step (0 = none / 0.01). */
export function roundToStep(amount: number, step: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (!step || step <= 0.01) return roundMoney2(amount);
  const units = Math.round(1 / step);
  if (!Number.isFinite(units) || units <= 0) return roundMoney2(amount);
  return Math.round((amount + Number.EPSILON) * units) / units;
}

/** Difference applied to reach 0.05 total (can be negative). */
export function roundingAdjustment(rawTotal: number, step = 0.05): number {
  return roundMoney2(roundToStep(rawTotal, step) - rawTotal);
}

/** Quick-cash denomination buttons ≥ total (plus Exact). */
export function quickCashOptions(total: number, denominations: number[]): number[] {
  const t = roundMoney2(total);
  const dens = [...new Set(denominations.map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
  const opts = dens.filter((d) => d >= t);
  return opts;
}

/** Split a 0.05-rounded total into N parts that each land on 0.05. */
export function splitEqual005(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const units = Math.round(roundTo005(total) * 20);
  const base = Math.floor(units / n);
  const rem = units - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 20);
}

/** Use channel-specific rate when > 0, else merchant vatRate, else default. */
export function resolvePosTaxRate(
  channelRate: string | number | null | undefined,
  vatRate: string | number | null | undefined,
  defaultRate: number
): number {
  const ch = Number(channelRate);
  if (Number.isFinite(ch) && ch > 0) return ch;
  const vat = Number(vatRate);
  if (Number.isFinite(vat) && vat > 0) return vat;
  return defaultRate;
}

/** Extract VAT from a gross (tax-included) amount. */
export function extractVatFromGross(gross: number, ratePercent: number): number {
  if (!Number.isFinite(gross) || gross <= 0 || ratePercent <= 0) return 0;
  return roundMoney2(gross - gross / (1 + ratePercent / 100));
}

export type MerchandiseLine = { lineTotal: number; taxable: boolean };

export function computeMerchandiseTotals(
  lines: MerchandiseLine[],
  taxRate: number,
  vatIncludedInPrice: boolean,
  roundingStep = 0.05
) {
  const gross = roundMoney2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const taxableGross = roundMoney2(
    lines.filter((l) => l.taxable).reduce((s, l) => s + l.lineTotal, 0)
  );

  if (vatIncludedInPrice) {
    const tax = extractVatFromGross(taxableGross, taxRate);
    const net = roundMoney2(gross - tax);
    const rounding = roundingAdjustment(gross, roundingStep);
    const total = roundToStep(gross + rounding, roundingStep);
    return { subtotal: net, tax, gross, net, rounding, total };
  }

  const net = gross;
  const tax = roundMoney2((taxableGross * taxRate) / 100);
  const raw = net + tax;
  const rounding = roundingAdjustment(raw, roundingStep);
  const total = roundToStep(raw + rounding, roundingStep);
  return { subtotal: net, tax, gross: raw, net, rounding, total };
}

/** Scale line amounts for an equal split (e.g. /2). */
export function scaleLinesByFactor<
  T extends { lineTotal: number; unitPrice: number; quantity: number },
>(lines: T[], factor: number): T[] {
  if (factor >= 0.999) return lines;
  return lines.map((l) => {
    const lineTotal = roundMoney2(l.lineTotal * factor);
    const unitPrice = l.quantity > 0 ? roundMoney2(lineTotal / l.quantity) : 0;
    return { ...l, lineTotal, unitPrice };
  });
}

export function formatCHF(amount: number): string {
  return `CHF ${roundMoney2(amount).toFixed(2)}`;
}
