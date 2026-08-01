package com.chaslay.pos.printer

import com.chaslay.pos.util.TextEncoding
import java.nio.charset.Charset
import java.text.Normalizer

object EscPosEncoder {
    private val CP850 = Charset.forName("CP850")

    /** Normalize symbols / mojibake before CP850 encoding. */
    fun normalizeForPrint(text: String): String =
        TextEncoding.repairCatalogText(text)
            .replace('\uFFFD', ' ')
            .replace('\u2019', '\'')
            .replace('\u2018', '\'')
            .replace('\u201C', '"')
            .replace('\u201D', '"')
            .replace('\u2013', '-')
            .replace('\u2014', '-')

    fun encode(text: String): ByteArray {
        val normalized = normalizeForPrint(text)
        val bytes = ArrayList<Byte>(normalized.length)
        normalized.forEach { char ->
            when {
                char.code <= 0x7F -> bytes.add(char.code.toByte())
                else -> {
                    val encoded = char.toString().toByteArray(CP850)
                    if (encoded.size == 1 && encoded[0] != '?'.code.toByte()) {
                        bytes.add(encoded[0])
                    } else {
                        val decomposed = Normalizer.normalize(char.toString(), Normalizer.Form.NFD)
                        val base = decomposed.firstOrNull { c ->
                            c.code <= 0x7F && (c.code < 0x300 || c.code > 0x36F)
                        }
                        if (base != null && base.code in 0x20..0x7E) {
                            bytes.add(base.code.toByte())
                        } else {
                            bytes.add('?'.code.toByte())
                        }
                    }
                }
            }
        }
        return bytes.toByteArray()
    }

    fun decodeForLog(payload: ByteArray): String =
        runCatching { String(payload, CP850) }.getOrElse { payload.decodeToString() }
}
