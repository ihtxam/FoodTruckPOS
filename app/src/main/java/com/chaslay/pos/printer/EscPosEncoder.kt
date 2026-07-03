package com.chaslay.pos.printer

import java.nio.charset.Charset

object EscPosEncoder {
    private val CP850 = Charset.forName("CP850")

    // CP850 code page mappings for Western European characters
    private val UNICODE_TO_CP850 = mapOf(
        '\u00E0' to 0x85, '\u00E1' to 0xA0, '\u00E2' to 0x83, '\u00E3' to 0xC6, '\u00E4' to 0x84,
        '\u00E5' to 0x86, '\u00E6' to 0x91, '\u00E7' to 0x87, '\u00E8' to 0x8A, '\u00E9' to 0x82,
        '\u00EA' to 0x88, '\u00EB' to 0x89, '\u00EC' to 0x8D, '\u00ED' to 0xA1, '\u00EE' to 0x8C,
        '\u00EF' to 0x8B, '\u00F1' to 0xA4, '\u00F2' to 0x95, '\u00F3' to 0xA2, '\u00F4' to 0x93,
        '\u00F5' to 0xE4, '\u00F6' to 0x94, '\u00F9' to 0x97, '\u00FA' to 0xA3, '\u00FB' to 0x96,
        '\u00FC' to 0x81, '\u00FD' to 0x98, '\u00FF' to 0x98,
        '\u00C0' to 0xB7, '\u00C1' to 0xB5, '\u00C2' to 0xB6, '\u00C4' to 0x8E, '\u00C7' to 0x80,
        '\u00C9' to 0x90, '\u00C8' to 0xD4, '\u00CA' to 0xD2, '\u00CB' to 0xD3, '\u00D1' to 0xA5,
        '\u00D6' to 0x99, '\u00DC' to 0x9A, '\u0152' to 0x8C, '\u0153' to 0x9B,
        '\u20AC' to 0xD5, '\u00A3' to 0x9C, '\u00B0' to 0xF8
    )

    fun encode(text: String): ByteArray {
        val normalized = text
            .replace('\u2019', '\'')
            .replace('\u2018', '\'')
            .replace('\u201C', '"')
            .replace('\u201D', '"')
        val bytes = ArrayList<Byte>(normalized.length)
        normalized.forEach { char ->
            when {
                char.code <= 0x7F -> bytes.add(char.code.toByte())
                UNICODE_TO_CP850.containsKey(char) -> bytes.add(UNICODE_TO_CP850.getValue(char).toByte())
                char.code in 0x80..0xFF -> bytes.add(char.code.toByte())
                else -> bytes.add('?'.code.toByte())
            }
        }
        return bytes.toByteArray()
    }

    fun decodeForLog(payload: ByteArray): String =
        runCatching { String(payload, CP850) }.getOrElse { payload.decodeToString() }
}
