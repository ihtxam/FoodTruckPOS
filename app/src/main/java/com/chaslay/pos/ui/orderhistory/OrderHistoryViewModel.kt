package com.chaslay.pos.ui.orderhistory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import javax.inject.Inject

enum class HistoryDateFilter { TODAY, YESTERDAY, WEEK, MONTH, THREE_MONTHS, ALL }

enum class HistorySourceFilter { ALL, IN_STORE, ONLINE, KIOSK }

data class OrderHistoryUiState(
    val orders: List<TransactionEntity> = emptyList(),
    val splitCounts: Map<String, Int> = emptyMap(),
    val tableNames: Map<Long, String> = emptyMap(),
    val selectedOrder: TransactionEntity? = null,
    val selectedItems: List<TransactionItemEntity> = emptyList(),
    val splitOrders: List<TransactionEntity> = emptyList(),
    val splitItemsByOrderId: Map<String, List<TransactionItemEntity>> = emptyMap(),
    val dateFilter: HistoryDateFilter = HistoryDateFilter.TODAY,
    val sourceFilter: HistorySourceFilter = HistorySourceFilter.ALL,
    val paymentFilter: PaymentMethod? = null,
    val serviceFilter: ServiceType? = null,
    val statusFilter: PaymentStatus? = null,
    val searchQuery: String = "",
    val currencySymbol: String = "CHF",
    val dateRangeLabel: String = "",
    val cancelReasons: List<String> = emptyList(),
    val showCancelDialog: Boolean = false,
    val showRefundDialog: Boolean = false,
    val showDeleteDialog: Boolean = false,
    val showBulkDeleteDialog: Boolean = false,
    val bulkDeleteCount: Int = 0,
    val pendingDeleteOrder: TransactionEntity? = null,
    val isAdminUser: Boolean = false,
    val deleteModeUnlocked: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class OrderHistoryViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val heldOrderRepository: HeldOrderRepository,
    private val settingsRepository: com.chaslay.pos.data.repository.SettingsRepository,
    private val printerService: com.chaslay.pos.printer.BluetoothPrinterService,
    private val tableDao: RestaurantTableDao,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrderHistoryUiState())
    val uiState: StateFlow<OrderHistoryUiState> = _uiState.asStateFlow()

    private var unlockTapCount = 0
    private var lastUnlockTapMs = 0L

    init {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val reasons = com.chaslay.pos.domain.model.CancelReasonLabels.localizedLabels(settings.defaultLanguage)
            val currency = settings.currencySymbol.ifBlank { "CHF" }
            val access = sessionManager.currentUserAccess.first()
            _uiState.value = _uiState.value.copy(
                cancelReasons = reasons,
                currencySymbol = currency,
                isAdminUser = access?.canAccessSettings() == true
            )
            refresh()
        }
    }

    /** Hidden admin gesture: tap the # column header 5 times quickly. */
    fun onAdminUnlockTap() {
        if (!_uiState.value.isAdminUser || _uiState.value.deleteModeUnlocked) return
        val now = System.currentTimeMillis()
        if (now - lastUnlockTapMs > 2500L) unlockTapCount = 0
        lastUnlockTapMs = now
        unlockTapCount++
        if (unlockTapCount >= 5) {
            unlockTapCount = 0
            _uiState.value = _uiState.value.copy(deleteModeUnlocked = true)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            val filter = _uiState.value.dateFilter
            val (start, end) = dateBounds(filter)
            val tables = tableDao.getAllActive().associate { it.id to it.name }
            var orders = transactionRepository.searchOrders(
                startMs = start,
                endMs = end,
                paymentMethod = _uiState.value.paymentFilter,
                serviceType = _uiState.value.serviceFilter
            ).filter { it.paymentStatus != PaymentStatus.PENDING }

            when (_uiState.value.sourceFilter) {
                HistorySourceFilter.ALL, HistorySourceFilter.IN_STORE -> Unit
                HistorySourceFilter.ONLINE, HistorySourceFilter.KIOSK -> orders = emptyList()
            }

            _uiState.value.statusFilter?.let { status ->
                orders = orders.filter { it.paymentStatus == status }
            }

            val query = _uiState.value.searchQuery.trim().lowercase(Locale.getDefault())
            if (query.isNotEmpty()) {
                orders = orders.filter { it.transactionNumber.lowercase(Locale.getDefault()).contains(query) }
            }

            val splitCounts = orders
                .mapNotNull { tx -> tx.masterOrderId?.let { it to tx } }
                .groupBy({ it.first }, { it.second })
                .filterValues { it.size > 1 }
                .mapValues { it.value.size }

            _uiState.value = _uiState.value.copy(
                orders = orders,
                splitCounts = splitCounts,
                tableNames = tables,
                dateRangeLabel = formatDateRange(start, end, filter)
            )
        }
    }

    fun setDateFilter(filter: HistoryDateFilter) {
        _uiState.value = _uiState.value.copy(dateFilter = filter)
        refresh()
    }

    fun setSourceFilter(filter: HistorySourceFilter) {
        _uiState.value = _uiState.value.copy(sourceFilter = filter)
        refresh()
    }

    fun setPaymentFilter(method: PaymentMethod?) {
        _uiState.value = _uiState.value.copy(paymentFilter = method)
        refresh()
    }

    fun setServiceFilter(serviceType: ServiceType?) {
        _uiState.value = _uiState.value.copy(serviceFilter = serviceType)
        refresh()
    }

    fun setStatusFilter(status: PaymentStatus?) {
        _uiState.value = _uiState.value.copy(statusFilter = status)
        refresh()
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        refresh()
    }

    fun openOrder(order: TransactionEntity) {
        viewModelScope.launch {
            val detail = transactionRepository.getTransaction(order.id)
            val splitOrders = order.masterOrderId?.let { masterId ->
                transactionRepository.getOrdersByMasterId(masterId)
            }.orEmpty().ifEmpty { listOfNotNull(detail?.first) }
            val splitItems = splitOrders.associate { split ->
                split.id to (transactionRepository.getTransaction(split.id)?.second.orEmpty())
            }
            _uiState.value = _uiState.value.copy(
                selectedOrder = detail?.first,
                selectedItems = detail?.second.orEmpty(),
                splitOrders = splitOrders,
                splitItemsByOrderId = splitItems
            )
        }
    }

    fun closeOrderDetail() {
        _uiState.value = _uiState.value.copy(
            selectedOrder = null,
            selectedItems = emptyList(),
            splitOrders = emptyList(),
            splitItemsByOrderId = emptyMap()
        )
    }

    fun showCancelDialog() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val reasons = com.chaslay.pos.domain.model.CancelReasonLabels.localizedLabels(settings.defaultLanguage)
            _uiState.value = _uiState.value.copy(showCancelDialog = true, cancelReasons = reasons)
        }
    }

    fun dismissCancelDialog() {
        _uiState.value = _uiState.value.copy(showCancelDialog = false)
    }

    fun showRefundDialog() {
        _uiState.value = _uiState.value.copy(showRefundDialog = true)
    }

    fun dismissRefundDialog() {
        _uiState.value = _uiState.value.copy(showRefundDialog = false)
    }

    fun cancelSelectedOrder(reason: String) {
        val orderId = _uiState.value.selectedOrder?.id ?: return
        viewModelScope.launch {
            transactionRepository.cancelOrder(orderId, reason)
            _uiState.value = _uiState.value.copy(
                showCancelDialog = false,
                selectedOrder = null,
                selectedItems = emptyList(),
                message = "Order cancelled"
            )
            refresh()
        }
    }

    fun refundSelectedOrder(amount: Double, fullRefund: Boolean) {
        val orderId = _uiState.value.selectedOrder?.id ?: return
        viewModelScope.launch {
            transactionRepository.refundOrder(orderId, amount, fullRefund)
            _uiState.value = _uiState.value.copy(
                showRefundDialog = false,
                selectedOrder = null,
                selectedItems = emptyList(),
                message = if (fullRefund) "Full refund processed" else "Partial refund processed"
            )
            refresh()
        }
    }

    fun requestDeleteOrder(order: TransactionEntity) {
        if (!_uiState.value.isAdminUser || !_uiState.value.deleteModeUnlocked) return
        _uiState.value = _uiState.value.copy(
            pendingDeleteOrder = order,
            showDeleteDialog = true
        )
    }

    fun requestBulkDelete() {
        if (!_uiState.value.isAdminUser || !_uiState.value.deleteModeUnlocked) return
        viewModelScope.launch {
            val (start, end) = dateBounds(_uiState.value.dateFilter)
            val count = transactionRepository.countOrdersInRange(start, end)
            _uiState.value = _uiState.value.copy(
                showBulkDeleteDialog = true,
                bulkDeleteCount = count
            )
        }
    }

    fun dismissBulkDeleteDialog() {
        _uiState.value = _uiState.value.copy(
            showBulkDeleteDialog = false,
            bulkDeleteCount = 0
        )
    }

    fun confirmBulkDelete() {
        viewModelScope.launch {
            val (start, end) = dateBounds(_uiState.value.dateFilter)
            val deleted = transactionRepository.deleteOrdersInRange(start, end)
            _uiState.value = _uiState.value.copy(
                showBulkDeleteDialog = false,
                bulkDeleteCount = 0,
                selectedOrder = null,
                selectedItems = emptyList(),
                splitOrders = emptyList(),
                splitItemsByOrderId = emptyMap(),
                message = "Deleted $deleted orders permanently"
            )
            refresh()
        }
    }

    fun dismissDeleteDialog() {
        _uiState.value = _uiState.value.copy(
            showDeleteDialog = false,
            pendingDeleteOrder = null
        )
    }

    fun confirmDeleteOrder() {
        val order = _uiState.value.pendingDeleteOrder ?: return
        viewModelScope.launch {
            transactionRepository.deleteOrderPermanently(order.id)
            _uiState.value = _uiState.value.copy(
                showDeleteDialog = false,
                pendingDeleteOrder = null,
                selectedOrder = null,
                selectedItems = emptyList(),
                splitOrders = emptyList(),
                splitItemsByOrderId = emptyMap(),
                message = "Order deleted permanently"
            )
            refresh()
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null)
    }

    fun printSelectedOrder() {
        val order = _uiState.value.selectedOrder ?: return
        val items = _uiState.value.selectedItems
        printOrder(order, items, includeCustomerCardCopy = true)
    }

    fun printAdyenCustomerReceiptForSelected() {
        val order = _uiState.value.selectedOrder ?: return
        printAdyenReceipt(order, customerCopy = true)
    }

    fun printAdyenCashierReceiptForSelected() {
        val order = _uiState.value.selectedOrder ?: return
        printAdyenReceipt(order, customerCopy = false)
    }

    fun printSplitOrder(orderId: String) {
        val order = _uiState.value.splitOrders.find { it.id == orderId } ?: return
        val items = _uiState.value.splitItemsByOrderId[orderId].orEmpty()
        printOrder(order, items, includeCustomerCardCopy = true)
    }

    fun printAllSplitOrders() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            for (split in _uiState.value.splitOrders) {
                val items = _uiState.value.splitItemsByOrderId[split.id].orEmpty()
                printerService.routeReceipt(settings, split, items)
            }
            _uiState.value = _uiState.value.copy(message = "Split receipts printed")
        }
    }

    private fun printOrder(
        order: TransactionEntity,
        items: List<TransactionItemEntity>,
        includeCustomerCardCopy: Boolean = false
    ) {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val customerCopy = if (includeCustomerCardCopy) {
                com.chaslay.pos.payment.AdyenPaymentReceiptStorage.customerReceipt(order)
            } else {
                null
            }
            printerService.routeReceipt(settings, order, items, customerCopy)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(message = "Receipt printed")
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(message = e.message ?: "Print failed")
                }
        }
    }

    private fun printAdyenReceipt(order: TransactionEntity, customerCopy: Boolean) {
        viewModelScope.launch {
            val receipt = if (customerCopy) {
                com.chaslay.pos.payment.AdyenPaymentReceiptStorage.customerReceipt(order)
            } else {
                com.chaslay.pos.payment.AdyenPaymentReceiptStorage.cashierReceipt(order)
            } ?: run {
                _uiState.value = _uiState.value.copy(message = "Card receipt not available for this order")
                return@launch
            }
            val settings = settingsRepository.getSettings()
            printerService.routeAdyenPaymentReceipt(settings, receipt)
                .onSuccess {
                    val label = if (customerCopy) "Customer card receipt printed" else "Merchant card receipt printed"
                    _uiState.value = _uiState.value.copy(message = label)
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(message = e.message ?: "Print failed")
                }
        }
    }

    private fun dateBounds(filter: HistoryDateFilter): Pair<Long, Long> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val tomorrowStart = (calendar.clone() as Calendar).apply {
            add(Calendar.DAY_OF_YEAR, 1)
        }.timeInMillis
        return when (filter) {
            HistoryDateFilter.TODAY -> calendar.timeInMillis to tomorrowStart
            HistoryDateFilter.YESTERDAY -> {
                calendar.add(Calendar.DAY_OF_YEAR, -1)
                val start = calendar.timeInMillis
                start to (start + 86_400_000L)
            }
            HistoryDateFilter.WEEK -> {
                calendar.add(Calendar.DAY_OF_YEAR, -7)
                calendar.timeInMillis to tomorrowStart
            }
            HistoryDateFilter.MONTH -> {
                calendar.add(Calendar.DAY_OF_YEAR, -30)
                calendar.timeInMillis to tomorrowStart
            }
            HistoryDateFilter.THREE_MONTHS -> {
                calendar.add(Calendar.DAY_OF_YEAR, -90)
                calendar.timeInMillis to tomorrowStart
            }
            HistoryDateFilter.ALL -> 0L to tomorrowStart
        }
    }

    private fun formatDateRange(start: Long, end: Long, filter: HistoryDateFilter): String {
        val fmt = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
        return when (filter) {
            HistoryDateFilter.TODAY, HistoryDateFilter.YESTERDAY -> fmt.format(start)
            else -> "${fmt.format(start)} — ${fmt.format(end - 1)}"
        }
    }
}
