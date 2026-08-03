/** ESC/POS text encoding for Western European thermal printers (IBM CP850). */

import { normalizeDashes, repairCatalogText } from '@/lib/text-encoding';

/** IBM CP850 mapping for Western European letters (byte values). */
const UNICODE_TO_CP850: Record<string, number> = {
  '\u00C0': 0xb7, '\u00C1': 0xb5, '\u00C2': 0xb6, '\u00C3': 0xc7,
  '\u00C4': 0x8e, '\u00C5': 0x8f, '\u00C6': 0x92, '\u00C7': 0x80,
  '\u00C8': 0xd4, '\u00C9': 0x90, '\u00CA': 0xd2, '\u00CB': 0xd3,
  '\u00CC': 0xe2, '\u00CD': 0xe3, '\u00CE': 0xd8, '\u00CF': 0xd9,
  '\u00D0': 0xd0, '\u00D1': 0xa5, '\u00D2': 0xe0, '\u00D3': 0xe2,
  '\u00D4': 0xe4, '\u00D5': 0xe5, '\u00D6': 0x99, '\u00D8': 0x9d,
  '\u00D9': 0xe9, '\u00DA': 0xea, '\u00DB': 0xeb, '\u00DC': 0x9a,
  '\u00DD': 0xed, '\u00DE': 0xee, '\u00DF': 0xe1,
  '\u00E0': 0x85, '\u00E1': 0xa0, '\u00E2': 0x83, '\u00E3': 0xc6,
  '\u00E4': 0x84, '\u00E5': 0x86, '\u00E6': 0x91, '\u00E7': 0x87,
  '\u00E8': 0x8a, '\u00E9': 0x82, '\u00EA': 0x88, '\u00EB': 0x89,
  '\u00EC': 0x8d, '\u00ED': 0xa1, '\u00EE': 0x8c, '\u00EF': 0x8b,
  '\u00F0': 0xa8, '\u00F1': 0xa4, '\u00F2': 0x95, '\u00F3': 0xa2,
  '\u00F4': 0x93, '\u00F5': 0xe4, '\u00F6': 0x94, '\u00F8': 0xe8,
  '\u00F9': 0x97, '\u00FA': 0xa3, '\u00FB': 0x96, '\u00FC': 0x81,
  '\u00FD': 0x98, '\u00FF': 0x98,
  '\u20AC': 0xd5, '\u00A3': 0x9c, '\u00B0': 0xf8,
};

export function normalizeForEscPosPrint(text: string): string {
  return normalizeDashes(repairCatalogText(text))
    .replace(/\uFFFD/g, ' ')
    .replace(/\u2019|\u2018|\u02BC/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');
}

/** Encode text to CP850 bytes for ESC/POS printers. */
export function escposCp850Encode(text: string): Uint8Array {
  const normalized = normalizeForEscPosPrint(text);
  const out: number[] = [];
  for (const char of normalized) {
    const code = char.codePointAt(0)!;
    if (code <= 0x7f) {
      out.push(code);
      continue;
    }
    const mapped = UNICODE_TO_CP850[char];
    if (mapped != null) {
      out.push(mapped);
      continue;
    }
    const decomposed = char.normalize('NFD');
    const base = [...decomposed].find((c) => {
      const cp = c.codePointAt(0)!;
      return cp <= 0x7f && (cp < 0x300 || cp > 0x36f);
    });
    if (base && (base.codePointAt(0)! >= 0x20 && base.codePointAt(0)! <= 0x7e)) {
      out.push(base.codePointAt(0)!);
    } else {
      out.push(0x3f); // ?
    }
  }
  return Uint8Array.from(out);
}

/** ESC t 2 - select CP850 on Epson-compatible printers. */
export const ESC_CODEPAGE_CP850 = new Uint8Array([0x1b, 0x74, 0x02]);
