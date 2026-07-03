package com.chaslay.pos.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.vectronColors

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
                    .padding(horizontal = 6.dp)
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(
                        if (filled) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                    )
            )
        }
    }
}

@Composable
fun PinLoginKeypad(
    onDigit: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onEnter: () -> Unit,
    modifier: Modifier = Modifier,
    enterEnabled: Boolean = true
) {
    val vc = vectronColors()
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(listOf("7", "8", "9"), listOf("4", "5", "6"), listOf("1", "2", "3")).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { key ->
                            PinKey(
                                label = key,
                                modifier = Modifier.weight(1f),
                                onClick = { onDigit(key) }
                            )
                        }
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PinKey(label = "0", modifier = Modifier.weight(1f), onClick = { onDigit("0") })
                    Spacer(modifier = Modifier.weight(2f))
                }
            }
            Column(modifier = Modifier.weight(0.38f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PinKey(
                    label = "",
                    icon = Icons.Default.Backspace,
                    onClick = onBackspace
                )
                PinKey(
                    label = stringResource(R.string.keypad_clear),
                    onClick = onClear
                )
                PinKey(
                    label = "",
                    icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                    highlight = true,
                    enabled = enterEnabled,
                    onClick = onEnter
                )
            }
        }
    }
}

@Composable
private fun PinKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    highlight: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val vc = vectronColors()
    val bg = when {
        !enabled -> vc.keypadButton.copy(alpha = 0.45f)
        highlight -> Color(0xFF2E7D32)
        else -> vc.keypadButton
    }
    val contentColor = vc.keypadText
    Column(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = label, tint = contentColor)
        } else {
            Text(label, fontWeight = FontWeight.Bold, color = contentColor, fontSize = 18.sp, textAlign = TextAlign.Center)
        }
    }
}