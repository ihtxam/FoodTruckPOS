package com.chaslay.pos.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import androidx.room.Upsert
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.local.entity.RoleEntity
import com.chaslay.pos.data.local.entity.UserEntity
import com.chaslay.pos.data.local.entity.DiscountPresetEntity
import com.chaslay.pos.data.local.entity.PrinterConfigEntity
import com.chaslay.pos.data.local.entity.KitchenMessageEntity
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.data.local.entity.FloorPlanElementEntity
import com.chaslay.pos.data.local.entity.TableFloorEntity
import com.chaslay.pos.data.local.entity.TableOrderEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.SyncStatus
import com.chaslay.pos.domain.model.TableOrderStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface RoleDao {
    @Query("SELECT * FROM roles ORDER BY name")
    fun observeAll(): Flow<List<RoleEntity>>

    @Query("SELECT * FROM roles ORDER BY name")
    suspend fun getAll(): List<RoleEntity>

    @Query("SELECT * FROM roles WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): RoleEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(role: RoleEntity): Long

    @Update
    suspend fun update(role: RoleEntity)

    @Query("DELETE FROM roles WHERE id = :id AND isSystem = 0")
    suspend fun deleteCustom(id: Long)
}

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE isActive = 1 ORDER BY name")
    fun observeActiveUsers(): Flow<List<UserEntity>>

    @Query("SELECT * FROM users ORDER BY name")
    fun observeAllUsers(): Flow<List<UserEntity>>

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): UserEntity?

    @Query("SELECT * FROM users WHERE LOWER(email) = LOWER(:email) AND isActive = 1 LIMIT 1")
    suspend fun getByEmail(email: String): UserEntity?

    @Query("SELECT * FROM users WHERE pinHash IS NOT NULL AND isActive = 1")
    suspend fun getPinUsers(): List<UserEntity>

    @Query("SELECT * FROM users ORDER BY name")
    suspend fun getAll(): List<UserEntity>

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

    @Update
    suspend fun update(category: CategoryEntity)

    @Query("UPDATE categories SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)

    @Query("UPDATE categories SET isActive = 0")
    suspend fun deactivateAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(categories: List<CategoryEntity>)

    @Query("SELECT * FROM categories WHERE remoteId = :remoteId LIMIT 1")
    suspend fun getByRemoteId(remoteId: String): CategoryEntity?
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

    @Query("SELECT * FROM products WHERE remoteId = :remoteId LIMIT 1")
    suspend fun getByRemoteId(remoteId: String): ProductEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(product: ProductEntity): Long

    @Update
    suspend fun update(product: ProductEntity)

    @Query("SELECT * FROM products WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeAllActive(): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE isActive = 1 AND isCombo = 1 ORDER BY sortOrder, name")
    fun observeCombos(): Flow<List<ProductEntity>>

    @Query("UPDATE products SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)

    @Query("UPDATE products SET isActive = 0")
    suspend fun deactivateAll()

    @Query("SELECT * FROM products WHERE sku = :sku AND isActive = 1 LIMIT 1")
    suspend fun getBySku(sku: String): ProductEntity?

    @Query("SELECT COUNT(*) FROM products")
    suspend fun count(): Int

    @Query(
        """
        UPDATE products
        SET stockQuantity = CASE WHEN stockQuantity - :qty < 0 THEN 0 ELSE stockQuantity - :qty END,
            updatedAt = :updatedAt
        WHERE id = :productId AND stockQuantity IS NOT NULL
        """
    )
    suspend fun decrementStock(productId: Long, qty: Int, updatedAt: Long = System.currentTimeMillis())
}

@Dao
interface ProductVariantDao {
    @Query("SELECT * FROM product_variants WHERE productId = :productId AND isActive = 1 ORDER BY sortOrder, name")
    fun observeByProduct(productId: Long): Flow<List<ProductVariantEntity>>

    @Query("SELECT * FROM product_variants WHERE productId = :productId AND isActive = 1 ORDER BY sortOrder, name")
    suspend fun getByProduct(productId: Long): List<ProductVariantEntity>

    @Query("SELECT * FROM product_variants WHERE barcode = :barcode AND isActive = 1 LIMIT 1")
    suspend fun getByBarcode(barcode: String): ProductVariantEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(variant: ProductVariantEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(variants: List<ProductVariantEntity>)

    @Query("UPDATE product_variants SET isActive = 0 WHERE productId = :productId")
    suspend fun deactivateByProduct(productId: Long)
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

    @Query("UPDATE transactions SET receiptUrl = :url WHERE id = :id")
    suspend fun updateReceiptUrl(id: String, url: String)

    @Query(
        """
        SELECT * FROM transactions
        WHERE masterOrderId = :masterOrderId
        ORDER BY COALESCE(splitCheckNumber, 0) ASC, createdAt ASC
        """
    )
    suspend fun getByMasterOrderId(masterOrderId: String): List<TransactionEntity>

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

    @Query(
        """
        SELECT * FROM transactions
        WHERE createdAt >= :startMs AND createdAt <= :endMs
        ORDER BY createdAt DESC
        """
    )
    suspend fun getAllInRange(startMs: Long, endMs: Long): List<TransactionEntity>

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
        SELECT ti.productName, SUM(ti.quantity) as qty, SUM(ti.lineTotal) as revenue
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transactionId
        WHERE t.createdAt >= :startMs AND t.createdAt < :endMs
        AND t.paymentStatus = 'COMPLETED'
        GROUP BY ti.productName
        ORDER BY qty DESC, ti.productName ASC
        """
    )
    suspend fun getProductsSold(startMs: Long, endMs: Long): List<ProductSalesRow>

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

    @Query(
        """
        SELECT * FROM transactions
        WHERE createdAt >= :startMs AND createdAt < :endMs
        AND (:paymentMethod IS NULL OR paymentMethod = :paymentMethod)
        AND (:serviceType IS NULL OR serviceType = :serviceType)
        ORDER BY createdAt DESC
        """
    )
    suspend fun searchTransactions(
        startMs: Long,
        endMs: Long,
        paymentMethod: PaymentMethod?,
        serviceType: ServiceType?
    ): List<TransactionEntity>

    @Query(
        """
        SELECT * FROM transactions
        WHERE pickupTimeMs IS NOT NULL
        AND pickupTimeMs >= :sinceMs
        AND paymentStatus = 'COMPLETED'
        ORDER BY pickupTimeMs ASC
        """
    )
    suspend fun getProgrammedPaid(sinceMs: Long): List<TransactionEntity>

    @Query(
        """
        UPDATE transactions
        SET paymentStatus = :status, cancelReason = :reason, cancelledAt = :cancelledAt
        WHERE id = :id
        """
    )
    suspend fun cancelTransaction(id: String, status: PaymentStatus, reason: String, cancelledAt: Long)

    @Query(
        """
        UPDATE transactions
        SET paymentStatus = :status, refundAmount = :refundAmount
        WHERE id = :id
        """
    )
    suspend fun refundTransaction(id: String, status: PaymentStatus, refundAmount: Double)

    @Query("DELETE FROM transaction_items WHERE transactionId = :transactionId")
    suspend fun deleteItemsForTransaction(transactionId: String)

    @Query("DELETE FROM transactions WHERE id = :transactionId")
    suspend fun deleteTransaction(transactionId: String)

    @Query("DELETE FROM transaction_items")
    suspend fun deleteAllItems()

    @Query("DELETE FROM transactions")
    suspend fun deleteAllTransactions()
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
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name")
    fun observeAll(): Flow<List<com.chaslay.pos.data.local.entity.CustomerEntity>>

    @Query("SELECT * FROM customers ORDER BY name")
    suspend fun getAll(): List<com.chaslay.pos.data.local.entity.CustomerEntity>

    @Query(
        """
        SELECT * FROM customers
        WHERE name LIKE '%' || :query || '%'
           OR phone LIKE '%' || :query || '%'
           OR email LIKE '%' || :query || '%'
           OR address LIKE '%' || :query || '%'
        ORDER BY name
        """
    )
    suspend fun search(query: String): List<com.chaslay.pos.data.local.entity.CustomerEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(customer: com.chaslay.pos.data.local.entity.CustomerEntity): Long

    @Update
    suspend fun update(customer: com.chaslay.pos.data.local.entity.CustomerEntity)
}

@Dao
interface BusinessSettingsDao {
    @Query("SELECT * FROM business_settings WHERE id = 1 LIMIT 1")
    fun observe(): Flow<BusinessSettingsEntity?>

    @Query("SELECT * FROM business_settings WHERE id = 1 LIMIT 1")
    suspend fun get(): BusinessSettingsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(settings: BusinessSettingsEntity)
}

@Dao
interface FloorPlanElementDao {
    @Query("SELECT * FROM floor_plan_elements WHERE floorId = :floorId ORDER BY id")
    suspend fun getByFloor(floorId: Long): List<FloorPlanElementEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(element: FloorPlanElementEntity): Long

    @Update
    suspend fun update(element: FloorPlanElementEntity)

    @Query("DELETE FROM floor_plan_elements WHERE id = :id")
    suspend fun delete(id: Long)
}

@Dao
interface TableFloorDao {
    @Query("SELECT * FROM table_floors WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<TableFloorEntity>>

    @Query("SELECT * FROM table_floors WHERE isActive = 1 ORDER BY sortOrder, name")
    suspend fun getAllActive(): List<TableFloorEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(floor: TableFloorEntity): Long

    @Update
    suspend fun update(floor: TableFloorEntity)
}

@Dao
interface RestaurantTableDao {
    @Query("SELECT * FROM restaurant_tables WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<RestaurantTableEntity>>

    @Query("SELECT * FROM restaurant_tables WHERE isActive = 1 ORDER BY sortOrder, name")
    suspend fun getAllActive(): List<RestaurantTableEntity>

    @Query("SELECT * FROM restaurant_tables WHERE isActive = 1 AND floorId = :floorId ORDER BY sortOrder, name")
    suspend fun getByFloor(floorId: Long): List<RestaurantTableEntity>

    @Query("SELECT * FROM restaurant_tables WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): RestaurantTableEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(table: RestaurantTableEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tables: List<RestaurantTableEntity>)

    @Update
    suspend fun update(table: RestaurantTableEntity)

    @Query("UPDATE restaurant_tables SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)
}

@Dao
interface TableOrderDao {
    @Query(
        """
        SELECT * FROM table_orders
        WHERE tableId = :tableId AND status IN ('OPEN', 'SENT', 'HELD')
        ORDER BY createdAt DESC
        LIMIT 1
        """
    )
    suspend fun getOpenOrderForTable(tableId: Long): TableOrderEntity?

    @Query("SELECT * FROM table_orders WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TableOrderEntity?

    @Query(
        """
        SELECT * FROM table_orders
        WHERE status IN ('OPEN', 'SENT')
        ORDER BY updatedAt DESC
        """
    )
    fun observeOpenOrders(): Flow<List<TableOrderEntity>>

    @Upsert
    suspend fun upsert(order: TableOrderEntity)

    @Query("UPDATE table_orders SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: TableOrderStatus, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM table_orders")
    suspend fun deleteAll()

    @Query("DELETE FROM table_orders WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query(
        """
        SELECT * FROM table_orders
        WHERE status IN ('OPEN', 'SENT', 'HELD')
        ORDER BY updatedAt DESC
        """
    )
    suspend fun getActiveOrders(): List<TableOrderEntity>

    @Query(
        """
        UPDATE table_orders
        SET status = 'SENT', lastSentAt = :sentAt, kitchenRound = :round, updatedAt = :sentAt
        WHERE id = :orderId
        """
    )
    suspend fun markSent(orderId: String, sentAt: Long, round: Int)
}

@Dao
interface TableOrderItemDao {
    @Query("SELECT * FROM table_order_items WHERE orderId = :orderId ORDER BY productName")
    suspend fun getByOrder(orderId: String): List<TableOrderItemEntity>

    @Query("SELECT * FROM table_order_items WHERE orderId = :orderId AND sentToKitchenAt IS NULL")
    suspend fun getUnsentByOrder(orderId: String): List<TableOrderItemEntity>

    @Query(
        """
        SELECT * FROM table_order_items
        WHERE orderId = :orderId AND sentToKitchenAt IS NULL AND courseNumber = :courseNumber
        """
    )
    suspend fun getUnsentByOrderAndCourse(orderId: String, courseNumber: Int): List<TableOrderItemEntity>

    @Query("DELETE FROM table_order_items WHERE orderId = :orderId")
    suspend fun deleteByOrder(orderId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<TableOrderItemEntity>)

    @androidx.room.Transaction
    suspend fun replaceItemsForOrder(orderId: String, items: List<TableOrderItemEntity>) {
        deleteByOrder(orderId)
        if (items.isNotEmpty()) {
            insertAll(items)
        }
    }

    @Query(
        """
        UPDATE table_order_items
        SET sentToKitchenAt = :sentAt, kitchenRound = :round
        WHERE id IN (:itemIds)
        """
    )
    suspend fun markSent(itemIds: List<String>, sentAt: Long, round: Int)

    @Query(
        """
        UPDATE table_order_items
        SET sentToKitchenAt = NULL, kitchenRound = 0
        WHERE id IN (:itemIds)
        """
    )
    suspend fun clearSentFlags(itemIds: List<String>)

    @Query("SELECT COUNT(*) FROM table_order_items WHERE orderId = :orderId")
    suspend fun countByOrder(orderId: String): Int

    @Query(
        """
        UPDATE table_order_items
        SET orderId = :targetOrderId
        WHERE id IN (:itemIds)
        """
    )
    suspend fun moveItemsToOrder(itemIds: List<String>, targetOrderId: String)

    @Query("DELETE FROM table_order_items")
    suspend fun deleteAll()
}

@Dao
interface DiscountPresetDao {
    @Query("SELECT * FROM discount_presets WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<DiscountPresetEntity>>

    @Query("SELECT * FROM discount_presets WHERE isActive = 1 ORDER BY sortOrder, name")
    suspend fun getActive(): List<DiscountPresetEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(preset: DiscountPresetEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(presets: List<DiscountPresetEntity>)

    @Query("UPDATE discount_presets SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)

    @Query("UPDATE discount_presets SET isActive = 0")
    suspend fun deactivateAll()
}

@Dao
interface PrinterConfigDao {
    @Query("SELECT * FROM printer_configs ORDER BY sortOrder, name")
    fun observeAll(): Flow<List<PrinterConfigEntity>>

    @Query("SELECT * FROM printer_configs ORDER BY sortOrder, name")
    suspend fun getAll(): List<PrinterConfigEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(printer: PrinterConfigEntity)

    @Query("DELETE FROM printer_configs WHERE id = :id")
    suspend fun delete(id: String)
}

@Dao
interface KitchenMessageDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: KitchenMessageEntity): Long

    @Query("SELECT * FROM kitchen_messages WHERE orderId = :orderId ORDER BY sentAt DESC")
    suspend fun getByOrder(orderId: String): List<KitchenMessageEntity>

    @Query("DELETE FROM kitchen_messages")
    suspend fun deleteAll()
}

@Dao
interface CancelReasonDao {
    @Query("SELECT * FROM cancel_reasons WHERE isActive = 1 ORDER BY sortOrder, label")
    suspend fun getActive(): List<com.chaslay.pos.data.local.entity.CancelReasonEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(reasons: List<com.chaslay.pos.data.local.entity.CancelReasonEntity>)
}

@Dao
interface HeldOrderDao {
    @Query(
        """
        SELECT * FROM held_orders
        WHERE status IN ('HELD', 'SENT_TO_KITCHEN')
        ORDER BY updatedAt DESC
        """
    )
    suspend fun getActive(): List<com.chaslay.pos.data.local.entity.HeldOrderEntity>

    @Query(
        """
        SELECT * FROM held_orders
        WHERE status IN ('HELD', 'SENT_TO_KITCHEN')
        AND pickupTimeMs IS NOT NULL
        ORDER BY pickupTimeMs ASC
        """
    )
    suspend fun getProgrammed(): List<com.chaslay.pos.data.local.entity.HeldOrderEntity>

    @Query("SELECT * FROM held_orders WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): com.chaslay.pos.data.local.entity.HeldOrderEntity?

    @Query("SELECT * FROM held_orders WHERE orderNumber = :orderNumber LIMIT 1")
    suspend fun getByOrderNumber(orderNumber: String): com.chaslay.pos.data.local.entity.HeldOrderEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(order: com.chaslay.pos.data.local.entity.HeldOrderEntity)

    @Query("DELETE FROM held_orders WHERE id = :id")
    suspend fun delete(id: String)

    @Query(
        """
        SELECT COUNT(*) FROM held_orders
        WHERE status IN ('HELD', 'SENT_TO_KITCHEN')
        """
    )
    suspend fun countActive(): Int

    @Query("DELETE FROM held_orders")
    suspend fun deleteAll()
}

@Dao
interface HeldOrderItemDao {
    @Query("SELECT * FROM held_order_items WHERE heldOrderId = :heldOrderId")
    suspend fun getByOrder(heldOrderId: String): List<com.chaslay.pos.data.local.entity.HeldOrderItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<com.chaslay.pos.data.local.entity.HeldOrderItemEntity>)

    @Query("DELETE FROM held_order_items WHERE heldOrderId = :heldOrderId")
    suspend fun deleteByOrder(heldOrderId: String)

    @Query("DELETE FROM held_order_items")
    suspend fun deleteAll()
}
