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

export function formatCHF(amount: number): string {
  return `CHF ${roundMoney2(amount).toFixed(2)}`;
}
