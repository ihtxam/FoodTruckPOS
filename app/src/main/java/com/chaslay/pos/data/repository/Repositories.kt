package com.chaslay.pos.data.repository

import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.dao.ProductVariantDao
import com.chaslay.pos.data.local.dao.TransactionDao
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.dao.UserDao
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.data.local.dao.KitchenMessageDao
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.dao.TableOrderDao
import com.chaslay.pos.data.local.dao.TableOrderItemDao
import com.chaslay.pos.data.local.entity.HeldOrderEntity
import com.chaslay.pos.data.local.entity.HeldOrderItemEntity
import com.chaslay.pos.data.local.entity.KitchenMessageEntity
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.data.local.entity.TableOrderEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.local.entity.UserEntity
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.DailySalesReport
import com.chaslay.pos.domain.model.DashboardStats
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.VatBreakdownRow
import com.chaslay.pos.domain.model.PaymentMethodRow
import com.chaslay.pos.domain.model.OrderTypeRow
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.roundMoney
import com.chaslay.pos.domain.model.ProductSalesReport
import com.chaslay.pos.domain.model.BarcodeLookupResult
import com.chaslay.pos.domain.model.ProductVariantModel
import com.chaslay.pos.domain.model.ProductWithVariants
import com.chaslay.pos.domain.model.TableOrderStatus
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.domain.model.resolveVatRate
import com.chaslay.pos.domain.model.SyncStatus
import com.chaslay.pos.domain.model.UserPerformanceReport
import com.chaslay.pos.data.preferences.LicenseManager
import com.chaslay.pos.data.remote.PosAuthApi
import com.chaslay.pos.data.remote.dto.PosLoginRequest
import com.chaslay.pos.domain.model.LoginResult
import com.chaslay.pos.domain.model.PosPermission
import org.json.JSONObject
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
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
    private val userDao: UserDao,
    private val roleDao: com.chaslay.pos.data.local.dao.RoleDao,
    private val posAuthApi: PosAuthApi,
    private val licenseManager: LicenseManager
) {
    data class AuthSession(
        val user: UserEntity,
        val role: com.chaslay.pos.data.local.entity.RoleEntity
    )

    companion object {
        /** Cloud merchant users are stored locally above seeded staff IDs. */
        private const val CLOUD_USER_ID_BASE = 100_000L
    }

    suspend fun loginWithPin(pin: String): AuthSession? {
        val hash = hash(pin)
        val user = userDao.getPinUsers().find { it.pinHash == hash && it.isActive } ?: return null
        val role = roleDao.getById(user.roleId) ?: return null
        return AuthSession(user, role)
    }

    suspend fun loginWithEmail(email: String, password: String): LoginResult {
        loginLocalWithEmail(email, password)?.let { session ->
            return LoginResult.Success(session, needsPinSetup = session.user.pinHash.isNullOrBlank())
        }
        return loginCloudWithEmail(email, password)
    }

    private suspend fun loginLocalWithEmail(email: String, password: String): AuthSession? {
        val user = userDao.getByEmail(email.trim()) ?: return null
        if (!user.isActive) return null
        val hash = hash(password)
        if (user.passwordHash != hash) return null
        val role = roleDao.getById(user.roleId) ?: return null
        return AuthSession(user, role)
    }

    private suspend fun resolveTenantSlugForLogin(): String? {
        val fromLicense = licenseManager.getTenantSlug().trim()
        if (fromLicense.isNotEmpty()) return fromLicense
        val fromBuild = BuildConfig.TENANT_SLUG.trim()
        return fromBuild.takeIf { it.isNotEmpty() }
    }

    private suspend fun loginCloudWithEmail(email: String, password: String): LoginResult {
        return try {
            val response = posAuthApi.login(
                PosLoginRequest(
                    email = email.trim(),
                    password = password,
                    tenantSlug = resolveTenantSlugForLogin()
                )
            )
            if (!response.isSuccessful) {
                return LoginResult.Failure(readPosAuthError(response.code(), response.errorBody()?.string()))
            }
            val cloudUser = response.body()?.user
                ?: return LoginResult.Failure("Invalid credentials")
            cloudUser.tenantSlug?.trim()?.takeIf { it.isNotEmpty() }?.let { licenseManager.setTenantSlug(it) }
            val permissions = PosPermission.all()
            val role = com.chaslay.pos.data.local.entity.RoleEntity(
                id = 1L,
                name = "Merchant",
                permissions = PosPermission.encode(permissions),
                isSystem = true
            )
            val localId = CLOUD_USER_ID_BASE + cloudUser.id
            val existing = userDao.getById(localId)
            val user = UserEntity(
                id = localId,
                name = cloudUser.name.ifBlank { cloudUser.email },
                email = cloudUser.email.trim().lowercase(Locale.getDefault()),
                pinHash = existing?.pinHash,
                passwordHash = hash(password),
                roleId = role.id,
                isActive = true,
                biometricEnabled = existing?.biometricEnabled ?: false,
                createdAt = existing?.createdAt ?: System.currentTimeMillis()
            )
            if (existing == null) {
                userDao.insert(user)
            } else {
                userDao.update(user)
            }
            val session = AuthSession(user, role)
            LoginResult.Success(session, needsPinSetup = user.pinHash.isNullOrBlank())
        } catch (_: IOException) {
            LoginResult.Failure("No internet connection. Connect to Wi‑Fi and try again.")
        } catch (e: Exception) {
            LoginResult.Failure(e.message ?: "Login failed")
        }
    }

    private fun readPosAuthError(code: Int, raw: String?): String {
        if (!raw.isNullOrBlank()) {
            runCatching {
                JSONObject(raw).optString("error").takeIf { it.isNotBlank() }
            }.getOrNull()?.let { return it }
        }
        return when (code) {
            401 -> "Invalid email or password"
            404 -> "Login service not available. Update the server."
            else -> "Login failed (HTTP $code)"
        }
    }

    suspend fun getUser(id: Long): UserEntity? = userDao.getById(id)

    fun toUserAccess(session: AuthSession): com.chaslay.pos.domain.model.UserAccess =
        com.chaslay.pos.domain.model.UserAccess(
            roleId = session.role.id,
            roleName = session.role.name,
            permissions = com.chaslay.pos.domain.model.PosPermission.decode(session.role.permissions)
        )

    suspend fun getAllRoles(): List<com.chaslay.pos.data.local.entity.RoleEntity> = roleDao.getAll()

    suspend fun getAllUsersWithRoles(): List<Pair<UserEntity, com.chaslay.pos.data.local.entity.RoleEntity?>> {
        val roles = roleDao.getAll().associateBy { it.id }
        return userDao.getAll().map { user -> user to roles[user.roleId] }
    }

    suspend fun saveRole(
        id: Long,
        name: String,
        permissions: Set<com.chaslay.pos.domain.model.PosPermission>,
        isSystem: Boolean = false
    ): Long {
        val entity = com.chaslay.pos.data.local.entity.RoleEntity(
            id = id,
            name = name.trim(),
            permissions = com.chaslay.pos.domain.model.PosPermission.encode(permissions),
            isSystem = isSystem
        )
        return if (id == 0L) roleDao.insert(entity) else {
            roleDao.update(entity)
            id
        }
    }

    suspend fun deleteRole(id: Long): Result<Unit> = runCatching {
        roleDao.deleteCustom(id)
    }

    suspend fun saveUser(
        id: Long,
        name: String,
        email: String?,
        roleId: Long,
        pin: String?,
        password: String?,
        isActive: Boolean
    ): Long {
        val existing = if (id != 0L) userDao.getById(id) else null
        val entity = UserEntity(
            id = id,
            name = name.trim(),
            email = email?.trim()?.takeIf { it.isNotBlank() },
            pinHash = when {
                !pin.isNullOrBlank() -> hash(pin)
                existing != null -> existing.pinHash
                else -> null
            },
            passwordHash = when {
                !password.isNullOrBlank() -> hash(password)
                existing != null -> existing.passwordHash
                else -> null
            },
            roleId = roleId,
            isActive = isActive,
            biometricEnabled = existing?.biometricEnabled ?: false,
            createdAt = existing?.createdAt ?: System.currentTimeMillis()
        )
        return if (id == 0L) userDao.insert(entity) else {
            userDao.update(entity)
            id
        }
    }

    suspend fun resetUserPin(userId: Long, newPin: String) {
        val user = userDao.getById(userId) ?: return
        userDao.update(user.copy(pinHash = hash(newPin)))
    }

    suspend fun resetUserPassword(userId: Long, newPassword: String) {
        val user = userDao.getById(userId) ?: return
        userDao.update(user.copy(passwordHash = hash(newPassword)))
    }

    fun hash(value: String): String {
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

    fun observeAllProducts(): Flow<List<ProductEntity>> = productDao.observeAllActive()

    suspend fun getAllCategories(): List<CategoryEntity> = categoryDao.observeActive().first()

    suspend fun getAllProducts(): List<ProductEntity> = productDao.observeAllActive().first()

    suspend fun updateCategoryPrintTarget(categoryId: Long, printTarget: com.chaslay.pos.domain.model.PrintTarget) {
        val categories = categoryDao.observeActive().first()
        val category = categories.find { it.id == categoryId } ?: return
        categoryDao.update(category.copy(printTarget = printTarget))
    }

    suspend fun saveCategory(category: CategoryEntity): Long {
        return if (category.id == 0L) categoryDao.insert(category) else {
            categoryDao.update(category)
            category.id
        }
    }

    suspend fun deleteCategory(id: Long) {
        categoryDao.deactivate(id)
    }

    suspend fun saveProduct(product: ProductEntity): Long = upsertProduct(product)

    suspend fun deleteProduct(id: Long) {
        productDao.deactivate(id)
    }

    suspend fun upsertProduct(product: ProductEntity, variants: List<ProductVariantEntity> = emptyList()): Long {
        val id = if (product.id == 0L) productDao.insert(product) else {
            productDao.update(product.copy(updatedAt = System.currentTimeMillis()))
            product.id
        }
        return id
    }

    suspend fun getProduct(id: Long): ProductEntity? = productDao.getById(id)

    suspend fun decrementStock(productId: Long, quantity: Int) {
        if (quantity <= 0) return
        productDao.decrementStock(productId, quantity)
    }

    suspend fun findByBarcode(barcode: String): BarcodeLookupResult? {
        val trimmed = barcode.trim()
        if (trimmed.isEmpty()) return null
        productDao.getByBarcode(trimmed)?.let { product ->
            return BarcodeLookupResult(productId = product.id)
        }
        productVariantDao.getByBarcode(trimmed)?.let { variant ->
            return BarcodeLookupResult(
                productId = variant.productId,
                variantId = variant.id,
                variantName = variant.name,
                variantPrice = variant.price
            )
        }
        return null
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
class CustomerRepository @Inject constructor(
    private val customerDao: com.chaslay.pos.data.local.dao.CustomerDao
) {
    fun observeAll(): Flow<List<com.chaslay.pos.data.local.entity.CustomerEntity>> =
        customerDao.observeAll()

    suspend fun getAll(): List<com.chaslay.pos.data.local.entity.CustomerEntity> =
        customerDao.getAll()

    suspend fun search(query: String): List<com.chaslay.pos.data.local.entity.CustomerEntity> {
        val trimmed = query.trim()
        return if (trimmed.isEmpty()) customerDao.getAll() else customerDao.search(trimmed)
    }

    suspend fun save(customer: com.chaslay.pos.data.local.entity.CustomerEntity): Long {
        return if (customer.id == 0L) {
            customerDao.insert(customer)
        } else {
            customerDao.update(customer)
            customer.id
        }
    }
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
        cardReference: String? = null,
        tipAmount: Double = 0.0,
        roundingAmount: Double = 0.0,
        checkoutDiscountPercent: Double = 0.0,
        overrideTotal: Double? = null,
        masterOrderId: String? = null,
        splitCheckNumber: Int? = null,
        amountTendered: Double? = null,
        changeDue: Double? = null,
        transactionId: String? = null,
        receiptUrl: String? = null
    ): TransactionEntity {
        val settings = settingsDao.get() ?: BusinessSettingsEntity()
        val resolvedTransactionId = transactionId ?: UUID.randomUUID().toString()
        val txNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() } ?: generateTransactionNumber()
        val resolvedReceiptUrl = receiptUrl
            ?: "${settings.receiptBaseUrl.trim().trimEnd('/')}/$resolvedTransactionId"

        val subtotal = cart.subtotal
        val itemDiscount = cart.itemDiscountTotal
        val checkoutDiscount = if (checkoutDiscountPercent > 0) {
            (subtotal - itemDiscount) * (checkoutDiscountPercent / 100.0)
        } else 0.0
        val discountPercent = when {
            checkoutDiscountPercent > 0 -> checkoutDiscountPercent
            cart.discountPercent > 0 -> cart.discountPercent
            else -> 0.0
        }
        val discountAmount = when {
            checkoutDiscountPercent > 0 -> checkoutDiscount
            cart.discountPercent > 0 -> (subtotal - itemDiscount) * (cart.discountPercent / 100.0)
            cart.discountAmount > 0 -> cart.discountAmount
            else -> 0.0
        }
        val baseTotal = if (cart.vatIncludedInPrice) {
            (subtotal - itemDiscount - discountAmount).coerceAtLeast(0.0)
        } else {
            (subtotal + cart.taxTotal - itemDiscount - discountAmount).coerceAtLeast(0.0)
        }
        val finalTotal = roundMoney(
            overrideTotal ?: (baseTotal + tipAmount + roundingAmount)
        ).coerceAtLeast(0.0)

        val transaction = TransactionEntity(
            id = resolvedTransactionId,
            transactionNumber = txNumber,
            userId = userId,
            userName = userName,
            subtotal = subtotal,
            taxTotal = cart.taxTotal,
            discountPercent = discountPercent,
            discountAmount = discountAmount,
            tipAmount = tipAmount,
            roundingAmount = roundingAmount,
            total = finalTotal,
            paymentMethod = paymentMethod,
            paymentStatus = PaymentStatus.COMPLETED,
            currencyCode = settings.defaultCurrency,
            notes = buildOrderNotes(cart),
            receiptUrl = resolvedReceiptUrl,
            cardReference = cardReference,
            tableId = cart.tableId,
            serviceType = cart.serviceType,
            syncStatus = SyncStatus.PENDING,
            masterOrderId = masterOrderId,
            splitCheckNumber = splitCheckNumber,
            amountTendered = amountTendered,
            changeDue = changeDue,
            pickupTimeMs = cart.pickupTimeMs
        )

        val items = cart.items.map { item ->
            TransactionItemEntity(
                transactionId = resolvedTransactionId,
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
                originalUnitPrice = item.originalUnitPrice ?: item.catalogUnitPrice,
                lineDiscountPerUnit = item.lineDiscountPerUnit,
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

    suspend fun updateReceiptUrl(transactionId: String, url: String) {
        transactionDao.updateReceiptUrl(transactionId, url)
    }

    suspend fun getTransactionsBetween(start: Long, end: Long): List<TransactionEntity> =
        transactionDao.getAllInRange(start, end)

    suspend fun getDailyReport(): DailySalesReport {
        val (start, end) = dayBounds()
        val transactions = transactionDao.getTransactionsForDay(start, end)
        return DailySalesReport(
            salesCount = transactions.size,
            revenue = roundMoney(transactions.sumOf { it.total }),
            tax = roundMoney(transactions.sumOf { it.taxTotal }),
            cashTotal = roundMoney(transactions.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf { it.total }),
            cardTotal = roundMoney(transactions.filter { it.paymentMethod != PaymentMethod.CASH }.sumOf { it.total })
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
            ProductSalesReport(it.productName, it.qty, roundMoney(it.revenue))
        }
    }

    suspend fun getProductsSold(start: Long, end: Long): List<ProductSalesReport> =
        transactionDao.getProductsSold(start, end).map {
            ProductSalesReport(it.productName, it.qty, roundMoney(it.revenue))
        }

    suspend fun getUserPerformance(): List<UserPerformanceReport> {
        val (start, end) = dayBounds()
        return transactionDao.getUserPerformance(start, end).map {
            UserPerformanceReport(it.userName, it.txCount, roundMoney(it.revenue))
        }
    }

    suspend fun getEndOfDayReport(): EndOfDayReport {
        val (start, end) = dayBounds()
        val transactions = transactionDao.getTransactionsForDay(start, end)
        return buildEndOfDayReport(transactions, start, end)
    }

    suspend fun getEndOfDayReport(start: Long, end: Long): EndOfDayReport {
        val transactions = transactionDao.searchTransactions(start, end, null, null)
        return buildEndOfDayReport(transactions, start, end)
    }

    suspend fun buildEndOfDayReport(
        transactions: List<TransactionEntity>,
        start: Long,
        end: Long
    ): EndOfDayReport {
        val settings = settingsDao.get() ?: BusinessSettingsEntity()
        val completed = transactions.filter { it.paymentStatus == PaymentStatus.COMPLETED }

        // Brut (taxable gross incl. VAT) excludes tips because tips are not taxable.
        fun brutOf(tx: TransactionEntity) = (tx.total - tx.tipAmount).coerceAtLeast(0.0)

        val vatRows = completed
            .groupBy { it.serviceType ?: ServiceType.TAKEAWAY }
            .map { (serviceType, txs) ->
                val brut = roundMoney(txs.sumOf { brutOf(it) })
                val tva = roundMoney(txs.sumOf { it.taxTotal })
                val rate = when (serviceType) {
                    ServiceType.DINE_IN -> settings.dineInVatRate
                    ServiceType.TAKEAWAY -> settings.takeawayVatRate
                }
                VatBreakdownRow(
                    label = "${serviceType.displayName} ${"%.1f".format(rate)}%",
                    rate = rate,
                    net = roundMoney(brut - tva),
                    tva = tva,
                    brut = brut
                )
            }
            .sortedByDescending { it.brut }

        val brutTotal = roundMoney(vatRows.sumOf { it.brut })
        val tvaTotal = roundMoney(vatRows.sumOf { it.tva })
        val netTotal = roundMoney(brutTotal - tvaTotal)
        val tipsTotal = roundMoney(completed.sumOf { it.tipAmount })
        val grandTotal = roundMoney(brutTotal + tipsTotal)

        val paymentRows = listOf(
            "Cash" to completed.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf { it.total },
            "Card" to completed.filter {
                it.paymentMethod == PaymentMethod.CARD || it.paymentMethod == PaymentMethod.ADYEN_TERMINAL
            }.sumOf { it.total },
            "Tap-to-Pay" to completed.filter { it.paymentMethod == PaymentMethod.TAP_TO_PAY }.sumOf { it.total }
        ).map { (label, amount) ->
            val roundedAmount = roundMoney(amount)
            PaymentMethodRow(
                label = label,
                amount = roundedAmount,
                percent = if (grandTotal > 0) roundMoney(roundedAmount / grandTotal * 100.0) else 0.0
            )
        }

        val orderTypeRows = ServiceType.entries.map { serviceType ->
            val txs = completed.filter { it.serviceType == serviceType }
            val amount = roundMoney(txs.sumOf { brutOf(it) })
            OrderTypeRow(
                label = serviceType.displayName,
                count = txs.size,
                percent = if (completed.isNotEmpty()) roundMoney(txs.size.toDouble() / completed.size * 100.0) else 0.0,
                amount = amount
            )
        }

        val productsSold = transactionDao.getProductsSold(start, end).map {
            ProductSalesReport(it.productName, it.qty, roundMoney(it.revenue))
        }

        return EndOfDayReport(
            periodStart = start,
            periodEnd = end,
            salesCount = completed.size,
            revenue = roundMoney(completed.sumOf { it.total }),
            taxTotal = tvaTotal,
            subtotal = brutTotal,
            netTotal = netTotal,
            brutTotal = brutTotal,
            tipsTotal = tipsTotal,
            grandTotal = grandTotal,
            vatRows = vatRows,
            paymentRows = paymentRows,
            orderTypeRows = orderTypeRows,
            cashTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf { it.total }),
            cardTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.CARD }.sumOf { it.total }),
            tapToPayTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.TAP_TO_PAY }.sumOf { it.total }),
            adyenTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.ADYEN_TERMINAL }.sumOf { it.total }),
            dineInTotal = roundMoney(completed.filter { it.serviceType == ServiceType.DINE_IN }.sumOf { brutOf(it) }),
            dineInCount = completed.count { it.serviceType == ServiceType.DINE_IN },
            takeawayTotal = roundMoney(completed.filter { it.serviceType == ServiceType.TAKEAWAY }.sumOf { brutOf(it) }),
            takeawayCount = completed.count { it.serviceType == ServiceType.TAKEAWAY },
            productsSold = productsSold
        )
    }

    suspend fun getPendingSyncTransactions(limit: Int = 100): List<TransactionEntity> =
        transactionDao.getBySyncStatus(SyncStatus.PENDING, limit)

    suspend fun markSynced(id: String) {
        transactionDao.updateSyncStatus(id, SyncStatus.SYNCED)
    }

    /** Deletes ALL completed/cancelled sales history. Irreversible. */
    suspend fun clearAllTransactions() {
        transactionDao.deleteAllItems()
        transactionDao.deleteAllTransactions()
    }

    suspend fun searchOrders(
        startMs: Long,
        endMs: Long,
        paymentMethod: PaymentMethod?,
        serviceType: ServiceType?
    ): List<TransactionEntity> = transactionDao.searchTransactions(startMs, endMs, paymentMethod, serviceType)

    suspend fun cancelOrder(transactionId: String, reason: String) {
        transactionDao.cancelTransaction(
            id = transactionId,
            status = PaymentStatus.CANCELLED,
            reason = reason,
            cancelledAt = System.currentTimeMillis()
        )
    }

    /** Permanently removes an order and its line items from local history and reports. */
    suspend fun deleteOrderPermanently(transactionId: String) {
        deleteOrdersByIds(collectOrderDeleteIds(transactionId))
    }

    suspend fun countOrdersInRange(startMs: Long, endMs: Long): Int =
        transactionDao.getAllInRange(startMs, endMs).size

    /** Permanently removes every order in the date range from history and reports. */
    suspend fun deleteOrdersInRange(startMs: Long, endMs: Long): Int {
        val orders = transactionDao.getAllInRange(startMs, endMs)
        val idsToDelete = linkedSetOf<String>()
        orders.forEach { tx ->
            idsToDelete.addAll(collectRelatedOrderIds(tx))
        }
        deleteOrdersByIds(idsToDelete)
        return idsToDelete.size
    }

    private suspend fun collectOrderDeleteIds(transactionId: String): Set<String> {
        val tx = transactionDao.getById(transactionId) ?: return emptySet()
        return collectRelatedOrderIds(tx)
    }

    private suspend fun collectRelatedOrderIds(tx: TransactionEntity): Set<String> {
        val masterKey = tx.masterOrderId ?: tx.id
        val related = transactionDao.getByMasterOrderId(masterKey)
        return if (related.isNotEmpty()) {
            related.map { it.id }.toSet() + masterKey
        } else {
            setOf(tx.id)
        }
    }

    private suspend fun deleteOrdersByIds(ids: Set<String>) {
        ids.forEach { id ->
            transactionDao.deleteItemsForTransaction(id)
            transactionDao.deleteTransaction(id)
        }
    }

    /** Records a cancelled open order in sales history (kitchen sent or receipt printed). */
    suspend fun recordCancelledOrder(
        cart: CartSummary,
        userId: Long,
        userName: String,
        reason: String
    ): TransactionEntity {
        val settings = settingsDao.get() ?: BusinessSettingsEntity()
        val transactionId = UUID.randomUUID().toString()
        val txNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() } ?: generateTransactionNumber()
        val subtotal = cart.subtotal
        val itemDiscount = cart.itemDiscountTotal
        val discountAmount = when {
            cart.discountPercent > 0 -> (subtotal - itemDiscount) * (cart.discountPercent / 100.0)
            cart.discountAmount > 0 -> cart.discountAmount
            else -> 0.0
        }
        val discountPercent = if (cart.discountPercent > 0) cart.discountPercent else 0.0
        val finalTotal = if (cart.vatIncludedInPrice) {
            roundMoney((subtotal - itemDiscount - discountAmount).coerceAtLeast(0.0))
        } else {
            roundMoney((subtotal + cart.taxTotal - itemDiscount - discountAmount).coerceAtLeast(0.0))
        }
        val cancelledAt = System.currentTimeMillis()
        val transaction = TransactionEntity(
            id = transactionId,
            transactionNumber = txNumber,
            userId = userId,
            userName = userName,
            subtotal = subtotal,
            taxTotal = cart.taxTotal,
            discountPercent = discountPercent,
            discountAmount = discountAmount,
            total = finalTotal,
            paymentMethod = PaymentMethod.PAY_LATER,
            paymentStatus = PaymentStatus.CANCELLED,
            currencyCode = settings.defaultCurrency,
            notes = buildOrderNotes(cart),
            tableId = cart.tableId,
            serviceType = cart.serviceType,
            syncStatus = SyncStatus.PENDING,
            cancelReason = reason,
            cancelledAt = cancelledAt,
            pickupTimeMs = cart.pickupTimeMs,
            createdAt = cancelledAt
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
                originalUnitPrice = item.originalUnitPrice ?: item.catalogUnitPrice,
                lineDiscountPerUnit = item.lineDiscountPerUnit,
                notes = item.notes
            )
        }
        transactionDao.insertFullTransaction(transaction, items)
        return transaction
    }

    suspend fun refundOrder(transactionId: String, amount: Double, fullRefund: Boolean) {
        val tx = transactionDao.getById(transactionId) ?: return
        val refundAmount = if (fullRefund) tx.total else amount.coerceIn(0.0, tx.total)
        val status = if (fullRefund || refundAmount >= tx.total) {
            PaymentStatus.REFUNDED
        } else {
            PaymentStatus.PARTIALLY_REFUNDED
        }
        transactionDao.refundTransaction(transactionId, status, refundAmount)
    }

    suspend fun getOrdersByMasterId(masterOrderId: String): List<TransactionEntity> =
        transactionDao.getByMasterOrderId(masterOrderId)

    suspend fun getProgrammedPaidOrders(sinceMs: Long): List<TransactionEntity> =
        transactionDao.getProgrammedPaid(sinceMs)

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
    private val settingsDao: BusinessSettingsDao,
    private val discountPresetDao: com.chaslay.pos.data.local.dao.DiscountPresetDao,
    private val printerConfigDao: com.chaslay.pos.data.local.dao.PrinterConfigDao
) {
    fun observeSettings(): Flow<BusinessSettingsEntity> =
        settingsDao.observe().map { it ?: BusinessSettingsEntity() }

    suspend fun getSettings(): BusinessSettingsEntity =
        settingsDao.get() ?: BusinessSettingsEntity()

    suspend fun saveSettings(settings: BusinessSettingsEntity) {
        settingsDao.upsert(settings.copy(id = 1))
    }

    fun observeDiscountPresets(): Flow<List<com.chaslay.pos.domain.model.DiscountPreset>> =
        discountPresetDao.observeActive().map { list ->
            list.map { com.chaslay.pos.domain.model.DiscountPreset(it.id, it.name, it.percent) }
        }

    suspend fun getDiscountPresets(): List<com.chaslay.pos.domain.model.DiscountPreset> =
        discountPresetDao.getActive().map { com.chaslay.pos.domain.model.DiscountPreset(it.id, it.name, it.percent) }

    suspend fun saveDiscountPreset(name: String, percent: Double): Long {
        val presets = discountPresetDao.getActive()
        val sortOrder = (presets.maxOfOrNull { it.sortOrder } ?: 0) + 1
        return discountPresetDao.insert(
            com.chaslay.pos.data.local.entity.DiscountPresetEntity(
                name = name.trim(),
                percent = percent,
                sortOrder = sortOrder
            )
        )
    }

    suspend fun deleteDiscountPreset(id: Long) {
        discountPresetDao.deactivate(id)
    }

    fun observePrinters(): Flow<List<com.chaslay.pos.data.local.entity.PrinterConfigEntity>> =
        printerConfigDao.observeAll()

    suspend fun getPrinters(): List<com.chaslay.pos.data.local.entity.PrinterConfigEntity> =
        printerConfigDao.getAll()

    suspend fun savePrinter(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity) {
        printerConfigDao.upsert(printer)
    }

    suspend fun deletePrinter(id: String) {
        printerConfigDao.delete(id)
    }
}

@Singleton
class CartManager @Inject constructor() {
    private val _cart = MutableStateFlow(CartSummary(emptyList()))
    val cart: Flow<CartSummary> = _cart.asStateFlow()

    fun snapshot(): CartSummary = _cart.value

    fun addItem(item: CartItem) {
        _cart.update { cart ->
            val stamped = item.copy(vatIncludedInPrice = cart.vatIncludedInPrice)
            val canMerge = cart.tableOrderId == null && !stamped.sentToKitchen
            val existing = if (canMerge) {
                cart.items.find {
                    it.productId == stamped.productId &&
                        it.variantName == stamped.variantName &&
                        it.unitPrice == stamped.unitPrice &&
                        it.modifiers == stamped.modifiers &&
                        it.addons == stamped.addons &&
                        it.notes == stamped.notes &&
                        it.courseNumber == stamped.courseNumber &&
                        it.splitCheck == stamped.splitCheck &&
                        !it.sentToKitchen
                }
            } else null
            if (existing != null) {
                cart.copy(
                    items = cart.items.map {
                        if (it.id == existing.id) it.copy(quantity = it.quantity + stamped.quantity) else it
                    }
                )
            } else {
                val enriched = when {
                    cart.tableOrderId != null -> stamped.copy(courseNumber = cart.activeCourse)
                    cart.splitByItems && cart.splitCount > 1 -> stamped.copy(splitCheck = cart.activeSplitCheck)
                    else -> stamped
                }
                cart.copy(items = cart.items + enriched)
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

    fun replaceItem(itemId: String, item: CartItem) {
        _cart.update { cart ->
            cart.copy(items = cart.items.map { if (it.id == itemId) item else it })
        }
    }

    fun removeItem(itemId: String) {
        _cart.update { cart -> cart.copy(items = cart.items.filter { it.id != itemId }) }
    }

    fun overrideItemPrice(itemId: String, newPrice: Double) {
        _cart.update { cart ->
            cart.copy(
                items = cart.items.map { item ->
                    if (item.id != itemId) return@map item
                    val original = item.originalUnitPrice ?: item.unitPrice
                    if (newPrice >= original) {
                        item.copy(
                            unitPrice = newPrice,
                            originalUnitPrice = null,
                            lineDiscountPerUnit = 0.0,
                            notes = null
                        )
                    } else {
                        val discount = original - newPrice
                        item.copy(
                            unitPrice = newPrice,
                            originalUnitPrice = original,
                            lineDiscountPerUnit = discount,
                            notes = "Adjusted from ${"%.2f".format(original)}"
                        )
                    }
                }
            )
        }
    }

    fun addMiscItem(name: String, price: Double, taxRate: Double = 2.6, categoryId: Long? = null) {
        val cart = snapshot()
        addItem(
            CartItem(
                id = java.util.UUID.randomUUID().toString(),
                productId = 0L,
                productName = name,
                unitPrice = price,
                quantity = 1,
                taxRate = taxRate,
                categoryId = categoryId,
                vatIncludedInPrice = cart.vatIncludedInPrice
            )
        )
    }

    fun setActiveCourse(course: Int) {
        _cart.update { it.copy(activeCourse = course.coerceAtLeast(1)) }
    }

    fun addCourse() {
        _cart.update { it.copy(courseCount = it.courseCount + 1, activeCourse = it.courseCount + 1) }
    }

    fun increaseSplitCount() {
        _cart.update {
            val next = (it.splitCount + 1).coerceAtMost(8)
            it.copy(splitCount = next, activeSplitCheck = it.activeSplitCheck.coerceAtMost(next))
        }
    }

    fun decreaseSplitCount() {
        _cart.update {
            val next = (it.splitCount - 1).coerceAtLeast(1)
            it.copy(
                splitCount = next,
                activeSplitCheck = it.activeSplitCheck.coerceAtMost(next),
                splitByItems = if (next == 1) false else it.splitByItems
            )
        }
    }

    fun setSplitByItems(enabled: Boolean) {
        _cart.update { it.copy(splitByItems = enabled && it.splitCount > 1, activeSplitCheck = 1) }
    }

    fun setActiveSplitCheck(check: Int) {
        _cart.update { cart ->
            cart.copy(activeSplitCheck = check.coerceIn(1, cart.splitCount.coerceAtLeast(1)))
        }
    }

    fun assignItemsToCheck(itemIds: Set<String>, check: Int) {
        _cart.update { cart ->
            val targetCheck = check.coerceIn(1, cart.splitCount.coerceAtLeast(1))
            cart.copy(
                items = cart.items.map { item ->
                    if (item.id in itemIds) item.copy(splitCheck = targetCheck) else item
                }
            )
        }
    }

    fun assignItemSplitCheck(itemId: String, check: Int) {
        _cart.update { cart ->
            cart.copy(
                items = cart.items.map { item ->
                    if (item.id == itemId) item.copy(splitCheck = check.coerceIn(1, cart.splitCount)) else item
                }
            )
        }
    }

    fun applyItemDiscountPercent(itemId: String, percent: Double) {
        if (percent <= 0.0) return
        _cart.update { cart ->
            cart.copy(
                items = cart.items.map { item ->
                    if (item.id != itemId) return@map item
                    val original = item.originalUnitPrice ?: item.unitPrice
                    val discounted = (original * (1 - percent / 100.0)).coerceAtLeast(0.0)
                    item.copy(
                        unitPrice = discounted,
                        originalUnitPrice = original,
                        lineDiscountPerUnit = original - discounted,
                        notes = "${percent.toInt()}% off"
                    )
                }
            )
        }
    }

    fun resetSplit() {
        _cart.update { cart ->
            cart.copy(
                splitCount = 1,
                splitByItems = false,
                activeSplitCheck = 1,
                items = cart.items.map { it.copy(splitCheck = 1) }
            )
        }
    }

    fun paymentSnapshot(): CartSummary {
        val cart = snapshot()
        return if (cart.splitByItems && cart.splitCount > 1) {
            val checkItems = cart.items.filter { it.splitCheck == cart.activeSplitCheck }
            cart.copy(items = checkItems)
        } else {
            cart
        }
    }

    fun removeItemsAfterPayment(paidItemIds: Set<String>) {
        _cart.update { cart ->
            val remaining = cart.items.filterNot { it.id in paidItemIds }
            cart.copy(items = remaining)
        }
    }

    fun applyDiscount(percent: Double, amount: Double) {
        _cart.update { it.copy(discountPercent = percent, discountAmount = amount) }
    }

    fun setNotes(notes: String?) {
        _cart.update { it.copy(cartNotes = notes) }
    }

    fun setServiceType(serviceType: ServiceType, rateResolver: (CartItem) -> Double) {
        _cart.update { cart ->
            cart.copy(
                serviceType = serviceType,
                items = cart.items.map { item ->
                    val rate = rateResolver(item)
                    if (item.taxRate == rate) item else item.copy(taxRate = rate)
                }
            )
        }
    }

    fun setVatIncludedInPrice(included: Boolean) {
        _cart.update { cart ->
            if (cart.vatIncludedInPrice == included && cart.items.all { it.vatIncludedInPrice == included }) {
                cart
            } else {
                cart.copy(
                    vatIncludedInPrice = included,
                    items = cart.items.map { it.copy(vatIncludedInPrice = included) }
                )
            }
        }
    }

    fun loadTableOrder(
        tableId: Long,
        tableName: String,
        orderId: String,
        serviceType: ServiceType,
        items: List<CartItem>,
        discountPercent: Double,
        discountAmount: Double,
        courseCount: Int = 1,
        activeCourse: Int = 1,
        vatIncludedInPrice: Boolean? = null
    ) {
        val included = vatIncludedInPrice ?: _cart.value.vatIncludedInPrice
        val maxCourse = items.maxOfOrNull { it.courseNumber } ?: 1
        _cart.value = CartSummary(
            items = items.map { it.copy(vatIncludedInPrice = included) },
            discountPercent = discountPercent,
            discountAmount = discountAmount,
            serviceType = serviceType,
            tableId = tableId,
            tableOrderId = orderId,
            tableName = tableName,
            activeCourse = activeCourse,
            courseCount = maxOf(courseCount, maxCourse),
            vatIncludedInPrice = included
        )
    }

    fun setTableOrderId(orderId: String) {
        _cart.update { it.copy(tableOrderId = orderId) }
    }

    fun refreshSentFlags(sentByItemId: Map<String, Boolean>) {
        _cart.update { cart ->
            cart.copy(
                items = cart.items.map { item ->
                    val sent = sentByItemId[item.id] ?: item.sentToKitchen
                    if (item.sentToKitchen == sent) item else item.copy(sentToKitchen = sent)
                }
            )
        }
    }

    fun clearTableContext() {
        _cart.update {
            it.copy(
                tableId = null,
                tableOrderId = null,
                tableName = null,
                serviceType = ServiceType.TAKEAWAY
            )
        }
    }

    fun clear() {
        _cart.update { cart ->
            CartSummary(
                items = emptyList(),
                vatIncludedInPrice = cart.vatIncludedInPrice,
                serviceType = cart.serviceType
            )
        }
    }

    fun setPickupOrder(orderNumber: String, pickupTimeMs: Long?) {
        _cart.update {
            it.copy(
                fulfillmentType = FulfillmentType.PICKUP,
                orderNumber = orderNumber,
                pickupTimeMs = pickupTimeMs,
                tableId = null,
                tableOrderId = null,
                tableName = null,
                serviceType = ServiceType.TAKEAWAY,
                deliveryName = null,
                deliveryAddress = null,
                deliveryZip = null,
                deliveryPhone = null
            )
        }
    }

    fun setCustomerInfo(
        name: String,
        phone: String?,
        email: String? = null,
        address: String? = null,
        zip: String? = null
    ) {
        _cart.update {
            it.copy(
                deliveryName = name,
                deliveryPhone = phone,
                deliveryAddress = address,
                deliveryZip = zip,
                cartNotes = email?.takeIf { e -> e.isNotBlank() } ?: it.cartNotes
            )
        }
    }

    fun setDeliveryOrder(
        name: String,
        address: String,
        zip: String,
        phone: String,
        orderNumber: String,
        deliveryTimeMs: Long? = null
    ) {
        _cart.update {
            it.copy(
                fulfillmentType = FulfillmentType.DELIVERY,
                orderNumber = orderNumber,
                pickupTimeMs = deliveryTimeMs,
                deliveryName = name,
                deliveryAddress = address,
                deliveryZip = zip,
                deliveryPhone = phone,
                tableId = null,
                tableOrderId = null,
                tableName = null,
                serviceType = ServiceType.TAKEAWAY
            )
        }
    }

    fun ensureOrderNumber(): String {
        val current = _cart.value.orderNumber
        if (!current.isNullOrBlank()) return current
        val generated = "P-${System.currentTimeMillis().toString().takeLast(6)}"
        _cart.update { it.copy(orderNumber = generated) }
        return generated
    }
}

@Singleton
class TableOrderRepository @Inject constructor(
    private val tableDao: RestaurantTableDao,
    private val orderDao: TableOrderDao,
    private val orderItemDao: TableOrderItemDao,
    private val kitchenMessageDao: KitchenMessageDao,
    private val settingsDao: BusinessSettingsDao
) {
    fun observeTables(): Flow<List<RestaurantTableEntity>> = tableDao.observeActive()

    fun observeOpenOrders(): Flow<List<TableOrderEntity>> = orderDao.observeOpenOrders()

    /** Deletes ALL table orders, their items and kitchen messages. Irreversible. */
    suspend fun clearAllOrders() {
        kitchenMessageDao.deleteAll()
        orderItemDao.deleteAll()
        orderDao.deleteAll()
    }

    suspend fun getTablesWithStatus(): List<TableWithOrderInfo> {
        val tables = tableDao.observeActive().first()
        return tables.map { table ->
            val order = orderDao.getOpenOrderForTable(table.id)
            val items = order?.let { orderItemDao.getByOrder(it.id) }.orEmpty()
            val cartItems = items.map { it.toCartItem() }
            val total = CartSummary(cartItems).total
            val unsentQty = items.filter { it.sentToKitchenAt == null }.sumOf { it.quantity }
            val sentQty = items.filter { it.sentToKitchenAt != null }.sumOf { it.quantity }
            val status = when {
                order == null || items.isEmpty() -> TableStatus.FREE
                sentQty > 0 || order.lastSentAt != null -> TableStatus.OCCUPIED
                else -> TableStatus.ACTIVE
            }
            TableWithOrderInfo(
                id = table.id,
                name = table.name,
                sortOrder = table.sortOrder,
                openOrderId = order?.id,
                itemCount = items.sumOf { it.quantity },
                unsentItemCount = unsentQty,
                sentItemCount = sentQty,
                orderTotal = total,
                status = status
            )
        }
    }

    suspend fun openTable(
        table: RestaurantTableEntity,
        serviceType: ServiceType,
        userId: Long,
        userName: String
    ): Pair<TableOrderEntity, List<CartItem>> {
        val existing = orderDao.getOpenOrderForTable(table.id)
        if (existing != null) {
            val items = orderItemDao.getByOrder(existing.id).map { it.toCartItem() }
            return existing to items
        }
        val order = TableOrderEntity(
            id = UUID.randomUUID().toString(),
            tableId = table.id,
            serviceType = serviceType,
            status = TableOrderStatus.OPEN,
            userId = userId,
            userName = userName
        )
        orderDao.upsert(order)
        return order to emptyList()
    }

    suspend fun syncCartToTable(cart: CartSummary, userId: Long, userName: String): String {
        val tableId = cart.tableId ?: error("No table selected")
        val table = tableDao.getById(tableId) ?: error("Table not found")
        val orderId = cart.tableOrderId ?: openTable(table, cart.serviceType, userId, userName).first.id
        val order = orderDao.getById(orderId) ?: error("Order not found")
        val existingItems = orderItemDao.getByOrder(orderId)
        val sentById = existingItems.filter { it.sentToKitchenAt != null }.associateBy { it.id }

        val items = cart.items.map { item ->
            val sent = sentById[item.id]
            val preserveSent = sent?.sentToKitchenAt != null
            TableOrderItemEntity(
                id = item.id,
                orderId = orderId,
                productId = item.productId,
                productName = item.productName,
                variantName = item.variantName,
                sku = item.sku,
                unitPrice = item.unitPrice,
                quantity = item.quantity,
                taxRate = item.taxRate,
                originalUnitPrice = item.originalUnitPrice,
                lineDiscountPerUnit = item.lineDiscountPerUnit,
                notes = item.notes,
                sentToKitchenAt = if (item.sentToKitchen) sent?.sentToKitchenAt else null,
                kitchenRound = if (item.sentToKitchen && sent?.sentToKitchenAt != null) sent.kitchenRound else 0,
                courseNumber = item.courseNumber.coerceAtLeast(1)
            )
        }
        // Update the order row BEFORE writing items. (Even though upsert now updates in
        // place, keeping this order avoids any chance of a cascade wiping the items.)
        orderDao.upsert(
            order.copy(
                serviceType = cart.serviceType,
                discountPercent = cart.discountPercent,
                discountAmount = cart.discountAmount,
                notes = cart.cartNotes,
                status = when (order.status) {
                    TableOrderStatus.PAID -> TableOrderStatus.OPEN
                    TableOrderStatus.HELD -> TableOrderStatus.OPEN
                    else -> order.status
                },
                updatedAt = System.currentTimeMillis()
            )
        )
        orderItemDao.replaceItemsForOrder(orderId, items)
        return orderId
    }

    suspend fun resolveUnsentForKitchen(
        orderId: String,
        courseNumber: Int? = null
    ): List<TableOrderItemEntity> = getUnsentKitchenItems(orderId, courseNumber)

    suspend fun clearSentFlags(orderId: String, itemIds: Set<String>) {
        if (itemIds.isEmpty()) return
        orderItemDao.clearSentFlags(itemIds.toList())
    }

    suspend fun getUnsentKitchenItems(orderId: String, courseNumber: Int? = null): List<TableOrderItemEntity> {
        orderDao.getById(orderId) ?: error("Order not found")
        return if (courseNumber != null) {
            orderItemDao.getUnsentByOrderAndCourse(orderId, courseNumber)
        } else {
            orderItemDao.getUnsentByOrder(orderId)
        }
    }

    suspend fun markItemsSentToKitchen(orderId: String, items: List<TableOrderItemEntity>): Int {
        if (items.isEmpty()) return orderDao.getById(orderId)?.kitchenRound ?: 0
        val order = orderDao.getById(orderId) ?: error("Order not found")
        val sentAt = System.currentTimeMillis()
        val round = order.kitchenRound + 1
        orderItemDao.markSent(items.map { it.id }, sentAt, round)
        orderDao.markSent(orderId, sentAt, round)
        return round
    }

    suspend fun sendToKitchen(orderId: String, courseNumber: Int? = null): Pair<Int, List<TableOrderItemEntity>> {
        val unsent = getUnsentKitchenItems(orderId, courseNumber)
        if (unsent.isEmpty()) {
            val order = orderDao.getById(orderId) ?: error("Order not found")
            return order.kitchenRound to emptyList()
        }
        val round = markItemsSentToKitchen(orderId, unsent)
        return round to unsent
    }

    suspend fun addKitchenMessage(
        orderId: String,
        tableId: Long,
        tableName: String,
        message: String
    ): KitchenMessageEntity {
        val entity = KitchenMessageEntity(
            orderId = orderId,
            tableId = tableId,
            tableName = tableName,
            message = message
        )
        kitchenMessageDao.insert(entity)
        return entity
    }

    suspend fun closeOrder(orderId: String) {
        orderDao.updateStatus(orderId, TableOrderStatus.PAID)
    }

    suspend fun voidOpenOrder(orderId: String, reason: String) {
        val order = orderDao.getById(orderId) ?: return
        val table = tableDao.getById(order.tableId)
        if (table != null) {
            addKitchenMessage(orderId, table.id, table.name, "ORDER CANCELLED: $reason")
        }
        orderItemDao.deleteByOrder(orderId)
        orderDao.deleteById(orderId)
    }

    suspend fun getTable(tableId: Long): RestaurantTableEntity? = tableDao.getById(tableId)

    suspend fun addTable(name: String): Long {
        val tables = tableDao.observeActive().first()
        val sortOrder = (tables.maxOfOrNull { it.sortOrder } ?: 0) + 1
        return tableDao.insert(RestaurantTableEntity(name = name.trim(), sortOrder = sortOrder))
    }

    suspend fun getAllTables(): List<RestaurantTableEntity> = tableDao.observeActive().first()

    suspend fun getOrder(orderId: String): TableOrderEntity? = orderDao.getById(orderId)

    suspend fun getOrderItems(orderId: String): List<CartItem> =
        orderItemDao.getByOrder(orderId).map { it.toCartItem() }

    suspend fun getOrderItemEntities(orderId: String): List<TableOrderItemEntity> =
        orderItemDao.getByOrder(orderId)

    suspend fun holdOrder(orderId: String) {
        orderDao.updateStatus(orderId, TableOrderStatus.HELD)
    }

    suspend fun loadTableOrderToCart(cartManager: CartManager, orderId: String): Boolean {
        val order = orderDao.getById(orderId) ?: return false
        val table = tableDao.getById(order.tableId) ?: return false
        val items = orderItemDao.getByOrder(orderId).map { it.toCartItem() }
        val vatIncluded = settingsDao.get()?.vatIncludedInPrice ?: false
        cartManager.loadTableOrder(
            tableId = table.id,
            tableName = table.name,
            orderId = order.id,
            serviceType = order.serviceType,
            items = items,
            discountPercent = order.discountPercent,
            discountAmount = order.discountAmount,
            vatIncludedInPrice = vatIncluded
        )
        if (order.status == TableOrderStatus.HELD) {
            orderDao.updateStatus(orderId, TableOrderStatus.OPEN)
        }
        return true
    }

    suspend fun getOngoingTableOrders(): List<Pair<TableOrderEntity, List<TableOrderItemEntity>>> {
        return orderDao.getActiveOrders().map { order ->
            order to orderItemDao.getByOrder(order.id)
        }
    }

    private fun TableOrderItemEntity.toCartItem() = CartItem(
        id = id,
        productId = productId,
        productName = productName,
        variantName = variantName,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        notes = notes,
        sku = sku,
        originalUnitPrice = originalUnitPrice,
        lineDiscountPerUnit = lineDiscountPerUnit,
        courseNumber = courseNumber,
        sentToKitchen = sentToKitchenAt != null
    )

    private fun CartItem.toTableOrderEntity(orderId: String) = TableOrderItemEntity(
        id = id,
        orderId = orderId,
        productId = productId,
        productName = productName,
        variantName = variantName,
        sku = sku,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        originalUnitPrice = originalUnitPrice,
        lineDiscountPerUnit = lineDiscountPerUnit,
        notes = notes ?: optionNotes(),
        sentToKitchenAt = null,
        kitchenRound = 0,
        courseNumber = courseNumber.coerceAtLeast(1)
    )
}

@Singleton
class HeldOrderRepository @Inject constructor(
    private val heldOrderDao: com.chaslay.pos.data.local.dao.HeldOrderDao,
    private val heldOrderItemDao: com.chaslay.pos.data.local.dao.HeldOrderItemDao,
    private val cancelReasonDao: com.chaslay.pos.data.local.dao.CancelReasonDao,
    private val tableOrderItemDao: TableOrderItemDao,
    private val settingsDao: BusinessSettingsDao
) {
    suspend fun getCancelReasons(): List<com.chaslay.pos.data.local.entity.CancelReasonEntity> =
        cancelReasonDao.getActive()

    suspend fun createHeldOrder(
        cart: CartSummary,
        sendToKitchen: Boolean,
        userId: Long,
        userName: String
    ): HeldOrderEntity {
        val id = UUID.randomUUID().toString()
        val orderNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() }
            ?: "H-${System.currentTimeMillis().toString().takeLast(6)}"
        val entity = HeldOrderEntity(
            id = id,
            orderNumber = orderNumber,
            serviceType = cart.serviceType,
            status = if (sendToKitchen) HeldOrderStatus.SENT_TO_KITCHEN else HeldOrderStatus.HELD,
            userId = userId,
            userName = userName,
            discountPercent = cart.discountPercent,
            discountAmount = cart.discountAmount,
            subtotal = cart.subtotal,
            taxTotal = cart.taxTotal,
            total = cart.total,
            tableId = cart.tableId,
            tableName = cart.tableName,
            tableOrderId = cart.tableOrderId,
            notes = cart.cartNotes,
            fulfillmentType = cart.fulfillmentType,
            pickupTimeMs = cart.pickupTimeMs,
            deliveryName = cart.deliveryName,
            deliveryAddress = cart.deliveryAddress,
            deliveryZip = cart.deliveryZip,
            deliveryPhone = cart.deliveryPhone
        )
        heldOrderDao.upsert(entity)
        val items = cart.items.map { item ->
            HeldOrderItemEntity(
                id = item.id,
                heldOrderId = id,
                productId = item.productId,
                productName = item.productName,
                variantName = item.variantName,
                sku = item.sku,
                unitPrice = item.unitPrice,
                quantity = item.quantity,
                taxRate = item.taxRate,
                originalUnitPrice = item.originalUnitPrice,
                lineDiscountPerUnit = item.lineDiscountPerUnit,
                notes = item.notes,
                courseNumber = item.courseNumber
            )
        }
        heldOrderItemDao.deleteByOrder(id)
        if (items.isNotEmpty()) heldOrderItemDao.insertAll(items)
        return entity
    }

    suspend fun createProgrammedPayLaterOrder(
        cart: CartSummary,
        userId: Long,
        userName: String,
        checkoutDiscountPercent: Double,
        finalTotal: Double
    ): HeldOrderEntity {
        val subtotal = cart.subtotal
        val itemDiscount = cart.itemDiscountTotal
        val checkoutDiscount = if (checkoutDiscountPercent > 0) {
            (subtotal - itemDiscount) * (checkoutDiscountPercent / 100.0)
        } else 0.0
        val discountPercent = when {
            checkoutDiscountPercent > 0 -> checkoutDiscountPercent
            cart.discountPercent > 0 -> cart.discountPercent
            else -> 0.0
        }
        val discountAmount = when {
            checkoutDiscountPercent > 0 -> checkoutDiscount
            cart.discountPercent > 0 -> (subtotal - itemDiscount) * (cart.discountPercent / 100.0)
            cart.discountAmount > 0 -> cart.discountAmount
            else -> 0.0
        }
        val id = UUID.randomUUID().toString()
        val orderNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() }
            ?: "H-${System.currentTimeMillis().toString().takeLast(6)}"
        val entity = HeldOrderEntity(
            id = id,
            orderNumber = orderNumber,
            serviceType = cart.serviceType,
            status = HeldOrderStatus.HELD,
            userId = userId,
            userName = userName,
            discountPercent = discountPercent,
            discountAmount = discountAmount,
            subtotal = subtotal,
            taxTotal = cart.taxTotal,
            total = finalTotal,
            tableId = cart.tableId,
            tableName = cart.tableName,
            tableOrderId = cart.tableOrderId,
            notes = cart.cartNotes,
            fulfillmentType = cart.fulfillmentType,
            pickupTimeMs = cart.pickupTimeMs,
            deliveryName = cart.deliveryName,
            deliveryAddress = cart.deliveryAddress,
            deliveryZip = cart.deliveryZip,
            deliveryPhone = cart.deliveryPhone
        )
        heldOrderDao.upsert(entity)
        val items = cart.items.map { item ->
            HeldOrderItemEntity(
                id = item.id,
                heldOrderId = id,
                productId = item.productId,
                productName = item.productName,
                variantName = item.variantName,
                sku = item.sku,
                unitPrice = item.unitPrice,
                quantity = item.quantity,
                taxRate = item.taxRate,
                originalUnitPrice = item.originalUnitPrice,
                lineDiscountPerUnit = item.lineDiscountPerUnit,
                notes = item.notes,
                courseNumber = item.courseNumber
            )
        }
        heldOrderItemDao.deleteByOrder(id)
        if (items.isNotEmpty()) heldOrderItemDao.insertAll(items)
        return entity
    }

    suspend fun getProgrammedHeldOrdersWithItems(): List<Pair<HeldOrderEntity, List<HeldOrderItemEntity>>> =
        heldOrderDao.getProgrammed().map { order -> order to heldOrderItemDao.getByOrder(order.id) }

    suspend fun loadHeldOrderToCart(cartManager: CartManager, heldOrderId: String): Boolean {
        val order = heldOrderDao.getById(heldOrderId) ?: return false
        val items = heldOrderItemDao.getByOrder(heldOrderId).map { it.toCartItem() }
        val vatIncluded = settingsDao.get()?.vatIncludedInPrice ?: false
        if (order.tableId != null && order.tableName != null && order.tableOrderId != null) {
            cartManager.loadTableOrder(
                tableId = order.tableId,
                tableName = order.tableName,
                orderId = order.tableOrderId,
                serviceType = order.serviceType,
                items = items,
                discountPercent = order.discountPercent,
                discountAmount = order.discountAmount,
                vatIncludedInPrice = vatIncluded
            )
            val sentFlags = tableOrderItemDao.getByOrder(order.tableOrderId)
                .associate { it.id to (it.sentToKitchenAt != null) }
            cartManager.refreshSentFlags(sentFlags)
        } else {
            cartManager.clear()
            cartManager.setVatIncludedInPrice(vatIncluded)
            cartManager.setServiceType(order.serviceType) { it.taxRate }
            when (order.fulfillmentType) {
                FulfillmentType.PICKUP -> cartManager.setPickupOrder(
                    orderNumber = order.orderNumber,
                    pickupTimeMs = order.pickupTimeMs
                )
                FulfillmentType.DELIVERY -> cartManager.setDeliveryOrder(
                    name = order.deliveryName.orEmpty(),
                    address = order.deliveryAddress.orEmpty(),
                    zip = order.deliveryZip.orEmpty(),
                    phone = order.deliveryPhone.orEmpty(),
                    orderNumber = order.orderNumber,
                    deliveryTimeMs = order.pickupTimeMs
                )
                else -> Unit
            }
            items.forEach { cartManager.addItem(it) }
            cartManager.applyDiscount(order.discountPercent, order.discountAmount)
            if (order.status == HeldOrderStatus.SENT_TO_KITCHEN) {
                cartManager.refreshSentFlags(items.associate { it.id to true })
            }
        }
        heldOrderDao.delete(heldOrderId)
        return true
    }

    suspend fun getHeldOrderWithItems(id: String): Pair<HeldOrderEntity, List<HeldOrderItemEntity>>? {
        val order = heldOrderDao.getById(id) ?: return null
        return order to heldOrderItemDao.getByOrder(id)
    }

    suspend fun getOngoingHeldOrders(): List<HeldOrderEntity> = heldOrderDao.getActive()

    suspend fun getOngoingHeldOrdersWithItems(): List<Pair<HeldOrderEntity, List<HeldOrderItemEntity>>> =
        heldOrderDao.getActive().map { order -> order to heldOrderItemDao.getByOrder(order.id) }

    suspend fun countActive(): Int = heldOrderDao.countActive()

    /** Deletes ALL held orders and their items. Irreversible. */
    suspend fun clearAll() {
        heldOrderItemDao.deleteAll()
        heldOrderDao.deleteAll()
    }

    private fun HeldOrderItemEntity.toCartItem() = CartItem(
        id = id,
        productId = productId,
        productName = productName,
        variantName = variantName,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        notes = notes,
        sku = sku,
        originalUnitPrice = originalUnitPrice,
        lineDiscountPerUnit = lineDiscountPerUnit,
        courseNumber = courseNumber
    )
}

private fun buildOrderNotes(cart: CartSummary): String? {
    val lines = mutableListOf<String>()
    cart.cartNotes?.trim()?.takeIf { it.isNotBlank() }?.let { lines.add(it) }
    when (cart.fulfillmentType) {
        FulfillmentType.PICKUP -> {
            cart.orderNumber?.let { lines.add("Pickup order: $it") }
            lines.add(
                cart.pickupTimeMs?.let {
                    "Pickup time: ${java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault()).format(java.util.Date(it))}"
                } ?: "Pickup: ASAP"
            )
        }
        FulfillmentType.DELIVERY -> {
            lines.add("--- DELIVERY ---")
            cart.orderNumber?.let { lines.add("Order: $it") }
            cart.deliveryName?.let { lines.add("Name: $it") }
            cart.deliveryAddress?.let { lines.add("Address: $it") }
            cart.deliveryZip?.let { lines.add("ZIP: $it") }
            cart.deliveryPhone?.let { lines.add("Tel: $it") }
        }
        else -> Unit
    }
    return lines.joinToString("\n").ifBlank { null }
}
