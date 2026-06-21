package com.foodtruck.pos.ui.pos

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodtruck.pos.R
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.domain.model.CartItem
import com.foodtruck.pos.domain.model.ProductVariantModel
import com.foodtruck.pos.receipt.ReceiptQrGenerator
import com.foodtruck.pos.ui.theme.PosColors
import java.util.Locale

@Composable
fun PosScreen(
    viewModel: PosViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val activity = LocalContext.current as? Activity

    Box(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxSize()) {
            CategoryPanel(
                categories = state.categories,
                selectedCategoryId = state.selectedCategoryId,
                onCategorySelected = viewModel::selectCategory,
                modifier = Modifier
                    .width(140.dp)
                    .fillMaxHeight()
            )

            ProductGridPanel(
                products = state.products,
                currencySymbol = state.currencySymbol,
                onProductClick = viewModel::onProductClick,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            )

            CartPanel(
                cart = state.cart,
                currencySymbol = state.currencySymbol,
                onIncrease = { id, qty -> viewModel.updateQuantity(id, qty + 1) },
                onDecrease = { id, qty -> viewModel.updateQuantity(id, qty - 1) },
                onRemove = viewModel::removeItem,
                onDiscountClick = viewModel::showDiscountDialog,
                modifier = Modifier
                    .width(320.dp)
                    .fillMaxHeight()
            )
        }

        PaymentBar(
            enabled = state.cart.isEmpty.not() && !state.isProcessingPayment,
            onCash = viewModel::initiateCashPayment,
            onCard = viewModel::initiateCardPayment,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }

    if (state.showOpenPriceDialog && state.selectedProduct != null) {
        OpenPriceDialog(
            productName = state.selectedProduct!!.name,
            currencySymbol = state.currencySymbol,
            onConfirm = viewModel::addOpenPriceProduct,
            onDismiss = viewModel::dismissDialogs
        )
    }

    if (state.showVariantDialog && state.selectedProduct != null) {
        VariantDialog(
            productName = state.selectedProduct!!.name,
            variants = state.selectedProduct!!.variants,
            currencySymbol = state.currencySymbol,
            onSelect = viewModel::addVariantProduct,
            onDismiss = viewModel::dismissDialogs
        )
    }

    if (state.showDiscountDialog) {
        DiscountDialog(
            onApply = viewModel::applyDiscount,
            onDismiss = viewModel::dismissDialogs
        )
    }

    if (state.showPaymentSummary) {
        PaymentSummaryDialog(
            cart = state.cart,
            currencySymbol = state.currencySymbol,
            method = state.pendingPaymentMethod,
            isProcessing = state.isProcessingPayment,
            message = state.tapToPayMessage,
            onConfirm = { viewModel.confirmPayment(activity) },
            onDismiss = viewModel::dismissPaymentSummary
        )
    }

    if (state.showReceiptOptions && state.lastTransaction != null) {
        ReceiptOptionsDialog(
            receiptUrl = state.lastTransaction!!.receiptUrl.orEmpty(),
            onPrint = viewModel::printLastReceipt,
            onSkip = viewModel::dismissReceiptOptions
        )
    }

    state.errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearError,
            title = { Text(stringResource(R.string.payment_failed)) },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = viewModel::clearError) {
                    Text(stringResource(R.string.confirm))
                }
            }
        )
    }
}

@Composable
private fun CategoryPanel(
    categories: List<com.foodtruck.pos.data.local.entity.CategoryEntity>,
    selectedCategoryId: Long?,
    onCategorySelected: (Long?) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(modifier = modifier, tonalElevation = 2.dp) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(R.string.category),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(8.dp)
            )
            FilterChip(
                selected = selectedCategoryId == null,
                onClick = { onCategorySelected(null) },
                label = { Text(stringResource(R.string.all_categories)) },
                modifier = Modifier.fillMaxWidth()
            )
            categories.forEach { category ->
                FilterChip(
                    selected = selectedCategoryId == category.id,
                    onClick = { onCategorySelected(category.id) },
                    label = { Text(category.name, maxLines = 2) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun ProductGridPanel(
    products: List<ProductEntity>,
    currencySymbol: String,
    onProductClick: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 140.dp),
        modifier = modifier.padding(12.dp),
        contentPadding = PaddingValues(bottom = 88.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(products, key = { it.id }) { product ->
            ProductButton(
                product = product,
                currencySymbol = currencySymbol,
                onClick = { onProductClick(product.id) }
            )
        }
    }
}

@Composable
private fun ProductButton(
    product: ProductEntity,
    currencySymbol: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = product.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2
            )
            Text(
                text = if (product.isOpenPrice) stringResource(R.string.open_price)
                else formatMoney(product.price, currencySymbol),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun CartPanel(
    cart: com.foodtruck.pos.domain.model.CartSummary,
    currencySymbol: String,
    onIncrease: (String, Int) -> Unit,
    onDecrease: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
    onDiscountClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(modifier = modifier, tonalElevation = 4.dp) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text(
                text = stringResource(R.string.cart),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(16.dp)
            )
            HorizontalDivider()
            if (cart.isEmpty) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.cart_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(cart.items, key = { it.id }) { item ->
                        CartItemRow(
                            item = item,
                            currencySymbol = currencySymbol,
                            onIncrease = { onIncrease(item.id, item.quantity) },
                            onDecrease = { onDecrease(item.id, item.quantity) },
                            onRemove = { onRemove(item.id) }
                        )
                    }
                }
            }
            HorizontalDivider()
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SummaryRow(stringResource(R.string.subtotal), formatMoney(cart.subtotal, currencySymbol))
                SummaryRow(stringResource(R.string.tax), formatMoney(cart.taxTotal, currencySymbol))
                if (cart.discountValue > 0) {
                    SummaryRow(stringResource(R.string.discount), "-${formatMoney(cart.discountValue, currencySymbol)}")
                }
                TextButton(onClick = onDiscountClick, modifier = Modifier.align(Alignment.End)) {
                    Text(stringResource(R.string.apply_discount))
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                SummaryRow(
                    stringResource(R.string.total),
                    formatMoney(cart.total, currencySymbol),
                    bold = true
                )
            }
        }
    }
}

@Composable
private fun CartItemRow(
    item: CartItem,
    currencySymbol: String,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
    onRemove: () -> Unit
) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.productName, fontWeight = FontWeight.SemiBold)
                    item.variantName?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    Text(formatMoney(item.lineTotal, currencySymbol), color = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onDecrease) { Icon(Icons.Default.Remove, contentDescription = null) }
                Text("${item.quantity}", fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp), textAlign = TextAlign.Center)
                IconButton(onClick = onIncrease) { Icon(Icons.Default.Add, contentDescription = null) }
                IconButton(onClick = onRemove) { Icon(Icons.Default.Delete, contentDescription = null) }
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String, bold: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
        Text(value, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, fontSize = if (bold) 20.sp else 16.sp)
    }
}

@Composable
private fun PaymentBar(
    enabled: Boolean,
    onCash: () -> Unit,
    onCard: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Button(
            onClick = onCash,
            enabled = enabled,
            modifier = Modifier
                .weight(1f)
                .height(64.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosColors.Cash)
        ) {
            Text(stringResource(R.string.cash), fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Button(
            onClick = onCard,
            enabled = enabled,
            modifier = Modifier
                .weight(1f)
                .height(64.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosColors.Card)
        ) {
            Text(stringResource(R.string.card), fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OpenPriceDialog(
    productName: String,
    currencySymbol: String,
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    var priceText by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(productName) },
        text = {
            OutlinedTextField(
                value = priceText,
                onValueChange = { priceText = it },
                label = { Text(stringResource(R.string.enter_price)) },
                prefix = { Text("$currencySymbol ") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true
            )
        },
        confirmButton = {
            Button(onClick = { priceText.toDoubleOrNull()?.let(onConfirm) }) {
                Text(stringResource(R.string.add_to_cart))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun VariantDialog(
    productName: String,
    variants: List<ProductVariantModel>,
    currencySymbol: String,
    onSelect: (ProductVariantModel) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_variant)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(productName, fontWeight = FontWeight.SemiBold)
                variants.forEach { variant ->
                    Button(
                        onClick = { onSelect(variant) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("${variant.name}  ${formatMoney(variant.price, currencySymbol)}")
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun DiscountDialog(
    onApply: (Double, Double) -> Unit,
    onDismiss: () -> Unit
) {
    var percent by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.apply_discount)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = percent,
                    onValueChange = { percent = it; amount = "" },
                    label = { Text(stringResource(R.string.discount_percent)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it; percent = "" },
                    label = { Text(stringResource(R.string.discount_amount)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(onClick = {
                onApply(percent.toDoubleOrNull() ?: 0.0, amount.toDoubleOrNull() ?: 0.0)
            }) { Text(stringResource(R.string.confirm)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun PaymentSummaryDialog(
    cart: com.foodtruck.pos.domain.model.CartSummary,
    currencySymbol: String,
    method: com.foodtruck.pos.domain.model.PaymentMethod?,
    isProcessing: Boolean,
    message: String?,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!isProcessing) onDismiss() },
        title = { Text(stringResource(R.string.payment_summary)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${cart.items.size} items")
                Text(
                    text = formatMoney(cart.total, currencySymbol),
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                method?.let {
                    Text(
                        text = if (it == com.foodtruck.pos.domain.model.PaymentMethod.CASH)
                            stringResource(R.string.cash) else stringResource(R.string.card)
                    )
                }
                message?.let { Text(it) }
                if (isProcessing) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }
        },
        confirmButton = {
            Button(onClick = onConfirm, enabled = !isProcessing) {
                Text(stringResource(R.string.confirm_payment))
            }
        },
        dismissButton = {
            if (!isProcessing) {
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
            }
        }
    )
}

@Composable
private fun ReceiptOptionsDialog(
    receiptUrl: String,
    onPrint: () -> Unit,
    onSkip: () -> Unit
) {
    val qrGenerator = remember { ReceiptQrGenerator() }
    val qrBitmap = remember(receiptUrl) {
        if (receiptUrl.isNotBlank()) qrGenerator.generateQrBitmap(receiptUrl, 256) else null
    }

    AlertDialog(
        onDismissRequest = onSkip,
        title = { Text(stringResource(R.string.receipt_options)) },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(stringResource(R.string.payment_success), color = PosColors.Cash, fontWeight = FontWeight.Bold)
                qrBitmap?.let {
                    androidx.compose.foundation.Image(
                        bitmap = it.asImageBitmap(),
                        contentDescription = stringResource(R.string.digital_receipt),
                        modifier = Modifier.size(180.dp)
                    )
                }
                Text(receiptUrl, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
            }
        },
        confirmButton = {
            Button(onClick = onPrint) { Text(stringResource(R.string.print_receipt)) }
        },
        dismissButton = {
            TextButton(onClick = onSkip) { Text(stringResource(R.string.skip_receipt)) }
        }
    )
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
