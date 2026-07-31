package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.HeldOrderDao
import com.chaslay.pos.data.local.dao.HeldOrderItemDao
import com.chaslay.pos.data.local.entity.HeldOrderEntity
import com.chaslay.pos.data.local.entity.HeldOrderItemEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.IncomingOnlineOrderDto
import com.chaslay.pos.data.remote.dto.OnlineOrderItemDto
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.ServiceType
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class OnlineOrderSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncPreferences: SyncPreferences,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val heldOrderDao: HeldOrderDao,
    private val heldOrderItemDao: HeldOrderItemDao
) {
    private val gson = Gson()

    suspend fun syncIncomingOrders(): OnlineOrderSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext OnlineOrderSyncResult(skipped = true)
        }
        val since = syncPreferences.getLastOrdersSyncMs()
        val response = syncApi.incomingOrders(since)
        var imported = 0
        response.orders.forEach { order ->
            if (importIncomingOrder(order)) {
                imported++
                runCatching { syncApi.ackOrder(order.id) }
            }
        }
        syncPreferences.setLastOrdersSyncMs(response.serverTime)
        OnlineOrderSyncResult(imported = imported, serverTime = response.serverTime)
    }

    private suspend fun importIncomingOrder(dto: IncomingOnlineOrderDto): Boolean {
        if (heldOrderDao.getByOrderNumber(dto.order_number) != null) return false
        val items = parseItems(dto)
        if (items.isEmpty()) return false

        val fulfillment = when (dto.fulfillment_type?.uppercase()) {
            "DELIVERY" -> FulfillmentType.DELIVERY
            "PICKUP" -> FulfillmentType.PICKUP
            else -> FulfillmentType.PICKUP
        }
        val serviceType = when (dto.service_type?.uppercase()) {
            "DINE_IN" -> ServiceType.DINE_IN
            else -> ServiceType.TAKEAWAY
        }
        val heldId = UUID.randomUUID().toString()
        val entity = HeldOrderEntity(
            id = heldId,
            orderNumber = dto.order_number,
            serviceType = serviceType,
            status = HeldOrderStatus.HELD,
            userId = 0L,
            userName = "Online",
            subtotal = dto.subtotal,
            taxTotal = dto.tax_total,
            total = dto.total,
            notes = buildString {
                append("Online order")
                dto.notes?.takeIf { it.isNotBlank() }?.let { append(": $it") }
            },
            fulfillmentType = fulfillment,
            pickupTimeMs = dto.pickup_time_ms,
            deliveryName = dto.customer_name,
            deliveryPhone = dto.customer_phone,
            deliveryAddress = dto.delivery_address
        )
        heldOrderDao.upsert(entity)
        val heldItems = items.map { item ->
            HeldOrderItemEntity(
                id = UUID.randomUUID().toString(),
                heldOrderId = heldId,
                productId = 0L,
                productName = item.productName ?: item.name ?: "Item",
                unitPrice = item.unitPrice,
                quantity = item.quantity.coerceAtLeast(1),
                taxRate = 0.0,
                notes = item.notes
            )
        }
        heldOrderItemDao.deleteByOrder(heldId)
        heldOrderItemDao.insertAll(heldItems)
        return true
    }

    private fun parseItems(dto: IncomingOnlineOrderDto): List<OnlineOrderItemDto> {
        val payload = dto.payload ?: return emptyList()
        return runCatching {
            val root = payload.asJsonObject ?: return emptyList()
            val itemsElement = root.get("items") ?: return emptyList()
            val type = object : TypeToken<List<OnlineOrderItemDto>>() {}.type
            gson.fromJson<List<OnlineOrderItemDto>>(itemsElement, type)
        }.getOrDefault(emptyList())
    }
}

data class OnlineOrderSyncResult(
    val imported: Int = 0,
    val serverTime: Long = 0L,
    val skipped: Boolean = false
)
