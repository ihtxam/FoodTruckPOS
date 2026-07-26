package com.chaslay.pos.scale

import kotlin.math.roundToInt

enum class AclasScaleStatus {
    STABLE,
    UNSTABLE,
    OVERLOAD,
    UNKNOWN
}

data class AclasScaleReading(
    val weightKg: Double,
    val rawWeight: String,
    val units: String,
    val status: AclasScaleStatus,
    val isZero: Boolean,
    val isTare: Boolean
)

/**
 * Aclas OS6X and compatible scales use the RS232 AUTO COMMUNICATE protocol:
 * SOH + STX + Status + Sign + Weight(6) + Units(2) + BCC + ETX + EOT + Status2 (16 bytes).
 */
object AclasScaleProtocol {
    const val FRAME_SIZE = 16
    private const val SOH = 0x01
    private const val STX = 0x02
    private const val ETX = 0x03
    private const val EOT = 0x04

    fun parseFrame(frame: ByteArray): AclasScaleReading? {
        if (frame.size < FRAME_SIZE) return null
        if (frame[0].toInt() and 0xFF != SOH ||
            frame[1].toInt() and 0xFF != STX ||
            frame[13].toInt() and 0xFF != ETX ||
            frame[14].toInt() and 0xFF != EOT
        ) {
            return null
        }

        val bcc = frame[12].toInt() and 0xFF
        if (calculateBcc(frame) != bcc) return null

        val statusByte = frame[2].toInt() and 0xFF
        val signByte = frame[3].toInt() and 0xFF
        val weightRaw = String(frame, 4, 6).trim()
        val units = String(frame, 10, 2).trim()
        val status2 = frame[15].toInt() and 0xFF

        val status = when (statusByte) {
            0x53 -> AclasScaleStatus.STABLE // 'S'
            0x55 -> AclasScaleStatus.UNSTABLE // 'U'
            0x46 -> AclasScaleStatus.OVERLOAD // 'F'
            else -> AclasScaleStatus.UNKNOWN
        }

        val isNegative = signByte == 0x2D
        val numeric = weightRaw.replace(" ", "").toDoubleOrNull() ?: return null
        val weightKg = normalizeToKg(if (isNegative) -numeric else numeric, units)

        return AclasScaleReading(
            weightKg = weightKg,
            rawWeight = weightRaw,
            units = units,
            status = status,
            isZero = status2 == 0x10,
            isTare = status2 == 0x20
        )
    }

    fun findLatestReading(buffer: ByteArray, length: Int): AclasScaleReading? {
        if (length < FRAME_SIZE) return null
        var latest: AclasScaleReading? = null
        var index = 0
        while (index <= length - FRAME_SIZE) {
            if ((buffer[index].toInt() and 0xFF) == SOH &&
                (buffer[index + 1].toInt() and 0xFF) == STX
            ) {
                latest = parseFrame(buffer.copyOfRange(index, index + FRAME_SIZE)) ?: latest
                index += FRAME_SIZE
            } else {
                index++
            }
        }
        return latest
    }

    private fun normalizeToKg(value: Double, units: String): Double {
        return when (units.uppercase()) {
            "KG", "K" -> value
            "G" -> value / 1000.0
            "LB" -> value * 0.45359237
            "OZ" -> value * 0.0283495231
            else -> value
        }
    }

    private fun calculateBcc(frame: ByteArray): Int {
        var bcc = 0
        for (index in 0 until 12) {
            bcc = bcc xor (frame[index].toInt() and 0xFF)
        }
        return bcc xor ETX
    }

    fun formatWeight(weightKg: Double): String =
        String.format("%.3f kg", weightKg)

    fun gramsFromKg(weightKg: Double): Int =
        (weightKg * 1000.0).roundToInt().coerceAtLeast(1)
}
