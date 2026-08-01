package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.util.TextEncoding
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.PushCatalogCategoryDto
import com.chaslay.pos.data.remote.dto.PushCatalogProductDto
import com.chaslay.pos.data.remote.dto.PushCatalogRequest
import com.chaslay.pos.data.remote.dto.SyncBusinessDto
import com.chaslay.pos.data.remote.dto.SyncCategoryDto
import com.chaslay.pos.data.remote.dto.SyncProductDto
import com.chaslay.pos.data.repository.SettingsRepository
import java.time.Instant
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

enum class MenuSyncMode {
    /** Upsert cloud items; keep local-only rows */
    MERGE,
    /** Deactivate local catalog, then full bootstrap from cloud */
    REPLACE
}

@Singleton
class MenuSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncPreferences: SyncPreferences,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val categoryDao: CategoryDao,
    private val productDao: ProductDao,
    private val settingsRepository: SettingsRepository
) {
    suspend fun syncMenu(mode: MenuSyncMode = MenuSyncMode.MERGE): MenuSyncResult =
        withContext(Dispatchers.IO) {
            if (!syncApiKeyStore.hasKey()) {
                return@withContext MenuSyncResult(skipped = true, message = "No sync API key")
            }
            val syncBusinessInfo = syncPreferences.isSyncBusinessInfoEnabled()
            if (mode == MenuSyncMode.REPLACE) {
                productDao.deactivateAll()
                categoryDao.deactivateAll()
                syncPreferences.resetMenuSyncCursor()
            }

            val lastSync = syncPreferences.getLastMenuSyncMs()
            val forceBootstrap = mode == MenuSyncMode.REPLACE || lastSync <= 0L
            var businessSynced = false
            val (serverTime, categories, products) = if (forceBootstrap) {
                val bootstrap = syncApi.bootstrap()
                if (syncBusinessInfo) {
                    bootstrap.business?.let { dto ->
                        applyBusinessInfo(dto)
                        businessSynced = true
                    }
                }
                Triple(bootstrap.serverTime, bootstrap.categories, bootstrap.products)
            } else {
                val changes = syncApi.menuChanges(lastSync)
                if (syncBusinessInfo) {
                    runCatching { syncApi.bootstrap().business }.getOrNull()?.let { dto ->
                        applyBusinessInfo(dto)
                        businessSynced = true
                    }
                }
                Triple(changes.serverTime, changes.categories, changes.products)
            }

            val categoryIdByRemote = mutableMapOf<String, Long>()
            categories.forEach { dto ->
                val localId = upsertCategory(dto)
                if (localId != null) categoryIdByRemote[dto.id] = localId
            }
            products.forEach { dto ->
                upsertProduct(dto, categoryIdByRemote)
            }

            syncPreferences.setLastMenuSyncMs(serverTime)
            if (categories.isNotEmpty() || products.isNotEmpty()) {
                syncPreferences.setMenuCloudSynced(true)
            }
            val businessNote = if (businessSynced) " + business info" else ""
            MenuSyncResult(
                categories = categories.size,
                products = products.size,
                serverTime = serverTime,
                mode = mode,
                businessSynced = businessSynced,
                message = if (products.isEmpty() && categories.isEmpty()) {
                    "Online menu is empty — add products in the merchant panel first"
                } else {
                    "Pulled ${categories.size} categories, ${products.size} products$businessNote"
                }
            )
        }

    /** Push local active catalog to merchant panel. */
    suspend fun pushMenuToCloud(): MenuSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext MenuSyncResult(skipped = true, message = "No sync API key")
        }
        val categories = categoryDao.getActive()
        val products = productDao.getAllActive()
        if (categories.isEmpty() && products.isEmpty()) {
            return@withContext MenuSyncResult(message = "Local menu is empty")
        }

        val catClientIds = categories.associate { cat ->
            cat.id to (cat.remoteId?.takeIf { it.isNotBlank() } ?: "local-cat-${cat.id}")
        }
        val payload = PushCatalogRequest(
            categories = categories.map { cat ->
                PushCatalogCategoryDto(
                    clientId = catClientIds[cat.id]!!,
                    name = TextEncoding.repairCatalogText(cat.name),
                    sortOrder = cat.sortOrder,
                    color = cat.colorHex
                )
            },
            products = products.map { p ->
                PushCatalogProductDto(
                    clientId = p.remoteId?.takeIf { it.isNotBlank() } ?: "local-prod-${p.id}",
                    name = TextEncoding.repairCatalogText(p.name),
                    price = p.price,
                    categoryClientId = p.categoryId?.let { catClientIds[it] },
                    sku = p.sku,
                    barcode = p.barcode,
                    isTaxable = p.taxRate > 0.0,
                    sortOrder = p.sortOrder
                )
            }
        )
        val response = syncApi.pushCatalog(payload)

        // Persist server clientIds as remoteId for future sync
        categories.forEach { cat ->
            val clientId = catClientIds[cat.id] ?: return@forEach
            if (cat.remoteId != clientId) {
                categoryDao.update(cat.copy(remoteId = clientId))
            }
        }
        products.forEach { p ->
            val clientId = p.remoteId?.takeIf { it.isNotBlank() } ?: "local-prod-${p.id}"
            if (p.remoteId != clientId) {
                productDao.update(p.copy(remoteId = clientId))
            }
        }

        MenuSyncResult(
            categories = categories.size,
            products = products.size,
            serverTime = response.serverTime,
            message = "Pushed ${categories.size} categories, ${products.size} products to panel"
        )
    }

    private suspend fun applyBusinessInfo(dto: SyncBusinessDto) {
        val current = settingsRepository.getSettings()
        val hours = parseStoreHours(dto.storeHours)
        val merged = current.copy(
            businessName = dto.name?.takeIf { it.isNotBlank() } ?: current.businessName,
            phone = dto.phone?.takeIf { it.isNotBlank() } ?: current.phone,
            email = dto.email?.takeIf { it.isNotBlank() } ?: current.email,
            address = dto.address?.takeIf { it.isNotBlank() } ?: current.address,
            vatNumber = dto.vatNumber?.takeIf { it.isNotBlank() } ?: current.vatNumber,
            takeawayVatRate = dto.taxTakeawayRate?.takeIf { it > 0.0 } ?: current.takeawayVatRate,
            dineInVatRate = dto.taxDineInRate?.takeIf { it > 0.0 } ?: current.dineInVatRate,
            vatIncludedInPrice = dto.taxIncludedInPrice ?: current.vatIncludedInPrice,
            defaultLanguage = dto.defaultLanguage?.takeIf { it.isNotBlank() } ?: current.defaultLanguage,
            openHour = hours?.getOrNull(0) ?: current.openHour,
            openMinute = hours?.getOrNull(1) ?: current.openMinute,
            closeHour = hours?.getOrNull(2) ?: current.closeHour,
            closeMinute = hours?.getOrNull(3) ?: current.closeMinute
        )
        settingsRepository.saveSettings(merged)
    }

    /** Returns openHour, openMinute, closeHour, closeMinute from takeaway hours for today. */
    private fun parseStoreHours(
        storeHours: Map<String, Map<String, List<com.chaslay.pos.data.remote.dto.SyncStoreHoursSlotDto>>>?
    ): List<Int>? {
        if (storeHours.isNullOrEmpty()) return null
        val dayKey = when (Calendar.getInstance().get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> "mon"
            Calendar.TUESDAY -> "tue"
            Calendar.WEDNESDAY -> "wed"
            Calendar.THURSDAY -> "thu"
            Calendar.FRIDAY -> "fri"
            Calendar.SATURDAY -> "sat"
            Calendar.SUNDAY -> "sun"
            else -> "mon"
        }
        val channel = storeHours["takeaway"] ?: storeHours["display"] ?: storeHours.values.firstOrNull()
        val slots = channel?.get(dayKey).orEmpty()
        val slot = slots.firstOrNull() ?: return null
        val open = parseHourMinute(slot.open) ?: return null
        val close = parseHourMinute(slot.close) ?: return null
        return listOf(open.first, open.second, close.first, close.second)
    }

    private fun parseHourMinute(value: String): Pair<Int, Int>? {
        val parts = value.trim().split(":")
        if (parts.size < 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null
        return hour to minute
    }

    private suspend fun upsertCategory(dto: SyncCategoryDto): Long? {
        val deleted = dto.deleted_at != null
        val existing = categoryDao.getByRemoteId(dto.id)
        val entity = CategoryEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = TextEncoding.repairCatalogText(dto.name),
            sortOrder = dto.sort_order ?: existing?.sortOrder ?: 0,
            colorHex = dto.color_hex ?: existing?.colorHex ?: "#5B9BD5",
            isActive = !deleted,
            onlineVisible = dto.online_visible ?: true,
            updatedAt = parseInstantMs(dto.updated_at)
        )
        return if (existing == null) categoryDao.insert(entity) else {
            categoryDao.update(entity)
            existing.id
        }
    }

    private suspend fun upsertProduct(dto: SyncProductDto, categoryIdByRemote: Map<String, Long>) {
        val deleted = dto.deleted_at != null
        val existing = productDao.getByRemoteId(dto.id)
        val categoryId = dto.category_id?.let { categoryIdByRemote[it] }
        val isCombo = dto.productType == "combo" || existing?.isCombo == true
        val isOpenPrice = dto.isOpenPrice == true || dto.productType == "open_price"
        val isWeighed = dto.soldByWeight == true || dto.productType == "weighed"
        val entity = ProductEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = TextEncoding.repairCatalogText(dto.name),
            sku = dto.sku ?: existing?.sku,
            barcode = existing?.barcode,
            categoryId = categoryId ?: existing?.categoryId,
            taxRate = dto.tax_rate ?: existing?.taxRate ?: 0.0,
            price = dto.price,
            imageUri = dto.image_url ?: existing?.imageUri,
            isActive = !deleted && dto.in_stock != false,
            isOpenPrice = isOpenPrice,
            isWeighed = isWeighed && !isOpenPrice,
            isCombo = isCombo,
            onlineVisible = dto.online_visible ?: true,
            sortOrder = dto.sort_order ?: existing?.sortOrder ?: 0,
            updatedAt = parseInstantMs(dto.updated_at)
        )
        if (existing == null) productDao.insert(entity) else productDao.update(entity)
    }

    private fun parseInstantMs(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
    }
}

data class MenuSyncResult(
    val categories: Int = 0,
    val products: Int = 0,
    val serverTime: Long = 0L,
    val skipped: Boolean = false,
    val mode: MenuSyncMode = MenuSyncMode.MERGE,
    val businessSynced: Boolean = false,
    val message: String? = null
)
