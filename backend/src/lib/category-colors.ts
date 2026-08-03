/** Pastel palette assigned automatically when categories are created without a color. */
export const CATEGORY_PALETTE = [
  "#f9a8d4",
  "#86efac",
  "#fde68a",
  "#fdba74",
  "#c4b5fd",
  "#67e8f9",
  "#fca5a5",
  "#a5b4fc",
  "#bef264",
  "#fcd34d",
  "#fda4af",
  "#6ee7b7",
];

export function paletteColorAt(index: number): string {
  return CATEGORY_PALETTE[Math.abs(index) % CATEGORY_PALETTE.length]!;
}

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHexColor(value: string): string {
  const hex = value.trim();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}
