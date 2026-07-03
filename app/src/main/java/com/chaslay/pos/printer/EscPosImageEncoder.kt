package com.chaslay.pos.printer

import android.graphics.Bitmap
import android.graphics.Color
import kotlin.math.roundToInt

object EscPosImageEncoder {
    /**
     * Converts a bitmap to ESC/POS raster bytes (GS v 0), centered via caller.
     */
    fun encodeRaster(
        bitmap: Bitmap,
        maxWidthPx: Int = 320,
        maxHeightPx: Int = 160
    ): ByteArray? {
        val scaled = scaleToFit(bitmap, maxWidthPx, maxHeightPx) ?: return null
        val width = scaled.width
        val height = scaled.height
        if (width <= 0 || height <= 0) return null

        val bytesPerRow = width / 8
        val raster = ByteArray(bytesPerRow * height)
        for (y in 0 until height) {
            for (xByte in 0 until bytesPerRow) {
                var value = 0
                for (bit in 0 until 8) {
                    val x = xByte * 8 + bit
                    val pixel = scaled.getPixel(x, y)
                    val luminance = (Color.red(pixel) * 0.299 +
                        Color.green(pixel) * 0.587 +
                        Color.blue(pixel) * 0.114).roundToInt()
                    if (luminance < 160) {
                        value = value or (1 shl (7 - bit))
                    }
                }
                raster[y * bytesPerRow + xByte] = value.toByte()
            }
        }

        if (scaled !== bitmap && !scaled.isRecycled) scaled.recycle()

        val xL = bytesPerRow and 0xFF
        val xH = (bytesPerRow shr 8) and 0xFF
        val yL = height and 0xFF
        val yH = (height shr 8) and 0xFF
        return byteArrayOf(0x1D, 0x76, 0x30, 0x00, xL.toByte(), xH.toByte(), yL.toByte(), yH.toByte()) + raster
    }

    private fun scaleToFit(source: Bitmap, maxWidthPx: Int, maxHeightPx: Int): Bitmap? {
        if (source.width <= 0 || source.height <= 0) return null
        val widthRatio = maxWidthPx.toDouble() / source.width
        val heightRatio = maxHeightPx.toDouble() / source.height
        val ratio = minOf(widthRatio, heightRatio, 1.0)
        val targetWidth = (source.width * ratio).roundToInt().coerceAtLeast(1)
        val targetHeight = (source.height * ratio).roundToInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
        val paddedWidth = ((targetWidth + 7) / 8) * 8
        if (paddedWidth == targetWidth) return scaled
        val padded = Bitmap.createBitmap(paddedWidth, targetHeight, Bitmap.Config.ARGB_8888)
        padded.eraseColor(Color.WHITE)
        val canvas = android.graphics.Canvas(padded)
        canvas.drawBitmap(scaled, 0f, 0f, null)
        if (scaled !== source && scaled !== padded) scaled.recycle()
        return padded
    }
}
