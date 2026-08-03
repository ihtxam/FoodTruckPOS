/** Pastel palette for POS category tiles / product accents */
export const CATEGORY_PALETTE = [
  '#f9a8d4', // pink
  '#86efac', // green
  '#fde68a', // yellow
  '#fdba74', // orange
  '#c4b5fd', // purple
  '#67e8f9', // cyan
  '#fca5a5', // red
  '#a5b4fc', // indigo
  '#bef264', // lime
  '#fcd34d', // amber
  '#fda4af', // rose
  '#6ee7b7', // emerald
];

/** Pick a distinct color by index (used on menu upload / create). */
export function paletteColorAt(index: number): string {
  return CATEGORY_PALETTE[Math.abs(index) % CATEGORY_PALETTE.length]!;
}

/** Prefer stored category color; else stable hash / index fallback. */
export function categoryColor(
  categoryId: string | null | undefined,
  index = 0,
  storedColor?: string | null
): string {
  const hex = storedColor?.trim();
  if (hex && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
    return hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  }
  if (!categoryId) return paletteColorAt(index);
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return paletteColorAt(hash);
}

export function categoryIndexMap(categories: Array<{ id: string }>): Map<string, number> {
  const map = new Map<string, number>();
  categories.forEach((c, i) => map.set(c.id, i));
  return map;
}

export function categoryColorMap(
  categories: Array<{ id: string; color?: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  categories.forEach((c, i) => {
    map.set(c.id, categoryColor(c.id, i, c.color));
  });
  return map;
}
