package com.chaslay.pos.ui.theme

import androidx.compose.ui.graphics.Color

object VectronColors {
    val Background = Color(0xFF1B2A4A)
    val PanelDark = Color(0xFF152038)
    val PanelLight = Color(0xFF243656)
    val Header = Color(0xFF0F1829)
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFFB8C5D9)
    val GridGap = Color(0xFF1B2A4A)
    val DefaultProduct = Color(0xFF4A6FA5)
    val KeypadButton = Color(0xFF2E4266)
    val KeypadText = Color(0xFFFFFFFF)
    val TotalBar = Color(0xFF0F1829)
    val CashGreen = Color(0xFF3D8B5E)
    val CardBlue = Color(0xFF2E6DB4)
    val SelectedCategory = Color(0xFF3A5080)
}

fun categoryColor(hex: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(hex)) }
        .getOrDefault(VectronColors.DefaultProduct)
