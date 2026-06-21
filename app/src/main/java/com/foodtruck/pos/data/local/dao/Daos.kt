package com.foodtruck.pos.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.local.entity.TransactionItemEntity
import com.foodtruck.pos.data.local.entity.UserEntity
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.SyncStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE isActive = 1 ORDER BY name")
    fun observeActiveUsers(): Flow<List<UserEntity>>

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): UserEntity?

    @Query("SELECT * FROM users WHERE email = :email AND isActive = 1 LIMIT 1")
    suspend fun getByEmail(email: String): UserEntity?

    @Query("SELECT * FROM users WHERE pinHash IS NOT NULL AND isActive = 1")
    suspend fun getPinUsers(): List<UserEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(user: UserEntity): Long

    @Update
    suspend fun update(user: UserEntity)
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<CategoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(category: CategoryEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(categories: List<CategoryEntity>)
}

@Dao
interface ProductDao {
    @Query(
        """
        SELECT * FROM products
        WHERE isActive = 1
        AND (:categoryId IS NULL OR categoryId = :categoryId)
        ORDER BY sortOrder, name
        """
    )
    fun observeActive(categoryId: Long?): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ProductEntity?

    @Query("SELECT * FROM products WHERE barcode = :barcode AND isActive = 1 LIMIT 1")
    suspend fun getByBarcode(barcode: String): ProductEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(product: ProductEntity): Long

    @Update
    suspend fun update(product: ProductEntity)

    @Query("SELECT COUNT(*) FROM products")
    suspend fun count(): Int
}

@Dao
interface ProductVariantDao {
    @Query("SELECT * FROM product_variants WHERE productId = :productId AND isActive = 1 ORDER BY sortOrder, name")
    fun observeByProduct(productId: Long): Flow<List<ProductVariantEntity>>

    @Query("SELECT * FROM product_variants WHERE productId = :productId AND isActive = 1 ORDER BY sortOrder, name")
    suspend fun getByProduct(productId: Long): List<ProductVariantEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(variant: ProductVariantEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(variants: List<ProductVariantEntity>)
}

@Dao
interface TransactionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<TransactionItemEntity>)

    @Transaction
    suspend fun insertFullTransaction(transaction: TransactionEntity, items: List<TransactionItemEntity>) {
        insertTransaction(transaction)
        insertItems(items)
    }

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TransactionEntity?

    @Query("SELECT * FROM transaction_items WHERE transactionId = :transactionId")
    suspend fun getItems(transactionId: String): List<TransactionItemEntity>

    @Query(
        """
        SELECT * FROM transactions
        WHERE createdAt >= :startOfDay AND createdAt < :endOfDay
        AND paymentStatus = 'COMPLETED'
        ORDER BY createdAt DESC
        """
    )
    suspend fun getTransactionsForDay(startOfDay: Long, endOfDay: Long): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE syncStatus = :status ORDER BY createdAt ASC LIMIT :limit")
    suspend fun getBySyncStatus(status: SyncStatus, limit: Int = 100): List<TransactionEntity>

    @Query("UPDATE transactions SET syncStatus = :status WHERE id = :id")
    suspend fun updateSyncStatus(id: String, status: SyncStatus)

    @Query(
        """
        SELECT ti.productName, SUM(ti.quantity) as qty, SUM(ti.lineTotal) as revenue
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transactionId
        WHERE t.createdAt >= :startOfDay AND t.createdAt < :endOfDay
        AND t.paymentStatus = 'COMPLETED'
        GROUP BY ti.productName
        ORDER BY qty DESC
        LIMIT :limit
        """
    )
    suspend fun getTopProducts(startOfDay: Long, endOfDay: Long, limit: Int = 10): List<ProductSalesRow>

    @Query(
        """
        SELECT userName, COUNT(*) as txCount, SUM(total) as revenue
        FROM transactions
        WHERE createdAt >= :startOfDay AND createdAt < :endOfDay
        AND paymentStatus = 'COMPLETED'
        GROUP BY userName
        ORDER BY revenue DESC
        """
    )
    suspend fun getUserPerformance(startOfDay: Long, endOfDay: Long): List<UserPerformanceRow>
}

data class ProductSalesRow(
    val productName: String,
    val qty: Int,
    val revenue: Double
)

data class UserPerformanceRow(
    val userName: String,
    val txCount: Int,
    val revenue: Double
)

@Dao
interface BusinessSettingsDao {
    @Query("SELECT * FROM business_settings WHERE id = 1 LIMIT 1")
    fun observe(): Flow<BusinessSettingsEntity?>

    @Query("SELECT * FROM business_settings WHERE id = 1 LIMIT 1")
    suspend fun get(): BusinessSettingsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(settings: BusinessSettingsEntity)
}
