package com.chaslay.pos.sync

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.SyncCategoryDto
import com.chaslay.pos.data.remote.dto.SyncProductDto
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class MenuSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncPreferences: SyncPreferences,
    private val categoryDao: CategoryDao,
    private val productDao: ProductDao
) {
    suspend fun syncMenu(): MenuSyncResult = withContext(Dispatchers.IO) {
        if (BuildConfig.SYNC_API_KEY.isBlank()) {
            return@withContext MenuSyncResult(skipped = true)
        }
        val lastSync = syncPreferences.getLastMenuSyncMs()
        val (serverTime, categories, products) = if (lastSync <= 0L) {
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
            serverTime = serverTime
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
    val skipped: Boolean = false
)
