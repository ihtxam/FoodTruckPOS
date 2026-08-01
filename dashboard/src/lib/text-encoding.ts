/** Catalog text normalization and mojibake repair (UTF-8 read as Latin-1). */

export function repairUtf8Mojibake(text: string): string {
  if (!text.includes("\u00C3") && !text.includes("\u00C2") && !text.includes("\uFFFD")) {
    return text;
  }
  try {
    const bytes = Uint8Array.from([...text].map((c) => c.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder("utf-8").decode(bytes);
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch {
    return text;
  }
}

export function normalizeCatalogText(text: string): string {
  return text.replace(/\u2300|\u2205/g, "\u00D8").normalize("NFC");
}

export function repairCatalogText(text: string): string {
  return normalizeCatalogText(repairUtf8Mojibake(String(text || "").trim()));
}
