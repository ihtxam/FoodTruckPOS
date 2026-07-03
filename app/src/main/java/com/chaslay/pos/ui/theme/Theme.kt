package com.chaslay.pos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = ChaslayBrand.Black,
    onPrimary = ChaslayBrand.White,
    secondary = ChaslayBrand.Gray800,
    onSecondary = ChaslayBrand.White,
    tertiary = ChaslayBrand.Gray600,
    onTertiary = ChaslayBrand.White,
    background = ChaslayBrand.White,
    onBackground = ChaslayBrand.Black,
    surface = ChaslayBrand.White,
    onSurface = ChaslayBrand.Black,
    surfaceVariant = ChaslayBrand.Gray100,
    onSurfaceVariant = ChaslayBrand.Gray600,
    outline = ChaslayBrand.Gray200
)

private val DarkColors = darkColorScheme(
    primary = ChaslayBrand.White,
    onPrimary = ChaslayBrand.Black,
    secondary = ChaslayBrand.Gray200,
    onSecondary = ChaslayBrand.Black,
    tertiary = ChaslayBrand.Gray400,
    background = ChaslayBrand.Black,
    onBackground = ChaslayBrand.White,
    surface = ChaslayBrand.Gray900,
    onSurface = ChaslayBrand.White,
    surfaceVariant = ChaslayBrand.Gray800,
    onSurfaceVariant = ChaslayBrand.Gray200,
    outline = ChaslayBrand.Gray600
)

@Composable
fun ChaslayPosTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}

object PosColors {
    val Cash = ChaslayBrand.Black
    val Card = ChaslayBrand.Gray800
}
