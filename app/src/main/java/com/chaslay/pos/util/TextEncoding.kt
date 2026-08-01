package com.chaslay.pos.util

import java.nio.charset.Charset
import java.text.Normalizer

/** Catalog / receipt text normalization and mojibake repair (UTF-8 read as Latin-1). */
object TextEncoding {
    private val ISO_8859_1 = Charset.forName("ISO-8859-1")

    /** Fix UTF-8 bytes mis-read as ISO-8859-1 (e.g. SnackÃ© ? Snacké). */
    fun repairUtf8Mojibake(text: String): String {
        if (!text.contains('\u00C3') && !text.contains('\u00C2') && !text.contains('\uFFFD')) {
            return text
        }
        val repaired = runCatching {
            String(text.toByteArray(ISO_8859_1), Charsets.UTF_8)
        }.getOrDefault(text)
        return if (repaired.contains('\uFFFD')) text else repaired
    }

    /** NFC + diameter symbols for catalog and print. */
    fun normalizeCatalogText(text: String): String =
        text
            .replace('\u2300', '\u00D8') // ? ? Ø
            .replace('\u2205', '\u00D8') // ? ? Ø
            .let { Normalizer.normalize(it, Normalizer.Form.NFC) }

    fun repairCatalogText(text: String): String =
        normalizeCatalogText(repairUtf8Mojibake(text.trim()))
}
