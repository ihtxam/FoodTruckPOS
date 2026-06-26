package com.foodtruck.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.foodtruck.pos.R
import com.foodtruck.pos.domain.model.CartItem
import com.foodtruck.pos.domain.model.CartSummary
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.ui.theme.VectronColors
import java.util.Locale

@Composable
fun SplitBillScreen(
    cart: CartSummary,
    currencySymbol: String,
    selectedItemIds: Set<String>,
    onBack: () -> Unit,
    onToggleItem: (String) -> Unit,
    onMoveToNewBill: () -> Unit,
    onSplitEvenly: (Int) -> Unit,
    onPayCheck: (Int, PaymentMethod) -> Unit,
    onDone: () -> Unit
) {
    var showEvenSplitDialog by remember { mutableStateOf(false) }
    val checks = (1..cart.splitCount).toList()
    val itemsByCheck = checks.associateWith { check ->
        cart.items.filter { it.splitCheck == check }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A1A))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF111111))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White)
                }
                Text(
                    stringResource(R.string.split_bill),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { showEvenSplitDialog = true }) {
                    Icon(Icons.AutoMirrored.Filled.CallSplit, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.split_equal), fontSize = 12.sp)
                }
                Button(
                    onClick = onDone,
                    colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.done), color = Color.White)
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SplitBillColumn(
                title = stringResource(R.string.bill_n, 1),
                items = itemsByCheck[1].orEmpty(),
                currencySymbol = currencySymbol,
                selectedItemIds = selectedItemIds,
                selectable = true,
                onToggleItem = onToggleItem,
                onPay = { onPayCheck(1, PaymentMethod.CASH) },
                modifier = Modifier.weight(1f)
            )

            Column(modifier = Modifier.weight(1f)) {
                val extraChecks = checks.filter { it > 1 }
                if (extraChecks.isEmpty()) {
                    AddNewBillDropZone(onClick = onMoveToNewBill, modifier = Modifier.fillMaxSize())
                } else {
                    extraChecks.forEach { check ->
                        SplitBillColumn(
                            title = stringResource(R.string.bill_n, check),
                            items = itemsByCheck[check].orEmpty(),
                            currencySymbol = currencySymbol,
                            selectedItemIds = emptySet(),
                            selectable = false,
                            onToggleItem = {},
                            onPay = { onPayCheck(check, PaymentMethod.CASH) },
                            modifier = Modifier
                                .weight(1f)
                                .padding(bottom = 8.dp)
                        )
                    }
                    if (selectedItemIds.isNotEmpty()) {
                        AddNewBillDropZone(
                            onClick = onMoveToNewBill,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                        )
                    }
                }
            }
        }
    }

    if (showEvenSplitDialog) {
        EvenSplitDialog(
            onDismiss = { showEvenSplitDialog = false },
            onConfirm = { count ->
                onSplitEvenly(count)
                showEvenSplitDialog = false
            }
        )
    }
}

@Composable
private fun SplitBillColumn(
    title: String,
    items: List<CartItem>,
    currencySymbol: String,
    selectedItemIds: Set<String>,
    selectable: Boolean,
    onToggleItem: (String) -> Unit,
    onPay: () -> Unit,
    modifier: Modifier = Modifier
) {
    val total = CartSummary(items = items).total
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF2A2A2A))
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(formatMoney(total, currencySymbol), color = VectronColors.CashGreen, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(items, key = { it.id }) { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF333333))
                        .clickable(enabled = selectable) { onToggleItem(item.id) }
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (selectable) {
                        Checkbox(
                            checked = item.id in selectedItemIds,
                            onCheckedChange = { onToggleItem(item.id) }
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.productName, color = Color.White, fontSize = 13.sp, maxLines = 2)
                        item.variantName?.let {
                            Text(it, color = Color(0xFFAAAAAA), fontSize = 11.sp, maxLines = 1)
                        }
                    }
                    Text("${item.quantity}", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (items.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onPay, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.pay_bill))
            }
        }
    }
}

@Composable
private fun AddNewBillDropZone(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .border(2.dp, Color(0xFF666666), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFFAAAAAA), modifier = Modifier.size(32.dp))
            Text(
                stringResource(R.string.add_to_new_bill),
                color = Color(0xFFAAAAAA),
                textAlign = TextAlign.Center,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun EvenSplitDialog(
    onDismiss: () -> Unit,
    onConfirm: (Int) -> Unit
) {
    var countText by remember { mutableStateOf("2") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.split_equal)) },
        text = {
            OutlinedTextField(
                value = countText,
                onValueChange = { countText = it.filter { ch -> ch.isDigit() }.take(1) },
                label = { Text(stringResource(R.string.split_parts)) },
                singleLine = true
            )
        },
        confirmButton = {
            Button(onClick = { onConfirm(countText.toIntOrNull()?.coerceIn(2, 8) ?: 2) }) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
