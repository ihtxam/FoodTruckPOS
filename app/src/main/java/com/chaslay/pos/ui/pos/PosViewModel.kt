package com.chaslay.pos.ui.pos

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.FloorPlanElementEntity
import com.chaslay.pos.data.local.entity.CustomerEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.CartManager
import com.chaslay.pos.data.repository.MenuRepository
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.data.repository.TableTransferResult
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.ComboPickState
import com.chaslay.pos.domain.model.ComboSelection
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.CancelReasonLabels
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.KitchenMessagePreset
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.AddonGroupModel
import com.chaslay.pos.domain.model.ModifierGroupModel
import com.chaslay.pos.domain.model.OptionChoice
import com.chaslay.pos.domain.model.OptionGroupPicker
import com.chaslay.pos.domain.model.ProductCustomizeState
import com.chaslay.pos.domain.model.SelectedModifier
import com.chaslay.pos.domain.model.SelectedAddon
import com.chaslay.pos.domain.model.ProductVariantModel
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.ProductWithVariants
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.domain.model.applyCashRounding
import com.chaslay.pos.domain.model.resolveVatRate
import com.chaslay.pos.payment.CashPaymentService
import com.chaslay.pos.payment.PaymentOrchestrator
import com.chaslay.pos.payment.PaymentResult
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.sync.FloorSyncRepository
import com.chaslay.pos.sync.FloorSyncEvents
import com.chaslay.pos.printer.KitchenPrintMeta
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID
import javax.inject.Inject

enum class KeypadMode {
    QTY,
    PERCENT,
    PRICE
}

enum class TableTransferMode {
    ENTIRE_TABLE,
    SELECTED_ITEMS
}

data class PosUiState(
    val categories: List<CategoryEntity> = emptyList(),
    val products: List<ProductEntity> = emptyList(),
    val selectedCategoryId: Long? = null,
    val cart: CartSummary = CartSummary(emptyList()),
    val settings: BusinessSettingsEntity = BusinessSettingsEntity(),
    val currencySymbol: String = "CHF",
    val serviceType: ServiceType = ServiceType.TAKEAWAY,
    val tables: List<TableWithOrderInfo> = emptyList(),
    val activeTableName: String? = null,
    val kitchenSentToPrinter: Boolean = false,
    val isProcessingPayment: Boolean = false,
    val showOpenPriceDialog: Boolean = false,
    val showVariantDialog: Boolean = false,
    val productCustomize: ProductCustomizeState? = null,
    val comboPick: ComboPickState? = null,
    val optionGroupPicker: OptionGroupPicker? = null,
    val showDiscountDialog: Boolean = false,
    val showCheckoutScreen: Boolean = false,
    val showOrderComplete: Boolean = false,
    val showPaymentSummary: Boolean = false,
    val showReceiptOptions: Boolean = false,
    val showTablePicker: Boolean = false,
    val showKitchenMessageDialog: Boolean = false,
    val showMiscPriceDialog: Boolean = false,
    val pendingPaymentMethod: PaymentMethod? = null,
    val selectedProduct: ProductWithVariants? = null,
    val lastTransaction: TransactionEntity? = null,
    val errorMessage: String? = null,
    val errorTitle: String? = null,
    val successMessage: String? = null,
    val snackbarMessage: String? = null,
    val showClearCartDialog: Boolean = false,
    val showPickupDialog: Boolean = false,
    val showDeliveryDialog: Boolean = false,
    val deliveryCustomers: List<CustomerEntity> = emptyList(),
    val pendingDeliveryCustomer: CustomerEntity? = null,
    val showDeliveryTimeDialog: Boolean = false,
    val suggestedOrderNumber: String = "",
    val tapToPayMessage: String? = null,
    val selectedCartItemId: String? = null,
    val lastAddedItemId: String? = null,
    val lastClickedProductId: Long? = null,
    val keypadBuffer: String = "",
    val keypadMode: KeypadMode = KeypadMode.PRICE,
    val keypadExpanded: Boolean = false,
    val checkoutState: CheckoutState = CheckoutState(),
    val completedTransaction: TransactionEntity? = null,
    val adyenCustomerReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
    val adyenCashierReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
    val orderCompleteNotice: String? = null,
    val receiptPublicUrl: String? = null,
    val showReceiptEmailDialog: Boolean = false,
    val isSendingReceiptEmail: Boolean = false,
    val receiptEmailError: String? = null,
    val discountPresets: List<DiscountPreset> = emptyList(),
    val showSplitBillScreen: Boolean = false,
    val splitSelectedItemIds: Set<String> = emptySet(),
    val showSplitDialog: Boolean = false,
    val equalSplitPaidCount: Int = 0,
    val splitPaymentIndex: Int? = null,
    val splitPaymentTotal: Int? = null,
    val showCartCancelDialog: Boolean = false,
    val cartCancelReasons: List<String> = emptyList(),
    val showAttachCustomerDialog: Boolean = false,
    val canCancelCartOrder: Boolean = false,
    val showWeighedProductDialog: Boolean = false,
    val scaleReading: com.chaslay.pos.scale.AclasScaleReading? = null,
    val showGuestCountDialog: Boolean = false,
    val guestCountTableName: String = "",
    val guestCountSeatCapacity: Int = 4,
    val guestCountDefault: Int = 2,
    val pendingTableId: Long? = null,
    val floorElementsByFloorId: Map<Long, List<FloorPlanElementEntity>> = emptyMap(),
    val showTableTransferItemsDialog: Boolean = false,
    val showTableTransferDestDialog: Boolean = false,
    val tableTransferMode: TableTransferMode? = null,
    val tableTransferSelectedIds: Set<String> = emptySet()
) {
    val kitchenMessagePresets: List<KitchenMessagePreset> = listOf(
        KitchenMessagePreset("Bring next dish", "Bring next dish"),
        KitchenMessagePreset("Fire mains", "Fire mains now"),
        KitchenMessagePreset("Ready for dessert", "Ready for dessert"),
        KitchenMessagePreset("More bread", "More bread please")
    )
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class PosViewModel @Inject constructor(
    private val productRepository: ProductRepository,
    private val menuRepository: MenuRepository,
    private val cartManager: CartManager,
    private val tableOrderRepository: TableOrderRepository,
    private val heldOrderRepository: HeldOrderRepository,
    private val transactionRepository: TransactionRepository,
    private val settingsRepository: SettingsRepository,
    private val customerRepository: com.chaslay.pos.data.repository.CustomerRepository,
    private val sessionManager: SessionManager,
    private val paymentOrchestrator: PaymentOrchestrator,
    private val cashPaymentService: CashPaymentService,
    private val printerService: BluetoothPrinterService,
    private val receiptRepository: com.chaslay.pos.data.repository.ReceiptRepository,
    private val adyenTerminalService: com.chaslay.pos.payment.AdyenTerminalService,
    private val scaleService: com.chaslay.pos.scale.AclasScaleService,
    private val floorSyncRepository: FloorSyncRepository,
    private val floorSyncEvents: FloorSyncEvents,
    @ApplicationContext private val appContext: android.content.Context
) : ViewModel() {

    private val _selectedCategoryId = MutableStateFlow<Long?>(null)
    private val _uiExtras = MutableStateFlow(PosDialogState())
    private val _tables = MutableStateFlow<List<TableWithOrderInfo>>(emptyList())
    private val _floorElements = MutableStateFlow<Map<Long, List<FloorPlanElementEntity>>>(emptyMap())
    private val _discountPresets = MutableStateFlow<List<DiscountPreset>>(emptyList())
    private var cachedSettings = BusinessSettingsEntity()
    private val tableOrderMutex = Mutex()
    private var persistTableJob: Job? = null

    private val _productCustomize = MutableStateFlow<ProductCustomizeState?>(null)
    private val _comboPick = MutableStateFlow<ComboPickState?>(null)

    private val productsFlow = _selectedCategoryId.flatMapLatest { categoryId ->
        productRepository.observeProducts(categoryId)
    }

    val uiState: StateFlow<PosUiState> = combine(
        combine(
            productRepository.observeCategories(),
            _selectedCategoryId,
            productsFlow,
            cartManager.cart,
            settingsRepository.observeSettings()
        ) { categories, categoryId, products, cart, settings ->
            DataBundle(categories, categoryId, products, cart, settings)
        },
        combine(_uiExtras, _productCustomize, _comboPick, _tables, _floorElements) { extras, productCustomize, comboPick, tables, floorElements ->
            UiExtrasBundle(extras, productCustomize, comboPick, tables, floorElements)
        },
        _discountPresets
    ) { bundle, extrasBundle, discountPresets ->
        cachedSettings = bundle.settings
        val extras = extrasBundle.extras
        val productCustomize = extrasBundle.productCustomize
        val comboPick = extrasBundle.comboPick
        val tables = extrasBundle.tables
        val floorElements = extrasBundle.floorElements
        PosUiState(
            categories = bundle.categories,
            products = bundle.products,
            selectedCategoryId = bundle.categoryId,
            cart = bundle.cart,
            settings = bundle.settings,
            currencySymbol = bundle.settings.currencySymbol,
            serviceType = bundle.cart.serviceType,
            tables = tables,
            activeTableName = bundle.cart.tableName,
            kitchenSentToPrinter = extras.kitchenSentToPrinter,
            isProcessingPayment = extras.isProcessingPayment,
            showOpenPriceDialog = extras.showOpenPriceDialog,
            showVariantDialog = extras.showVariantDialog,
            productCustomize = productCustomize,
            comboPick = comboPick,
            optionGroupPicker = extras.optionGroupPicker,
            showDiscountDialog = extras.showDiscountDialog,
            showCheckoutScreen = extras.showCheckoutScreen,
            showOrderComplete = extras.showOrderComplete,
            showPaymentSummary = extras.showPaymentSummary,
            showReceiptOptions = extras.showReceiptOptions,
            showTablePicker = extras.showTablePicker,
            showKitchenMessageDialog = extras.showKitchenMessageDialog,
            showMiscPriceDialog = extras.showMiscPriceDialog,
            pendingPaymentMethod = extras.pendingPaymentMethod,
            selectedProduct = extras.selectedProduct,
            lastTransaction = extras.lastTransaction,
            errorMessage = extras.errorMessage,
            errorTitle = extras.errorTitle,
            successMessage = extras.successMessage,
            snackbarMessage = extras.snackbarMessage,
            showClearCartDialog = extras.showClearCartDialog,
            showPickupDialog = extras.showPickupDialog,
            showDeliveryDialog = extras.showDeliveryDialog,
            deliveryCustomers = extras.deliveryCustomers,
            pendingDeliveryCustomer = extras.pendingDeliveryCustomer,
            showDeliveryTimeDialog = extras.showDeliveryTimeDialog,
            suggestedOrderNumber = extras.suggestedOrderNumber,
            tapToPayMessage = extras.tapToPayMessage,
            selectedCartItemId = extras.selectedCartItemId,
            lastAddedItemId = extras.lastAddedItemId,
            lastClickedProductId = extras.lastClickedProductId,
            keypadBuffer = extras.keypadBuffer,
            keypadMode = extras.keypadMode,
            keypadExpanded = extras.keypadExpanded,
            checkoutState = extras.checkoutState,
            completedTransaction = extras.completedTransaction,
            adyenCustomerReceipt = extras.adyenCustomerReceipt,
            adyenCashierReceipt = extras.adyenCashierReceipt,
            orderCompleteNotice = extras.orderCompleteNotice,
            receiptPublicUrl = extras.receiptPublicUrl,
            showReceiptEmailDialog = extras.showReceiptEmailDialog,
            isSendingReceiptEmail = extras.isSendingReceiptEmail,
            receiptEmailError = extras.receiptEmailError,
            discountPresets = discountPresets,
            showSplitBillScreen = extras.showSplitBillScreen,
            splitSelectedItemIds = extras.splitSelectedItemIds,
            showSplitDialog = extras.showSplitDialog,
            equalSplitPaidCount = extras.equalSplitPaidCount,
            splitPaymentIndex = extras.splitPaymentIndex,
            splitPaymentTotal = extras.splitPaymentTotal,
            showCartCancelDialog = extras.showCartCancelDialog,
            cartCancelReasons = extras.cartCancelReasons,
            showAttachCustomerDialog = extras.showAttachCustomerDialog,
            canCancelCartOrder = extras.orderCommittedForCancel,
            showWeighedProductDialog = extras.showWeighedProductDialog,
            scaleReading = extras.scaleReading,
            showGuestCountDialog = extras.showGuestCountDialog,
            guestCountTableName = extras.guestCountTableName,
            guestCountSeatCapacity = extras.guestCountSeatCapacity,
            guestCountDefault = extras.guestCountDefault,
            pendingTableId = extras.pendingTableId,
            floorElementsByFloorId = floorElements,
            showTableTransferItemsDialog = extras.showTableTransferItemsDialog,
            showTableTransferDestDialog = extras.showTableTransferDestDialog,
            tableTransferMode = extras.tableTransferMode,
            tableTransferSelectedIds = extras.tableTransferSelectedIds
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PosUiState())

    init {
        viewModelScope.launch {
            settingsRepository.observeSettings().collect { settings ->
                if (settings.scaleEnabled && !settings.scaleUsbAddress.isNullOrBlank()) {
                    scaleService.connect(settings.scaleUsbAddress!!)
                } else {
                    scaleService.disconnect()
                }
                cartManager.setVatIncludedInPrice(settings.vatIncludedInPrice)
            }
        }
        viewModelScope.launch {
            scaleService.reading.collect { reading ->
                updateExtras { it.copy(scaleReading = reading) }
            }
        }
        viewModelScope.launch {
            settingsRepository.observeDiscountPresets().collect { presets ->
                _discountPresets.value = presets
            }
        }
        viewModelScope.launch {
            productRepository.observeCategories().collect { categories ->
                if (_selectedCategoryId.value == null && categories.isNotEmpty()) {
                    _selectedCategoryId.value = categories.first().id
                }
            }
        }
        viewModelScope.launch {
            floorSyncEvents.tableOrdersChanged.collect {
                refreshTables()
                reloadOpenTableCartIfNeeded()
            }
        }
        refreshTables()
    }

    private suspend fun reloadOpenTableCartIfNeeded() {
        val orderId = cartManager.snapshot().tableOrderId ?: return
        tableOrderRepository.loadTableOrderToCart(cartManager, orderId)
        val order = tableOrderRepository.getOrder(orderId) ?: return
        val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
        updateExtras {
            it.copy(
                kitchenSentToPrinter = order.lastSentAt != null,
                orderCommittedForCancel = sentFlags.values.any { sent -> sent } || order.lastSentAt != null
            )
        }
    }

    fun refreshTables() {
        viewModelScope.launch {
            _tables.value = tableOrderRepository.getTablesWithStatus()
            val floors = tableOrderRepository.getAllFloors()
            _floorElements.value = floors.associate { floor ->
                floor.id to tableOrderRepository.getFloorElements(floor.id)
            }
        }
    }

    fun selectCategory(categoryId: Long?) {
        _selectedCategoryId.value = categoryId
    }

    fun setServiceType(serviceType: ServiceType) {
        applyServiceTypeRates(serviceType)
        viewModelScope.launch { persistTableOrderIfNeeded() }
    }

    private fun applyServiceTypeRates(serviceType: ServiceType) {
        cartManager.setServiceType(serviceType) { item ->
            resolveTaxRate(item.productId, item.taxRate, serviceType)
        }
    }

    fun ensureRetailMode() {
        if (isRestaurantMode()) return
        if (cartManager.snapshot().tableId != null) {
            viewModelScope.launch { switchToWalkIn() }
        }
    }

    private fun isRestaurantMode(): Boolean = cachedSettings.posMode == PosMode.RESTAURANT

    fun showTablePicker() {
        if (!isRestaurantMode()) return
        refreshTables()
        updateExtras { it.copy(showTablePicker = true) }
    }

    fun dismissTablePicker() = updateExtras { it.copy(showTablePicker = false) }

    fun openTable(tableId: Long) {
        if (!isRestaurantMode()) return
        viewModelScope.launch {
            persistTableOrderIfNeeded()
            val table = tableOrderRepository.getTable(tableId) ?: return@launch
            val trackCovers = cachedSettings.trackCoversFromSeatingPlan
            val hasOrder = tableOrderRepository.hasOpenOrder(tableId)
            if (trackCovers && !hasOrder) {
                updateExtras {
                    it.copy(
                        showGuestCountDialog = true,
                        pendingTableId = tableId,
                        guestCountTableName = table.name,
                        guestCountSeatCapacity = table.seatCapacity.coerceAtLeast(1),
                        guestCountDefault = table.seatCapacity.coerceAtLeast(1).coerceAtMost(4),
                        showTablePicker = false
                    )
                }
                return@launch
            }
            openTableInternal(tableId, guestCount = null)
        }
    }

    fun dismissGuestCountDialog() {
        updateExtras { it.copy(showGuestCountDialog = false, pendingTableId = null) }
    }

    fun confirmGuestCount(count: Int) {
        val tableId = _uiExtras.value.pendingTableId ?: return
        updateExtras { it.copy(showGuestCountDialog = false, pendingTableId = null) }
        viewModelScope.launch { openTableInternal(tableId, guestCount = count) }
    }

    fun updateGuestCount(count: Int) {
        cartManager.setGuestCount(count)
        viewModelScope.launch {
            cartManager.snapshot().tableOrderId?.let { orderId ->
                tableOrderRepository.updateGuestCount(orderId, count)
            }
        }
    }

    private suspend fun openTableInternal(tableId: Long, guestCount: Int?) {
        val table = tableOrderRepository.getTable(tableId) ?: return
        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Cashier"
        val (order, items) = tableOrderRepository.openTable(
            table,
            ServiceType.DINE_IN,
            userId,
            userName,
            guestCount = guestCount
        )
        cartManager.loadTableOrder(
            tableId = table.id,
            tableName = table.name,
            orderId = order.id,
            serviceType = ServiceType.DINE_IN,
            items = items,
            discountPercent = order.discountPercent,
            discountAmount = order.discountAmount,
            guestCount = order.guestCount,
            vatIncludedInPrice = cachedSettings.vatIncludedInPrice
        )
        val sentFlags = tableOrderRepository.getOrderItemEntities(order.id)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
        applyServiceTypeRates(ServiceType.DINE_IN)
        val hasSentKitchen = items.any { it.sentToKitchen }
        updateExtras {
            it.copy(
                showTablePicker = false,
                kitchenSentToPrinter = order.lastSentAt != null,
                orderCommittedForCancel = hasSentKitchen || order.lastSentAt != null
            )
        }
        refreshTables()
    }

    fun switchToWalkIn() {
        viewModelScope.launch {
            persistTableOrderIfNeeded()
            cartManager.clear()
            refreshTables()
            updateExtras { it.copy(showTablePicker = false, kitchenSentToPrinter = false, orderCommittedForCancel = false) }
        }
    }

    fun closeTable() {
        viewModelScope.launch {
            persistTableOrderIfNeeded()
            cartManager.clear()
            refreshTables()
            updateExtras { it.copy(kitchenSentToPrinter = false, orderCommittedForCancel = false) }
        }
    }

    fun startMoveEntireTable() {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableId == null || cart.isEmpty) return
        refreshTables()
        updateExtras {
            it.copy(
                tableTransferMode = TableTransferMode.ENTIRE_TABLE,
                showTableTransferDestDialog = true,
                showTableTransferItemsDialog = false,
                tableTransferSelectedIds = emptySet()
            )
        }
    }

    fun startMoveDishes() {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableId == null || cart.isEmpty) return
        val preselected = _uiExtras.value.selectedCartItemId?.let { setOf(it) }.orEmpty()
        updateExtras {
            it.copy(
                tableTransferMode = TableTransferMode.SELECTED_ITEMS,
                showTableTransferItemsDialog = true,
                showTableTransferDestDialog = false,
                tableTransferSelectedIds = preselected
            )
        }
    }

    fun dismissTableTransferItemsDialog() {
        updateExtras {
            it.copy(
                showTableTransferItemsDialog = false,
                tableTransferMode = null,
                tableTransferSelectedIds = emptySet()
            )
        }
    }

    fun toggleTableTransferItem(itemId: String) {
        updateExtras { extras ->
            val next = extras.tableTransferSelectedIds.toMutableSet()
            if (itemId in next) next.remove(itemId) else next.add(itemId)
            extras.copy(tableTransferSelectedIds = next)
        }
    }

    fun confirmTableTransferItems() {
        val selected = _uiExtras.value.tableTransferSelectedIds
        if (selected.isEmpty()) {
            updateExtras { it.copy(snackbarMessage = appContext.getString(R.string.table_transfer_pick_dishes)) }
            return
        }
        refreshTables()
        updateExtras {
            it.copy(
                showTableTransferItemsDialog = false,
                showTableTransferDestDialog = true
            )
        }
    }

    fun dismissTableTransferDestDialog() {
        updateExtras {
            it.copy(
                showTableTransferDestDialog = false,
                tableTransferMode = null,
                tableTransferSelectedIds = emptySet()
            )
        }
    }

    fun confirmTableTransferDestination(targetTableId: Long) {
        val mode = _uiExtras.value.tableTransferMode ?: return
        viewModelScope.launch {
            tableOrderMutex.withLock {
                syncTableOrderToDb()
                val cart = cartManager.snapshot()
                val sourceTableId = cart.tableId ?: return@withLock
                if (targetTableId == sourceTableId) {
                    updateExtras {
                        it.copy(snackbarMessage = appContext.getString(R.string.table_transfer_same_table))
                    }
                    return@withLock
                }
                val userId = sessionManager.currentUserId.first() ?: 0L
                val userName = sessionManager.currentUserName.first() ?: "Cashier"
                val selectedIds = _uiExtras.value.tableTransferSelectedIds
                val result = when (mode) {
                    TableTransferMode.ENTIRE_TABLE -> tableOrderRepository.transferEntireOrder(
                        sourceTableId = sourceTableId,
                        targetTableId = targetTableId,
                        userId = userId,
                        userName = userName
                    )
                    TableTransferMode.SELECTED_ITEMS -> tableOrderRepository.transferItems(
                        sourceTableId = sourceTableId,
                        targetTableId = targetTableId,
                        itemIds = selectedIds,
                        userId = userId,
                        userName = userName
                    )
                }
                when (result) {
                    is TableTransferResult.Error -> {
                        updateExtras {
                            it.copy(
                                showTableTransferDestDialog = false,
                                tableTransferMode = null,
                                tableTransferSelectedIds = emptySet(),
                                snackbarMessage = result.message
                            )
                        }
                    }
                    is TableTransferResult.Success -> {
                        refreshTables()
                        when (mode) {
                            TableTransferMode.ENTIRE_TABLE -> openTableInternal(targetTableId, guestCount = null)
                            TableTransferMode.SELECTED_ITEMS -> reloadTableCart(sourceTableId)
                        }
                        updateExtras {
                            it.copy(
                                showTableTransferDestDialog = false,
                                tableTransferMode = null,
                                tableTransferSelectedIds = emptySet(),
                                snackbarMessage = result.message
                            )
                        }
                    }
                }
            }
        }
    }

    private suspend fun reloadTableCart(tableId: Long) {
        val order = tableOrderRepository.getOpenOrderForTable(tableId)
        if (order == null) {
            cartManager.clear()
            updateExtras { it.copy(kitchenSentToPrinter = false, orderCommittedForCancel = false) }
            return
        }
        tableOrderRepository.loadTableOrderToCart(cartManager, order.id)
        val sentFlags = tableOrderRepository.getOrderItemEntities(order.id)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
        val hasSentKitchen = sentFlags.values.any { it }
        updateExtras {
            it.copy(
                kitchenSentToPrinter = order.lastSentAt != null,
                orderCommittedForCancel = hasSentKitchen || order.lastSentAt != null,
                selectedCartItemId = null
            )
        }
    }

    fun setActiveCourse(course: Int) {
        cartManager.setActiveCourse(course)
    }

    fun addCourse() {
        if (!isRestaurantMode()) return
        cartManager.addCourse()
        updateExtras { it.copy(keypadExpanded = false, keypadBuffer = "") }
    }

    fun setKeypadMode(mode: KeypadMode) {
        updateExtras { it.copy(keypadMode = mode, keypadBuffer = "") }
    }

    fun setKeypadExpanded(expanded: Boolean) {
        updateExtras { it.copy(keypadExpanded = expanded) }
    }

    fun increaseSplitCount() = cartManager.increaseSplitCount()
    fun decreaseSplitCount() = cartManager.decreaseSplitCount()
    fun setSplitByItems(enabled: Boolean) = cartManager.setSplitByItems(enabled)
    fun setActiveSplitCheck(check: Int) = cartManager.setActiveSplitCheck(check)
    fun assignItemSplitCheck(itemId: String, check: Int) = cartManager.assignItemSplitCheck(itemId, check)

    fun applyItemDiscountPercent(itemId: String, percent: Double) {
        cartManager.applyItemDiscountPercent(itemId, percent)
        persistTableOrderAsync()
    }

    fun applyPresetToSelectedItem(preset: DiscountPreset) {
        val itemId = _uiExtras.value.selectedCartItemId ?: return
        applyItemDiscountPercent(itemId, preset.percent)
    }

    fun applyPresetToCart(preset: DiscountPreset) {
        cartManager.applyDiscount(preset.percent, 0.0)
        persistTableOrderAsync()
    }

    fun addMiscItemFromDialog(price: Double, name: String = "Divers") {
        val serviceType = cartManager.snapshot().serviceType
        val taxRate = resolveTaxRate(0L, cachedSettings.takeawayVatRate, serviceType)
        val itemId = UUID.randomUUID().toString()
        cartManager.addItem(
            CartItem(
                id = itemId,
                productId = 0L,
                productName = name,
                unitPrice = price,
                quantity = 1,
                taxRate = taxRate
            )
        )
        updateExtras { it.copy(showMiscPriceDialog = false, keypadBuffer = "", lastAddedItemId = itemId) }
        persistTableOrderAsync()
    }

    fun dismissMiscPriceDialog() = updateExtras { it.copy(showMiscPriceDialog = false) }

    fun clearWalkInOrder() {
        cartManager.clear()
        updateExtras { it.copy(selectedCartItemId = null, keypadBuffer = "") }
    }

    fun onProductClick(productId: Long) {
        updateExtras { it.copy(lastClickedProductId = productId) }
        viewModelScope.launch {
            val product = productRepository.getProductWithVariants(productId) ?: return@launch
            when {
                product.isCombo -> {
                    val combo = menuRepository.getComboMeal(product.id) ?: return@launch
                    _comboPick.value = ComboPickState(combo)
                }
                product.isWeighed -> updateExtras {
                    it.copy(showWeighedProductDialog = true, selectedProduct = product)
                }
                product.isOpenPrice -> updateExtras {
                    it.copy(showOpenPriceDialog = true, selectedProduct = product)
                }
                else -> openProductCustomize(product, null)
            }
        }
    }

    fun dismissComboPick() {
        _comboPick.value = null
    }

    fun addComboToCart(result: ComboPickResult) {
        val state = _comboPick.value ?: return
        val product = state.combo.product
        val serviceType = cartManager.snapshot().serviceType
        val itemId = UUID.randomUUID().toString()
        val item = CartItem(
            id = itemId,
            productId = product.id,
            productName = product.name,
            unitPrice = product.price,
            quantity = result.quantity,
            taxRate = resolveTaxRate(product.id, product.taxRate, serviceType),
            sku = product.sku,
            categoryId = product.categoryId,
            isCombo = true,
            comboSelections = result.selections
        ).let { it.copy(notes = it.optionNotes()) }
        cartManager.addItem(item)
        playItemClickBeep()
        _comboPick.value = null
        updateExtras {
            it.copy(
                lastAddedItemId = itemId,
                lastClickedProductId = product.id,
                selectedCartItemId = itemId,
                keypadExpanded = true
            )
        }
        persistTableOrderAsync()
    }

    fun onBarcodeScanned(rawCode: String) {
        val code = rawCode.trim()
        if (code.isEmpty()) return
        viewModelScope.launch {
            val lookup = productRepository.findByBarcode(code)
            if (lookup == null) {
                updateExtras { it.copy(snackbarMessage = "No product for barcode $code") }
                return@launch
            }
            val product = productRepository.getProductWithVariants(lookup.productId) ?: return@launch
            when {
                product.isWeighed -> updateExtras {
                    it.copy(showWeighedProductDialog = true, selectedProduct = product, keypadExpanded = true)
                }
                product.isOpenPrice -> updateExtras {
                    it.copy(
                        showOpenPriceDialog = true,
                        selectedProduct = product,
                        keypadExpanded = true
                    )
                }
                lookup.variantName != null -> addProductToCart(
                    product = product,
                    variantName = lookup.variantName,
                    basePrice = lookup.variantPrice ?: product.price
                )
                product.isCombo -> onProductClick(product.id)
                else -> {
                    val modifierGroups = menuRepository.getModifierGroupsForProduct(product.id)
                    val addonGroups = menuRepository.getAddonGroupsForProduct(product.id)
                    val needsCustomize = product.variants.isNotEmpty() ||
                        modifierGroups.isNotEmpty() ||
                        addonGroups.isNotEmpty()
                    if (needsCustomize) {
                        onProductClick(product.id)
                    } else {
                        addProductToCart(product, null, product.price)
                    }
                }
            }
        }
    }

    fun addOpenPriceProduct(price: Double) {
        val product = _uiExtras.value.selectedProduct ?: return
        dismissDialogs()
        viewModelScope.launch { openProductCustomize(product, price) }
    }

    fun dismissWeighedProductDialog() = updateExtras {
        it.copy(showWeighedProductDialog = false, selectedProduct = null)
    }

    fun addWeighedProductToCart(weightKg: Double) {
        val product = _uiExtras.value.selectedProduct ?: return
        if (weightKg <= 0.0) return
        val grams = com.chaslay.pos.scale.AclasScaleProtocol.gramsFromKg(weightKg)
        dismissWeighedProductDialog()
        addProductToCart(
            product = product,
            variantName = null,
            basePrice = product.price,
            sku = product.sku,
            quantity = grams,
            isWeighed = true
        )
    }

    private suspend fun openProductCustomize(product: ProductWithVariants, openPrice: Double?) {
        val modifierGroups = menuRepository.getModifierGroupsForProduct(product.id)
        val addonGroups = menuRepository.getAddonGroupsForProduct(product.id)
        val needsCustomize = product.variants.isNotEmpty() ||
            modifierGroups.isNotEmpty() ||
            addonGroups.isNotEmpty()
        if (!needsCustomize) {
            val price = openPrice ?: product.price
            addProductToCart(product, null, price, product.sku, emptyList(), emptyList(), null, 1)
            return
        }
        _productCustomize.value = ProductCustomizeState(
            product = product,
            modifierGroups = modifierGroups,
            addonGroups = addonGroups,
            openPrice = openPrice
        )
    }

    fun dismissProductCustomize() {
        _productCustomize.value = null
    }

    fun addCustomizedProduct(result: CustomizedProductResult) {
        val state = _productCustomize.value ?: return
        if (state.editingItemId != null) {
            updateCartItemFromCustomize(state.editingItemId, state.product, result)
        } else {
            addProductToCart(
                product = state.product,
                variantName = result.variantName,
                basePrice = result.unitPrice,
                sku = result.sku,
                modifiers = result.modifiers,
                addons = result.addons,
                userNotes = result.notes,
                quantity = result.quantity
            )
        }
        _productCustomize.value = null
    }

    fun editCartItem(itemId: String) {
        viewModelScope.launch {
            val item = cartManager.snapshot().items.find { it.id == itemId } ?: return@launch
            if (item.sentToKitchen) return@launch
            val product = productRepository.getProductWithVariants(item.productId) ?: return@launch
            val modifierGroups = menuRepository.getModifierGroupsForProduct(product.id)
            val addonGroups = menuRepository.getAddonGroupsForProduct(product.id)
            _productCustomize.value = ProductCustomizeState(
                product = product,
                modifierGroups = modifierGroups,
                addonGroups = addonGroups,
                openPrice = if (product.isOpenPrice) item.unitPrice else null,
                editingItemId = itemId,
                initialQuantity = item.quantity,
                initialVariantName = item.variantName,
                initialModifiers = item.modifiers,
                initialAddons = item.addons
            )
        }
    }

    private fun updateCartItemFromCustomize(
        itemId: String,
        product: ProductWithVariants,
        result: CustomizedProductResult
    ) {
        val existing = cartManager.snapshot().items.find { it.id == itemId } ?: return
        if (existing.sentToKitchen) return
        val serviceType = cartManager.snapshot().serviceType
        val updated = existing.copy(
            variantName = result.variantName,
            unitPrice = result.unitPrice,
            quantity = result.quantity,
            sku = result.sku,
            modifiers = result.modifiers,
            addons = result.addons,
            notes = result.notes,
            taxRate = resolveTaxRate(product.id, product.taxRate, serviceType)
        )
        cartManager.replaceItem(itemId, updated.copy(notes = updated.optionNotes()))
        playItemClickBeep()
        persistTableOrderAsync()
    }

    private fun addProductToCart(
        product: ProductWithVariants,
        variantName: String?,
        basePrice: Double,
        sku: String? = product.sku,
        modifiers: List<SelectedModifier> = emptyList(),
        addons: List<SelectedAddon> = emptyList(),
        userNotes: String? = null,
        quantity: Int = 1,
        isWeighed: Boolean = false
    ) {
        val unitPrice = basePrice
        val serviceType = cartManager.snapshot().serviceType
        val itemId = UUID.randomUUID().toString()
        val item = CartItem(
            id = itemId,
            productId = product.id,
            productName = product.name,
            variantName = variantName,
            unitPrice = unitPrice,
            quantity = quantity,
            taxRate = resolveTaxRate(product.id, product.taxRate, serviceType),
            sku = sku,
            categoryId = product.categoryId,
            modifiers = modifiers,
            addons = addons,
            notes = userNotes,
            isWeighed = isWeighed
        ).let { it.copy(notes = it.optionNotes()) }
        cartManager.addItem(item)
        playItemClickBeep()
        checkLowStockAlert(product.id, quantity)
        updateExtras {
            it.copy(
                lastAddedItemId = itemId,
                lastClickedProductId = product.id,
                selectedCartItemId = itemId,
                keypadExpanded = true
            )
        }
        persistTableOrderAsync()
    }

    fun updateQuantity(itemId: String, quantity: Int) {
        val item = cartManager.snapshot().items.find { it.id == itemId } ?: return
        if (item.sentToKitchen) return
        cartManager.updateQuantity(itemId, quantity)
        persistTableOrderAsync()
    }

    fun incrementItemQuantity(itemId: String) {
        val item = cartManager.snapshot().items.find { it.id == itemId } ?: return
        if (item.sentToKitchen) return
        updateQuantity(itemId, item.quantity + 1)
    }

    fun decrementItemQuantity(itemId: String) {
        val item = cartManager.snapshot().items.find { it.id == itemId } ?: return
        if (item.sentToKitchen) return
        updateQuantity(itemId, item.quantity - 1)
    }

    fun removeItem(itemId: String) {
        cartManager.removeItem(itemId)
        if (_uiExtras.value.selectedCartItemId == itemId) {
            updateExtras { it.copy(selectedCartItemId = null) }
        }
        persistTableOrderAsync()
    }

    fun selectCartItem(itemId: String?) {
        updateExtras {
            it.copy(selectedCartItemId = itemId, keypadExpanded = itemId != null || it.keypadExpanded)
        }
    }

    fun onKeypadInput(key: String) {
        updateExtras { extras ->
            if (extras.keypadMode == KeypadMode.QTY && key == ".") return@updateExtras extras
            val buffer = extras.keypadBuffer
            val next = when (key) {
                "00" -> if (buffer.isEmpty()) "0" else buffer + "00"
                "." -> when {
                    buffer.contains(".") -> buffer
                    buffer.isEmpty() -> "0."
                    else -> buffer + "."
                }
                else -> if (buffer == "0") key else buffer + key
            }
            extras.copy(keypadBuffer = next.take(12))
        }
    }

    fun onKeypadBackspace() {
        updateExtras { extras ->
            extras.copy(keypadBuffer = extras.keypadBuffer.dropLast(1))
        }
    }

    fun onKeypadClear() {
        val extras = _uiExtras.value
        when {
            extras.keypadBuffer.isNotEmpty() -> updateExtras { it.copy(keypadBuffer = "") }
            extras.selectedCartItemId != null -> {
                removeItem(extras.selectedCartItemId)
            }
            extras.lastAddedItemId != null && cartManager.snapshot().items.any { it.id == extras.lastAddedItemId } -> {
                removeItem(extras.lastAddedItemId)
                updateExtras { it.copy(lastAddedItemId = null) }
            }
            else -> Unit
        }
    }

    fun onKeypadClearAll() {
        cartManager.clear()
        updateExtras { it.copy(keypadBuffer = "", selectedCartItemId = null, lastAddedItemId = null) }
        persistTableOrderAsync()
    }

    fun onKeypadEnter() {
        val extras = _uiExtras.value
        val buffer = extras.keypadBuffer
        val value = buffer.toDoubleOrNull() ?: return
        when (extras.keypadMode) {
            KeypadMode.QTY -> {
                val itemId = extras.selectedCartItemId ?: extras.lastAddedItemId ?: return
                val item = cartManager.snapshot().items.find { it.id == itemId } ?: return
                if (item.sentToKitchen) return
                updateQuantity(itemId, value.toInt().coerceAtLeast(1))
            }
            KeypadMode.PERCENT -> {
                val itemId = extras.selectedCartItemId ?: return
                applyItemDiscountPercent(itemId, value.coerceIn(0.0, 100.0))
            }
            KeypadMode.PRICE -> {
                val selectedId = extras.selectedCartItemId
                val serviceType = cartManager.snapshot().serviceType
                val taxRate = resolveTaxRate(0L, cachedSettings.takeawayVatRate, serviceType)
                if (selectedId != null) {
                    cartManager.overrideItemPrice(selectedId, value)
                } else {
                    val itemId = UUID.randomUUID().toString()
                    cartManager.addItem(
                        CartItem(
                            id = itemId,
                            productId = 0L,
                            productName = "Divers",
                            unitPrice = value,
                            quantity = 1,
                            taxRate = taxRate
                        )
                    )
                    updateExtras { it.copy(lastAddedItemId = itemId) }
                }
            }
        }
        updateExtras { it.copy(keypadBuffer = "", selectedCartItemId = null, keypadExpanded = false) }
        persistTableOrderAsync()
    }

    fun addMiscItemQuick() {
        updateExtras {
            it.copy(selectedCartItemId = null, keypadBuffer = "", showMiscPriceDialog = true, keypadExpanded = true)
        }
    }

    fun showDiscountDialog() = updateExtras { it.copy(showDiscountDialog = true) }

    fun applyDiscount(percent: Double, amount: Double) {
        cartManager.applyDiscount(percent, amount)
        updateExtras { it.copy(showDiscountDialog = false) }
        persistTableOrderAsync()
    }

    fun sendToKitchen(courseNumber: Int? = null) {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableId == null) {
            showError("Kitchen", "Open a table first")
            return
        }
        if (cart.isEmpty) {
            showError("Kitchen", "Add items before sending to kitchen")
            return
        }
        viewModelScope.launch {
            tableOrderMutex.withLock {
                val orderId = flushTableOrderSync() ?: run {
                    showError("Kitchen", "Open a table first")
                    return@withLock
                }
                val syncedCart = cartManager.snapshot()
                val dbItems = tableOrderRepository.getOrderItemEntities(orderId)
                // Send every item not yet sent to the kitchen (union of cart + DB views).
                val cartUnsentIds = (cart.items + syncedCart.items)
                    .filter { !it.sentToKitchen && (courseNumber == null || it.courseNumber == courseNumber) }
                    .map { it.id }
                    .toSet()
                val dbUnsentIds = dbItems
                    .filter { it.sentToKitchenAt == null && (courseNumber == null || it.courseNumber == courseNumber) }
                    .map { it.id }
                    .toSet()
                val targetIds = cartUnsentIds + dbUnsentIds
                Log.i(
                    "KITCHEN_SEND",
                    "order=$orderId cartItems=${cart.items.size} cartUnsent=${cartUnsentIds.size} " +
                        "dbItems=${dbItems.size} dbUnsent=${dbUnsentIds.size} target=${targetIds.size} " +
                        "flags=${syncedCart.items.joinToString { "${it.productName}:${it.sentToKitchen}" }}"
                )
                if (targetIds.isEmpty()) {
                    showError(
                        "Kitchen",
                        if (courseNumber != null) "No new items in course $courseNumber" else "No new items to send"
                    )
                    return@withLock
                }
                tableOrderRepository.clearSentFlags(orderId, targetIds)
                val unsent = tableOrderRepository.getOrderItemEntities(orderId)
                    .filter { it.id in targetIds }
                if (unsent.isEmpty()) {
                    showError("Kitchen", "No new items to send")
                    return@withLock
                }
                val settings = settingsRepository.getSettings()
                val previewRound = (tableOrderRepository.getOrder(orderId)?.kitchenRound ?: 0) + 1
                val meta = buildKitchenMeta(syncedCart)
                deliverKitchenPrint(
                    settings = settings,
                    orderId = orderId,
                    tableName = syncedCart.tableName.orEmpty(),
                    serviceType = syncedCart.serviceType,
                    round = previewRound,
                    items = unsent,
                    meta = meta
                ).onSuccess {
                    tableOrderRepository.markItemsSentToKitchen(orderId, unsent)
                    val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
                        .associate { it.id to (it.sentToKitchenAt != null) }
                    cartManager.refreshSentFlags(sentFlags)
                    updateExtras {
                        it.copy(
                            kitchenSentToPrinter = true,
                            orderCommittedForCancel = true,
                            snackbarMessage = "Sent ${unsent.size} item(s) to kitchen",
                            selectedCartItemId = null,
                            keypadBuffer = ""
                        )
                    }
                    refreshTables()
                }.onFailure { e ->
                    showError("Kitchen", e.message ?: "Kitchen print failed")
                }
            }
        }
    }

    fun sendAllCoursesToKitchen() {
        sendToKitchen(courseNumber = null)
        updateExtras {
            it.copy(snackbarMessage = "All courses sent. Switch course tab and tap Fire to send each course when ready.")
        }
    }

    fun sendActiveCourseToKitchen() {
        val cart = cartManager.snapshot()
        val active = cart.activeCourse
        val courseItems = cart.items.filter { it.courseNumber == active }
        if (courseItems.isEmpty()) {
            showError("Kitchen", "No items in course $active")
            return
        }
        if (courseItems.any { !it.sentToKitchen }) {
            sendToKitchen(courseNumber = active)
        } else {
            reprintCourseToKitchen(active)
        }
    }

    private fun reprintCourseToKitchen(courseNumber: Int) {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableId == null) {
            showError("Kitchen", "Open a table first")
            return
        }
        viewModelScope.launch {
            tableOrderMutex.withLock {
                val orderId = flushTableOrderSync() ?: run {
                    showError("Kitchen", "Open a table first")
                    return@withLock
                }
                val syncedCart = cartManager.snapshot()
                val courseItems = tableOrderRepository.getOrderItemEntities(orderId)
                    .filter { it.courseNumber == courseNumber }
                if (courseItems.isEmpty()) {
                    showError("Kitchen", "No items in course $courseNumber")
                    return@withLock
                }
                val settings = settingsRepository.getSettings()
                val previewRound = (tableOrderRepository.getOrder(orderId)?.kitchenRound ?: 0) + 1
                val meta = buildKitchenMeta(syncedCart).copy(fireCourseNumber = courseNumber)
                deliverKitchenPrint(
                    settings = settings,
                    orderId = orderId,
                    tableName = syncedCart.tableName.orEmpty(),
                    serviceType = syncedCart.serviceType,
                    round = previewRound,
                    items = courseItems,
                    meta = meta
                ).onSuccess {
                    updateExtras {
                        it.copy(
                            orderCommittedForCancel = true,
                            snackbarMessage = "Course $courseNumber fired to kitchen",
                            selectedCartItemId = null,
                            keypadBuffer = ""
                        )
                    }
                    refreshTables()
                }.onFailure { e ->
                    showError("Kitchen", e.message ?: "Kitchen print failed")
                }
            }
        }
    }

    fun holdOrder(sendToKitchen: Boolean) {
        if (sendToKitchen && !isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.isEmpty) {
            showError("Hold", "Add items before holding the order")
            return
        }
        viewModelScope.launch {
            val userId = sessionManager.currentUserId.first() ?: 0L
            val userName = sessionManager.currentUserName.first() ?: "Cashier"

            // 1. Optionally print to kitchen (must not block the hold itself)
            if (sendToKitchen) {
                runCatching {
                    val snapshot = cartManager.snapshot()
                    if (snapshot.tableId != null) {
                        tableOrderMutex.withLock {
                            val orderId = flushTableOrderSync()
                            if (orderId != null) {
                                printPendingKitchenItems(orderId, snapshot.tableName.orEmpty(), snapshot.serviceType)
                            }
                        }
                    } else {
                        val unsent = snapshot.items.filter { !it.sentToKitchen }
                        if (unsent.isNotEmpty()) {
                            printWalkInKitchenTicket(snapshot.copy(items = unsent))
                            cartManager.refreshSentFlags(
                                snapshot.items.associate { item ->
                                    item.id to (item.sentToKitchen || unsent.any { it.id == item.id })
                                }
                            )
                        }
                    }
                }.onFailure { e -> Log.e("HOLD_ORDER", "Kitchen print during hold failed", e) }
                if (sendToKitchen) {
                    updateExtras { it.copy(orderCommittedForCancel = true) }
                }
            }

            // 2. Ensure table order is persisted + marked HELD (best effort)
            runCatching {
                if (cartManager.snapshot().tableId != null) {
                    tableOrderMutex.withLock {
                        flushTableOrderSync()
                        cartManager.snapshot().tableOrderId?.let { tableOrderRepository.holdOrder(it) }
                    }
                }
            }.onFailure { e -> Log.e("HOLD_ORDER", "Persisting table order during hold failed", e) }

            // 3. Create the held order record (this is what shows in Ongoing Orders) - critical
            val result = runCatching {
                val heldSnapshot = cartManager.snapshot()
                val held = heldOrderRepository.createHeldOrder(
                    cart = heldSnapshot,
                    sendToKitchen = sendToKitchen,
                    userId = userId,
                    userName = userName
                )
                Log.i("HOLD_ORDER", "Created held order ${held.id} status=${held.status} items=${heldSnapshot.items.size} tableOrderId=${heldSnapshot.tableOrderId}")
                held
            }

            result.onSuccess {
                cartManager.clear()
                updateExtras {
                    it.copy(
                        selectedCartItemId = null,
                        keypadBuffer = "",
                        snackbarMessage = if (sendToKitchen) "Order held and sent to kitchen" else "Order held"
                    )
                }
                refreshTables()
            }.onFailure { e ->
                Log.e("HOLD_ORDER", "Creating held order failed", e)
                showError("Hold", e.message ?: "Could not hold order")
            }
        }
    }

    private suspend fun printWalkInKitchenTicket(cart: CartSummary) {
        val settings = settingsRepository.getSettings()
        val categories = productRepository.getAllCategories()
        val products = productRepository.getAllProducts()
        val items = cart.items.map { item ->
            com.chaslay.pos.data.local.entity.TableOrderItemEntity(
                id = item.id,
                orderId = "walk-in",
                productId = item.productId,
                productName = item.productName,
                variantName = item.variantName,
                sku = item.sku,
                unitPrice = item.unitPrice,
                quantity = item.quantity,
                taxRate = item.taxRate,
                notes = item.notes ?: item.optionNotes(),
                courseNumber = item.courseNumber
            )
        }
        printerService.routeKitchen(
            settings = settings,
            tableName = when (cart.fulfillmentType) {
                FulfillmentType.DINE_IN -> cart.tableName.orEmpty()
                else -> ""
            },
            serviceType = cart.serviceType,
            round = 1,
            items = items,
            isFollowUp = false,
            message = null,
            categories = categories,
            products = products,
            meta = buildKitchenMeta(cart)
        )
    }

    private suspend fun printPendingKitchenForCurrentTable() {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableId == null) {
            // Walk-in / direct order (no table): print the order to the kitchen on sale.
            // Only print items not already sent so split-bill payments don't re-fire the kitchen.
            val unsent = cart.items.filter { !it.sentToKitchen }
            if (unsent.isEmpty()) return
            runCatching { printWalkInKitchenTicket(cart.copy(items = unsent)) }
                .onSuccess {
                    cartManager.refreshSentFlags(
                        cart.items.associate { item ->
                            item.id to (item.sentToKitchen || unsent.any { it.id == item.id })
                        }
                    )
                    updateExtras { it.copy(orderCommittedForCancel = true) }
                }
                .onFailure { e -> Log.e("KITCHEN_SEND", "Walk-in kitchen print on sale failed", e) }
            return
        }
        tableOrderMutex.withLock {
            val orderId = flushTableOrderSync() ?: return@withLock
            printPendingKitchenItems(orderId, cart.tableName.orEmpty(), cart.serviceType)
        }
    }

    private suspend fun printPendingKitchenItems(
        orderId: String,
        tableName: String,
        serviceType: ServiceType
    ) {
        val syncedCart = cartManager.snapshot()
        val intendedIds = syncedCart.items.filter { !it.sentToKitchen }.map { it.id }.toSet()
        if (intendedIds.isEmpty()) return
        tableOrderRepository.clearSentFlags(orderId, intendedIds)
        val unsent = tableOrderRepository.getOrderItemEntities(orderId)
            .filter { it.id in intendedIds }
        if (unsent.isEmpty()) return
        val settings = settingsRepository.getSettings()
        val previewRound = (tableOrderRepository.getOrder(orderId)?.kitchenRound ?: 0) + 1
        deliverKitchenPrint(
            settings = settings,
            orderId = orderId,
            tableName = tableName,
            serviceType = serviceType,
            round = previewRound,
            items = unsent,
            meta = buildKitchenMeta(syncedCart)
        ).onSuccess {
            tableOrderRepository.markItemsSentToKitchen(orderId, unsent)
            val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
                .associate { it.id to (it.sentToKitchenAt != null) }
            cartManager.refreshSentFlags(sentFlags)
            updateExtras { it.copy(orderCommittedForCancel = true) }
        }
    }

    fun showSplitDialog() = openSplitBillScreen()

    fun openSplitBillScreen() {
        if (!cachedSettings.splitBillsEnabled) return
        val cart = cartManager.snapshot()
        if (cart.isEmpty) return
        if (cartManager.snapshot().splitCount <= 1) {
            cartManager.increaseSplitCount()
        }
        cartManager.setSplitByItems(true)
        updateExtras {
            it.copy(
                showSplitBillScreen = true,
                showSplitDialog = false,
                showCheckoutScreen = false,
                splitSelectedItemIds = emptySet()
            )
        }
    }

    fun dismissSplitBillScreen() = updateExtras {
        it.copy(showSplitBillScreen = false, splitSelectedItemIds = emptySet(), returnToSplitAfterCheckout = false)
    }

    fun finishSplitBill() {
        val cart = cartManager.snapshot()
        if (cart.items.isEmpty()) {
            cartManager.resetSplit()
            updateExtras {
                it.copy(
                    showSplitBillScreen = false,
                    splitSelectedItemIds = emptySet(),
                    returnToSplitAfterCheckout = false,
                    masterOrderId = null,
                    equalSplitPaidCount = 0
                )
            }
            return
        }
        val firstCheck = (1..cart.splitCount).firstOrNull { check ->
            cart.items.any { it.splitCheck == check }
        } ?: 1
        cartManager.setActiveSplitCheck(firstCheck)
        updateExtras {
            it.copy(
                showSplitBillScreen = false,
                splitSelectedItemIds = emptySet(),
                returnToSplitAfterCheckout = false,
                masterOrderId = null,
                equalSplitPaidCount = 0
            )
        }
        openCheckout(method = PaymentMethod.CASH, fromSplit = false)
    }

    fun toggleSplitItemSelection(itemId: String) {
        updateExtras { extras ->
            val next = extras.splitSelectedItemIds.toMutableSet()
            if (itemId in next) next.remove(itemId) else next.add(itemId)
            extras.copy(splitSelectedItemIds = next)
        }
    }

    fun moveSelectedToNewBill() {
        val selected = _uiExtras.value.splitSelectedItemIds
        if (selected.isEmpty()) return
        val cart = cartManager.snapshot()
        val usedChecks = cart.items.map { it.splitCheck }.toSet()
        var targetCheck = (usedChecks.maxOrNull() ?: 1) + 1
        while (targetCheck in usedChecks && targetCheck <= 8) targetCheck++
        while (cartManager.snapshot().splitCount < targetCheck) cartManager.increaseSplitCount()
        cartManager.assignItemsToCheck(selected, targetCheck)
        updateExtras { it.copy(splitSelectedItemIds = emptySet()) }
        persistTableOrderAsync()
    }

    fun splitEqually(count: Int) {
        cartManager.setSplitByItems(false)
        val target = count.coerceIn(2, 8)
        while (cartManager.snapshot().splitCount < target) cartManager.increaseSplitCount()
        while (cartManager.snapshot().splitCount > target) cartManager.decreaseSplitCount()
        cartManager.setActiveSplitCheck(1)
        updateExtras { it.copy(equalSplitPaidCount = 0, showSplitBillScreen = false) }
        openCheckout(method = PaymentMethod.CASH, fromSplit = false)
    }

    fun checkoutSplitCheck(checkNumber: Int, method: PaymentMethod = PaymentMethod.CASH) {
        cartManager.setActiveSplitCheck(checkNumber)
        openCheckout(method, fromSplit = true)
    }

    fun navigateSplitBill(delta: Int) {
        val cart = cartManager.snapshot()
        if (cart.splitCount <= 1) return
        val next = (cart.activeSplitCheck + delta).coerceIn(1, cart.splitCount)
        if (next == cart.activeSplitCheck) return
        cartManager.setActiveSplitCheck(next)
        updateExtras {
            it.copy(checkoutState = CheckoutState(roundingStep = checkoutRoundingDefault()))
        }
    }

    fun checkoutDisplayCart(cart: CartSummary): CartSummary {
        if (cart.splitByItems && cart.splitCount > 1) {
            return cart.copy(items = cart.items.filter { it.splitCheck == cart.activeSplitCheck })
        }
        return cart
    }

    fun dismissSplitDialog() = dismissSplitBillScreen()

    fun applySplitCount(count: Int) {
        splitEqually(count)
        dismissSplitBillScreen()
    }

    fun enableSplitByItems() {
        if (cartManager.snapshot().splitCount <= 1) cartManager.increaseSplitCount()
        cartManager.setSplitByItems(true)
        updateExtras { it.copy(showSplitBillScreen = true, showSplitDialog = false) }
    }

    fun showKitchenMessageDialog() {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        if (cart.tableOrderId == null) {
            showError("Kitchen", "Open a table first")
            return
        }
        updateExtras { it.copy(showKitchenMessageDialog = true) }
    }

    fun dismissKitchenMessageDialog() = updateExtras { it.copy(showKitchenMessageDialog = false) }

    fun sendKitchenMessage(message: String) {
        if (!isRestaurantMode()) return
        val cart = cartManager.snapshot()
        val orderId = cart.tableOrderId ?: return
        val tableId = cart.tableId ?: return
        val tableName = cart.tableName.orEmpty()
        viewModelScope.launch {
            tableOrderRepository.addKitchenMessage(orderId, tableId, tableName, message)
            val settings = settingsRepository.getSettings()
            printerService.routeKitchen(
                settings = settings,
                tableName = tableName,
                serviceType = cart.serviceType,
                round = 0,
                items = emptyList(),
                isFollowUp = true,
                message = message,
                meta = buildKitchenMeta(cart)
            ).onSuccess {
                updateExtras {
                    it.copy(showKitchenMessageDialog = false)
                }
            }.onFailure { e ->
                updateExtras { it.copy(errorMessage = e.message ?: "Kitchen message failed") }
            }
        }
    }

    fun openCheckout(method: PaymentMethod = PaymentMethod.CASH, fromSplit: Boolean = false) {
        val full = cartManager.snapshot()
        val payable = cartManager.paymentSnapshot()
        if (payable.isEmpty && !(full.splitCount > 1 && !full.splitByItems)) return
        val resolvedMethod = resolveCheckoutMethod(method)
        updateExtras {
            it.copy(
                showCheckoutScreen = true,
                showSplitBillScreen = false,
                returnToSplitAfterCheckout = false,
                checkoutState = CheckoutState(
                    method = resolvedMethod,
                    roundingStep = checkoutRoundingDefault()
                ),
                errorMessage = null,
                errorTitle = null
            )
        }
    }

    private fun resolveCheckoutMethod(preferred: PaymentMethod): PaymentMethod {
        val settings = cachedSettings
        val enabled = buildList {
            if (settings.cashEnabled) add(PaymentMethod.CASH)
            if (settings.cardEnabled) add(PaymentMethod.CARD)
            if (settings.terminalEnabled && settings.adyenTerminalEnabled) add(PaymentMethod.ADYEN_TERMINAL)
        }
        if (enabled.isEmpty()) return preferred
        if (preferred in enabled) return preferred
        return enabled.first()
    }

    fun dismissCheckout() {
        updateExtras {
            it.copy(
                showCheckoutScreen = false,
                pendingPaymentMethod = null,
                showSplitBillScreen = false,
                returnToSplitAfterCheckout = false
            )
        }
    }

    fun updateCheckoutMethod(method: PaymentMethod) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(method = method)) }
    }

    fun updateCheckoutTipAmount(amount: Double) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(tipAmount = amount)) }
    }

    fun updateCheckoutTipPercent(percent: Double) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(tipPercent = percent)) }
    }

    fun updateCheckoutDiscountPercent(percent: Double) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(discountPercent = percent)) }
    }

    fun updateCheckoutRoundingStep(step: Double) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(roundingStep = step)) }
    }

    fun updateCheckoutPrintReceipt(print: Boolean) {
        updateExtras { it.copy(checkoutState = it.checkoutState.copy(printReceipt = print)) }
    }

    fun toggleCheckoutTipPanel() {
        updateExtras {
            it.copy(checkoutState = it.checkoutState.copy(showTipPanel = !it.checkoutState.showTipPanel))
        }
    }

    fun toggleCheckoutDiscountPanel() {
        updateExtras {
            it.copy(checkoutState = it.checkoutState.copy(showDiscountPanel = !it.checkoutState.showDiscountPanel))
        }
    }

    fun openCashDrawer() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            withContext(Dispatchers.IO) {
                printerService.routeOpenCashDrawer(settings)
            }.onFailure { e -> showError("Drawer", e.message ?: "Cash drawer failed") }
        }
    }

    fun printKitchenTicket() {
        viewModelScope.launch {
            val cart = cartManager.snapshot()
            if (cart.isEmpty) {
                showError("Print", "Add items before printing")
                return@launch
            }
            runCatching {
                withContext(Dispatchers.IO) { printWalkInKitchenTicket(cart) }
            }.onSuccess {
                updateExtras { it.copy(orderCommittedForCancel = true) }
            }.onFailure { e -> showError("Print", e.message ?: "Kitchen print failed") }
        }
    }

    fun showAttachCustomerDialog() {
        viewModelScope.launch {
            val customers = customerRepository.getAll()
            updateExtras {
                it.copy(showAttachCustomerDialog = true, deliveryCustomers = customers)
            }
        }
    }

    fun dismissAttachCustomerDialog() = updateExtras { it.copy(showAttachCustomerDialog = false) }

    fun attachCustomerToCart(customer: CustomerEntity) {
        cartManager.setCustomerInfo(
            name = customer.name,
            phone = customer.phone,
            email = customer.email,
            address = customer.address,
            zip = customer.zip
        )
        updateExtras {
            it.copy(
                showAttachCustomerDialog = false,
                snackbarMessage = customer.name
            )
        }
    }

    fun toggleCartOrderType() {
        val cart = cartManager.snapshot()
        if (cart.tableId != null) {
            viewModelScope.launch {
                val items = cart.items.map { it.copy(sentToKitchen = false) }
                cart.tableOrderId?.let { tableOrderRepository.voidOpenOrder(it, "Converted to takeaway") }
                cartManager.clear()
                applyServiceTypeRates(ServiceType.TAKEAWAY)
                cartManager.setPickupOrder(suggestOrderNumber(), null)
                items.forEach { cartManager.addItem(it) }
                refreshTables()
                updateExtras { it.copy(snackbarMessage = appContext.getString(R.string.snackbar_switched_takeaway)) }
            }
            return
        }
        when (cart.serviceType) {
            ServiceType.TAKEAWAY -> {
                if (isRestaurantMode()) {
                    refreshTables()
                    updateExtras { it.copy(showTablePicker = true) }
                } else {
                    setServiceType(ServiceType.DINE_IN)
                    updateExtras { it.copy(snackbarMessage = "Switched to dine-in") }
                }
            }
            ServiceType.DINE_IN -> {
                setServiceType(ServiceType.TAKEAWAY)
                updateExtras { it.copy(snackbarMessage = appContext.getString(R.string.snackbar_switched_takeaway)) }
            }
        }
    }

    fun showCartCancelDialog() {
        if (cartManager.snapshot().isEmpty) return
        if (!_uiExtras.value.orderCommittedForCancel) {
            updateExtras { it.copy(snackbarMessage = "Send to kitchen or print a receipt before cancelling") }
            return
        }
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val reasons = CancelReasonLabels.localizedLabels(settings.defaultLanguage)
            updateExtras {
                it.copy(showCartCancelDialog = true, cartCancelReasons = reasons)
            }
        }
    }

    fun dismissCartCancelDialog() = updateExtras { it.copy(showCartCancelDialog = false) }

    fun confirmCancelCartOrder(reason: String) {
        viewModelScope.launch {
            if (!_uiExtras.value.orderCommittedForCancel) {
                showError("Cancel", "Send to kitchen or print a receipt before cancelling")
                return@launch
            }
            val cart = cartManager.snapshot()
            val userId = sessionManager.currentUserId.first() ?: 0L
            val userName = sessionManager.currentUserName.first() ?: "Staff"
            transactionRepository.recordCancelledOrder(cart, userId, userName, reason)
            cart.tableOrderId?.let { orderId ->
                tableOrderRepository.voidOpenOrder(orderId, reason)
            }
            cartManager.clear()
            refreshTables()
            updateExtras {
                it.copy(
                    showCartCancelDialog = false,
                    selectedCartItemId = null,
                    keypadBuffer = "",
                    orderCommittedForCancel = false,
                    kitchenSentToPrinter = false,
                    receiptPrintedForOrder = false,
                    snackbarMessage = "Order cancelled"
                )
            }
        }
    }

    fun printProvisionalReceipt() {
        viewModelScope.launch {
            val cart = cartManager.snapshot()
            if (cart.isEmpty) {
                showError("Print", "Add items before printing")
                return@launch
            }
            val settings = settingsRepository.getSettings()
            val total = applyCashRounding(cart.merchandiseTotal(), settings.roundingStep)
            val staffName = sessionManager.currentUserName.first() ?: "Staff"
            val context = com.chaslay.pos.printer.ReceiptPrintContext(
                orderNumber = cart.orderNumber,
                serviceType = cart.serviceType,
                fulfillmentType = cart.fulfillmentType,
                tableName = cart.tableName,
                paymentMethod = null,
                staffName = staffName,
                isProvisional = true
            )
            withContext(Dispatchers.IO) {
                printerService.routeCartReceipt(
                    settings = settings,
                    cart = cart,
                    context = context,
                    discountAmount = cart.discountValue,
                    tipAmount = 0.0,
                    total = total
                )
            }.onSuccess {
                updateExtras { it.copy(orderCommittedForCancel = true, receiptPrintedForOrder = true) }
            }.onFailure { e -> showError("Print", e.message ?: "Print failed") }
        }
    }

    fun printCheckoutPreview() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val cart = cartManager.paymentSnapshot()
            if (cart.isEmpty) {
                showError("Print", "Nothing to print")
                return@launch
            }
            val checkout = _uiExtras.value.checkoutState
            val netSubtotal = cart.subtotal - cart.itemDiscountTotal
            val discount = if (checkout.discountPercent > 0) {
                netSubtotal * (checkout.discountPercent / 100.0)
            } else {
                cart.discountValue
            }
            val equalSplitCount = if (cart.splitCount > 1 && !cart.splitByItems) cart.splitCount else 1
            val merchandiseTotal = cart.merchandiseTotal(checkout.discountPercent)
            val shareTotal = if (equalSplitCount > 1) merchandiseTotal / equalSplitCount else merchandiseTotal
            val rawTotal = shareTotal + checkout.tipAmount
            val roundingStep = checkout.roundingStep.takeIf { it > 0 } ?: settings.roundingStep
            val total = applyCashRounding(rawTotal, roundingStep)
            val staffName = sessionManager.currentUserName.first() ?: "Staff"
            val context = com.chaslay.pos.printer.ReceiptPrintContext(
                orderNumber = cart.orderNumber,
                serviceType = cart.serviceType,
                fulfillmentType = cart.fulfillmentType,
                tableName = cart.tableName,
                paymentMethod = null,
                staffName = staffName,
                isProvisional = true
            )
            withContext(Dispatchers.IO) {
                printerService.routeCartReceipt(
                    settings = settings,
                    cart = cart,
                    context = context,
                    discountAmount = discount,
                    tipAmount = checkout.tipAmount,
                    total = total
                )
            }.onFailure { e -> showError("Print", e.message ?: "Print failed") }
        }
    }

    fun dismissOrderComplete() {
        val extras = _uiExtras.value
        val cart = cartManager.snapshot()
        updateExtras {
            it.copy(
                showOrderComplete = false,
                completedTransaction = null,
                adyenCustomerReceipt = null,
                adyenCashierReceipt = null,
                splitPaymentIndex = null,
                splitPaymentTotal = null,
                orderCompleteNotice = null,
                receiptPublicUrl = null,
                showReceiptEmailDialog = false,
                isSendingReceiptEmail = false,
                receiptEmailError = null
            )
        }
        when {
            cart.splitCount > 1 && !cart.splitByItems -> {
                val paid = extras.equalSplitPaidCount
                if (paid < cart.splitCount) {
                    cartManager.setActiveSplitCheck(paid + 1)
                    openCheckout(PaymentMethod.CASH, fromSplit = false)
                }
            }
            cart.splitByItems && cart.items.isNotEmpty() -> {
                val nextCheck = (1..cart.splitCount).firstOrNull { check ->
                    cart.items.any { it.splitCheck == check }
                }
                if (nextCheck != null) {
                    cartManager.setActiveSplitCheck(nextCheck)
                    openCheckout(PaymentMethod.CASH, fromSplit = false)
                }
            }
        }
    }

    fun printCompletedReceipt() {
        viewModelScope.launch {
            val tx = _uiExtras.value.completedTransaction ?: return@launch
            val full = transactionRepository.getTransaction(tx.id) ?: return@launch
            val settings = settingsRepository.getSettings()
            val (transaction, publicUrl) = publishAndPersistReceipt(full.first, full.second, settings)
            if (publicUrl != null) {
                updateExtras { it.copy(receiptPublicUrl = publicUrl, completedTransaction = transaction) }
            }
            val customerCopy = _uiExtras.value.adyenCustomerReceipt
                ?: com.chaslay.pos.payment.AdyenPaymentReceiptStorage.customerReceipt(transaction)
            withContext(Dispatchers.IO) {
                printerService.routeReceipt(settings, transaction, full.second, customerCopy)
            }.onSuccess {
                updateExtras { it.copy(orderCompleteNotice = "Receipt printed") }
            }.onFailure { e ->
                updateExtras {
                    it.copy(orderCompleteNotice = e.message ?: "No receipt printer configured")
                }
            }
        }
    }

    fun printAdyenCustomerReceipt() {
        viewModelScope.launch {
            val receipt = _uiExtras.value.adyenCustomerReceipt
                ?: _uiExtras.value.completedTransaction?.let {
                    com.chaslay.pos.payment.AdyenPaymentReceiptStorage.customerReceipt(it)
                }
                ?: return@launch
            val settings = settingsRepository.getSettings()
            withContext(Dispatchers.IO) {
                printerService.routeAdyenPaymentReceipt(settings, receipt)
            }.onSuccess {
                updateExtras { it.copy(orderCompleteNotice = "Customer card receipt printed") }
            }.onFailure { e ->
                updateExtras {
                    it.copy(orderCompleteNotice = e.message ?: "Could not print customer card receipt")
                }
            }
        }
    }

    fun printAdyenCashierReceipt() {
        viewModelScope.launch {
            val receipt = _uiExtras.value.adyenCashierReceipt
                ?: _uiExtras.value.completedTransaction?.let {
                    com.chaslay.pos.payment.AdyenPaymentReceiptStorage.cashierReceipt(it)
                }
                ?: return@launch
            val settings = settingsRepository.getSettings()
            withContext(Dispatchers.IO) {
                printerService.routeAdyenPaymentReceipt(settings, receipt)
            }.onSuccess {
                updateExtras { it.copy(orderCompleteNotice = "Merchant card receipt printed") }
            }.onFailure { e ->
                updateExtras {
                    it.copy(orderCompleteNotice = e.message ?: "Could not print merchant card receipt")
                }
            }
        }
    }

    fun openReceiptEmailDialog() {
        updateExtras {
            it.copy(showReceiptEmailDialog = true, receiptEmailError = null)
        }
    }

    fun dismissReceiptEmailDialog() {
        updateExtras {
            it.copy(showReceiptEmailDialog = false, receiptEmailError = null, isSendingReceiptEmail = false)
        }
    }

    fun sendReceiptByEmail(email: String) {
        val tx = _uiExtras.value.completedTransaction ?: return
        viewModelScope.launch {
            updateExtras { it.copy(isSendingReceiptEmail = true, receiptEmailError = null) }
            val settings = settingsRepository.getSettings()
            val full = transactionRepository.getTransaction(tx.id)
            if (full == null) {
                updateExtras {
                    it.copy(
                        isSendingReceiptEmail = false,
                        receiptEmailError = "Transaction not found"
                    )
                }
                return@launch
            }
            val (transaction, items) = full
            receiptRepository.ensureReceiptPublished(transaction, items, settings)
                .onFailure { e ->
                    updateExtras {
                        it.copy(
                            isSendingReceiptEmail = false,
                            receiptEmailError = e.message ?: "Could not upload receipt"
                        )
                    }
                }
                .onSuccess { publicUrl ->
                    updateExtras { it.copy(receiptPublicUrl = publicUrl) }
                    receiptRepository.sendReceiptEmail(transaction.id, email)
                        .onSuccess { message ->
                            updateExtras {
                                it.copy(
                                    isSendingReceiptEmail = false,
                                    showReceiptEmailDialog = false,
                                    orderCompleteNotice = message
                                )
                            }
                        }
                        .onFailure { e ->
                            updateExtras {
                                it.copy(
                                    isSendingReceiptEmail = false,
                                    receiptEmailError = e.message ?: "Could not send email"
                                )
                            }
                        }
                }
        }
    }

    fun clearOrderCompleteNotice() {
        updateExtras { it.copy(orderCompleteNotice = null) }
    }

    fun initiateCashPayment() {
        if (!cachedSettings.cashEnabled) return
        openCheckout(PaymentMethod.CASH)
    }

    fun initiateCardPayment() {
        if (!cachedSettings.cardEnabled) return
        openCheckout(PaymentMethod.CARD)
    }

    fun xpressSale() {
        if (!cachedSettings.expressEnabled) return
        val payable = cartManager.paymentSnapshot()
        if (payable.isEmpty) return
        viewModelScope.launch {
            updateExtras { it.copy(isProcessingPayment = true) }
            persistTableOrderIfNeeded()
            printPendingKitchenForCurrentTable()
            val settings = settingsRepository.getSettings()
            val userId = sessionManager.currentUserId.first() ?: 0L
            val userName = sessionManager.currentUserName.first() ?: "Cashier"
            val paidIds = payable.items.map { it.id }.toSet()
            val rawTotal = payable.merchandiseTotal()
            val roundedTotal = applyCashRounding(rawTotal, settings.roundingStep)
            val roundingAmount = roundedTotal - rawTotal
            val transaction = transactionRepository.completeSale(
                cart = payable,
                paymentMethod = PaymentMethod.CASH,
                userId = userId,
                userName = userName,
                roundingAmount = roundingAmount,
                overrideTotal = roundedTotal
            )
            val receiptItems = transactionRepository.getTransaction(transaction.id)?.second.orEmpty()
            val (publishedTx, publicReceiptUrl) = publishAndPersistReceipt(transaction, receiptItems, settings)
            cartManager.removeItemsAfterPayment(paidIds)
            decrementStockForCartItems(payable.items)
            if (cartManager.snapshot().items.isEmpty()) {
                cartManager.snapshot().tableOrderId?.let { tableOrderRepository.closeOrder(it) }
                cartManager.clear()
            }
            refreshTables()
            updateExtras {
                it.copy(
                    isProcessingPayment = false,
                    showOrderComplete = true,
                    completedTransaction = publishedTx,
                    receiptPublicUrl = publicReceiptUrl,
                    successMessage = "Payment completed",
                    selectedCartItemId = null,
                    keypadBuffer = "",
                    kitchenSentToPrinter = false
                )
            }
        }
    }

    fun completeCheckoutWithQuickCash(tenderAmount: Double, activity: Activity?) {
        updateExtras {
            it.copy(
                checkoutState = it.checkoutState.copy(
                    method = PaymentMethod.CASH,
                    tenderAmount = tenderAmount
                )
            )
        }
        completeCheckout(activity)
    }

    fun completeCheckout(activity: Activity?) {
        val checkout = _uiExtras.value.checkoutState
        val method = resolveCheckoutMethod(checkout.method)
        val fullCart = cartManager.snapshot()
        val payable = cartManager.paymentSnapshot()
        if (payable.isEmpty && !(fullCart.splitCount > 1 && !fullCart.splitByItems)) return

        viewModelScope.launch {
            updateExtras { it.copy(isProcessingPayment = true, errorMessage = null) }
            persistTableOrderIfNeeded()
            if (method != PaymentMethod.ADYEN_TERMINAL) {
                printPendingKitchenForCurrentTable()
            }
            val settings = settingsRepository.getSettings()
            val userId = sessionManager.currentUserId.first() ?: 0L
            val userName = sessionManager.currentUserName.first() ?: "Cashier"
            val paidIds = payable.items.map { it.id }.toSet()

            val cartForMerchandise = if (fullCart.splitCount > 1 && !fullCart.splitByItems) fullCart else payable
            val merchandiseTotal = cartForMerchandise.merchandiseTotal(checkout.discountPercent)
            val rawTotal = when {
                fullCart.splitCount > 1 && !fullCart.splitByItems ->
                    merchandiseTotal / fullCart.splitCount + checkout.tipAmount
                else -> merchandiseTotal + checkout.tipAmount
            }
            val roundingStep = checkout.roundingStep.takeIf { it > 0 } ?: settings.roundingStep
            val roundedTotal = applyCashRounding(rawTotal, roundingStep)
            val roundingAmount = roundedTotal - rawTotal

            val masterId = _uiExtras.value.masterOrderId ?: UUID.randomUUID().toString().also { id ->
                updateExtras { it.copy(masterOrderId = id) }
            }

            if (method == PaymentMethod.PAY_LATER) {
                val saleCart = if (fullCart.splitCount > 1 && !fullCart.splitByItems) fullCart else payable
                if (saleCart.pickupTimeMs == null) {
                    updateExtras {
                        it.copy(
                            isProcessingPayment = false,
                            errorMessage = "Schedule a pickup or delivery time before using Pay Later"
                        )
                    }
                    return@launch
                }
                runCatching {
                    heldOrderRepository.createProgrammedPayLaterOrder(
                        cart = saleCart,
                        userId = userId,
                        userName = userName,
                        checkoutDiscountPercent = checkout.discountPercent,
                        finalTotal = roundedTotal
                    )
                }.onSuccess {
                    cartManager.clear()
                    cartManager.resetSplit()
                    updateExtras {
                        it.copy(
                            isProcessingPayment = false,
                            showCheckoutScreen = false,
                            snackbarMessage = "Order scheduled — pay at pickup",
                            checkoutState = CheckoutState(roundingStep = checkoutRoundingDefault()),
                            masterOrderId = null,
                            equalSplitPaidCount = 0,
                            selectedCartItemId = null,
                            lastAddedItemId = null,
                            keypadBuffer = "",
                            kitchenSentToPrinter = false
                        )
                    }
                }.onFailure { e ->
                    updateExtras {
                        it.copy(isProcessingPayment = false, errorMessage = e.message ?: "Could not save order")
                    }
                }
                return@launch
            }

            val saleCartForPayment = if (fullCart.splitCount > 1 && !fullCart.splitByItems) fullCart else payable
            var pendingTransactionId: String? = null
            var pendingReceiptUrl: String? = null
            if (method == PaymentMethod.ADYEN_TERMINAL && settings.adyenTerminalEnabled) {
                pendingTransactionId = UUID.randomUUID().toString()
                pendingReceiptUrl = receiptRepository.buildPublicUrl(pendingTransactionId!!, settings)
                runCatching {
                    receiptRepository.publishPendingReceipt(
                        transactionId = pendingTransactionId!!,
                        cart = saleCartForPayment,
                        total = roundedTotal,
                        currency = settings.defaultCurrency,
                        settings = settings
                    )
                }
            }

            val paymentResult = when (method) {
                PaymentMethod.CASH -> cashPaymentService.processPayment()
                PaymentMethod.ADYEN_TERMINAL -> {
                    if (!settings.adyenTerminalEnabled) {
                        PaymentResult.Failure("Enable Adyen terminal in Settings")
                    } else {
                        paymentOrchestrator.processAdyenTerminalPayment(
                            roundedTotal,
                            settings.defaultCurrency,
                            settings
                        )
                    }
                }
                PaymentMethod.CARD -> {
                    paymentOrchestrator.processCardPayment(activity, roundedTotal, settings.defaultCurrency, settings)
                }
                else -> PaymentResult.Failure("Unsupported payment method")
            }

            when (paymentResult) {
                is PaymentResult.Success -> {
                    val resolvedMethod = when (method) {
                        PaymentMethod.CASH -> PaymentMethod.CASH
                        PaymentMethod.ADYEN_TERMINAL -> PaymentMethod.ADYEN_TERMINAL
                        else -> paymentResult.method
                    }
                    val tender = checkout.tenderAmount.takeIf { it > 0 && resolvedMethod == PaymentMethod.CASH }
                    val changeDue = tender?.let { (it - roundedTotal).coerceAtLeast(0.0) }
                    val saleCart = saleCartForPayment
                    if (method == PaymentMethod.ADYEN_TERMINAL) {
                        printPendingKitchenForCurrentTable()
                    }
                    val transaction = transactionRepository.completeSale(
                        cart = saleCart,
                        paymentMethod = resolvedMethod,
                        userId = userId,
                        userName = userName,
                        cardReference = paymentResult.reference,
                        tipAmount = checkout.tipAmount,
                        roundingAmount = roundingAmount,
                        checkoutDiscountPercent = checkout.discountPercent,
                        overrideTotal = roundedTotal,
                        masterOrderId = masterId,
                        splitCheckNumber = if (fullCart.splitByItems) fullCart.activeSplitCheck else null,
                        amountTendered = tender,
                        changeDue = changeDue,
                        transactionId = pendingTransactionId,
                        receiptUrl = pendingReceiptUrl,
                        adyenCustomerReceiptJson = com.chaslay.pos.payment.AdyenPaymentReceiptStorage.toJson(
                            paymentResult.adyenCustomerReceipt
                        ),
                        adyenCashierReceiptJson = com.chaslay.pos.payment.AdyenPaymentReceiptStorage.toJson(
                            paymentResult.adyenCashierReceipt
                        )
                    )
                    val receiptItems = transactionRepository.getTransaction(transaction.id)?.second.orEmpty()
                    val (publishedTx, publicReceiptUrl) = publishAndPersistReceipt(
                        transaction,
                        receiptItems,
                        settings
                    )
                    if (method == PaymentMethod.ADYEN_TERMINAL && settings.adyenTerminalEnabled) {
                        runCatching {
                            adyenTerminalService.showDigitalReceipt(
                                settings = settings,
                                items = saleCart.items,
                                total = publishedTx.total,
                                currencySymbol = settings.currencySymbol,
                                receiptUrl = publicReceiptUrl ?: publishedTx.receiptUrl.orEmpty()
                            )
                        }.onFailure { e ->
                            Log.w("POS", "Could not show digital receipt on terminal", e)
                        }
                    }
                    if (fullCart.splitByItems) {
                        cartManager.removeItemsAfterPayment(paidIds)
                    } else if (fullCart.splitCount > 1) {
                        val paid = _uiExtras.value.equalSplitPaidCount + 1
                        updateExtras { it.copy(equalSplitPaidCount = paid) }
                        if (paid >= fullCart.splitCount) {
                            cartManager.clear()
                            cartManager.resetSplit()
                            updateExtras { it.copy(masterOrderId = null, equalSplitPaidCount = 0) }
                        }
                    } else {
                        cartManager.removeItemsAfterPayment(paidIds)
                    }
                    val remaining = cartManager.snapshot()
                    refreshTables()
                    val isEqualSplit = fullCart.splitCount > 1 && !fullCart.splitByItems
                    val equalSplitPaid = if (isEqualSplit) _uiExtras.value.equalSplitPaidCount else 0
                    when {
                        isEqualSplit && equalSplitPaid < fullCart.splitCount -> Unit
                        isEqualSplit -> decrementStockForCartItems(fullCart.items)
                        else -> decrementStockForCartItems(fullCart.items.filter { paidIds.contains(it.id) })
                    }
                    if (remaining.items.isNotEmpty() && fullCart.splitByItems) {
                        val nextCheck = (1..remaining.splitCount).firstOrNull { check ->
                            remaining.items.any { it.splitCheck == check }
                        }
                        if (nextCheck != null) {
                            cartManager.setActiveSplitCheck(nextCheck)
                            updateExtras {
                                it.copy(
                                    isProcessingPayment = false,
                                    showCheckoutScreen = true,
                                    showOrderComplete = false,
                                    showSplitBillScreen = false,
                                    returnToSplitAfterCheckout = false,
                                    checkoutState = CheckoutState(roundingStep = checkoutRoundingDefault()),
                                    selectedCartItemId = null,
                                    lastAddedItemId = null,
                                    keypadBuffer = "",
                                    kitchenSentToPrinter = false
                                )
                            }
                            return@launch
                        }
                    }
                    if (remaining.items.isEmpty()) {
                        remaining.tableOrderId?.let { tableOrderRepository.closeOrder(it) }
                        if (!isEqualSplit || equalSplitPaid >= fullCart.splitCount) {
                            cartManager.clear()
                            cartManager.resetSplit()
                            updateExtras { it.copy(masterOrderId = null, equalSplitPaidCount = 0) }
                        }
                    }
                    val splitIndex = if (isEqualSplit) equalSplitPaid else null
                    val splitTotal = if (isEqualSplit) fullCart.splitCount else null
                    val adyenCustomerReceipt = if (resolvedMethod == PaymentMethod.ADYEN_TERMINAL) {
                        paymentResult.adyenCustomerReceipt
                    } else {
                        null
                    }
                    val adyenCashierReceipt = if (resolvedMethod == PaymentMethod.ADYEN_TERMINAL) {
                        paymentResult.adyenCashierReceipt
                    } else {
                        null
                    }
                    updateExtras {
                        it.copy(
                            isProcessingPayment = false,
                            showCheckoutScreen = false,
                            showOrderComplete = true,
                            completedTransaction = publishedTx,
                            adyenCustomerReceipt = adyenCustomerReceipt,
                            adyenCashierReceipt = adyenCashierReceipt,
                            receiptPublicUrl = publicReceiptUrl,
                            orderCompleteNotice = receiptUploadNotice(publicReceiptUrl),
                            splitPaymentIndex = splitIndex,
                            splitPaymentTotal = splitTotal,
                            successMessage = if (splitIndex != null && splitTotal != null) {
                                "Payment $splitIndex of $splitTotal completed"
                            } else {
                                "Payment completed"
                            },
                            checkoutState = CheckoutState(roundingStep = checkoutRoundingDefault()),
                            selectedCartItemId = null,
                            lastAddedItemId = null,
                            keypadBuffer = "",
                            kitchenSentToPrinter = false,
                            showSplitBillScreen = false
                        )
                    }
                }
                is PaymentResult.Failure -> updateExtras {
                    it.copy(
                        isProcessingPayment = false,
                        errorMessage = paymentResult.message,
                        errorTitle = "Payment failed"
                    )
                }
                PaymentResult.Cancelled -> updateExtras {
                    it.copy(isProcessingPayment = false)
                }
            }
        }
    }

    fun confirmPayment(activity: Activity?) = completeCheckout(activity)

    fun dismissPaymentSummary() {
        updateExtras { it.copy(showPaymentSummary = false, showCheckoutScreen = false, pendingPaymentMethod = null, errorMessage = null) }
    }

    fun printLastReceipt() {
        viewModelScope.launch {
            val tx = _uiExtras.value.lastTransaction ?: return@launch
            val full = transactionRepository.getTransaction(tx.id) ?: return@launch
            val settings = settingsRepository.getSettings()
            val (transaction, _) = publishAndPersistReceipt(full.first, full.second, settings)
            printerService.routeReceipt(settings, transaction, full.second)
                .onFailure { e -> updateExtras { it.copy(errorMessage = e.message) } }
            dismissReceiptOptions()
        }
    }

    fun dismissReceiptOptions() {
        updateExtras { it.copy(showReceiptOptions = false, lastTransaction = null) }
    }

    fun dismissDialogs() {
        _productCustomize.value = null
        updateExtras {
            it.copy(
                showOpenPriceDialog = false,
                showVariantDialog = false,
                optionGroupPicker = null,
                showDiscountDialog = false,
                selectedProduct = null
            )
        }
    }

    fun clearError() = updateExtras { it.copy(errorMessage = null, errorTitle = null) }
    fun clearProductHighlight() = updateExtras { it.copy(lastClickedProductId = null) }

    fun clearSuccess() = updateExtras { it.copy(successMessage = null) }
    fun clearSnackbar() = updateExtras { it.copy(snackbarMessage = null) }

    fun showNewOrderDialog() {
        if (cartManager.snapshot().isEmpty) return
        updateExtras { it.copy(showClearCartDialog = true) }
    }

    fun dismissClearCartDialog() = updateExtras { it.copy(showClearCartDialog = false) }

    fun confirmClearCart() {
        cartManager.clear()
        updateExtras {
            it.copy(
                showClearCartDialog = false,
                orderCommittedForCancel = false,
                receiptPrintedForOrder = false,
                snackbarMessage = "Cart cleared"
            )
        }
        refreshTables()
    }

    fun showPickupOrderDialog() {
        viewModelScope.launch {
            val parked = parkCartIfNeeded()
            updateExtras {
                it.copy(
                    showPickupDialog = true,
                    suggestedOrderNumber = suggestOrderNumber(),
                    snackbarMessage = if (parked) {
                        appContext.getString(R.string.snackbar_cart_parked_for_new_order)
                    } else {
                        it.snackbarMessage
                    }
                )
            }
        }
    }

    fun dismissPickupDialog() = updateExtras { it.copy(showPickupDialog = false) }

    fun confirmPickup(pickupTimeMs: Long?) {
        viewModelScope.launch {
            val orderNumber = suggestOrderNumber()
            cartManager.setPickupOrder(orderNumber, pickupTimeMs)
            val cart = cartManager.snapshot()
            if (pickupTimeMs != null && !isRestaurantMode() && !cart.isEmpty) {
                printFulfillmentSlip("SCHEDULED TAKEAWAY", pickupTimeMs)
            }
            updateExtras {
                it.copy(
                    showPickupDialog = false,
                    snackbarMessage = if (pickupTimeMs == null) {
                        appContext.getString(R.string.snackbar_pickup_asap, orderNumber)
                    } else {
                        appContext.getString(R.string.snackbar_pickup_scheduled, orderNumber)
                    }
                )
            }
        }
    }

    fun showDeliveryOrderDialog() {
        viewModelScope.launch {
            val parked = parkCartIfNeeded()
            val customers = customerRepository.getAll()
            updateExtras {
                it.copy(
                    showDeliveryDialog = true,
                    deliveryCustomers = customers,
                    suggestedOrderNumber = suggestOrderNumber(),
                    snackbarMessage = if (parked) {
                        appContext.getString(R.string.snackbar_cart_parked_for_new_order)
                    } else {
                        it.snackbarMessage
                    }
                )
            }
        }
    }

    fun dismissDeliveryDialog() = updateExtras { it.copy(showDeliveryDialog = false) }

    fun searchDeliveryCustomers(query: String) {
        viewModelScope.launch {
            val customers = customerRepository.search(query)
            updateExtras { it.copy(deliveryCustomers = customers) }
        }
    }

    fun createDeliveryCustomer(
        name: String,
        phone: String,
        email: String,
        address: String,
        zip: String,
        onCreated: (CustomerEntity) -> Unit
    ) {
        if (name.isBlank()) return
        viewModelScope.launch {
            val customer = CustomerEntity(
                name = name.trim(),
                phone = phone.trim().ifBlank { null },
                email = email.trim().ifBlank { null },
                address = address.trim().ifBlank { null },
                zip = zip.trim().ifBlank { null }
            )
            val id = customerRepository.save(customer)
            val saved = customer.copy(id = id)
            val customers = customerRepository.getAll()
            updateExtras { it.copy(deliveryCustomers = customers) }
            onCreated(saved)
        }
    }

    fun confirmDeliveryWithCustomer(customer: CustomerEntity) {
        updateExtras {
            it.copy(
                showDeliveryDialog = false,
                pendingDeliveryCustomer = customer,
                showDeliveryTimeDialog = true
            )
        }
    }

    fun dismissDeliveryTimeDialog() = updateExtras {
        it.copy(showDeliveryTimeDialog = false, pendingDeliveryCustomer = null)
    }

    fun confirmDeliveryTime(deliveryTimeMs: Long?) {
        val customer = _uiExtras.value.pendingDeliveryCustomer ?: return
        viewModelScope.launch {
            val orderNumber = suggestOrderNumber().replace("P-", "D-")
            cartManager.setDeliveryOrder(
                name = customer.name,
                address = customer.address.orEmpty(),
                zip = customer.zip.orEmpty(),
                phone = customer.phone.orEmpty(),
                orderNumber = orderNumber,
                deliveryTimeMs = deliveryTimeMs
            )
            val cart = cartManager.snapshot()
            if (!cart.isEmpty) {
                printDeliverySlip(customer, deliveryTimeMs)
            }
            updateExtras {
                it.copy(
                    showDeliveryTimeDialog = false,
                    pendingDeliveryCustomer = null,
                    snackbarMessage = if (deliveryTimeMs == null) {
                        appContext.getString(R.string.snackbar_delivery_asap, customer.name)
                    } else {
                        appContext.getString(R.string.snackbar_delivery_scheduled, customer.name)
                    }
                )
            }
        }
    }

    fun confirmDelivery(
        orderNumber: String,
        name: String,
        address: String,
        zip: String,
        phone: String
    ) {
        cartManager.setDeliveryOrder(
            name = name.trim(),
            address = address.trim(),
            zip = zip.trim(),
            phone = phone.trim(),
            orderNumber = orderNumber.trim()
        )
        updateExtras {
            it.copy(
                showDeliveryDialog = false,
                snackbarMessage = "Delivery order ${orderNumber.trim()}"
            )
        }
    }

    private fun suggestOrderNumber(): String =
        "P-${System.currentTimeMillis().toString().takeLast(6)}"

    private fun checkoutRoundingDefault(): Double =
        cachedSettings.roundingStep.takeIf { it > 0.0 } ?: 0.05

    private suspend fun publishAndPersistReceipt(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity
    ): Pair<TransactionEntity, String?> {
        return receiptRepository.ensureReceiptPublished(transaction, items, settings).fold(
            onSuccess = { url ->
                transactionRepository.updateReceiptUrl(transaction.id, url)
                transaction.copy(receiptUrl = url) to url
            },
            onFailure = { e ->
                Log.w("POS", "Receipt publish failed: ${e.message}", e)
                transaction to null
            }
        )
    }

    private fun receiptUploadNotice(publicUrl: String?): String? =
        if (publicUrl.isNullOrBlank()) {
            "Digital receipt could not be uploaded. Check internet and API key."
        } else {
            null
        }

    private fun checkLowStockAlert(productId: Long, addedQty: Int) {
        viewModelScope.launch {
            val product = productRepository.getProduct(productId) ?: return@launch
            val stock = product.stockQuantity ?: return@launch
            val threshold = product.lowStockThreshold ?: 5
            val inCartQty = cartManager.snapshot().items
                .filter { it.productId == productId }
                .sumOf { it.quantity }
            val remaining = stock - inCartQty
            if (remaining <= threshold) {
                updateExtras {
                    it.copy(snackbarMessage = "Low stock: ${product.name} ($remaining left)")
                }
            }
        }
    }

    private suspend fun decrementStockForCartItems(items: List<CartItem>) {
        val alerts = mutableListOf<String>()
        items.groupBy { it.productId }.forEach { (productId, lines) ->
            val qty = lines.sumOf { it.quantity }
            productRepository.decrementStock(productId, qty)
            val product = productRepository.getProduct(productId) ?: return@forEach
            val stock = product.stockQuantity ?: return@forEach
            val threshold = product.lowStockThreshold ?: 5
            if (stock <= threshold) {
                alerts.add("${product.name} ($stock left)")
            }
        }
        if (alerts.isNotEmpty()) {
            updateExtras {
                it.copy(snackbarMessage = "Low stock: ${alerts.distinct().joinToString(", ")}")
            }
        }
    }

    private suspend fun buildKitchenMeta(cart: CartSummary): KitchenPrintMeta {
        val settings = settingsRepository.getSettings()
        val userName = sessionManager.currentUserName.first() ?: "Cashier"
        val orderNum = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() }
            ?: cart.tableOrderId?.let { "T-${it.takeLast(6).uppercase()}" }
            ?: "P-${System.currentTimeMillis().toString().takeLast(6)}"
        val deliveryAddress = listOfNotNull(cart.deliveryAddress, cart.deliveryZip)
            .filter { it.isNotBlank() }
            .joinToString(", ")
            .ifBlank { null }
        val source = when (FloorDeviceRole.fromApi(settings.floorDeviceRole)) {
            FloorDeviceRole.WAITER -> "WAITERAPP"
            else -> "POS"
        }
        return KitchenPrintMeta(
            orderNumber = orderNum,
            fulfillmentType = cart.fulfillmentType,
            pickupTimeMs = cart.pickupTimeMs,
            orderedAtMs = System.currentTimeMillis(),
            orderSource = source,
            cashierName = userName,
            deliveryName = cart.deliveryName,
            deliveryAddress = deliveryAddress,
            deliveryPhone = cart.deliveryPhone
        )
    }

    private suspend fun printFulfillmentSlip(title: String, scheduledTimeMs: Long?) {
        val cart = cartManager.snapshot()
        if (cart.isEmpty) return
        val settings = settingsRepository.getSettings()
        val timeLabel = scheduledTimeMs?.let {
            java.text.SimpleDateFormat("dd-MM-yyyy HH:mm", java.util.Locale.getDefault()).format(java.util.Date(it))
        } ?: "ASAP / NOW"
        val headerLines = listOf("When: $timeLabel", "Order: ${cart.orderNumber.orEmpty()}")
        val lines = headerLines.map { it to 0.0 } +
            cart.items.map { "${it.quantity}x ${it.productName}" to it.lineSubtotal }
        val total = applyCashRounding(cart.displayTotal, settings.roundingStep.takeIf { it > 0 } ?: 0.05)
        withContext(Dispatchers.IO) {
            printerService.routeCartPreview(settings, lines, total, title)
        }.onFailure { e -> showError("Print", e.message ?: "Print failed") }
    }

    private suspend fun printDeliverySlip(customer: CustomerEntity, deliveryTimeMs: Long?) {
        val cart = cartManager.snapshot()
        val settings = settingsRepository.getSettings()
        val timeLabel = deliveryTimeMs?.let {
            java.text.SimpleDateFormat("dd-MM-yyyy HH:mm", java.util.Locale.getDefault()).format(java.util.Date(it))
        } ?: "ASAP / NOW"
        val lines = buildList {
            add("DELIVERY SLIP" to 0.0)
            add("Customer: ${customer.name}" to 0.0)
            customer.address?.takeIf { it.isNotBlank() }?.let { add(it to 0.0) }
            customer.phone?.takeIf { it.isNotBlank() }?.let { add("Tel: $it" to 0.0) }
            add("When: $timeLabel" to 0.0)
            add("Order: ${cart.orderNumber.orEmpty()}" to 0.0)
            cart.items.forEach { add("${it.quantity}x ${it.productName}" to it.lineSubtotal) }
        }
        val total = applyCashRounding(cart.displayTotal, settings.roundingStep.takeIf { it > 0 } ?: 0.05)
        withContext(Dispatchers.IO) {
            printerService.routeCartPreview(settings, lines, total, "DELIVERY ORDER")
        }.onFailure { e -> showError("Print", e.message ?: "Print failed") }
    }

    private fun showError(title: String, message: String) {
        updateExtras { it.copy(errorTitle = title, errorMessage = message) }
    }

    private fun playItemClickBeep() {
        runCatching {
            android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 35)
                .startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 60)
        }
    }

    private suspend fun reloadCartFromTable(cart: CartSummary) {
        val orderId = cart.tableOrderId ?: return
        val order = tableOrderRepository.getOrder(orderId) ?: return
        val items = tableOrderRepository.getOrderItems(orderId)
        cartManager.loadTableOrder(
            tableId = cart.tableId ?: return,
            tableName = cart.tableName.orEmpty(),
            orderId = orderId,
            serviceType = cart.serviceType,
            items = items,
            discountPercent = order.discountPercent,
            discountAmount = order.discountAmount,
            courseCount = cart.courseCount,
            activeCourse = cart.activeCourse,
            guestCount = order.guestCount,
            vatIncludedInPrice = cachedSettings.vatIncludedInPrice
        )
    }

    private fun resolveTaxRate(productId: Long, productTaxRate: Double, serviceType: ServiceType): Double {
        if (productTaxRate == 0.0) return 0.0
        return resolveVatRate(productTaxRate, serviceType, cachedSettings)
    }

    fun prepareForOngoingOrders(onReady: () -> Unit) {
        viewModelScope.launch {
            tableOrderMutex.withLock { flushTableOrderSync() }
            onReady()
        }
    }

    /** Saves the active cart to held/table orders before starting takeaway or delivery. */
    private suspend fun parkCartIfNeeded(): Boolean {
        val snapshot = cartManager.snapshot()
        if (snapshot.isEmpty) return false

        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Cashier"

        if (snapshot.tableId != null) {
            tableOrderMutex.withLock {
                flushTableOrderSync()
                cartManager.snapshot().tableOrderId?.let { tableOrderRepository.holdOrder(it) }
            }
        } else {
            heldOrderRepository.createHeldOrder(
                cart = snapshot,
                sendToKitchen = false,
                userId = userId,
                userName = userName
            )
        }
        cartManager.clear()
        refreshTables()
        return true
    }

    private suspend fun flushTableOrderSync(): String? {
        persistTableJob?.cancel()
        persistTableJob = null
        return syncTableOrderToDb()
    }

    private suspend fun syncTableOrderToDb(): String? {
        val cart = cartManager.snapshot()
        if (cart.tableId == null) return null
        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Cashier"
        val orderId = tableOrderRepository.syncCartToTable(cart, userId, userName)
        cartManager.setTableOrderId(orderId)
        val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
        refreshTables()
        pushFloorOrder(orderId)
        return orderId
    }

    private suspend fun pushFloorOrder(orderId: String) {
        val settings = settingsRepository.getSettings()
        if (!settings.floorSyncEnabled) return
        val cart = cartManager.snapshot()
        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Staff"
        floorSyncRepository.pushTableOrder(settings, orderId, cart, userId, userName)
    }

    private suspend fun usesRemoteKitchenPrint(settings: BusinessSettingsEntity): Boolean =
        settings.floorSyncEnabled &&
            FloorDeviceRole.fromApi(settings.floorDeviceRole) == FloorDeviceRole.WAITER

    private suspend fun deliverKitchenPrint(
        settings: BusinessSettingsEntity,
        orderId: String,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        meta: KitchenPrintMeta,
        isFollowUp: Boolean = false,
        message: String? = null
    ): Result<Unit> {
        if (usesRemoteKitchenPrint(settings)) {
            return runCatching {
                floorSyncRepository.queueKitchenPrint(
                    settings = settings,
                    orderId = orderId,
                    tableName = tableName,
                    serviceType = serviceType.name,
                    round = round,
                    items = items,
                    meta = meta
                )
            }
        }
        val categories = productRepository.getAllCategories()
        val products = productRepository.getAllProducts()
        return printerService.routeKitchen(
            settings = settings,
            tableName = tableName,
            serviceType = serviceType,
            round = round,
            items = items,
            isFollowUp = isFollowUp,
            message = message,
            categories = categories,
            products = products,
            meta = meta
        ).map { }
    }

    private suspend fun persistTableOrderIfNeeded() {
        tableOrderMutex.withLock { syncTableOrderToDb() }
    }

    private fun persistTableOrderAsync() {
        persistTableJob?.cancel()
        persistTableJob = viewModelScope.launch {
            delay(250)
            persistTableOrderIfNeeded()
        }
    }

    private data class PosDialogState(
        val isProcessingPayment: Boolean = false,
        val showOpenPriceDialog: Boolean = false,
        val showVariantDialog: Boolean = false,
        val optionGroupPicker: OptionGroupPicker? = null,
        val showDiscountDialog: Boolean = false,
        val showCheckoutScreen: Boolean = false,
        val showOrderComplete: Boolean = false,
        val showPaymentSummary: Boolean = false,
        val showReceiptOptions: Boolean = false,
        val showTablePicker: Boolean = false,
        val showKitchenMessageDialog: Boolean = false,
        val showMiscPriceDialog: Boolean = false,
        val showSplitDialog: Boolean = false,
        val showSplitBillScreen: Boolean = false,
        val splitSelectedItemIds: Set<String> = emptySet(),
        val masterOrderId: String? = null,
        val equalSplitPaidCount: Int = 0,
        val returnToSplitAfterCheckout: Boolean = false,
        val kitchenSentToPrinter: Boolean = false,
        val pendingPaymentMethod: PaymentMethod? = null,
        val selectedProduct: ProductWithVariants? = null,
        val lastTransaction: TransactionEntity? = null,
        val errorMessage: String? = null,
        val errorTitle: String? = null,
        val successMessage: String? = null,
        val snackbarMessage: String? = null,
        val showClearCartDialog: Boolean = false,
        val showPickupDialog: Boolean = false,
        val showDeliveryDialog: Boolean = false,
        val deliveryCustomers: List<CustomerEntity> = emptyList(),
        val pendingDeliveryCustomer: CustomerEntity? = null,
        val showDeliveryTimeDialog: Boolean = false,
        val splitPaymentIndex: Int? = null,
        val splitPaymentTotal: Int? = null,
        val suggestedOrderNumber: String = "",
        val tapToPayMessage: String? = null,
        val selectedCartItemId: String? = null,
        val lastAddedItemId: String? = null,
        val lastClickedProductId: Long? = null,
        val keypadBuffer: String = "",
        val keypadMode: KeypadMode = KeypadMode.PRICE,
        val keypadExpanded: Boolean = false,
        val checkoutState: CheckoutState = CheckoutState(),
        val completedTransaction: TransactionEntity? = null,
        val adyenCustomerReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        val adyenCashierReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        val orderCompleteNotice: String? = null,
        val receiptPublicUrl: String? = null,
        val showReceiptEmailDialog: Boolean = false,
        val isSendingReceiptEmail: Boolean = false,
        val receiptEmailError: String? = null,
        val showCartCancelDialog: Boolean = false,
        val cartCancelReasons: List<String> = emptyList(),
        val showAttachCustomerDialog: Boolean = false,
        val orderCommittedForCancel: Boolean = false,
        val receiptPrintedForOrder: Boolean = false,
        val showWeighedProductDialog: Boolean = false,
        val scaleReading: com.chaslay.pos.scale.AclasScaleReading? = null,
        val showGuestCountDialog: Boolean = false,
        val guestCountTableName: String = "",
        val guestCountSeatCapacity: Int = 4,
        val guestCountDefault: Int = 2,
        val pendingTableId: Long? = null,
        val showTableTransferItemsDialog: Boolean = false,
        val showTableTransferDestDialog: Boolean = false,
        val tableTransferMode: TableTransferMode? = null,
        val tableTransferSelectedIds: Set<String> = emptySet()
    )

    private fun updateExtras(block: (PosDialogState) -> PosDialogState) {
        _uiExtras.value = block(_uiExtras.value)
    }

    private data class DataBundle(
        val categories: List<CategoryEntity>,
        val categoryId: Long?,
        val products: List<ProductEntity>,
        val cart: CartSummary,
        val settings: BusinessSettingsEntity
    )

    private data class UiExtrasBundle(
        val extras: PosDialogState,
        val productCustomize: ProductCustomizeState?,
        val comboPick: ComboPickState?,
        val tables: List<TableWithOrderInfo>,
        val floorElements: Map<Long, List<FloorPlanElementEntity>>
    )
}
