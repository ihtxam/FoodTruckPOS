package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.PushCatalogCategoryDto
import com.chaslay.pos.data.remote.dto.PushCatalogProductDto
import com.chaslay.pos.data.remote.dto.PushCatalogRequest
import com.chaslay.pos.data.remote.dto.SyncCategoryDto
import com.chaslay.pos.data.remote.dto.SyncProductDto
import java.time.Instant
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
    private val productDao: ProductDao
) {
    suspend fun syncMenu(mode: MenuSyncMode = MenuSyncMode.MERGE): MenuSyncResult =
        withContext(Dispatchers.IO) {
            if (!syncApiKeyStore.hasKey()) {
                return@withContext MenuSyncResult(skipped = true, message = "No sync API key")
            }
            if (mode == MenuSyncMode.REPLACE) {
                productDao.deactivateAll()
                categoryDao.deactivateAll()
                syncPreferences.resetMenuSyncCursor()
            }

            val lastSync = syncPreferences.getLastMenuSyncMs()
            val forceBootstrap = mode == MenuSyncMode.REPLACE || lastSync <= 0L
            val (serverTime, categories, products) = if (forceBootstrap) {
                val bootstrap = syncApi.bootstrap()
                Triple(bootstrap.serverTime, bootstrap.categories, bootstrap.products)
            } else {
                val changes = syncApi.menuChanges(lastSync)
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
            MenuSyncResult(
                categories = categories.size,
                products = products.size,
                serverTime = serverTime,
                mode = mode,
                message = "Pulled ${categories.size} categories, ${products.size} products"
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
                    name = cat.name,
                    sortOrder = cat.sortOrder,
                    color = cat.colorHex
                )
            },
            products = products.map { p ->
                PushCatalogProductDto(
                    clientId = p.remoteId?.takeIf { it.isNotBlank() } ?: "local-prod-${p.id}",
                    name = p.name,
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

    private suspend fun upsertCategory(dto: SyncCategoryDto): Long? {
        val deleted = dto.deleted_at != null
        val existing = categoryDao.getByRemoteId(dto.id)
        val entity = CategoryEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = dto.name,
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
        val entity = ProductEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = dto.name,
            sku = dto.sku ?: existing?.sku,
            barcode = existing?.barcode,
            categoryId = categoryId ?: existing?.categoryId,
            taxRate = dto.tax_rate ?: existing?.taxRate ?: 0.0,
            price = dto.price,
            imageUri = dto.image_url ?: existing?.imageUri,
            isActive = !deleted && (dto.in_stock ?: true),
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
    val message: String? = null
)
