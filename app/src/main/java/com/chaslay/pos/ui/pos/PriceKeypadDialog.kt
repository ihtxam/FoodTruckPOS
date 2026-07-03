package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.VectronColors

@Composable
fun PriceKeypadDialog(
    title: String,
    subtitle: String = stringResource(R.string.enter_price),
    currencySymbol: String,
    initialValue: String = "",
    confirmLabel: String = stringResource(R.string.add_to_cart),
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    var buffer by remember { mutableStateOf(initialValue) }

    fun appendKey(key: String) {
        buffer = when (key) {
            "00" -> if (buffer.isEmpty()) "0" else buffer + "00"
            "." -> when {
                buffer.contains(".") -> buffer
                buffer.isEmpty() -> "0."
                else -> buffer + "."
            }
            else -> if (buffer == "0") key else buffer + key
        }.take(12)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(title, fontWeight = FontWeight.Bold)
                Text(subtitle, fontSize = 12.sp, color = Color.Gray)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.End,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(listOf("7", "8", "9"), listOf("4", "5", "6"), listOf("1", "2", "3"), listOf("0", "00", ".")).forEach { row ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                row.forEach { key ->
                                    PriceKey(
                                        label = key,
                                        modifier = Modifier.weight(1f),
                                        onClick = { appendKey(key) }
                                    )
                                }
                            }
                        }
                    }
                    Column(modifier = Modifier.weight(0.35f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        PriceKey(
                            label = "",
                            icon = Icons.Default.Backspace,
                            onClick = { buffer = buffer.dropLast(1) }
                        )
                        PriceKey(
                            label = stringResource(R.string.keypad_clear),
                            onClick = { buffer = "" }
                        )
                        PriceKey(
                            label = "",
                            icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                            highlight = true,
                            onClick = {
                                buffer.toDoubleOrNull()?.let(onConfirm)
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { buffer.toDoubleOrNull()?.let(onConfirm) }) {
                Text(confirmLabel)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun PriceKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    highlight: Boolean = false,
    onClick: () -> Unit
) {
    val bg = when {
        highlight -> VectronColors.CashGreen
        else -> VectronColors.KeypadButton
    }
    Column(
        modifier = modifier
            .height(44.dp)
            .background(bg, RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = if (highlight) Color.White else VectronColors.TextPrimary)
        } else {
            Text(label, fontWeight = FontWeight.Bold, color = if (highlight) Color.White else VectronColors.TextPrimary)
        }
    }
}
