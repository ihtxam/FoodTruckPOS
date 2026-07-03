package com.chaslay.pos.ui.ongoing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.CartManager
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.OngoingOrderCard
import com.chaslay.pos.domain.model.OngoingOrderSource
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.TableOrderStatus
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.KitchenPrintMeta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class OngoingOrdersUiState(
    val orders: List<OngoingOrderCard> = emptyList(),
    val filter: ServiceType? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class OngoingOrdersViewModel @Inject constructor(
    private val heldOrderRepository: HeldOrderRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val cartManager: CartManager,
    private val sessionManager: SessionManager,
    private val settingsRepository: SettingsRepository,
    private val productRepository: ProductRepository,
    private val printerService: BluetoothPrinterService,
    private val crashLogger: CrashLogger
) : ViewModel() {

    private val _uiState = MutableStateFlow(OngoingOrdersUiState())
    val uiState: StateFlow<OngoingOrdersUiState> = _uiState.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, filter = null)
            runCatching { flushActiveTableCart() }
                .onFailure { e -> crashLogger.logError("OngoingOrders", "flushActiveTableCart failed", e) }
            runCatching {
                val heldOrdersWithItems = heldOrderRepository.getOngoingHeldOrdersWithItems()
                android.util.Log.i("ONGOING", "held=${heldOrdersWithItems.size} activeCount=${heldOrderRepository.countActive()}")
                val heldTableOrderIds = heldOrdersWithItems.mapNotNull { (order, _) -> order.tableOrderId }.toSet()
                val held = heldOrdersWithItems
                    .filter { (order, _) -> order.pickupTimeMs == null }
                    .map { (order, items) ->
                    OngoingOrderCard(
                        id = order.id,
                        orderNumber = order.orderNumber,
                        serviceType = order.serviceType,
                        fulfillmentType = order.fulfillmentType,
                        total = if (items.isEmpty()) order.total else CartSummary(items.map { it.toCartItem() }).total,
                        itemCount = items.sumOf { it.quantity },
                        statusLabel = when (order.status) {
                            HeldOrderStatus.SENT_TO_KITCHEN -> "Kitchen sent"
                            HeldOrderStatus.HELD -> "On hold"
                        },
                        source = OngoingOrderSource.HELD,
                        tableName = order.tableName,
                        updatedAt = order.updatedAt
                    )
                }
                val table = runCatching {
                    tableOrderRepository.getOngoingTableOrders()
                    .filter { (order, _) -> order.id !in heldTableOrderIds }
                    .map { (order, items) ->
                    val tableEntity = tableOrderRepository.getTable(order.tableId)
                    val cartItems = items.map { it.toCartItem() }
                    OngoingOrderCard(
                        id = order.id,
                        orderNumber = tableEntity?.name ?: order.id.take(6).uppercase(),
                        serviceType = order.serviceType,
                        fulfillmentType = FulfillmentType.DINE_IN,
                        total = if (cartItems.isEmpty()) 0.0 else CartSummary(cartItems).total,
                        itemCount = items.sumOf { it.quantity },
                        statusLabel = when (order.status) {
                            TableOrderStatus.SENT -> "Kitchen sent"
                            TableOrderStatus.HELD -> "On hold"
                            else -> "Open"
                        },
                        source = OngoingOrderSource.TABLE,
                        tableName = tableEntity?.name,
                        updatedAt = order.updatedAt
                    )
                }
                }.getOrElse { e ->
                    crashLogger.logError("OngoingOrders", "Loading table orders failed", e)
                    emptyList()
                }
                val merged = mergeWithActiveCart(held + table)
                android.util.Log.i("ONGOING", "heldCards=${held.size} tableCards=${table.size} merged=${merged.size}")
                _uiState.value = OngoingOrdersUiState(
                    orders = merged.sortedByDescending { it.updatedAt },
                    filter = _uiState.value.filter,
                    isLoading = false
                )
            }.onFailure { e ->
                android.util.Log.e("ONGOING", "refresh failed", e)
                crashLogger.logError("OngoingOrders", "Failed to load ongoing orders", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Could not load orders"
                )
            }
        }
    }

    private suspend fun flushActiveTableCart() {
        val cart = cartManager.snapshot()
        if (cart.tableId == null || cart.items.isEmpty()) return
        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Cashier"
        val orderId = tableOrderRepository.syncCartToTable(cart, userId, userName)
        cartManager.setTableOrderId(orderId)
        val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
    }

    private fun mergeWithActiveCart(orders: List<OngoingOrderCard>): List<OngoingOrderCard> {
        val cart = cartManager.snapshot()
        val orderId = cart.tableOrderId ?: return orders
        if (cart.tableId == null || cart.items.isEmpty()) return orders
        val existing = orders.find { it.id == orderId && it.source == OngoingOrderSource.TABLE }
        val card = OngoingOrderCard(
            id = orderId,
            orderNumber = cart.tableName ?: existing?.orderNumber.orEmpty(),
            serviceType = cart.serviceType,
            fulfillmentType = cart.fulfillmentType,
            total = cart.total,
            itemCount = cart.items.sumOf { it.quantity },
            statusLabel = existing?.statusLabel ?: "Open",
            source = OngoingOrderSource.TABLE,
            tableName = cart.tableName,
            updatedAt = maxOf(existing?.updatedAt ?: 0L, System.currentTimeMillis())
        )
        return if (existing == null) {
            orders + card
        } else {
            orders.map { if (it.id == orderId && it.source == OngoingOrderSource.TABLE) card else it }
        }
    }

    fun setFilter(serviceType: ServiceType?) {
        _uiState.value = _uiState.value.copy(filter = serviceType)
    }

    val filteredOrders: List<OngoingOrderCard>
        get() {
            val filter = _uiState.value.filter ?: return _uiState.value.orders
            return _uiState.value.orders.filter { it.serviceType == filter }
        }

    fun resumeOrder(card: OngoingOrderCard, onDone: () -> Unit) {
        viewModelScope.launch {
            val loaded = when (card.source) {
                OngoingOrderSource.HELD -> heldOrderRepository.loadHeldOrderToCart(cartManager, card.id)
                OngoingOrderSource.TABLE -> tableOrderRepository.loadTableOrderToCart(cartManager, card.id)
            }
            if (loaded) onDone()
        }
    }

    fun printReceiptForOrder(card: OngoingOrderCard) {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val lines = loadOrderLines(card)
            if (lines.isEmpty()) {
                _uiState.value = _uiState.value.copy(errorMessage = "No items to print")
                return@launch
            }
            val total = lines.sumOf { it.second }
            withContext(Dispatchers.IO) {
                printerService.routeCartPreview(
                    settings = settings,
                    lines = lines.map { it.first to it.second },
                    total = total,
                    title = "ORDER ${card.orderNumber}"
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(errorMessage = e.message ?: "Print failed")
            }
        }
    }

    fun sendKitchenForOrder(card: OngoingOrderCard) {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val categories = productRepository.getAllCategories()
            val products = productRepository.getAllProducts()
            val userName = sessionManager.currentUserName.first() ?: "Cashier"
            val payload = loadKitchenPayload(card, userName) ?: run {
                _uiState.value = _uiState.value.copy(errorMessage = "No items to send")
                return@launch
            }
            withContext(Dispatchers.IO) {
                printerService.routeKitchen(
                    settings = settings,
                    tableName = payload.tableName,
                    serviceType = payload.serviceType,
                    round = payload.round,
                    items = payload.items,
                    isFollowUp = false,
                    message = null,
                    categories = categories,
                    products = products,
                    meta = payload.meta
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(errorMessage = e.message ?: "Kitchen print failed")
            }
        }
    }

    private data class KitchenPayload(
        val tableName: String,
        val serviceType: ServiceType,
        val round: Int,
        val items: List<com.chaslay.pos.data.local.entity.TableOrderItemEntity>,
        val meta: KitchenPrintMeta
    )

    private suspend fun loadOrderLines(card: OngoingOrderCard): List<Pair<String, Double>> = when (card.source) {
        OngoingOrderSource.HELD -> {
            val detail = heldOrderRepository.getHeldOrderWithItems(card.id) ?: return emptyList()
            detail.second.map { "${it.quantity}x ${it.productName}" to (it.unitPrice * it.quantity) }
        }
        OngoingOrderSource.TABLE -> {
            tableOrderRepository.getOrderItems(card.id).map {
                "${it.quantity}x ${it.productName}" to it.lineSubtotal
            }
        }
    }

    private suspend fun loadKitchenPayload(card: OngoingOrderCard, userName: String): KitchenPayload? {
        return when (card.source) {
            OngoingOrderSource.HELD -> {
                val detail = heldOrderRepository.getHeldOrderWithItems(card.id) ?: return null
                val (order, items) = detail
                if (items.isEmpty()) return null
                val tableName = when (order.fulfillmentType) {
                    FulfillmentType.PICKUP -> "Takeaway"
                    FulfillmentType.DELIVERY -> "Delivery"
                    else -> order.tableName ?: "Walk-in"
                }
                KitchenPayload(
                    tableName = tableName,
                    serviceType = order.serviceType,
                    round = 1,
                    items = items.map { heldItem ->
                        com.chaslay.pos.data.local.entity.TableOrderItemEntity(
                            id = heldItem.id,
                            orderId = order.id,
                            productId = heldItem.productId,
                            productName = heldItem.productName,
                            variantName = heldItem.variantName,
                            unitPrice = heldItem.unitPrice,
                            quantity = heldItem.quantity,
                            taxRate = heldItem.taxRate,
                            notes = heldItem.notes,
                            courseNumber = heldItem.courseNumber
                        )
                    },
                    meta = KitchenPrintMeta(
                        orderNumber = order.orderNumber,
                        fulfillmentType = order.fulfillmentType,
                        pickupTimeMs = order.pickupTimeMs,
                        cashierName = userName
                    )
                )
            }
            OngoingOrderSource.TABLE -> {
                val order = tableOrderRepository.getOrder(card.id) ?: return null
                var items = tableOrderRepository.getOrderItemEntities(card.id)
                    .filter { it.sentToKitchenAt == null }
                if (items.isEmpty()) {
                    items = tableOrderRepository.getOrderItemEntities(card.id)
                }
                if (items.isEmpty()) return null
                val table = tableOrderRepository.getTable(order.tableId)
                KitchenPayload(
                    tableName = table?.name ?: card.orderNumber,
                    serviceType = order.serviceType,
                    round = (order.kitchenRound) + 1,
                    items = items,
                    meta = KitchenPrintMeta(
                        orderNumber = card.orderNumber,
                        fulfillmentType = FulfillmentType.DINE_IN,
                        cashierName = userName
                    )
                )
            }
        }
    }

    private fun com.chaslay.pos.data.local.entity.HeldOrderItemEntity.toCartItem() = CartItem(
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

    private fun com.chaslay.pos.data.local.entity.TableOrderItemEntity.toCartItem() = CartItem(
        id = id,
        productId = productId,
        productName = productName,
        variantName = variantName,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        sentToKitchen = sentToKitchenAt != null,
        courseNumber = courseNumber
    )
}
