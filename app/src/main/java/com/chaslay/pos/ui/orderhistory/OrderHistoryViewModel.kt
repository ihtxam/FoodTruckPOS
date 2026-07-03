package com.chaslay.pos.ui.orderhistory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    val message: String? = null
)

@HiltViewModel
class OrderHistoryViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val heldOrderRepository: HeldOrderRepository,
    private val settingsRepository: com.chaslay.pos.data.repository.SettingsRepository,
    private val printerService: com.chaslay.pos.printer.BluetoothPrinterService,
    private val tableDao: RestaurantTableDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrderHistoryUiState())
    val uiState: StateFlow<OrderHistoryUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val reasons = heldOrderRepository.getCancelReasons().map { it.label }
            val settings = settingsRepository.getSettings()
            val currency = settings.currencySymbol.ifBlank { "CHF" }
            _uiState.value = _uiState.value.copy(cancelReasons = reasons, currencySymbol = currency)
            refresh()
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
        _uiState.value = _uiState.value.copy(showCancelDialog = true)
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

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null)
    }

    fun printSelectedOrder() {
        val order = _uiState.value.selectedOrder ?: return
        val items = _uiState.value.selectedItems
        printOrder(order, items)
    }

    fun printSplitOrder(orderId: String) {
        val order = _uiState.value.splitOrders.find { it.id == orderId } ?: return
        val items = _uiState.value.splitItemsByOrderId[orderId].orEmpty()
        printOrder(order, items)
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

    private fun printOrder(order: TransactionEntity, items: List<TransactionItemEntity>) {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            printerService.routeReceipt(settings, order, items)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(message = "Receipt printed")
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
