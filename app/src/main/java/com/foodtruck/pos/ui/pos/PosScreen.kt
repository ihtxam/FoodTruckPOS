package com.foodtruck.pos.ui.pos

import android.app.Activity
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Remove
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TableBar
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodtruck.pos.R
import com.foodtruck.pos.data.local.entity.ProductEntity
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import com.foodtruck.pos.domain.model.CartItem
import com.foodtruck.pos.domain.model.DiscountPreset
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.ProductVariantModel
import com.foodtruck.pos.domain.model.ServiceType
import com.foodtruck.pos.domain.model.TableStatus
import com.foodtruck.pos.domain.model.TableWithOrderInfo
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.ui.license.LicenseRenewalBanner
import com.foodtruck.pos.ui.license.LicenseViewModel
import com.foodtruck.pos.ui.navigation.AppRoute
import com.foodtruck.pos.receipt.ReceiptQrGenerator
import androidx.compose.ui.draw.clip
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import androidx.compose.ui.graphics.Color
import com.foodtruck.pos.data.local.entity.CategoryEntity
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Print
import com.foodtruck.pos.domain.model.applyCashRounding
import com.foodtruck.pos.ui.theme.VectronColors
import com.foodtruck.pos.ui.theme.vectronColors
import com.foodtruck.pos.ui.theme.categoryColor
import java.util.Date
import kotlinx.coroutines.delay

@Composable
fun PosScreen(
    userRole: UserRole,
    onNavigate: (String) -> Unit,
    onBackToPos: () -> Unit = {},
    viewModel: PosViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val licenseState by hiltViewModel<LicenseViewModel>().licenseState.collectAsStateWithLifecycle()
    val activity = LocalContext.current as? Activity
    val context = LocalContext.current

    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearSnackbar()
        }
    }

    state.lastClickedProductId?.let { productId ->
        LaunchedEffect(productId) {
            delay(400)
            viewModel.clearProductHighlight()
        }
    }

    if (state.showCheckoutScreen) {
        val checkoutCart = viewModel.checkoutDisplayCart(state.cart)
        val isSplitCheckout = state.cart.splitCount > 1
        CheckoutScreen(
            cart = checkoutCart,
            currencySymbol = state.currencySymbol,
            discountPresets = state.discountPresets,
            checkoutState = state.checkoutState,
            isProcessing = state.isProcessingPayment,
            splitBillIndex = if (isSplitCheckout) state.cart.activeSplitCheck else null,
            splitBillCount = if (isSplitCheckout) state.cart.splitCount else null,
            isEqualSplit = isSplitCheckout && !state.cart.splitByItems,
            equalSplitPaidCount = state.equalSplitPaidCount,
            onBack = viewModel::dismissCheckout,
            onSelectMethod = viewModel::updateCheckoutMethod,
            onTipAmount = viewModel::updateCheckoutTipAmount,
            onTipPercent = viewModel::updateCheckoutTipPercent,
            onDiscountPercent = viewModel::updateCheckoutDiscountPercent,
            onRoundingStep = viewModel::updateCheckoutRoundingStep,
            onToggleTipPanel = viewModel::toggleCheckoutTipPanel,
            onToggleDiscountPanel = viewModel::toggleCheckoutDiscountPanel,
            onSplitClick = viewModel::openSplitBillScreen,
            onOpenCashDrawer = viewModel::openCashDrawer,
            onPrintReceipt = viewModel::printCheckoutPreview,
            onQuickCash = { amount -> viewModel.completeCheckoutWithQuickCash(amount, activity) },
            onComplete = { viewModel.completeCheckout(activity) },
            onPrevSplitBill = { viewModel.navigateSplitBill(-1) },
            onNextSplitBill = { viewModel.navigateSplitBill(1) }
        )
        if (state.showOrderComplete && state.completedTransaction != null) {
            OrderCompleteDialog(
                transaction = state.completedTransaction!!,
                currencySymbol = state.currencySymbol,
                onPrintReceipt = viewModel::printCompletedReceipt,
                onDone = viewModel::dismissOrderComplete
            )
        }
        return
    }

    if (state.showSplitBillScreen) {
        SplitBillScreen(
            cart = state.cart,
            currencySymbol = state.currencySymbol,
            selectedItemIds = state.splitSelectedItemIds,
            onBack = viewModel::dismissSplitBillScreen,
            onToggleItem = viewModel::toggleSplitItemSelection,
            onMoveToNewBill = viewModel::moveSelectedToNewBill,
            onSplitEvenly = viewModel::splitEqually,
            onPayCheck = viewModel::checkoutSplitCheck,
            onDone = viewModel::finishSplitBill
        )
        return
    }

    if (state.showOrderComplete && state.completedTransaction != null) {
        OrderCompleteDialog(
            transaction = state.completedTransaction!!,
            currencySymbol = state.currencySymbol,
            onPrintReceipt = viewModel::printCompletedReceipt,
            onDone = viewModel::dismissOrderComplete
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(vectronColors().background)
    ) {
        VectronTopBar(
            businessName = state.settings.businessName,
            userRole = userRole,
            onNavigate = onNavigate,
            onOngoingOrders = { viewModel.prepareForOngoingOrders { onNavigate(AppRoute.OngoingOrders.route) } },
            onOrderHistory = { onNavigate(AppRoute.OrderHistory.route) }
        )
        LicenseRenewalBanner(licenseState)

        Row(modifier = Modifier.weight(1f)) {
            VectronOrderPanel(
                cart = state.cart,
                currencySymbol = state.currencySymbol,
                roundingStep = state.settings.roundingStep,
                activeTableName = state.activeTableName,
                keypadBuffer = state.keypadBuffer,
                onEditItem = viewModel::editCartItem,
                onIncreaseItem = viewModel::incrementItemQuantity,
                onDecreaseItem = viewModel::decrementItemQuantity,
                onKeypadInput = viewModel::onKeypadInput,
                onKeypadBackspace = viewModel::onKeypadBackspace,
                onKeypadClear = viewModel::onKeypadClear,
                onKeypadClearAll = viewModel::onKeypadClearAll,
                onKeypadEnter = viewModel::onKeypadEnter,
                onTableClick = viewModel::showTablePicker,
                onPrintProvisional = viewModel::printProvisionalReceipt,
                onSendKitchen = viewModel::sendToKitchen,
                onKitchenMessage = viewModel::showKitchenMessageDialog,
                onHoldOrder = { viewModel.holdOrder(false) },
                onHoldAndSend = { viewModel.holdOrder(true) },
                onNewOrder = viewModel::showNewOrderDialog,
                onPickup = viewModel::showPickupOrderDialog,
                onDelivery = viewModel::showDeliveryOrderDialog,
                modifier = Modifier
                    .width(400.dp)
                    .fillMaxHeight()
            )

            VectronCategoryColumn(
                categories = state.categories,
                selectedCategoryId = state.selectedCategoryId,
                onCategorySelected = viewModel::selectCategory,
                modifier = Modifier
                    .width(140.dp)
                    .fillMaxHeight()
            )

            VectronProductGrid(
                products = state.products,
                categories = state.categories,
                currencySymbol = state.currencySymbol,
                paymentEnabled = state.cart.isEmpty.not() && !state.isProcessingPayment,
                highlightedProductId = state.lastClickedProductId,
                onProductClick = viewModel::onProductClick,
                onMiscClick = viewModel::addMiscItemQuick,
                onCash = viewModel::initiateCashPayment,
                onCard = viewModel::initiateCardPayment,
                onXpress = viewModel::xpressSale,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            )
        }
    }

    if (state.showTablePicker) {
        TablePickerDialog(
            tables = state.tables,
            currencySymbol = state.currencySymbol,
            onSelectTable = viewModel::openTable,
            onWalkIn = viewModel::switchToWalkIn,
            onDismiss = viewModel::dismissTablePicker
        )
    }

    if (state.showKitchenMessageDialog) {
        KitchenMessageDialog(
            presets = state.kitchenMessagePresets,
            onSend = viewModel::sendKitchenMessage,
            onDismiss = viewModel::dismissKitchenMessageDialog
        )
    }

    if (state.showClearCartDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissClearCartDialog,
            title = { Text(stringResource(R.string.new_order)) },
            text = { Text(stringResource(R.string.clear_cart_confirm)) },
            confirmButton = {
                TextButton(onClick = viewModel::confirmClearCart) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissClearCartDialog) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (state.showPickupDialog) {
        PickupOrderDialog(
            suggestedOrderNumber = state.suggestedOrderNumber,
            onConfirm = viewModel::confirmPickup,
            onDismiss = viewModel::dismissPickupDialog
        )
    }

    if (state.showDeliveryDialog) {
        DeliveryOrderDialog(
            suggestedOrderNumber = state.suggestedOrderNumber,
            onConfirm = viewModel::confirmDelivery,
            onDismiss = viewModel::dismissDeliveryDialog
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

    if (state.showMiscPriceDialog) {
        PriceKeypadDialog(
            title = stringResource(R.string.misc_item),
            currencySymbol = state.currencySymbol,
            onConfirm = { price -> viewModel.addMiscItemFromDialog(price) },
            onDismiss = viewModel::dismissMiscPriceDialog
        )
    }

    if (state.showSplitDialog) {
        SplitBillDialog(
            splitCount = state.cart.splitCount,
            splitByItems = state.cart.splitByItems,
            onSplitCount = viewModel::applySplitCount,
            onSplitByItems = viewModel::enableSplitByItems,
            onDismiss = viewModel::dismissSplitDialog
        )
    }

    if (state.showOpenPriceDialog && state.selectedProduct != null) {
        PriceKeypadDialog(
            title = state.selectedProduct!!.name,
            currencySymbol = state.currencySymbol,
            onConfirm = viewModel::addOpenPriceProduct,
            onDismiss = viewModel::dismissDialogs
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

    if (state.showDiscountDialog) {
        DiscountDialog(
            onApply = viewModel::applyDiscount,
            onDismiss = viewModel::dismissDialogs
        )
    }

    if (state.showPaymentSummary) {
        val payable = if (state.cart.splitByItems && state.cart.splitCount > 1) {
            state.cart.copy(items = state.cart.visibleItems)
        } else {
            state.cart
        }
        PaymentSummaryDialog(
            cart = payable,
            splitCount = state.cart.splitCount,
            splitByItems = state.cart.splitByItems,
            activeSplitCheck = state.cart.activeSplitCheck,
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
}

@Composable
private fun VectronTopBar(
    businessName: String,
    userRole: UserRole,
    onNavigate: (String) -> Unit,
    onOngoingOrders: () -> Unit,
    onOrderHistory: () -> Unit
) {
    val date = remember { SimpleDateFormat("MM/dd", Locale.getDefault()).format(Date()) }
    val vc = vectronColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(vc.header)
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(date, color = vc.textSecondary, fontSize = 12.sp)
        Text(businessName, color = vc.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onOngoingOrders) {
                Text(stringResource(R.string.ongoing_orders), color = vc.textPrimary, fontSize = 11.sp)
            }
            if (userRole.canAccessReports() || userRole.canAccessSettings()) {
                IconButton(onClick = onOrderHistory) {
                    Icon(Icons.Default.History, contentDescription = stringResource(R.string.order_history), tint = vc.textPrimary)
                }
            }
            if (userRole.canAccessSettings() || userRole.canManageProducts() || userRole.canAccessReports()) {
                IconButton(onClick = { onNavigate(AppRoute.Admin.route) }) {
                    Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.menu), tint = vc.textPrimary)
                }
            }
        }
    }
}

private enum class TableCartTab {
    ORDERING,
    ORDERED
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun VectronOrderPanel(
    cart: com.foodtruck.pos.domain.model.CartSummary,
    currencySymbol: String,
    roundingStep: Double,
    activeTableName: String?,
    keypadBuffer: String,
    onEditItem: (String) -> Unit,
    onIncreaseItem: (String) -> Unit,
    onDecreaseItem: (String) -> Unit,
    onKeypadInput: (String) -> Unit,
    onKeypadBackspace: () -> Unit,
    onKeypadClear: () -> Unit,
    onKeypadClearAll: () -> Unit,
    onKeypadEnter: () -> Unit,
    onTableClick: () -> Unit,
    onPrintProvisional: () -> Unit,
    onSendKitchen: () -> Unit,
    onKitchenMessage: () -> Unit,
    onHoldOrder: () -> Unit,
    onHoldAndSend: () -> Unit,
    onNewOrder: () -> Unit,
    onPickup: () -> Unit,
    onDelivery: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isTableMode = activeTableName != null
    val displayTotal = applyCashRounding(cart.displayTotal, roundingStep)
    val orderingItems = cart.items.filter { !it.sentToKitchen }
    val orderedItems = cart.items.filter { it.sentToKitchen }
    val showCartTabs = orderedItems.isNotEmpty()
    var cartTab by remember(activeTableName, orderedItems.size) {
        mutableStateOf(
            if (showCartTabs) TableCartTab.ORDERED else TableCartTab.ORDERING
        )
    }
    var prevOrderingCount by remember(activeTableName, showCartTabs) { mutableStateOf(orderingItems.size) }
    LaunchedEffect(orderingItems.size) {
        if (showCartTabs && orderingItems.size > prevOrderingCount) {
            cartTab = TableCartTab.ORDERING
        }
        prevOrderingCount = orderingItems.size
    }
    val displayItems = when {
        showCartTabs && cartTab == TableCartTab.ORDERED -> orderedItems
        showCartTabs -> orderingItems
        else -> cart.items
    }
    val vc = vectronColors()
    Row(
        modifier = modifier
            .background(vc.panelDark)
            .padding(6.dp)
    ) {
        CartActionSidebar(
            isTableMode = isTableMode,
            activeTableName = activeTableName,
            onTableClick = onTableClick,
            onPickup = onPickup,
            onDelivery = onDelivery,
            onNewOrder = onNewOrder,
            onHold = onHoldOrder,
            onHoldAndSend = onHoldAndSend,
            onSendKitchen = onSendKitchen,
            onKitchenMessage = onKitchenMessage
        )
        Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF2F2F2), RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.receipt), color = Color(0xFF333333), fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (!cart.isEmpty) {
                    IconButton(onClick = onPrintProvisional, modifier = Modifier.size(32.dp)) {
                        Icon(
                            Icons.Default.Print,
                            contentDescription = stringResource(R.string.provisional_receipt),
                            tint = Color(0xFF2E6DB4),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Text(
                    text = if (activeTableName != null) stringResource(R.string.dine_in) else stringResource(R.string.take_away_delivery),
                    color = Color(0xFF666666),
                    fontSize = 11.sp
                )
            }
        }

        if (showCartTabs) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                FilterChip(
                    selected = cartTab == TableCartTab.ORDERING,
                    onClick = { cartTab = TableCartTab.ORDERING },
                    label = {
                        Text(
                            "${stringResource(R.string.cart_tab_ordering)} (${orderingItems.size})",
                            fontSize = 11.sp
                        )
                    }
                )
                FilterChip(
                    selected = cartTab == TableCartTab.ORDERED,
                    onClick = { cartTab = TableCartTab.ORDERED },
                    label = {
                        Text(
                            "${stringResource(R.string.cart_tab_ordered)} (${orderedItems.size})",
                            fontSize = 11.sp
                        )
                    }
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color(0xFFF8F8F8))
        ) {
            if (displayItems.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    val emptyText = when {
                        showCartTabs && cartTab == TableCartTab.ORDERED -> stringResource(R.string.cart_tab_ordered)
                        showCartTabs -> stringResource(R.string.cart_empty)
                        else -> stringResource(R.string.cart_empty)
                    }
                    Text(emptyText, color = Color(0xFF888888), fontSize = 13.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(6.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    items(displayItems, key = { it.id }) { item ->
                        SwipeableCartRow(
                            item = item,
                            currencySymbol = currencySymbol,
                            editable = !item.sentToKitchen,
                            onEdit = { onEditItem(item.id) },
                            onDoubleTap = { onIncreaseItem(item.id) },
                            onDecrease = { onDecreaseItem(item.id) }
                        )
                    }
                }
            }
        }

        VectronKeypad(
            total = displayTotal,
            buffer = keypadBuffer,
            currencySymbol = currencySymbol,
            activeTableName = activeTableName,
            hint = stringResource(R.string.keypad_hint_misc),
            onInput = onKeypadInput,
            onBackspace = onKeypadBackspace,
            onClear = onKeypadClear,
            onClearAll = onKeypadClearAll,
            onEnter = onKeypadEnter,
            onTableClick = onTableClick
        )
        }
    }
}

@Composable
private fun CartActionSidebar(
    isTableMode: Boolean,
    activeTableName: String?,
    onTableClick: () -> Unit,
    onPickup: () -> Unit,
    onDelivery: () -> Unit,
    onNewOrder: () -> Unit,
    onHold: () -> Unit,
    onHoldAndSend: () -> Unit,
    onSendKitchen: () -> Unit,
    onKitchenMessage: () -> Unit
) {
    val vc = vectronColors()
    Column(
        modifier = Modifier
            .width(96.dp)
            .fillMaxHeight()
            .background(vc.sidebar, RoundedCornerShape(6.dp))
            .verticalScroll(rememberScrollState())
            .padding(vertical = 8.dp, horizontal = 6.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CartSidebarButton(
            label = stringResource(R.string.tables),
            shortLabel = stringResource(R.string.table_short),
            icon = Icons.Default.TableBar,
            color = if (activeTableName != null) VectronColors.CardBlue else Color(0xFF4A5568),
            onClick = onTableClick
        )
        CartSidebarButton(
            label = stringResource(R.string.pickup),
            shortLabel = stringResource(R.string.pickup_short),
            icon = Icons.Default.ShoppingBag,
            color = Color(0xFF1565C0),
            onClick = onPickup
        )
        CartSidebarButton(
            label = stringResource(R.string.delivery),
            shortLabel = stringResource(R.string.delivery_short),
            icon = Icons.Default.LocalShipping,
            color = Color(0xFF6A1B9A),
            onClick = onDelivery
        )
        CartSidebarButton(
            label = stringResource(R.string.new_order),
            shortLabel = stringResource(R.string.new_short),
            color = Color(0xFF8B0000),
            onClick = onNewOrder
        )
        HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = vc.textSecondary.copy(alpha = 0.3f))
        CartSidebarButton(
            label = stringResource(R.string.hold_order),
            shortLabel = stringResource(R.string.hold_short),
            icon = Icons.Default.Pause,
            color = Color(0xFF7D6608),
            onClick = onHold
        )
        CartSidebarButton(
            label = stringResource(R.string.hold_and_send),
            shortLabel = "H+S",
            color = Color(0xFF9A7B0A),
            onClick = onHoldAndSend
        )
        if (isTableMode) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = vc.textSecondary.copy(alpha = 0.3f))
            CartSidebarButton(
                label = stringResource(R.string.send_kitchen),
                shortLabel = stringResource(R.string.send),
                icon = Icons.Default.Send,
                color = VectronColors.CashGreen,
                onClick = onSendKitchen
            )
            CartSidebarButton(
                label = stringResource(R.string.kitchen_message),
                shortLabel = "MSG",
                color = Color(0xFF7D6608),
                onClick = onKitchenMessage
            )
        }
    }
}

@Composable
private fun CartSidebarButton(
    label: String,
    shortLabel: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    color: Color,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(color)
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(32.dp))
        }
        Text(
            text = shortLabel ?: label,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = if ((shortLabel?.length ?: label.length) > 3) 11.sp else 14.sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
            lineHeight = 12.sp
        )
    }
}

@Composable
private fun SwipeableCartRow(
    item: CartItem,
    currencySymbol: String,
    editable: Boolean,
    onEdit: () -> Unit,
    onDoubleTap: () -> Unit,
    onDecrease: () -> Unit
) {
    if (!editable) {
        VectronCartRow(
            item = item,
            currencySymbol = currencySymbol,
            editable = false,
            onEdit = onEdit,
            onDoubleTap = onDoubleTap
        )
        return
    }
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDecrease()
            }
            false
        }
    )
    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFE67E22), RoundedCornerShape(4.dp))
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White)
            }
        },
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = true
    ) {
        VectronCartRow(
            item = item,
            currencySymbol = currencySymbol,
            editable = true,
            onEdit = onEdit,
            onDoubleTap = onDoubleTap
        )
    }
}

@Composable
private fun VectronCartRow(
    item: CartItem,
    currencySymbol: String,
    editable: Boolean,
    onEdit: () -> Unit,
    onDoubleTap: () -> Unit
) {
    val rowBg = when {
        !editable -> Color(0xFFF0F0F0)
        else -> Color.White
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(rowBg)
            .pointerInput(item.id, editable) {
                detectTapGestures(
                    onTap = { if (editable) onEdit() },
                    onDoubleTap = { if (editable) onDoubleTap() }
                )
            }
            .padding(horizontal = 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).fillMaxWidth()) {
            Text(
                "${item.quantity}x ${item.productName}",
                color = Color(0xFF222222),
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )
            item.variantName?.let { Text(it, color = Color(0xFF666666), fontSize = 11.sp) }
            if (item.lineDiscount > 0) {
                Text(
                    "-${formatMoney(item.lineDiscount, currencySymbol)}",
                    color = Color(0xFFE67E22),
                    fontSize = 11.sp
                )
            }
            if (item.splitCheck > 1) {
                Text(stringResource(R.string.check_n, item.splitCheck), color = Color(0xFF888888), fontSize = 10.sp)
            }
            if (item.courseNumber > 1) {
                Text(stringResource(R.string.course_n, item.courseNumber), color = Color(0xFF888888), fontSize = 10.sp)
            }
            if (item.sentToKitchen) {
                Text(stringResource(R.string.sent_to_kitchen), color = Color(0xFF27AE60), fontSize = 10.sp)
            }
            Text(formatMoney(item.lineSubtotal, currencySymbol), color = Color(0xFF2E6DB4), fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun VectronKeypad(
    total: Double,
    buffer: String,
    currencySymbol: String,
    activeTableName: String?,
    hint: String,
    onInput: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onClearAll: () -> Unit,
    onEnter: () -> Unit,
    onTableClick: () -> Unit
) {
    val vc = vectronColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(vc.totalBar, RoundedCornerShape(4.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.total), color = VectronColors.TextSecondary, fontSize = 13.sp)
            Text(
                text = formatMoney(total, currencySymbol),
                color = VectronColors.TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        }

        Text(
            text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
            color = VectronColors.TextSecondary,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            textAlign = TextAlign.End,
            modifier = Modifier.fillMaxWidth()
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                listOf(listOf("7", "8", "9"), listOf("4", "5", "6"), listOf("1", "2", "3"), listOf("0", "00", ".")).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        row.forEach { key ->
                            KeypadKey(label = key, modifier = Modifier.weight(1f), compact = true, onClick = { onInput(key) })
                        }
                    }
                }
            }
            Column(
                modifier = Modifier.width(54.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                KeypadKey(
                    label = "",
                    icon = Icons.Default.Backspace,
                    modifier = Modifier.fillMaxWidth(),
                    compact = true,
                    onClick = onBackspace
                )
                KeypadKey(
                    label = stringResource(R.string.keypad_clear),
                    modifier = Modifier.fillMaxWidth(),
                    compact = true,
                    onClick = onClear,
                    onLongClick = onClearAll
                )
                KeypadKey(
                    label = stringResource(R.string.keypad_enter),
                    icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                    modifier = Modifier.fillMaxWidth(),
                    compact = true,
                    keyHeight = 58.dp,
                    iconSize = 24.dp,
                    highlight = true,
                    onClick = onEnter
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (activeTableName != null) VectronColors.CardBlue.copy(alpha = 0.35f) else VectronColors.KeypadButton,
                    RoundedCornerShape(4.dp)
                )
                .padding(vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (activeTableName != null) {
                Text(activeTableName, color = VectronColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.dine_in), color = Color(0xFF8FD4FF), fontSize = 11.sp)
            } else {
                Text(stringResource(R.string.take_away_delivery), color = VectronColors.TextSecondary, fontSize = 11.sp)
            }
        }
        Text(hint, color = VectronColors.TextSecondary, fontSize = 10.sp, maxLines = 1, modifier = Modifier.fillMaxWidth())
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun KeypadKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    compact: Boolean = false,
    keyHeight: androidx.compose.ui.unit.Dp? = null,
    iconSize: androidx.compose.ui.unit.Dp = 18.dp,
    highlight: Boolean = false,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null
) {
    val bg = when {
        highlight -> VectronColors.CardBlue
        else -> VectronColors.KeypadButton
    }
    val height = keyHeight ?: if (compact) 32.dp else 44.dp
    val fontSize = if (compact) 13.sp else 16.sp
    Box(
        modifier = modifier
            .height(height)
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .then(
                if (onLongClick != null) {
                    Modifier.combinedClickable(onClick = onClick, onLongClick = onLongClick)
                } else {
                    Modifier.clickable(onClick = onClick)
                }
            ),
        contentAlignment = Alignment.Center
    ) {
        if (icon != null && label.isBlank()) {
            Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(iconSize))
        } else if (icon != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(iconSize))
                Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp, maxLines = 1)
            }
        } else {
            Text(label, color = VectronColors.KeypadText, fontWeight = FontWeight.Bold, fontSize = fontSize)
        }
    }
}

@Composable
private fun VectronCategoryColumn(
    categories: List<CategoryEntity>,
    selectedCategoryId: Long?,
    onCategorySelected: (Long?) -> Unit,
    modifier: Modifier = Modifier
) {
    val vc = vectronColors()
    Column(
        modifier = modifier
            .background(vc.panelDark)
            .verticalScroll(rememberScrollState())
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        categories.forEach { category ->
            val selected = selectedCategoryId == category.id
            val bg = if (selected) categoryColor(category.colorHex) else categoryColor(category.colorHex).copy(alpha = 0.5f)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(bg)
                    .clickable { onCategorySelected(category.id) }
                    .padding(8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    category.name,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun VectronProductGrid(
    products: List<ProductEntity>,
    categories: List<CategoryEntity>,
    currencySymbol: String,
    paymentEnabled: Boolean,
    highlightedProductId: Long? = null,
    onProductClick: (Long) -> Unit,
    onMiscClick: () -> Unit,
    onCash: () -> Unit,
    onCard: () -> Unit,
    onXpress: () -> Unit,
    modifier: Modifier = Modifier
) {
    val vc = vectronColors()
    val colorByCategory = categories.associate { it.id to categoryColor(it.colorHex) }
    Column(modifier = modifier.background(vc.background)) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(5),
            modifier = Modifier
                .weight(1f)
                .padding(6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            item(key = "misc") {
                VectronMiscButton(onClick = onMiscClick)
            }
            items(products, key = { it.id }) { product ->
                val bg = product.categoryId?.let { colorByCategory[it] } ?: VectronColors.DefaultProduct
                VectronProductButton(
                    product = product,
                    background = bg,
                    currencySymbol = currencySymbol,
                    highlighted = product.id == highlightedProductId,
                    onClick = { onProductClick(product.id) }
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(VectronColors.Header)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = onXpress,
                enabled = paymentEnabled,
                modifier = Modifier.weight(1f).height(64.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFE67E22),
                    disabledContainerColor = VectronColors.KeypadButton
                )
            ) {
                Text(stringResource(R.string.xpress_sale), fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onCash,
                enabled = paymentEnabled,
                modifier = Modifier.weight(1f).height(64.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VectronColors.CashGreen,
                    disabledContainerColor = VectronColors.KeypadButton
                )
            ) {
                Text(stringResource(R.string.cash), fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onCard,
                enabled = paymentEnabled,
                modifier = Modifier.weight(1f).height(64.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VectronColors.CardBlue,
                    disabledContainerColor = VectronColors.KeypadButton
                )
            ) {
                Text(stringResource(R.string.payment_by_card), fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun VectronMiscButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(88.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF5C4B7A))
            .clickable(onClick = onClick)
            .padding(10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            stringResource(R.string.misc_item),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            fontSize = 14.sp
        )
    }
}

@Composable
private fun VectronProductButton(
    product: ProductEntity,
    background: Color,
    currencySymbol: String,
    highlighted: Boolean = false,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(88.dp)
            .clip(RoundedCornerShape(8.dp))
            .then(
                if (highlighted) Modifier.border(3.dp, Color.White, RoundedCornerShape(8.dp))
                else Modifier
            )
            .background(background)
            .clickable(onClick = onClick)
            .padding(10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                product.name,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                fontSize = 14.sp
            )
            if (!product.isOpenPrice) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(formatMoney(product.price, currencySymbol), color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String, bold: Boolean = false, light: Boolean = false) {
    val labelColor = if (light) VectronColors.TextSecondary else MaterialTheme.colorScheme.onSurface
    val valueColor = if (light) VectronColors.TextPrimary else MaterialTheme.colorScheme.onSurface
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, color = labelColor)
        Text(value, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, fontSize = if (bold) 20.sp else 16.sp, color = valueColor)
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

@Composable
private fun TablePickerDialog(
    tables: List<TableWithOrderInfo>,
    currencySymbol: String,
    onSelectTable: (Long) -> Unit,
    onWalkIn: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_table)) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 380.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(VectronColors.CardBlue)
                        .clickable(onClick = onWalkIn)
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.take_away_delivery), color = Color.White, fontWeight = FontWeight.Bold)
                }
                tables.chunked(3).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row.forEach { table ->
                            val bg = when (table.status) {
                                TableStatus.OCCUPIED -> Color(0xFFE67E22)
                                TableStatus.ACTIVE -> VectronColors.CashGreen.copy(alpha = 0.85f)
                                TableStatus.FREE -> VectronColors.KeypadButton
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(64.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(bg)
                                    .clickable { onSelectTable(table.id) }
                                    .padding(6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    when (table.status) {
                                        TableStatus.OCCUPIED -> {
                                            Text(
                                                stringResource(R.string.table_busy),
                                                color = Color.White.copy(alpha = 0.95f),
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                "${table.itemCount} \u00B7 ${formatMoney(table.orderTotal, currencySymbol)}",
                                                color = Color.White.copy(alpha = 0.9f),
                                                fontSize = 10.sp
                                            )
                                        }
                                        TableStatus.ACTIVE -> {
                                            Text(
                                                "${table.itemCount} \u00B7 ${formatMoney(table.orderTotal, currencySymbol)}",
                                                color = Color.White.copy(alpha = 0.9f),
                                                fontSize = 10.sp
                                            )
                                        }
                                        TableStatus.FREE -> Unit
                                    }
                                }
                            }
                        }
                        repeat(3 - row.size) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
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
private fun KitchenMessageDialog(
    presets: List<com.foodtruck.pos.domain.model.KitchenMessagePreset>,
    onSend: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var customMessage by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.kitchen_message)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                presets.forEach { preset ->
                    Button(
                        onClick = { onSend(preset.message) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(preset.label)
                    }
                }
                OutlinedTextField(
                    value = customMessage,
                    onValueChange = { customMessage = it },
                    label = { Text(stringResource(R.string.custom_message)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = false,
                    maxLines = 3
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (customMessage.isNotBlank()) onSend(customMessage) },
                enabled = customMessage.isNotBlank()
            ) {
                Text(stringResource(R.string.send))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
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
private fun OptionGroupDialog(
    picker: com.foodtruck.pos.domain.model.OptionGroupPicker,
    currencySymbol: String,
    onConfirm: (Set<String>) -> Unit,
    onDismiss: () -> Unit
) {
    val selected = remember(picker) { mutableStateListOf<String>() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(picker.groupName) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (picker.limitQuantity <= 1) "Choose 1" else "Choose up to ${picker.limitQuantity}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                picker.choices.forEach { choice ->
                    val isSelected = choice.name in selected
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            if (picker.limitQuantity <= 1) {
                                selected.clear()
                                selected.add(choice.name)
                            } else if (isSelected) {
                                selected.remove(choice.name)
                            } else if (selected.size < picker.limitQuantity) {
                                selected.add(choice.name)
                            }
                        },
                        label = {
                            Text(
                                if (picker.isAddon && choice.price > 0) {
                                    "${choice.name} +${formatMoney(choice.price, currencySymbol)}"
                                } else choice.name
                            )
                        }
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selected.toSet()) }) {
                Text(stringResource(R.string.confirm))
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
                        Text("${variant.name} - ${formatMoney(variant.price, currencySymbol)}")
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
    splitCount: Int,
    splitByItems: Boolean,
    activeSplitCheck: Int,
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
                if (splitByItems && splitCount > 1) {
                    Text(stringResource(R.string.paying_check, activeSplitCheck))
                } else if (splitCount > 1) {
                    Text(stringResource(R.string.split_each, splitCount, formatMoney(cart.total / splitCount, currencySymbol)))
                }
                SummaryRow(stringResource(R.string.subtotal), formatMoney(cart.subtotal, currencySymbol))
                SummaryRow(stringResource(R.string.tax), formatMoney(cart.taxTotal, currencySymbol))
                SummaryRow(stringResource(R.string.total), formatMoney(cart.total, currencySymbol), bold = true)
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
private fun SplitBillDialog(
    splitCount: Int,
    splitByItems: Boolean,
    onSplitCount: (Int) -> Unit,
    onSplitByItems: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.split_bill)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.split_equal), fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(2, 3, 4).forEach { count ->
                        Button(
                            onClick = { onSplitCount(count) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (splitCount == count && !splitByItems) {
                                    VectronColors.CardBlue
                                } else {
                                    VectronColors.KeypadButton
                                }
                            )
                        ) {
                            Text("$count")
                        }
                    }
                }
                Button(onClick = onSplitByItems, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.split_by_items))
                }
                if (splitByItems) {
                    Text(stringResource(R.string.paying_check, splitCount), fontSize = 12.sp)
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
                Text(stringResource(R.string.payment_success), color = VectronColors.CashGreen, fontWeight = FontWeight.Bold)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickupOrderDialog(
    suggestedOrderNumber: String,
    onConfirm: (String, Long?) -> Unit,
    onDismiss: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }
    var orderNumberField by remember(suggestedOrderNumber) {
        mutableStateOf(TextFieldValue(suggestedOrderNumber, TextRange(0, suggestedOrderNumber.length)))
    }
    var asap by remember { mutableStateOf(true) }
    val now = remember { Calendar.getInstance() }
    var pickupDateMillis by remember { mutableStateOf(now.timeInMillis) }
    var pickupHour by remember { mutableIntStateOf(now.get(Calendar.HOUR_OF_DAY)) }
    var pickupMinute by remember { mutableIntStateOf(((now.get(Calendar.MINUTE) / 5) + 1) * 5 % 60) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val dateLabel = remember(pickupDateMillis) {
        SimpleDateFormat("EEE, dd MMM yyyy", Locale.getDefault()).format(pickupDateMillis)
    }
    val timeLabel = remember(pickupHour, pickupMinute) {
        String.format(Locale.getDefault(), "%02d:%02d", pickupHour, pickupMinute)
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = pickupDateMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { pickupDateMillis = it }
                    showDatePicker = false
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text(stringResource(R.string.cancel)) }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = pickupHour,
            initialMinute = pickupMinute,
            is24Hour = true
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text(stringResource(R.string.pickup_time)) },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    pickupHour = timePickerState.hour
                    pickupMinute = timePickerState.minute
                    showTimePicker = false
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.pickup_order)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = orderNumberField,
                    onValueChange = { orderNumberField = it },
                    label = { Text(stringResource(R.string.order_number)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester),
                    singleLine = true
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.pickup_asap))
                    androidx.compose.material3.Switch(checked = asap, onCheckedChange = { asap = it })
                }
                if (!asap) {
                    OutlinedButton(
                        onClick = { showDatePicker = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(dateLabel)
                    }
                    OutlinedButton(
                        onClick = { showTimePicker = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(timeLabel)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val orderNumber = orderNumberField.text.trim()
                    val pickupMs = if (asap) {
                        null
                    } else {
                        buildPickupTimeMillis(pickupDateMillis, pickupHour, pickupMinute)
                    }
                    onConfirm(orderNumber, pickupMs)
                },
                enabled = orderNumberField.text.isNotBlank()
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun DeliveryOrderDialog(
    suggestedOrderNumber: String,
    onConfirm: (String, String, String, String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var orderNumber by remember(suggestedOrderNumber) { mutableStateOf(suggestedOrderNumber) }
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var zip by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.delivery_order)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = orderNumber,
                    onValueChange = { orderNumber = it },
                    label = { Text(stringResource(R.string.order_number)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.client_name)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text(stringResource(R.string.address)) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                OutlinedTextField(
                    value = zip,
                    onValueChange = { zip = it },
                    label = { Text(stringResource(R.string.zip_code)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text(stringResource(R.string.telephone)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(orderNumber, name, address, zip, phone) },
                enabled = orderNumber.isNotBlank() && name.isNotBlank() && address.isNotBlank()
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

private fun buildPickupTimeMillis(dateMillis: Long, hour: Int, minute: Int): Long {
    val cal = Calendar.getInstance()
    cal.timeInMillis = dateMillis
    cal.set(Calendar.HOUR_OF_DAY, hour)
    cal.set(Calendar.MINUTE, minute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}
