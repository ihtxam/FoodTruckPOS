/** Pastel palette inspired by Odoo POS category tiles */
const PALETTE = [
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
];

export function categoryColor(categoryId: string | null | undefined, index = 0): string {
  if (!categoryId) return PALETTE[index % PALETTE.length]!;
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}

export function categoryIndexMap(categories: Array<{ id: string }>): Map<string, number> {
  const map = new Map<string, number>();
  categories.forEach((c, i) => map.set(c.id, i));
  return map;
}
