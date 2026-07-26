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

/** Difference applied to reach 0.05 total (can be negative). */
export function roundingAdjustment(rawTotal: number): number {
  return roundMoney2(roundTo005(rawTotal) - rawTotal);
}

/** Split a 0.05-rounded total into N parts that each land on 0.05. */
export function splitEqual005(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const units = Math.round(roundTo005(total) * 20);
  const base = Math.floor(units / n);
  const rem = units - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 20);
}
