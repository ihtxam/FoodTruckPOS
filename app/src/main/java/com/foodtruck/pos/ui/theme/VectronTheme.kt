package com.foodtruck.pos.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class VectronPalette(
    val background: Color,
    val panelDark: Color,
    val panelLight: Color,
    val header: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val gridGap: Color,
    val keypadButton: Color,
    val keypadText: Color,
    val totalBar: Color,
    val sidebar: Color,
    val cartBackground: Color,
    val cartHeader: Color,
    val selectedCategory: Color
) {
    val cashGreen: Color get() = VectronColors.CashGreen
    val cardBlue: Color get() = VectronColors.CardBlue
    val defaultProduct: Color get() = VectronColors.DefaultProduct
}

object VectronPalettes {
    val Light = VectronPalette(
        background = Color(0xFFF5F5F5),
        panelDark = Color(0xFFFFFFFF),
        panelLight = Color(0xFFF0F0F0),
        header = Color(0xFFE8E8E8),
        textPrimary = Color(0xFF1A1A1A),
        textSecondary = Color(0xFF666666),
        gridGap = Color(0xFFE0E0E0),
        keypadButton = Color(0xFFECECEC),
        keypadText = Color(0xFF1A1A1A),
        totalBar = Color(0xFF2E2E2E),
        sidebar = Color(0xFFEEEEEE),
        cartBackground = Color(0xFFFAFAFA),
        cartHeader = Color(0xFFF2F2F2),
        selectedCategory = Color(0xFFD6E4F0)
    )

    val Dark = VectronPalette(
        background = Color(0xFF1B2A4A),
        panelDark = Color(0xFF152038),
        panelLight = Color(0xFF243656),
        header = Color(0xFF0F1829),
        textPrimary = Color(0xFFFFFFFF),
        textSecondary = Color(0xFFB8C5D9),
        gridGap = Color(0xFF1B2A4A),
        keypadButton = Color(0xFF2E4266),
        keypadText = Color(0xFFFFFFFF),
        totalBar = Color(0xFF0F1829),
        sidebar = Color(0xFF252525),
        cartBackground = Color(0xFFF8F8F8),
        cartHeader = Color(0xFFF2F2F2),
        selectedCategory = Color(0xFF3A5080)
    )
}

val LocalVectronPalette = staticCompositionLocalOf { VectronPalettes.Light }

@Composable
fun ProvideVectronTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalVectronPalette provides if (darkTheme) VectronPalettes.Dark else VectronPalettes.Light,
        content = content
    )
}

@Composable
fun vectronColors(): VectronPalette = LocalVectronPalette.current
