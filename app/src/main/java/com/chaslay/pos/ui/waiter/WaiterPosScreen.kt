package com.chaslay.pos.ui.waiter

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.TableBar
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.pos.CheckoutScreen
import com.chaslay.pos.ui.pos.OrderCompleteDialog
import com.chaslay.pos.ui.pos.PosViewModel
import com.chaslay.pos.ui.pos.ComboPickDialog
import com.chaslay.pos.ui.pos.ProductCustomizeDialog
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import com.chaslay.pos.ui.tableplan.GuestCountDialog

private enum class WaiterTab { TABLES, ORDER }

@Composable
fun WaiterPosScreen(
    userAccess: UserAccess,
    onLogout: () -> Unit,
    viewModel: PosViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context as? Activity
    var tab by remember { mutableStateOf(WaiterTab.TABLES) }

    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearSnackbar()
        }
    }

    LaunchedEffect(state.activeTableName) {
        if (state.activeTableName != null) tab = WaiterTab.ORDER
    }

    if (state.showCheckoutScreen) {
        val checkoutCart = viewModel.checkoutDisplayCart(state.cart)
        CheckoutScreen(
            cart = checkoutCart,
            currencySymbol = state.currencySymbol,
            discountPresets = state.discountPresets,
            checkoutState = state.checkoutState,
            isProcessing = state.isProcessingPayment,
            onBack = viewModel::dismissCheckout,
            onSelectMethod = viewModel::updateCheckoutMethod,
            onTipAmount = viewModel::updateCheckoutTipAmount,
            onTipPercent = viewModel::updateCheckoutTipPercent,
            onDiscountPercent = viewModel::updateCheckoutDiscountPercent,
            onRoundingStep = viewModel::updateCheckoutRoundingStep,
            onToggleTipPanel = viewModel::toggleCheckoutTipPanel,
            onToggleDiscountPanel = viewModel::toggleCheckoutDiscountPanel,
            onSplitClick = {},
            onOpenCashDrawer = {},
            onPrintReceipt = {},
            onQuickCash = { amount -> viewModel.completeCheckoutWithQuickCash(amount, activity) },
            onComplete = { viewModel.completeCheckout(activity) }
        )
        if (state.showOrderComplete && state.completedTransaction != null) {
            OrderCompleteDialog(
                transaction = state.completedTransaction!!,
                currencySymbol = state.currencySymbol,
                successMessage = state.successMessage,
                receiptPublicUrl = state.receiptPublicUrl,
                orderCompleteNotice = state.orderCompleteNotice,
                showAdyenPaymentReceipt = state.adyenCustomerReceipt != null,
                showAdyenCashierReceipt = state.adyenCashierReceipt != null,
                onPrintReceipt = {},
                onPrintAdyenPaymentReceipt = {},
                onPrintAdyenCashierReceipt = {},
                onShareEmail = {},
                onDone = {
                    viewModel.dismissOrderComplete()
                    tab = WaiterTab.TABLES
                }
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(vectronColors().background)
    ) {
        WaiterTopBar(
            businessName = state.settings.businessName,
            tableName = state.activeTableName,
            onLogout = onLogout
        )

        Box(modifier = Modifier.weight(1f)) {
            when (tab) {
                WaiterTab.TABLES -> WaiterTablesPanel(
                    tables = state.tables,
                    currencySymbol = state.currencySymbol,
                    activeTableName = state.activeTableName,
                    onSelectTable = { tableId ->
                        viewModel.openTable(tableId)
                        tab = WaiterTab.ORDER
                    }
                )
                WaiterTab.ORDER -> WaiterOrderPanel(
                    cartItems = state.cart.items,
                    categories = state.categories,
                    products = state.products,
                    selectedCategoryId = state.selectedCategoryId,
                    currencySymbol = state.currencySymbol,
                    tableName = state.activeTableName,
                    total = state.cart.total,
                    hasUnsent = state.cart.items.any { !it.sentToKitchen },
                    onSelectCategory = viewModel::selectCategory,
                    onProductClick = viewModel::onProductClick,
                    onIncrease = viewModel::incrementItemQuantity,
                    onDecrease = viewModel::decrementItemQuantity,
                    onSendKitchen = viewModel::sendToKitchen,
                    onPay = viewModel::initiateCardPayment,
                    onPickTable = { tab = WaiterTab.TABLES }
                )
            }
        }

        NavigationBar {
            NavigationBarItem(
                selected = tab == WaiterTab.TABLES,
                onClick = { tab = WaiterTab.TABLES },
                icon = { Icon(Icons.Default.TableBar, contentDescription = null) },
                label = { Text(stringResource(R.string.waiter_tables)) }
            )
            NavigationBarItem(
                selected = tab == WaiterTab.ORDER,
                onClick = { tab = WaiterTab.ORDER },
                icon = { Icon(Icons.Default.Restaurant, contentDescription = null) },
                label = { Text(stringResource(R.string.waiter_order)) }
            )
        }
    }

    if (state.showGuestCountDialog) {
        GuestCountDialog(
            tableName = state.guestCountTableName,
            seatCapacity = state.guestCountSeatCapacity,
            initialCount = state.guestCountDefault,
            onConfirm = viewModel::confirmGuestCount,
            onDismiss = viewModel::dismissGuestCountDialog
        )
    }

    state.productCustomize?.let { customize ->
        ProductCustomizeDialog(
            state = customize,
            currencySymbol = state.currencySymbol,
            onAdd = viewModel::addCustomizedProduct,
            onDismiss = viewModel::dismissProductCustomize
        )
    }

    state.comboPick?.let { comboPick ->
        ComboPickDialog(
            state = comboPick,
            currencySymbol = state.currencySymbol,
            onConfirm = viewModel::addComboToCart,
            onDismiss = viewModel::dismissComboPick
        )
    }

    state.errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearError,
            title = { Text(state.errorTitle ?: stringResource(R.string.error)) },
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
private fun WaiterTopBar(
    businessName: String,
    tableName: String?,
    onLogout: () -> Unit
) {
    val vc = vectronColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(vc.header)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(businessName, color = vc.textPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            tableName?.let {
                Text(
                    stringResource(R.string.dine_in) + ": $it",
                    color = vc.textSecondary,
                    fontSize = 12.sp
                )
            }
        }
        IconButton(onClick = onLogout) {
            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = stringResource(R.string.logout), tint = vc.textPrimary)
        }
    }
}

@Composable
private fun WaiterTablesPanel(
    tables: List<TableWithOrderInfo>,
    currencySymbol: String,
    activeTableName: String?,
    onSelectTable: (Long) -> Unit
) {
    val mainFloorLabel = stringResource(R.string.main_floor)
    val patioLabel = stringResource(R.string.patio_floor)
    val floorPairs = remember(tables, mainFloorLabel, patioLabel) {
        if (tables.size <= 1) {
            listOf(mainFloorLabel to tables)
        } else {
            val split = (tables.size + 1) / 2
            listOf(
                mainFloorLabel to tables.take(split),
                patioLabel to tables.drop(split)
            )
        }
    }
    var selectedFloor by remember(tables) { mutableIntStateOf(0) }
    val floorTables = floorPairs.getOrElse(selectedFloor) { floorPairs.first() }.second

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            floorPairs.forEachIndexed { index, (name, _) ->
                FilterChip(
                    selected = selectedFloor == index,
                    onClick = { selectedFloor = index },
                    label = { Text(name, fontSize = 12.sp) }
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 100.dp),
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 8.dp)
        ) {
            items(floorTables, key = { it.id }) { table ->
                WaiterTableCard(
                    table = table,
                    currencySymbol = currencySymbol,
                    isActive = table.name == activeTableName,
                    onClick = { onSelectTable(table.id) }
                )
            }
        }
    }
}

@Composable
private fun WaiterTableCard(
    table: TableWithOrderInfo,
    currencySymbol: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    val bg = when {
        isActive -> VectronColors.CardBlue
        table.status == TableStatus.OCCUPIED -> Color(0xFFE67E22)
        table.status == TableStatus.ACTIVE -> VectronColors.CashGreen.copy(alpha = 0.9f)
        else -> Color(0xFF5C6BC0).copy(alpha = 0.75f)
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (table.orderTotal > 0.0) {
                Text(
                    "$currencySymbol ${"%.2f".format(table.orderTotal)}",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 11.sp
                )
            }
            Text(
                "${table.seatCapacity} seats",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 9.sp
            )
        }
    }
}

@Composable
private fun WaiterOrderPanel(
    cartItems: List<CartItem>,
    categories: List<com.chaslay.pos.data.local.entity.CategoryEntity>,
    products: List<com.chaslay.pos.data.local.entity.ProductEntity>,
    selectedCategoryId: Long?,
    currencySymbol: String,
    tableName: String?,
    total: Double,
    hasUnsent: Boolean,
    onSelectCategory: (Long?) -> Unit,
    onProductClick: (Long) -> Unit,
    onIncrease: (String) -> Unit,
    onDecrease: (String) -> Unit,
    onSendKitchen: () -> Unit,
    onPay: () -> Unit,
    onPickTable: () -> Unit
) {
    if (tableName == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(stringResource(R.string.waiter_pick_table), textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onPickTable) {
                Text(stringResource(R.string.waiter_tables))
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (cartItems.isNotEmpty()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 140.dp)
                        .padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(cartItems, key = { it.id }) { item ->
                        WaiterCartRow(
                            item = item,
                            currencySymbol = currencySymbol,
                            onIncrease = { onIncrease(item.id) },
                            onDecrease = { onDecrease(item.id) }
                        )
                    }
                }
                HorizontalDivider()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.total), fontWeight = FontWeight.Bold)
                    Text("$currencySymbol ${"%.2f".format(total)}", fontWeight = FontWeight.Bold)
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onSendKitchen,
                modifier = Modifier.weight(1f),
                enabled = hasUnsent
            ) {
                Text(stringResource(R.string.send_to_kitchen))
            }
            Button(
                onClick = onPay,
                modifier = Modifier.weight(1f),
                enabled = cartItems.isNotEmpty(),
                colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
            ) {
                Text(stringResource(R.string.payment))
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            FilterChip(
                selected = selectedCategoryId == null,
                onClick = { onSelectCategory(null) },
                label = { Text(stringResource(R.string.all_categories), fontSize = 11.sp) }
            )
            categories.take(6).forEach { cat ->
                FilterChip(
                    selected = selectedCategoryId == cat.id,
                    onClick = { onSelectCategory(cat.id) },
                    label = { Text(cat.name, fontSize = 11.sp) }
                )
            }
        }

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 96.dp),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(products, key = { it.id }) { product ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(VectronColors.CardBlue.copy(alpha = 0.85f))
                        .clickable { onProductClick(product.id) }
                        .padding(6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            product.name,
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            maxLines = 2
                        )
                        Text(
                            "$currencySymbol ${"%.2f".format(product.price)}",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 10.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WaiterCartRow(
    item: CartItem,
    currencySymbol: String,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.productName, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
            Text(
                "$currencySymbol ${"%.2f".format(item.lineTotal)}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onDecrease) { Text("?") }
            Text("${item.quantity}", modifier = Modifier.padding(horizontal = 4.dp))
            TextButton(onClick = onIncrease) { Text("+") }
        }
    }
}
