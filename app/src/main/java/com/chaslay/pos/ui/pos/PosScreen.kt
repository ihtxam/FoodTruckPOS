package com.chaslay.pos.ui.pos

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
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Remove
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TableBar
import androidx.compose.material.icons.automirrored.filled.Logout
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
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.ProductEntity
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.ui.scanner.BarcodeScannerDialog
import com.chaslay.pos.ui.scanner.BarcodeWedgeListener
import com.chaslay.pos.domain.model.ProductVariantModel
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.ongoing.OngoingOrdersScreen
import com.chaslay.pos.ui.orderhistory.OrderHistoryScreen
import com.chaslay.pos.ui.license.LicenseRenewalBanner
import com.chaslay.pos.ui.license.LicenseViewModel
import com.chaslay.pos.ui.navigation.AppRoute
import com.chaslay.pos.receipt.ReceiptQrGenerator
import androidx.compose.ui.draw.clip
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import androidx.compose.ui.graphics.Color
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.CustomerEntity
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.Restaurant
import com.chaslay.pos.domain.model.applyCashRounding
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import com.chaslay.pos.ui.theme.categoryColor
import java.util.Date
import kotlinx.coroutines.delay

@Composable
fun PosScreen(
    userAccess: UserAccess,
    onNavigate: (String) -> Unit,
    onBackToPos: () -> Unit = {},
    onLogout: () -> Unit = {},
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

    val isRestaurantMode = state.settings.posMode == PosMode.RESTAURANT
    var showBarcodeScanner by remember { mutableStateOf(false) }

    BarcodeWedgeListener(
        enabled = true,
        onBarcode = viewModel::onBarcodeScanned
    )

    if (showBarcodeScanner) {
        BarcodeScannerDialog(
            onBarcode = { code ->
                viewModel.onBarcodeScanned(code)
                showBarcodeScanner = false
            },
            onDismiss = { showBarcodeScanner = false }
        )
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
            onNextSplitBill = { viewModel.navigateSplitBill(1) },
            onScanBarcode = { showBarcodeScanner = true }
        )
        if (state.showOrderComplete && state.completedTransaction != null) {
            OrderCompleteDialog(
                transaction = state.completedTransaction!!,
                currencySymbol = state.currencySymbol,
                splitPaymentIndex = state.splitPaymentIndex,
                splitPaymentTotal = state.splitPaymentTotal,
                successMessage = state.successMessage,
                receiptPublicUrl = state.receiptPublicUrl,
                orderCompleteNotice = state.orderCompleteNotice,
                onPrintReceipt = viewModel::printCompletedReceipt,
                onShareEmail = viewModel::openReceiptEmailDialog,
                onDone = viewModel::dismissOrderComplete
            )
        }
        if (state.showReceiptEmailDialog) {
            ReceiptEmailDialog(
                isSending = state.isSendingReceiptEmail,
                errorMessage = state.receiptEmailError,
                onDismiss = viewModel::dismissReceiptEmailDialog,
                onSend = viewModel::sendReceiptByEmail
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
            splitPaymentIndex = state.splitPaymentIndex,
            splitPaymentTotal = state.splitPaymentTotal,
            successMessage = state.successMessage,
            receiptPublicUrl = state.receiptPublicUrl,
            orderCompleteNotice = state.orderCompleteNotice,
            onPrintReceipt = viewModel::printCompletedReceipt,
            onShareEmail = viewModel::openReceiptEmailDialog,
            onDone = viewModel::dismissOrderComplete
        )
        if (state.showReceiptEmailDialog) {
            ReceiptEmailDialog(
                isSending = state.isSendingReceiptEmail,
                errorMessage = state.receiptEmailError,
                onDismiss = viewModel::dismissReceiptEmailDialog,
                onSend = viewModel::sendReceiptByEmail
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(vectronColors().background)
    ) {
        var mainTab by remember { mutableStateOf(PosMainTab.REGISTER) }

        LaunchedEffect(isRestaurantMode) {
            viewModel.ensureRetailMode()
            if (!isRestaurantMode && mainTab == PosMainTab.TABLES) {
                mainTab = PosMainTab.REGISTER
            }
        }

        OdooPosNavBar(
            businessName = state.settings.businessName,
            userAccess = userAccess,
            selectedTab = mainTab,
            isRestaurantMode = isRestaurantMode,
            showTabs = false,
            onTabSelected = { tab ->
                when (tab) {
                    PosMainTab.ORDERS -> mainTab = PosMainTab.ORDERS
                    PosMainTab.REGISTER, PosMainTab.TABLES -> mainTab = tab
                }
            },
            onNavigate = onNavigate,
            onLogout = onLogout
        )
        LicenseRenewalBanner(licenseState)

        Row(modifier = Modifier.weight(1f)) {
            val orderingItemsForRail = state.cart.items.filter { !it.sentToKitchen }
            CartActionSidebar(
                isRestaurantMode = isRestaurantMode,
                isTableMode = isRestaurantMode && state.activeTableName != null,
                activeTableName = state.activeTableName,
                activeCourse = state.cart.activeCourse,
                activeCourseHasItems = state.cart.items.any { it.courseNumber == state.cart.activeCourse },
                hasUnsentItems = orderingItemsForRail.isNotEmpty(),
                unsentCourseCount = orderingItemsForRail.map { it.courseNumber }.distinct().size,
                selectedTab = mainTab,
                onTabSelected = { mainTab = it },
                onPickup = {
                    mainTab = PosMainTab.REGISTER
                    viewModel.showPickupOrderDialog()
                },
                onDelivery = {
                    mainTab = PosMainTab.REGISTER
                    viewModel.showDeliveryOrderDialog()
                },
                onNewOrder = viewModel::showNewOrderDialog,
                onHold = { viewModel.holdOrder(false) },
                onHoldAndSend = { viewModel.holdOrder(true) },
                onAddCourse = viewModel::addCourse,
                onSendActiveCourse = viewModel::sendActiveCourseToKitchen,
                onSendAllCourses = viewModel::sendAllCoursesToKitchen,
                onKitchenMessage = viewModel::showKitchenMessageDialog
            )
            when (mainTab) {
                PosMainTab.TABLES -> {
                    OdooTablesScreen(
                        tables = state.tables,
                        currencySymbol = state.currencySymbol,
                        activeTableName = state.activeTableName,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        onSelectTable = { tableId ->
                            viewModel.openTable(tableId)
                            mainTab = PosMainTab.REGISTER
                        },
                        onWalkIn = {
                            viewModel.switchToWalkIn()
                            mainTab = PosMainTab.REGISTER
                        }
                    )
                }
                PosMainTab.REGISTER -> {
                    Row(modifier = Modifier.weight(1f).fillMaxHeight()) {
                        VectronOrderPanel(
                        cart = state.cart,
                        currencySymbol = state.currencySymbol,
                        roundingStep = state.settings.roundingStep.takeIf { it > 0.0 } ?: 0.05,
                        activeTableName = state.activeTableName,
                        keypadBuffer = state.keypadBuffer,
                        keypadMode = state.keypadMode,
                        keypadExpanded = state.keypadExpanded,
                        selectedCartItemId = state.selectedCartItemId,
                        onSelectItem = viewModel::selectCartItem,
                        onEditItem = viewModel::editCartItem,
                        onIncreaseItem = viewModel::incrementItemQuantity,
                        onDecreaseItem = viewModel::decrementItemQuantity,
                        onKeypadInput = viewModel::onKeypadInput,
                        onKeypadBackspace = viewModel::onKeypadBackspace,
                        onKeypadClear = viewModel::onKeypadClear,
                        onKeypadClearAll = viewModel::onKeypadClearAll,
                        onKeypadEnter = viewModel::onKeypadEnter,
                        onKeypadModeChange = viewModel::setKeypadMode,
                        onKeypadExpandedChange = viewModel::setKeypadExpanded,
                        onPrintReceipt = viewModel::printProvisionalReceipt,
                        onPrintKitchen = viewModel::printKitchenTicket,
                        onAddCustomer = viewModel::showAttachCustomerDialog,
                        onChangeOrderType = viewModel::toggleCartOrderType,
                        onCancelOrder = viewModel::showCartCancelDialog,
                        canCancelOrder = state.canCancelCartOrder,
                        serviceType = state.cart.serviceType,
                        onSendActiveCourse = viewModel::sendActiveCourseToKitchen,
                        onSendAllCourses = viewModel::sendAllCoursesToKitchen,
                        onAddCourse = viewModel::addCourse,
                        onSetActiveCourse = viewModel::setActiveCourse,
                        onKitchenMessage = viewModel::showKitchenMessageDialog,
                        onHoldOrder = { viewModel.holdOrder(false) },
                        onHoldAndSend = { viewModel.holdOrder(true) },
                        onNewOrder = viewModel::showNewOrderDialog,
                        onPickup = viewModel::showPickupOrderDialog,
                        onDelivery = viewModel::showDeliveryOrderDialog,
                        isRestaurantMode = isRestaurantMode,
                        selectedTab = mainTab,
                        onTabSelected = { mainTab = it },
                        modifier = Modifier
                            .width(304.dp)
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
                PosMainTab.ORDERS -> {
                    PosOrdersTabContent(
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        onResumeOrder = { mainTab = PosMainTab.REGISTER }
                    )
                }
            }
        }
    }

    if (state.showTablePicker && isRestaurantMode) {
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

    if (state.showAttachCustomerDialog) {
        ChooseCustomerDialog(
            customers = state.deliveryCustomers,
            title = stringResource(R.string.add_customer),
            onSearch = viewModel::searchDeliveryCustomers,
            onCreateCustomer = viewModel::createDeliveryCustomer,
            onSelectCustomer = viewModel::attachCustomerToCart,
            onDismiss = viewModel::dismissAttachCustomerDialog
        )
    }

    if (state.showCartCancelDialog) {
        CartCancelOrderDialog(
            reasons = state.cartCancelReasons,
            onDismiss = viewModel::dismissCartCancelDialog,
            onConfirm = viewModel::confirmCancelCartOrder
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

    if (state.showDeliveryTimeDialog && state.pendingDeliveryCustomer != null) {
        TakeoutScheduleDialog(
            title = stringResource(R.string.delivery),
            showAsapOption = true,
            openHour = state.settings.openHour,
            openMinute = state.settings.openMinute,
            closeHour = state.settings.closeHour,
            closeMinute = state.settings.closeMinute,
            onConfirm = viewModel::confirmDeliveryTime,
            onDismiss = viewModel::dismissDeliveryTimeDialog
        )
    }

    if (state.showPickupDialog) {
        TakeoutScheduleDialog(
            title = stringResource(R.string.takeout),
            showAsapOption = true,
            openHour = state.settings.openHour,
            openMinute = state.settings.openMinute,
            closeHour = state.settings.closeHour,
            closeMinute = state.settings.closeMinute,
            onConfirm = viewModel::confirmPickup,
            onDismiss = viewModel::dismissPickupDialog
        )
    }

    if (state.showDeliveryDialog) {
        ChooseCustomerDialog(
            customers = state.deliveryCustomers,
            onSearch = viewModel::searchDeliveryCustomers,
            onCreateCustomer = viewModel::createDeliveryCustomer,
            onSelectCustomer = viewModel::confirmDeliveryWithCustomer,
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
private fun OdooPosNavBar(
    businessName: String,
    userAccess: UserAccess,
    selectedTab: PosMainTab,
    isRestaurantMode: Boolean,
    showTabs: Boolean,
    onTabSelected: (PosMainTab) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit
) {
    val vc = vectronColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(vc.header)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (showTabs) {
                if (isRestaurantMode) {
                    OdooNavTab(
                        label = stringResource(R.string.tables),
                        selected = selectedTab == PosMainTab.TABLES,
                        onClick = { onTabSelected(PosMainTab.TABLES) }
                    )
                }
                OdooNavTab(
                    label = stringResource(R.string.pos_register),
                    selected = selectedTab == PosMainTab.REGISTER,
                    onClick = { onTabSelected(PosMainTab.REGISTER) }
                )
                OdooNavTab(
                    label = stringResource(R.string.pos_orders),
                    selected = selectedTab == PosMainTab.ORDERS,
                    onClick = { onTabSelected(PosMainTab.ORDERS) }
                )
            }
        }
        Text(
            businessName,
            color = vc.textPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (userAccess.canAccessSettings() || userAccess.canManageProducts() || userAccess.canAccessReports()) {
                IconButton(onClick = { onNavigate(AppRoute.Admin.route) }) {
                    Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.menu), tint = vc.textPrimary)
                }
            }
            IconButton(onClick = onLogout) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = stringResource(R.string.logout), tint = vc.textPrimary)
            }
        }
    }
}

@Composable
private fun OdooNavTab(label: String, selected: Boolean, onClick: () -> Unit) {
    val bg = if (selected) Color(0xFF714B67) else Color.Transparent
    val textColor = if (selected) Color.White else vectronColors().textPrimary
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(label, color = textColor, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    }
}

@Composable
private fun OdooTablesScreen(
    tables: List<TableWithOrderInfo>,
    currencySymbol: String,
    activeTableName: String?,
    modifier: Modifier = Modifier,
    onSelectTable: (Long) -> Unit,
    onWalkIn: () -> Unit
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
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFEBEBEB))
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
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(VectronColors.CardBlue)
                .clickable(onClick = onWalkIn)
                .padding(8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(stringResource(R.string.take_away_delivery), color = Color.White, fontWeight = FontWeight.Bold)
        }
        if (activeTableName != null) {
            Text(
                text = "${stringResource(R.string.dine_in)}: $activeTableName",
                color = Color(0xFF555555),
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 6.dp)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 110.dp),
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 12.dp)
        ) {
            items(floorTables, key = { it.id }) { table ->
                OdooTableCard(
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
private fun OdooTableCard(
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
            .height(88.dp)
            .clip(RoundedCornerShape(10.dp))
            .border(
                width = if (isActive) 3.dp else 0.dp,
                color = if (isActive) Color.White else Color.Transparent,
                shape = RoundedCornerShape(10.dp)
            )
            .background(bg)
            .clickable(onClick = onClick)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            when (table.status) {
                TableStatus.OCCUPIED -> {
                    Text(stringResource(R.string.table_busy), color = Color.White.copy(alpha = 0.95f), fontSize = 10.sp)
                    Text(
                        "${table.itemCount} · ${formatMoney(table.orderTotal, currencySymbol)}",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 10.sp
                    )
                }
                TableStatus.ACTIVE -> {
                    Text(
                        "${table.itemCount} · ${formatMoney(table.orderTotal, currencySymbol)}",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 10.sp
                    )
                }
                TableStatus.FREE -> {
                    Text(stringResource(R.string.select_table), color = Color.White.copy(alpha = 0.85f), fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun VectronTopBar(
    businessName: String,
    userAccess: UserAccess,
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
            if (userAccess.canAccessReports() || userAccess.canAccessSettings()) {
                IconButton(onClick = onOrderHistory) {
                    Icon(Icons.Default.History, contentDescription = stringResource(R.string.order_history), tint = vc.textPrimary)
                }
            }
            if (userAccess.canAccessSettings() || userAccess.canManageProducts() || userAccess.canAccessReports()) {
                IconButton(onClick = { onNavigate(AppRoute.Admin.route) }) {
                    Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.menu), tint = vc.textPrimary)
                }
            }
        }
    }
}

private enum class PosMainTab {
    TABLES,
    REGISTER,
    ORDERS
}

private enum class TableCartTab {
    ORDERING,
    ORDERED
}

private sealed interface CartRowModel {
    data class CourseHeader(val number: Int, val isActive: Boolean) : CartRowModel
    data class Line(val item: CartItem) : CartRowModel
}

private fun buildCartRows(
    items: List<CartItem>,
    isTableMode: Boolean,
    activeCourse: Int
): List<CartRowModel> {
    if (!isTableMode) return items.map { CartRowModel.Line(it) }
    return items.groupBy { it.courseNumber }
        .toSortedMap()
        .flatMap { (course, courseItems) ->
            listOf(CartRowModel.CourseHeader(course, course == activeCourse)) +
                courseItems.map { CartRowModel.Line(it) }
        }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun VectronOrderPanel(
    cart: com.chaslay.pos.domain.model.CartSummary,
    currencySymbol: String,
    roundingStep: Double,
    activeTableName: String?,
    keypadBuffer: String,
    keypadMode: KeypadMode,
    keypadExpanded: Boolean,
    selectedCartItemId: String?,
    onSelectItem: (String?) -> Unit,
    onEditItem: (String) -> Unit,
    onIncreaseItem: (String) -> Unit,
    onDecreaseItem: (String) -> Unit,
    onKeypadInput: (String) -> Unit,
    onKeypadBackspace: () -> Unit,
    onKeypadClear: () -> Unit,
    onKeypadClearAll: () -> Unit,
    onKeypadEnter: () -> Unit,
    onKeypadModeChange: (KeypadMode) -> Unit,
    onKeypadExpandedChange: (Boolean) -> Unit,
    onPrintReceipt: () -> Unit,
    onPrintKitchen: () -> Unit,
    onAddCustomer: () -> Unit,
    onChangeOrderType: () -> Unit,
    onCancelOrder: () -> Unit,
    canCancelOrder: Boolean,
    serviceType: ServiceType,
    onSendActiveCourse: () -> Unit,
    onSendAllCourses: () -> Unit,
    onAddCourse: () -> Unit,
    onSetActiveCourse: (Int) -> Unit,
    onKitchenMessage: () -> Unit,
    onHoldOrder: () -> Unit,
    onHoldAndSend: () -> Unit,
    onNewOrder: () -> Unit,
    onPickup: () -> Unit,
    onDelivery: () -> Unit,
    isRestaurantMode: Boolean,
    selectedTab: PosMainTab,
    onTabSelected: (PosMainTab) -> Unit,
    modifier: Modifier = Modifier
) {
    val isTableMode = isRestaurantMode && activeTableName != null
    val displayTotal = applyCashRounding(cart.displayTotal, roundingStep)
    val orderingItems = cart.items.filter { !it.sentToKitchen }
    val orderedItems = cart.items.filter { it.sentToKitchen }
    val showCartTabs = isRestaurantMode && orderedItems.isNotEmpty()
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
    val cartRows = buildCartRows(displayItems, isTableMode, cart.activeCourse)
    val unsentCourses = orderingItems.map { it.courseNumber }.distinct().sorted()
    val keypadHint = when (keypadMode) {
        KeypadMode.QTY -> stringResource(R.string.keypad_hint_qty)
        KeypadMode.PERCENT -> stringResource(R.string.keypad_hint_percent)
        KeypadMode.PRICE -> {
            val selected = selectedCartItemId?.let { id -> cart.items.find { it.id == id } }
            if (selected != null) {
                stringResource(R.string.keypad_hint_override, selected.productName)
            } else {
                stringResource(R.string.keypad_hint_misc)
            }
        }
    }
    val vc = vectronColors()
    Row(
        modifier = modifier
            .background(vc.panelDark)
            .padding(6.dp)
    ) {
        Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF2F2F2), RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                .padding(horizontal = 6.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            CartOrderMenuButton(
                enabled = !cart.isEmpty,
                isDineIn = activeTableName != null || serviceType == ServiceType.DINE_IN,
                canCancelOrder = canCancelOrder,
                onPrintReceipt = onPrintReceipt,
                onPrintKitchen = onPrintKitchen,
                onAddCustomer = onAddCustomer,
                onChangeOrderType = onChangeOrderType,
                onCancelOrder = onCancelOrder
            )
            Column(horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.receipt), color = Color(0xFF333333), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(
                    text = when {
                        activeTableName != null -> activeTableName
                        serviceType == ServiceType.DINE_IN -> stringResource(R.string.dine_in)
                        else -> stringResource(R.string.take_away)
                    },
                    color = Color(0xFF666666),
                    fontSize = 11.sp
                )
                cart.deliveryName?.takeIf { it.isNotBlank() }?.let { name ->
                    Text(name, color = Color(0xFF666666), fontSize = 10.sp, maxLines = 1)
                }
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

        if (isTableMode && cartTab != TableCartTab.ORDERED) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                (1..cart.courseCount).forEach { course ->
                    FilterChip(
                        selected = cart.activeCourse == course,
                        onClick = { onSetActiveCourse(course) },
                        label = {
                            Text(stringResource(R.string.course_n, course), fontSize = 10.sp)
                        }
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color(0xFFF8F8F8))
        ) {
            if (cartRows.isEmpty()) {
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
                    items(cartRows.size, key = { index ->
                        when (val row = cartRows[index]) {
                            is CartRowModel.CourseHeader -> "course-${row.number}"
                            is CartRowModel.Line -> row.item.id
                        }
                    }) { index ->
                        when (val row = cartRows[index]) {
                            is CartRowModel.CourseHeader -> {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            if (row.isActive) Color(0xFFE8F4FD) else Color(0xFFEAEAEA),
                                            RoundedCornerShape(4.dp)
                                        )
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        stringResource(R.string.course_n, row.number),
                                        color = if (row.isActive) Color(0xFF2E6DB4) else Color(0xFF666666),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            is CartRowModel.Line -> {
                                SwipeableCartRow(
                                    item = row.item,
                                    currencySymbol = currencySymbol,
                                    editable = !row.item.sentToKitchen,
                                    isSelected = row.item.id == selectedCartItemId,
                                    onSelect = { onSelectItem(row.item.id) },
                                    onEdit = { onEditItem(row.item.id) },
                                    onDoubleTap = { onIncreaseItem(row.item.id) },
                                    onDecrease = { onDecreaseItem(row.item.id) }
                                )
                            }
                        }
                    }
                }
            }
        }

        FulfillmentInfoBar(cart = cart)

        VectronKeypad(
            total = displayTotal,
            buffer = keypadBuffer,
            currencySymbol = currencySymbol,
            activeTableName = activeTableName,
            hint = keypadHint,
            keypadMode = keypadMode,
            expanded = keypadExpanded,
            onModeChange = onKeypadModeChange,
            onExpandedChange = onKeypadExpandedChange,
            onInput = onKeypadInput,
            onBackspace = onKeypadBackspace,
            onClear = onKeypadClear,
            onClearAll = onKeypadClearAll,
            onEnter = onKeypadEnter
        )
        }
    }
}

@Composable
private fun FulfillmentInfoBar(cart: com.chaslay.pos.domain.model.CartSummary) {
    val deliveryName = cart.deliveryName?.takeIf { it.isNotBlank() }
    val isPickup = cart.fulfillmentType == com.chaslay.pos.domain.model.FulfillmentType.PICKUP ||
        (cart.pickupTimeMs != null && deliveryName == null && cart.fulfillmentType != com.chaslay.pos.domain.model.FulfillmentType.DELIVERY)
    val isDelivery = deliveryName != null || cart.fulfillmentType == com.chaslay.pos.domain.model.FulfillmentType.DELIVERY
    if (!isPickup && !isDelivery) return

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF5F5F5), RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        if (isDelivery) {
            Text(
                stringResource(R.string.delivery),
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp
            )
            Text(deliveryName.orEmpty(), color = Color(0xFF111111), fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            listOfNotNull(cart.deliveryAddress, cart.deliveryZip)
                .filter { it.isNotBlank() }
                .joinToString(", ")
                .takeIf { it.isNotBlank() }
                ?.let { Text(it, color = Color(0xFF555555), fontSize = 11.sp) }
            cart.deliveryPhone?.takeIf { it.isNotBlank() }?.let {
                Text(it, color = Color(0xFF555555), fontSize = 11.sp)
            }
            Text(
                formatScheduledTimeLabel(cart.pickupTimeMs),
                color = Color(0xFF333333),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        } else {
            Text(
                stringResource(R.string.takeout),
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp
            )
            cart.orderNumber?.let {
                Text("#$it", color = Color(0xFF111111), fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            }
            Text(
                formatScheduledTimeLabel(cart.pickupTimeMs),
                color = Color(0xFF333333),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun formatScheduledTimeLabel(timeMs: Long?): String {
    if (timeMs == null) return stringResource(R.string.asap_now)
    return SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault()).format(Date(timeMs))
}

@Composable
private fun CartOrderMenuButton(
    enabled: Boolean,
    isDineIn: Boolean,
    canCancelOrder: Boolean,
    onPrintReceipt: () -> Unit,
    onPrintKitchen: () -> Unit,
    onAddCustomer: () -> Unit,
    onChangeOrderType: () -> Unit,
    onCancelOrder: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(
            onClick = { if (enabled) expanded = true },
            enabled = enabled,
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                Icons.Default.Menu,
                contentDescription = stringResource(R.string.cart_order_menu),
                tint = if (enabled) Color(0xFF333333) else Color(0xFFBBBBBB)
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.print_receipt)) },
                onClick = {
                    expanded = false
                    onPrintReceipt()
                }
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.print_kitchen_ticket)) },
                onClick = {
                    expanded = false
                    onPrintKitchen()
                }
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.add_customer)) },
                onClick = {
                    expanded = false
                    onAddCustomer()
                }
            )
            DropdownMenuItem(
                text = {
                    Text(
                        if (isDineIn) stringResource(R.string.switch_to_takeaway)
                        else stringResource(R.string.switch_to_dine_in)
                    )
                },
                onClick = {
                    expanded = false
                    onChangeOrderType()
                }
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.cancel_order), color = Color(0xFFC0392B)) },
                onClick = {
                    expanded = false
                    onCancelOrder()
                },
                enabled = canCancelOrder
            )
        }
    }
}

@Composable
private fun CartCancelOrderDialog(
    reasons: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var selected by remember(reasons) { mutableStateOf(reasons.firstOrNull().orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.cancel_order)) },
        text = {
            Column {
                Text(stringResource(R.string.cancel_order_reason_prompt), fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                reasons.forEach { reason ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selected = reason }
                    ) {
                        RadioButton(selected = selected == reason, onClick = { selected = reason })
                        Text(reason)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selected) }, enabled = selected.isNotBlank()) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun CartActionSidebar(
    isRestaurantMode: Boolean,
    isTableMode: Boolean,
    activeTableName: String?,
    activeCourse: Int,
    activeCourseHasItems: Boolean,
    hasUnsentItems: Boolean,
    unsentCourseCount: Int,
    selectedTab: PosMainTab,
    onTabSelected: (PosMainTab) -> Unit,
    onPickup: () -> Unit,
    onDelivery: () -> Unit,
    onNewOrder: () -> Unit,
    onHold: () -> Unit,
    onHoldAndSend: () -> Unit,
    onAddCourse: () -> Unit,
    onSendActiveCourse: () -> Unit,
    onSendAllCourses: () -> Unit,
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
        if (isRestaurantMode) {
            CartTabButton(
                label = stringResource(R.string.tables),
                icon = Icons.Default.TableRestaurant,
                baseColor = Color(0xFF00796B),
                selected = selectedTab == PosMainTab.TABLES,
                onClick = { onTabSelected(PosMainTab.TABLES) }
            )
        }
        CartTabButton(
            label = stringResource(R.string.pos_register),
            icon = Icons.Default.PointOfSale,
            baseColor = Color(0xFF37474F),
            selected = selectedTab == PosMainTab.REGISTER,
            onClick = { onTabSelected(PosMainTab.REGISTER) }
        )
        CartTabButton(
            label = stringResource(R.string.pos_orders),
            icon = Icons.Default.ReceiptLong,
            baseColor = Color(0xFFEF6C00),
            selected = selectedTab == PosMainTab.ORDERS,
            onClick = { onTabSelected(PosMainTab.ORDERS) }
        )
        HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = vc.textSecondary.copy(alpha = 0.3f))
        CartSidebarButton(
            label = stringResource(R.string.save_hold_order),
            shortLabel = stringResource(R.string.save_hold_short),
            icon = Icons.Default.Upload,
            color = Color(0xFF7D6608),
            onClick = onHold
        )
        if (isRestaurantMode && isTableMode) {
            CartSidebarButton(
                label = stringResource(R.string.add_course),
                shortLabel = "C+",
                icon = Icons.Default.Restaurant,
                color = Color(0xFF455A64),
                onClick = onAddCourse
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = vc.textSecondary.copy(alpha = 0.3f))
            if (activeCourseHasItems) {
                CartSidebarButton(
                    label = stringResource(R.string.fire_course_n, activeCourse),
                    shortLabel = "Fire",
                    icon = Icons.Default.Send,
                    color = VectronColors.CashGreen,
                    onClick = onSendActiveCourse
                )
            }
            if (hasUnsentItems && unsentCourseCount > 1) {
                CartSidebarButton(
                    label = stringResource(R.string.send_all_courses),
                    shortLabel = "All",
                    color = Color(0xFF2E7D32),
                    onClick = onSendAllCourses
                )
            }
            CartSidebarButton(
                label = stringResource(R.string.kitchen_message),
                shortLabel = "MSG",
                color = Color(0xFF7D6608),
                onClick = onKitchenMessage
            )
        }
        if (activeTableName != null) {
            Text(
                activeTableName,
                color = vc.textPrimary,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun CartTabButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    baseColor: Color,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) baseColor else baseColor.copy(alpha = 0.35f)
    val contentColor = Color.White
    val borderWidth = if (selected) 2.dp else 0.dp
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(borderWidth, Color.White, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = label, tint = contentColor, modifier = Modifier.size(26.dp))
        Text(
            text = label,
            color = contentColor,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
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
    isSelected: Boolean,
    onSelect: () -> Unit,
    onEdit: () -> Unit,
    onDoubleTap: () -> Unit,
    onDecrease: () -> Unit
) {
    if (!editable) {
        VectronCartRow(
            item = item,
            currencySymbol = currencySymbol,
            editable = false,
            isSelected = false,
            onSelect = onSelect,
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
            isSelected = isSelected,
            onSelect = onSelect,
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
    isSelected: Boolean,
    onSelect: () -> Unit,
    onEdit: () -> Unit,
    onDoubleTap: () -> Unit
) {
    val rowBg = when {
        !editable -> Color(0xFFF0F0F0)
        isSelected -> Color(0xFFD6EBFF)
        else -> Color.White
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(rowBg)
            .pointerInput(item.id, editable) {
                detectTapGestures(
                    onTap = { if (editable) onSelect() },
                    onDoubleTap = { if (editable) onDoubleTap() },
                    onLongPress = { if (editable) onEdit() }
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
    keypadMode: KeypadMode,
    expanded: Boolean,
    onModeChange: (KeypadMode) -> Unit,
    onExpandedChange: (Boolean) -> Unit,
    onInput: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onClearAll: () -> Unit,
    onEnter: () -> Unit
) {
    val vc = vectronColors()
    val bufferPrefix = when (keypadMode) {
        KeypadMode.QTY -> ""
        KeypadMode.PERCENT -> ""
        KeypadMode.PRICE -> currencySymbol
    }
    val bufferSuffix = when (keypadMode) {
        KeypadMode.PERCENT -> "%"
        else -> ""
    }
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
                .clickable { onExpandedChange(!expanded) }
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.total), color = VectronColors.TextSecondary, fontSize = 13.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = formatMoney(total, currencySymbol),
                    color = VectronColors.TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowUp,
                    contentDescription = if (expanded) {
                        stringResource(R.string.keypad_collapse)
                    } else {
                        stringResource(R.string.keypad_expand)
                    },
                    tint = VectronColors.TextSecondary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            KeypadMode.entries.forEach { mode ->
                val label = when (mode) {
                    KeypadMode.QTY -> stringResource(R.string.keypad_mode_qty)
                    KeypadMode.PERCENT -> stringResource(R.string.keypad_mode_percent)
                    KeypadMode.PRICE -> stringResource(R.string.keypad_mode_price)
                }
                KeypadKey(
                    label = label,
                    modifier = Modifier.weight(1f),
                    compact = true,
                    highlight = keypadMode == mode,
                    onClick = { onModeChange(mode) }
                )
            }
        }

        if (expanded) {
            Text(
                text = when {
                    buffer.isEmpty() && keypadMode == KeypadMode.QTY -> "0"
                    buffer.isEmpty() && keypadMode == KeypadMode.PERCENT -> "0%"
                    buffer.isEmpty() -> "$currencySymbol 0.00"
                    else -> "$bufferPrefix$buffer$bufferSuffix"
                },
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
                                val enabled = keypadMode != KeypadMode.QTY || key != "."
                                KeypadKey(
                                    label = key,
                                    modifier = Modifier.weight(1f),
                                    compact = true,
                                    onClick = { if (enabled) onInput(key) }
                                )
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
        if (expanded) {
            Text(hint, color = VectronColors.TextSecondary, fontSize = 10.sp, maxLines = 2, modifier = Modifier.fillMaxWidth())
        }
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
private fun VectronScanButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(88.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF455A64))
            .clickable(onClick = onClick)
            .padding(10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
            Text(
                stringResource(R.string.scan_barcode),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                fontSize = 12.sp
            )
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
                else if (product.stockQuantity != null && product.lowStockThreshold != null &&
                    product.stockQuantity <= product.lowStockThreshold
                ) {
                    Modifier.border(2.dp, Color(0xFFFF5252), RoundedCornerShape(8.dp))
                } else Modifier
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
    presets: List<com.chaslay.pos.domain.model.KitchenMessagePreset>,
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
    picker: com.chaslay.pos.domain.model.OptionGroupPicker,
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
    cart: com.chaslay.pos.domain.model.CartSummary,
    splitCount: Int,
    splitByItems: Boolean,
    activeSplitCheck: Int,
    currencySymbol: String,
    method: com.chaslay.pos.domain.model.PaymentMethod?,
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
                if (!cart.vatIncludedInPrice) {
                    SummaryRow(stringResource(R.string.subtotal), formatMoney(cart.subtotal, currencySymbol))
                    SummaryRow(stringResource(R.string.tax), formatMoney(cart.taxTotal, currencySymbol))
                } else {
                    SummaryRow(
                        stringResource(R.string.tax_included_in_total),
                        formatMoney(cart.taxTotal, currencySymbol)
                    )
                }
                SummaryRow(stringResource(R.string.total), formatMoney(cart.total, currencySymbol), bold = true)
                method?.let {
                    Text(
                        text = if (it == com.chaslay.pos.domain.model.PaymentMethod.CASH)
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

@Composable
private fun PosOrdersTabContent(
    modifier: Modifier = Modifier,
    onResumeOrder: () -> Unit
) {
    var subTab by remember { mutableIntStateOf(0) }
    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFEBEBEB))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = subTab == 0,
                onClick = { subTab = 0 },
                label = { Text(stringResource(R.string.ongoing_orders)) }
            )
            FilterChip(
                selected = subTab == 1,
                onClick = { subTab = 1 },
                label = { Text(stringResource(R.string.programmed_orders)) }
            )
            FilterChip(
                selected = subTab == 2,
                onClick = { subTab = 2 },
                label = { Text(stringResource(R.string.order_history)) }
            )
        }
        when (subTab) {
            0 -> OngoingOrdersScreen(onBack = onResumeOrder, embedded = true)
            1 -> com.chaslay.pos.ui.programmed.ProgrammedOrdersScreen(onBack = onResumeOrder, embedded = true)
            2 -> OrderHistoryScreen(onBack = {}, embedded = true)
        }
    }
}

@Composable
private fun TakeoutScheduleDialog(
    title: String = stringResource(R.string.takeout),
    showAsapOption: Boolean = false,
    openHour: Int,
    openMinute: Int,
    closeHour: Int,
    closeMinute: Int,
    onConfirm: (Long?) -> Unit,
    onDismiss: () -> Unit
) {
    val dateOptions = remember { nextSevenDays() }
    var selectedDateMillis by remember { mutableStateOf(dateOptions.first()) }
    val groupedSlots = remember(selectedDateMillis, openHour, openMinute, closeHour, closeMinute) {
        groupedPickupSlots(selectedDateMillis, openHour, openMinute, closeHour, closeMinute)
    }
    var selectedSlot by remember(selectedDateMillis, groupedSlots) {
        mutableStateOf(groupedSlots.firstOrNull()?.slots?.firstOrNull())
    }
    var asapSelected by remember { mutableStateOf(showAsapOption) }
    val openLabel = formatTime24h(openHour, openMinute)
    val closeLabel = formatTime24h(closeHour, closeMinute)
    val dateFormat = remember { SimpleDateFormat("MM/dd/yyyy", Locale.getDefault()) }
    val takeoutChipColors = FilterChipDefaults.filterChipColors(
        containerColor = Color(0xFFE8E8E8),
        labelColor = Color(0xFF333333),
        selectedContainerColor = Color(0xFF111111),
        selectedLabelColor = Color.White
    )
    val takeoutButtonColors = ButtonDefaults.buttonColors(
        containerColor = Color(0xFF111111),
        contentColor = Color.White
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.88f),
            shape = RoundedCornerShape(12.dp),
            color = Color.White
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = Color(0xFF111111)
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel), tint = Color(0xFF111111))
                    }
                }
                Text(
                    stringResource(R.string.open_hours_display, openLabel, closeLabel),
                    modifier = Modifier.padding(horizontal = 16.dp),
                    color = Color(0xFF666666),
                    fontSize = 13.sp
                )
                if (showAsapOption) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = asapSelected,
                            onClick = { asapSelected = true },
                            label = { Text(stringResource(R.string.asap_now)) },
                            colors = takeoutChipColors
                        )
                        FilterChip(
                            selected = !asapSelected,
                            onClick = { asapSelected = false },
                            label = { Text(stringResource(R.string.schedule_later)) },
                            colors = takeoutChipColors
                        )
                    }
                }
                if (!showAsapOption || !asapSelected) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    dateOptions.forEach { dateMillis ->
                        val selected = selectedDateMillis == dateMillis
                        FilterChip(
                            selected = selected,
                            onClick = { selectedDateMillis = dateMillis },
                            label = { Text(dateFormat.format(dateMillis), fontSize = 12.sp) },
                            colors = takeoutChipColors
                        )
                    }
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    groupedSlots.forEach { group ->
                        val groupLabel = when (group.label) {
                            "Morning" -> stringResource(R.string.morning)
                            "Afternoon" -> stringResource(R.string.afternoon)
                            else -> stringResource(R.string.evening)
                        }
                        Text(groupLabel, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(10),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 220.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(group.slots.size) { index ->
                                val slot = group.slots[index]
                                val selected = selectedSlot == slot
                                FilterChip(
                                    selected = selected,
                                    onClick = { selectedSlot = slot },
                                    label = {
                                        Text(formatTime24h(slot.first, slot.second), fontSize = 12.sp)
                                    },
                                    colors = takeoutChipColors
                                )
                            }
                        }
                    }
                    if (groupedSlots.isEmpty()) {
                        Text(
                            stringResource(R.string.pickup_select_time),
                            color = Color(0xFF888888),
                            modifier = Modifier.padding(vertical = 24.dp)
                        )
                    }
                }
                Button(
                    onClick = {
                        val slot = selectedSlot
                        val pickupMs = slot?.let { (hour, minute) ->
                            buildPickupTimeMillis(selectedDateMillis, hour, minute)
                        }
                        onConfirm(pickupMs)
                    },
                    enabled = selectedSlot != null,
                    modifier = Modifier
                        .padding(16.dp)
                        .height(48.dp)
                        .fillMaxWidth(),
                    colors = takeoutButtonColors
                ) {
                    Text(stringResource(R.string.continue_action))
                }
                } else {
                    Button(
                        onClick = { onConfirm(null) },
                        modifier = Modifier
                            .padding(16.dp)
                            .height(48.dp)
                            .fillMaxWidth(),
                        colors = takeoutButtonColors
                    ) {
                        Text(stringResource(R.string.continue_action))
                    }
                }
            }
        }
    }
}

@Composable
private fun ChooseCustomerDialog(
    customers: List<CustomerEntity>,
    title: String = stringResource(R.string.choose_customer),
    onSearch: (String) -> Unit,
    onCreateCustomer: (String, String, String, String, String, (CustomerEntity) -> Unit) -> Unit,
    onSelectCustomer: (CustomerEntity) -> Unit,
    onDismiss: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var showCreateDialog by remember { mutableStateOf(false) }
    val takeoutButtonColors = ButtonDefaults.buttonColors(
        containerColor = Color(0xFF111111),
        contentColor = Color.White
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.9f),
            shape = RoundedCornerShape(12.dp),
            color = Color.White
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF5F5F5))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { showCreateDialog = true },
                        colors = takeoutButtonColors
                    ) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(stringResource(R.string.create_customer))
                    }
                    Text(
                        title,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color(0xFF111111)
                    )
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = {
                            searchQuery = it
                            onSearch(it)
                        },
                        placeholder = { Text(stringResource(R.string.search_customers), fontSize = 13.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.width(260.dp)
                    )
                }
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    items(customers, key = { it.id }) { customer ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelectCustomer(customer) }
                                .background(if (customers.indexOf(customer) % 2 == 0) Color.White else Color(0xFFF8F8F8))
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(customer.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF111111))
                                customer.address?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, fontSize = 12.sp, color = Color(0xFF666666))
                                }
                            }
                            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                customer.phone?.takeIf { it.isNotBlank() }?.let { phone ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF888888))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(phone, fontSize = 12.sp)
                                    }
                                }
                                customer.email?.takeIf { it.isNotBlank() }?.let { email ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF888888))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(email, fontSize = 12.sp, maxLines = 1)
                                    }
                                }
                            }
                        }
                    }
                }
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                        .height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF111111))
                ) {
                    Text(stringResource(R.string.discard))
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateCustomerDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { name, phone, email, address, zip ->
                onCreateCustomer(name, phone, email, address, zip) { customer ->
                    showCreateDialog = false
                    onSelectCustomer(customer)
                }
            }
        )
    }
}

@Composable
private fun CreateCustomerDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var zip by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.new_contact)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(stringResource(R.string.client_name)) }, singleLine = true)
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text(stringResource(R.string.telephone)) }, singleLine = true)
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text(stringResource(R.string.email)) }, singleLine = true)
                OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text(stringResource(R.string.address)) }, minLines = 2)
                OutlinedTextField(value = zip, onValueChange = { zip = it }, label = { Text(stringResource(R.string.zip_code)) }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = { onCreate(name, phone, email, address, zip) }, enabled = name.isNotBlank()) {
                Text(stringResource(R.string.create_customer))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

private data class TimeSlotGroup(val label: String, val slots: List<Pair<Int, Int>>)

private fun nextSevenDays(): List<Long> {
    val base = Calendar.getInstance()
    return (0..6).map { offset ->
        val cal = (base.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
        startOfDayMillis(cal)
    }
}

private fun formatTime24h(hour: Int, minute: Int): String =
    String.format(Locale.getDefault(), "%02d:%02d", hour, minute)

private fun groupedPickupSlots(
    dateMillis: Long,
    openHour: Int,
    openMinute: Int,
    closeHour: Int,
    closeMinute: Int,
    intervalMinutes: Int = 20
): List<TimeSlotGroup> {
    val slots = pickupTimeSlots(dateMillis, openHour, openMinute, closeHour, closeMinute, intervalMinutes)
    val morning = slots.filter { it.first < 12 }
    val afternoon = slots.filter { it.first in 12..16 }
    val evening = slots.filter { it.first >= 17 }
    return buildList {
        if (morning.isNotEmpty()) add(TimeSlotGroup("Morning", morning))
        if (afternoon.isNotEmpty()) add(TimeSlotGroup("Afternoon", afternoon))
        if (evening.isNotEmpty()) add(TimeSlotGroup("Evening", evening))
    }
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

private fun startOfDayMillis(calendar: Calendar): Long {
    val cal = (calendar.clone() as Calendar)
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

private fun pickupTimeSlots(
    dateMillis: Long,
    openHour: Int,
    openMinute: Int,
    closeHour: Int,
    closeMinute: Int,
    intervalMinutes: Int = 20
): List<Pair<Int, Int>> {
    val targetDay = Calendar.getInstance().apply { timeInMillis = dateMillis }
    val now = Calendar.getInstance()
    val isToday = startOfDayMillis(targetDay) == startOfDayMillis(now)
    var hour = openHour
    var minute = openMinute
    if (isToday) {
        hour = maxOf(openHour, now.get(Calendar.HOUR_OF_DAY))
        minute = if (hour == now.get(Calendar.HOUR_OF_DAY)) {
            val rounded = ((now.get(Calendar.MINUTE) / intervalMinutes) + 1) * intervalMinutes
            if (rounded >= 60) {
                hour += 1
                0
            } else rounded
        } else openMinute
    }
    val slots = mutableListOf<Pair<Int, Int>>()
    var h = hour
    var m = minute
    while (h < closeHour || (h == closeHour && m <= closeMinute)) {
        slots.add(h to m)
        m += intervalMinutes
        if (m >= 60) {
            h += 1
            m = 0
        }
        if (h > closeHour || (h == closeHour && m > closeMinute)) break
    }
    return slots
}
