/** Catalog text normalization and mojibake repair (UTF-8 read as Latin-1). */

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

/** NFC + diameter symbols for catalog and print. */
export function normalizeCatalogText(text: string): string {
  return text.replace(/\u2300|\u2205/g, "\u00D8").normalize("NFC");
}

export function repairCatalogText(text: string): string {
  return normalizeCatalogText(repairUtf8Mojibake(String(text || "").trim()));
}
