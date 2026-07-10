package com.chaslay.pos.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.ChaslayBrand

@Composable
fun PinDotsDisplay(pinLength: Int, maxLength: Int = 6, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(maxLength) { index ->
            val filled = index < pinLength
            Box(
                modifier = Modifier
                    .padding(horizontal = 8.dp)
                    .size(if (filled) 18.dp else 14.dp)
                    .clip(CircleShape)
                    .background(if (filled) ChaslayBrand.White else ChaslayBrand.Gray800)
                    .border(
                        width = 1.dp,
                        color = if (filled) ChaslayBrand.White else ChaslayBrand.Gray600,
                        shape = CircleShape
                    )
            )
        }
    }
}

private enum class KeyVariant { Digit, Muted, Primary }

@Composable
fun PinLoginKeypad(
    onDigit: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onEnter: () -> Unit,
    modifier: Modifier = Modifier,
    enterEnabled: Boolean = true
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9")
        ).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                row.forEach { key ->
                    PinKey(
                        label = key,
                        modifier = Modifier.weight(1f),
                        onClick = { onDigit(key) }
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            PinKey(
                label = stringResource(R.string.keypad_clear),
                modifier = Modifier.weight(1f),
                variant = KeyVariant.Muted,
                onClick = onClear
            )
            PinKey(
                label = "0",
                modifier = Modifier.weight(1f),
                onClick = { onDigit("0") }
            )
            PinKey(
                label = "",
                icon = Icons.AutoMirrored.Filled.Backspace,
                modifier = Modifier.weight(1f),
                variant = KeyVariant.Muted,
                onClick = onBackspace
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        PinKey(
            label = stringResource(R.string.login),
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            variant = KeyVariant.Primary,
            enabled = enterEnabled,
            fillHeight = true,
            onClick = onEnter
        )
    }
}

@Composable
private fun PinKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    variant: KeyVariant = KeyVariant.Digit,
    enabled: Boolean = true,
    fillHeight: Boolean = false,
    onClick: () -> Unit
) {
    val bg = when {
        !enabled -> ChaslayBrand.Gray900
        variant == KeyVariant.Primary -> ChaslayBrand.White
        variant == KeyVariant.Muted -> ChaslayBrand.Gray900
        else -> ChaslayBrand.Gray800
    }
    val contentColor = when {
        !enabled -> ChaslayBrand.Gray600
        variant == KeyVariant.Primary -> ChaslayBrand.Black
        variant == KeyVariant.Muted -> ChaslayBrand.Gray200
        else -> ChaslayBrand.White
    }
    val borderColor = when {
        !enabled -> ChaslayBrand.Gray800
        variant == KeyVariant.Primary -> ChaslayBrand.White
        else -> ChaslayBrand.Gray800
    }
    val shape = RoundedCornerShape(16.dp)
    val heightMod = if (fillHeight) modifier else modifier.heightIn(min = 72.dp).aspectRatio(1.6f)
    Column(
        modifier = heightMod
            .clip(shape)
            .background(bg)
            .border(1.dp, borderColor, shape)
            .clickable(enabled = enabled, onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(28.dp)
            )
        } else {
            Text(
                text = label,
                fontWeight = if (variant == KeyVariant.Primary) FontWeight.Bold else FontWeight.SemiBold,
                color = contentColor,
                fontSize = if (variant == KeyVariant.Primary) 20.sp else 26.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
