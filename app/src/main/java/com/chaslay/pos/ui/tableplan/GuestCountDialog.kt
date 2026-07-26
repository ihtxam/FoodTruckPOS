package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R

@Composable
fun GuestCountDialog(
    tableName: String,
    seatCapacity: Int,
    initialCount: Int,
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    var countText by remember(initialCount) { mutableStateOf(initialCount.toString()) }
    val presets = remember(seatCapacity) {
        (1..seatCapacity.coerceAtLeast(1)).toList()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.guest_count_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    stringResource(R.string.guest_count_body, tableName, seatCapacity),
                    fontWeight = FontWeight.Medium
                )
                OutlinedTextField(
                    value = countText,
                    onValueChange = { countText = it.filter { ch -> ch.isDigit() }.take(2) },
                    label = { Text(stringResource(R.string.guest_count_label)) },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    presets.take(8).forEach { n ->
                        FilterChip(
                            selected = countText == n.toString(),
                            onClick = { countText = n.toString() },
                            label = { Text(n.toString()) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val count = countText.toIntOrNull()?.coerceIn(1, seatCapacity.coerceAtLeast(1))
                        ?: initialCount.coerceIn(1, seatCapacity.coerceAtLeast(1))
                    onConfirm(count)
                }
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
