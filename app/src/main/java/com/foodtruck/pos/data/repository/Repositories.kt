package com.foodtruck.pos.data.repository

import com.foodtruck.pos.data.local.dao.BusinessSettingsDao
import com.foodtruck.pos.data.local.dao.CategoryDao
import com.foodtruck.pos.data.local.dao.ProductDao
import com.foodtruck.pos.data.local.dao.ProductVariantDao
import com.foodtruck.pos.data.local.dao.TransactionDao
import com.foodtruck.pos.data.local.dao.UserDao
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.local.entity.TransactionItemEntity
import com.foodtruck.pos.data.local.entity.UserEntity
import com.foodtruck.pos.domain.model.CartItem
import com.foodtruck.pos.domain.model.CartSummary
import com.foodtruck.pos.domain.model.DailySalesReport
import com.foodtruck.pos.domain.model.DashboardStats
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.ProductSalesReport
import com.foodtruck.pos.domain.model.ProductVariantModel
import com.foodtruck.pos.domain.model.ProductWithVariants
import com.foodtruck.pos.domain.model.SyncStatus
import com.foodtruck.pos.domain.model.UserPerformanceReport
import com.foodtruck.pos.domain.model.UserRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val userDao: UserDao
) {
    suspend fun loginWithPin(pin: String): UserEntity? {
        val hash = hash(pin)
        return userDao.getPinUsers().find { it.pinHash == hash && it.isActive }
    }

    suspend fun loginWithEmail(email: String, password: String): UserEntity? {
        val user = userDao.getByEmail(email) ?: return null
        val hash = hash(password)
        return if (user.passwordHash == hash) user else null
    }

    suspend fun getUser(id: Long): UserEntity? = userDao.getById(id)

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}

@Singleton
class ProductRepository @Inject constructor(
    private val productDao: ProductDao,
    private val productVariantDao: ProductVariantDao,
    private val categoryDao: CategoryDao
) {
    fun observeCategories(): Flow<List<CategoryEntity>> = categoryDao.observeActive()

    fun observeProducts(categoryId: Long?): Flow<List<ProductEntity>> =
        productDao.observeActive(categoryId)

    suspend fun getProductWithVariants(productId: Long): ProductWithVariants? {
        val product = productDao.getById(productId) ?: return null
        val variants = productVariantDao.getByProduct(productId).map { it.toModel() }
        val categories = categoryDao.observeActive().first()
        val categoryName = categories.find { it.id == product.categoryId }?.name
        return product.toModel(categoryName, variants)
    }

    suspend fun upsertProduct(product: ProductEntity, variants: List<ProductVariantEntity> = emptyList()) {
        val id = if (product.id == 0L) productDao.insert(product) else {
            productDao.update(product.copy(updatedAt = System.currentTimeMillis()))
            product.id
        }
        if (variants.isNotEmpty()) {
            productVariantDao.insertAll(variants.map { it.copy(productId = id) })
        }
    }

    private fun ProductEntity.toModel(categoryName: String?, variants: List<ProductVariantModel>) =
        ProductWithVariants(
            id = id,
            name = name,
            sku = sku,
            barcode = barcode,
            categoryId = categoryId,
            categoryName = categoryName,
            taxRate = taxRate,
            price = price,
            costPrice = costPrice,
            imageUri = imageUri,
            isActive = isActive,
            isOpenPrice = isOpenPrice,
            variants = variants
        )

    private fun ProductVariantEntity.toModel() = ProductVariantModel(
        id = id,
        name = name,
        price = price,
        sku = sku,
        barcode = barcode
    )
}

@Singleton
class TransactionRepository @Inject constructor(
    private val transactionDao: TransactionDao,
    private val settingsDao: BusinessSettingsDao
) {
    suspend fun completeSale(
        cart: CartSummary,
        paymentMethod: PaymentMethod,
        userId: Long,
        userName: String,
        cardReference: String? = null
    ): TransactionEntity {
        val settings = settingsDao.get() ?: BusinessSettingsEntity()
        val transactionId = UUID.randomUUID().toString()
        val txNumber = generateTransactionNumber()
        val receiptUrl = "${settings.receiptBaseUrl}/r/$transactionId"

        val transaction = TransactionEntity(
            id = transactionId,
            transactionNumber = txNumber,
            userId = userId,
            userName = userName,
            subtotal = cart.subtotal,
            taxTotal = cart.taxTotal,
            discountPercent = cart.discountPercent,
            discountAmount = cart.discountAmount,
            total = cart.total,
            paymentMethod = paymentMethod,
            paymentStatus = PaymentStatus.COMPLETED,
            currencyCode = settings.defaultCurrency,
            notes = cart.cartNotes,
            receiptUrl = receiptUrl,
            cardReference = cardReference,
            syncStatus = SyncStatus.PENDING
        )

        val items = cart.items.map { item ->
            TransactionItemEntity(
                transactionId = transactionId,
                productId = item.productId,
                productName = item.productName,
                variantName = item.variantName,
                sku = item.sku,
                unitPrice = item.unitPrice,
                quantity = item.quantity,
                taxRate = item.taxRate,
                lineSubtotal = item.lineSubtotal,
                lineTax = item.lineTax,
                lineTotal = item.lineTotal,
                notes = item.notes
            )
        }

        transactionDao.insertFullTransaction(transaction, items)
        return transaction
    }

    suspend fun getTransaction(id: String): Pair<TransactionEntity, List<TransactionItemEntity>>? {
        val tx = transactionDao.getById(id) ?: return null
        val items = transactionDao.getItems(id)
        return tx to items
    }

    suspend fun getDailyReport(): DailySalesReport {
        val (start, end) = dayBounds()
        val transactions = transactionDao.getTransactionsForDay(start, end)
        return DailySalesReport(
            salesCount = transactions.size,
            revenue = transactions.sumOf { it.total },
            tax = transactions.sumOf { it.taxTotal },
            cashTotal = transactions.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf { it.total },
            cardTotal = transactions.filter { it.paymentMethod != PaymentMethod.CASH }.sumOf { it.total }
        )
    }

    suspend fun getDashboardStats(): DashboardStats {
        val report = getDailyReport()
        return DashboardStats(
            todaySales = report.revenue,
            transactionCount = report.salesCount,
            cashRevenue = report.cashTotal,
            cardRevenue = report.cardTotal
        )
    }

    suspend fun getTopProducts(limit: Int = 10): List<ProductSalesReport> {
        val (start, end) = dayBounds()
        return transactionDao.getTopProducts(start, end, limit).map {
            ProductSalesReport(it.productName, it.qty, it.revenue)
        }
    }

    suspend fun getUserPerformance(): List<UserPerformanceReport> {
        val (start, end) = dayBounds()
        return transactionDao.getUserPerformance(start, end).map {
            UserPerformanceReport(it.userName, it.txCount, it.revenue)
        }
    }

    suspend fun getPendingSyncTransactions(limit: Int = 100): List<TransactionEntity> =
        transactionDao.getBySyncStatus(SyncStatus.PENDING, limit)

    suspend fun markSynced(id: String) {
        transactionDao.updateSyncStatus(id, SyncStatus.SYNCED)
    }

    private fun generateTransactionNumber(): String {
        val formatter = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US)
        return "TX-${formatter.format(System.currentTimeMillis())}-${(1000..9999).random()}"
    }

    private fun dayBounds(): Pair<Long, Long> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val start = calendar.timeInMillis
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        return start to calendar.timeInMillis
    }
}

@Singleton
class SettingsRepository @Inject constructor(
    private val settingsDao: BusinessSettingsDao
) {
    fun observeSettings(): Flow<BusinessSettingsEntity> =
        settingsDao.observe().map { it ?: BusinessSettingsEntity() }

    suspend fun getSettings(): BusinessSettingsEntity =
        settingsDao.get() ?: BusinessSettingsEntity()

    suspend fun saveSettings(settings: BusinessSettingsEntity) {
        settingsDao.upsert(settings.copy(id = 1))
    }
}

@Singleton
class CartManager @Inject constructor() {
    private val _cart = MutableStateFlow(CartSummary(emptyList()))
    val cart: Flow<CartSummary> = _cart.asStateFlow()

    fun snapshot(): CartSummary = _cart.value

    fun addItem(item: CartItem) {
        _cart.update { cart ->
            val existing = cart.items.find {
                it.productId == item.productId &&
                    it.variantName == item.variantName &&
                    it.unitPrice == item.unitPrice &&
                    it.notes == item.notes
            }
            if (existing != null) {
                cart.copy(
                    items = cart.items.map {
                        if (it.id == existing.id) it.copy(quantity = it.quantity + item.quantity) else it
                    }
                )
            } else {
                cart.copy(items = cart.items + item)
            }
        }
    }

    fun updateQuantity(itemId: String, quantity: Int) {
        _cart.update { cart ->
            if (quantity <= 0) {
                cart.copy(items = cart.items.filter { it.id != itemId })
            } else {
                cart.copy(items = cart.items.map { if (it.id == itemId) it.copy(quantity = quantity) else it })
            }
        }
    }

    fun removeItem(itemId: String) {
        _cart.update { cart -> cart.copy(items = cart.items.filter { it.id != itemId }) }
    }

    fun applyDiscount(percent: Double, amount: Double) {
        _cart.update { it.copy(discountPercent = percent, discountAmount = amount) }
    }

    fun setNotes(notes: String?) {
        _cart.update { it.copy(cartNotes = notes) }
    }

    fun clear() {
        _cart.value = CartSummary(emptyList())
    }
}
