import { v4 as uuidv4 } from "uuid";

/** Stored on products.combo_items (slot-based, with legacy fixed-item support). */
export type ComboOptionStored = {
  productId: string;
  /** Surcharge on top of combo base price (0 = included). */
  extraPrice?: number;
};

export type ComboSlotStored = {
  id: string;
  name: string;
  minPick?: number;
  maxPick?: number;
  options?: ComboOptionStored[];
  /** Legacy fixed component */
  productId?: string;
  quantity?: number;
};

export type NormalizedComboSlot = {
  id: string;
  name: string;
  minPick: number;
  maxPick: number;
  options: Array<{ productId: string; extraPrice: number }>;
};

export function isSlotShaped(row: any): boolean {
  return Array.isArray(row?.options) || (!!row?.name && !row?.productId);
}

/** Normalize legacy fixed items and new slots into a single slot list. */
export function normalizeComboSlots(raw: unknown): NormalizedComboSlot[] {
  if (!Array.isArray(raw) || !raw.length) return [];

  return raw
    .map((row: any, idx: number) => {
      if (!row || typeof row !== "object") return null;

      // New slot shape
      if (Array.isArray(row.options)) {
        const options = row.options
          .filter((o: any) => o?.productId)
          .map((o: any) => ({
            productId: String(o.productId),
            extraPrice: Math.max(0, Number(o.extraPrice) || 0),
          }));
        if (!options.length) return null;
        const minPick = Math.max(0, Number(row.minPick) || 1);
        const maxPick = Math.max(minPick, Number(row.maxPick) || 1);
        return {
          id: String(row.id || `slot-${idx + 1}`),
          name: String(row.name || `Choice ${idx + 1}`).trim() || `Choice ${idx + 1}`,
          minPick,
          maxPick,
          options,
        } satisfies NormalizedComboSlot;
      }

      // Legacy: fixed product component → single-option required slot
      if (row.productId) {
        const qty = Math.max(1, Number(row.quantity) || 1);
        const options = Array.from({ length: qty }, () => ({
          productId: String(row.productId),
          extraPrice: 0,
        }));
        // Represent as one pick of that product (qty>1 rare); keep one option
        return {
          id: String(row.id || `legacy-${row.productId}-${idx}`),
          name: String(row.name || `Item ${idx + 1}`).trim() || `Item ${idx + 1}`,
          minPick: 1,
          maxPick: 1,
          options: [{ productId: String(row.productId), extraPrice: 0 }],
        } satisfies NormalizedComboSlot;
      }

      return null;
    })
    .filter(Boolean) as NormalizedComboSlot[];
}

/** Sanitize combo slots from merchant API before save. */
export function sanitizeComboSlotsInput(raw: unknown): ComboSlotStored[] {
  const slots = normalizeComboSlots(raw);
  return slots.map((s) => ({
    id: s.id || uuidv4(),
    name: s.name,
    minPick: s.minPick,
    maxPick: s.maxPick,
    options: s.options.map((o) => ({
      productId: o.productId,
      extraPrice: o.extraPrice,
    })),
  }));
}
