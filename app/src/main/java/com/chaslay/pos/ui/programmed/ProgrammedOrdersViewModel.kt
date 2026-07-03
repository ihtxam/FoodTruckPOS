package com.chaslay.pos.ui.programmed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.repository.CartManager
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.ProgrammedOrderCard
import com.chaslay.pos.domain.model.ProgrammedOrderSource
import com.chaslay.pos.printer.BluetoothPrinterService
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.Calendar
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class ProgrammedDayGroup(
    val dayKey: Long,
    val dayLabel: String,
    val orders: List<ProgrammedOrderCard>
)

data class ProgrammedOrdersUiState(
    val groups: List<ProgrammedDayGroup> = emptyList(),
    val currencySymbol: String = "CHF",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val message: String? = null
)

@HiltViewModel
class ProgrammedOrdersViewModel @Inject constructor(
    private val heldOrderRepository: HeldOrderRepository,
    private val transactionRepository: TransactionRepository,
    private val settingsRepository: SettingsRepository,
    private val cartManager: CartManager,
    private val printerService: BluetoothPrinterService
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProgrammedOrdersUiState())
    val uiState: StateFlow<ProgrammedOrdersUiState> = _uiState.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching {
                val settings = settingsRepository.getSettings()
                val currency = settings.currencySymbol.ifBlank { "CHF" }
                val sinceMs = startOfTodayMs()
                val held = heldOrderRepository.getProgrammedHeldOrdersWithItems().map { (order, items) ->
                    ProgrammedOrderCard(
                        id = order.id,
                        orderNumber = order.orderNumber,
                        serviceType = order.serviceType,
                        fulfillmentType = order.fulfillmentType,
                        total = if (items.isEmpty()) order.total else CartSummary(items.map { it.toCartItem() }).total,
                        itemCount = items.sumOf { it.quantity },
                        pickupTimeMs = order.pickupTimeMs ?: order.createdAt,
                        isPaid = false,
                        source = ProgrammedOrderSource.HELD,
                        customerLabel = order.deliveryName ?: order.deliveryPhone,
                        statusLabel = when (order.status) {
                            HeldOrderStatus.SENT_TO_KITCHEN -> "Kitchen sent"
                            HeldOrderStatus.HELD -> "Awaiting payment"
                        }
                    )
                }
                val paid = transactionRepository.getProgrammedPaidOrders(sinceMs).map { tx ->
                    val items = transactionRepository.getTransaction(tx.id)?.second.orEmpty()
                    ProgrammedOrderCard(
                        id = tx.id,
                        orderNumber = tx.transactionNumber,
                        serviceType = tx.serviceType ?: com.chaslay.pos.domain.model.ServiceType.TAKEAWAY,
                        fulfillmentType = FulfillmentType.PICKUP,
                        total = tx.total,
                        itemCount = items.sumOf { it.quantity },
                        pickupTimeMs = tx.pickupTimeMs ?: tx.createdAt,
                        isPaid = true,
                        source = ProgrammedOrderSource.TRANSACTION,
                        statusLabel = "Paid"
                    )
                }
                val grouped = (held + paid)
                    .sortedBy { it.pickupTimeMs }
                    .groupBy { dayKey(it.pickupTimeMs) }
                    .toSortedMap()
                    .map { (key, orders) ->
                        ProgrammedDayGroup(
                            dayKey = key,
                            dayLabel = formatDayLabel(orders.first().pickupTimeMs),
                            orders = orders.sortedBy { it.pickupTimeMs }
                        )
                    }
                _uiState.value = ProgrammedOrdersUiState(
                    groups = grouped,
                    currencySymbol = currency,
                    isLoading = false
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Could not load programmed orders"
                )
            }
        }
    }

    fun resumeOrder(card: ProgrammedOrderCard, onDone: () -> Unit) {
        if (card.source != ProgrammedOrderSource.HELD) {
            _uiState.value = _uiState.value.copy(message = "Order already paid")
            return
        }
        viewModelScope.launch {
            val loaded = heldOrderRepository.loadHeldOrderToCart(cartManager, card.id)
            if (loaded) onDone() else {
                _uiState.value = _uiState.value.copy(message = "Could not open order")
            }
        }
    }

    fun printReceipt(card: ProgrammedOrderCard) {
        if (card.source != ProgrammedOrderSource.TRANSACTION) return
        viewModelScope.launch {
            val detail = transactionRepository.getTransaction(card.id) ?: return@launch
            val settings = settingsRepository.getSettings()
            withContext(Dispatchers.IO) {
                printerService.routeReceipt(settings, detail.first, detail.second)
            }.onSuccess {
                _uiState.value = _uiState.value.copy(message = "Receipt printed")
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(message = e.message ?: "Print failed")
            }
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null)
    }

    private fun dayKey(timeMs: Long): Long {
        val cal = Calendar.getInstance().apply { timeInMillis = timeMs }
        return cal.get(Calendar.YEAR) * 1000L + cal.get(Calendar.DAY_OF_YEAR)
    }

    private fun formatDayLabel(timeMs: Long): String {
        val fmt = java.text.SimpleDateFormat("EEEE, dd MMM yyyy", java.util.Locale.getDefault())
        return fmt.format(java.util.Date(timeMs))
    }

    private fun startOfTodayMs(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun com.chaslay.pos.data.local.entity.HeldOrderItemEntity.toCartItem() =
        com.chaslay.pos.domain.model.CartItem(
            id = id,
            productId = productId,
            productName = productName,
            variantName = variantName,
            unitPrice = unitPrice,
            quantity = quantity,
            taxRate = taxRate,
            sku = sku,
            courseNumber = courseNumber
        )
}
