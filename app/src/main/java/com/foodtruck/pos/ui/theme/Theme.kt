package com.foodtruck.pos.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val OrangePrimary = Color(0xFFFF6F00)
private val GreenCash = Color(0xFF2E7D32)
private val BlueCard = Color(0xFF1565C0)

private val LightColors = lightColorScheme(
    primary = OrangePrimary,
    onPrimary = Color.White,
    secondary = GreenCash,
    tertiary = BlueCard,
    background = Color(0xFFF5F5F5),
    surface = Color.White
)

private val DarkColors = darkColorScheme(
    primary = OrangePrimary,
    onPrimary = Color.White,
    secondary = GreenCash,
    tertiary = BlueCard
)

@Composable
fun FoodTruckPosTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}

object PosColors {
    val Cash = GreenCash
    val Card = BlueCard
}
