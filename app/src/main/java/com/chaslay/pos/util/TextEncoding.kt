package com.chaslay.pos.util

import java.nio.charset.Charset
import java.text.Normalizer

/** Catalog / receipt text normalization and mojibake repair (UTF-8 read as Latin-1). */
object TextEncoding {
    private val ISO_8859_1 = Charset.forName("ISO-8859-1")

    /** Dash / hyphen lookalikes ? ASCII hyphen-minus (U+002D). */
    private val DASH_LIKE =
        Regex("[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D\u00AD\u2043]")

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

    /** Fold en/em/minus/etc. to ASCII `-` so printers never emit `?` for dashes. */
    fun normalizeDashes(text: String): String = DASH_LIKE.replace(text, "-")

    /** NFC + diameter symbols + ASCII dashes for catalog and print. */
    fun normalizeCatalogText(text: String): String =
        normalizeDashes(
            text
                .replace('\u2300', '\u00D8') // ? ? Ø
                .replace('\u2205', '\u00D8') // ? ? Ø
        ).let { Normalizer.normalize(it, Normalizer.Form.NFC) }

    fun repairCatalogText(text: String): String =
        normalizeCatalogText(repairUtf8Mojibake(text.trim()))
}
