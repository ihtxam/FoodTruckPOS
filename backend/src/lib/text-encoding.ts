/** Catalog text normalization and mojibake repair (UTF-8 read as Latin-1). */

/** All dash / hyphen lookalikes that must become ASCII hyphen-minus (U+002D). */
const DASH_LIKE =
  /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D\u00AD\u2043]/g;

/** Fix UTF-8 bytes mis-read as ISO-8859-1 (e.g. SnackÃ© ? Snacké). */
export function repairUtf8Mojibake(text: string): string {
  if (!text.includes("\u00C3") && !text.includes("\u00C2") && !text.includes("\uFFFD")) {
    return text;
  }
  try {
    const bytes = Buffer.from(text, "latin1");
    const repaired = bytes.toString("utf8");
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch {
    return text;
  }
}

/** Fold en/em/minus/etc. to ASCII `-` so printers and latin1 paths never emit `?`. */
export function normalizeDashes(text: string): string {
  return text.replace(DASH_LIKE, "-");
}

/** NFC + diameter symbols + ASCII dashes for catalog and print. */
export function normalizeCatalogText(text: string): string {
  return normalizeDashes(text.replace(/\u2300|\u2205/g, "\u00D8")).normalize("NFC");
}

export function repairCatalogText(text: string): string {
  return normalizeCatalogText(repairUtf8Mojibake(String(text || "").trim()));
}
