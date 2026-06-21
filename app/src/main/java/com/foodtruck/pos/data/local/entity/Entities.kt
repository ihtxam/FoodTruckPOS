package com.foodtruck.pos.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.SyncStatus
import com.foodtruck.pos.domain.model.UserRole

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val email: String?,
    val pinHash: String?,
    val passwordHash: String?,
    val role: UserRole,
    val isActive: Boolean = true,
    val biometricEnabled: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "products",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("categoryId"), Index("barcode"), Index("sku")]
)
data class ProductEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sku: String? = null,
    val barcode: String? = null,
    val categoryId: Long? = null,
    val taxRate: Double = 0.0,
    val price: Double = 0.0,
    val costPrice: Double? = null,
    val imageUri: String? = null,
    val isActive: Boolean = true,
    val isOpenPrice: Boolean = false,
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "product_variants",
    foreignKeys = [
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("productId"), Index("barcode"), Index("sku")]
)
data class ProductVariantEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val productId: Long,
    val name: String,
    val price: Double,
    val sku: String? = null,
    val barcode: String? = null,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "transactions",
    indices = [Index("transactionNumber"), Index("createdAt"), Index("userId"), Index("syncStatus")]
)
data class TransactionEntity(
    @PrimaryKey val id: String,
    val transactionNumber: String,
    val userId: Long,
    val userName: String,
    val subtotal: Double,
    val taxTotal: Double,
    val discountPercent: Double,
    val discountAmount: Double,
    val total: Double,
    val paymentMethod: PaymentMethod,
    val paymentStatus: PaymentStatus,
    val currencyCode: String,
    val notes: String? = null,
    val receiptUrl: String? = null,
    val cardReference: String? = null,
    val syncStatus: SyncStatus = SyncStatus.PENDING,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "transaction_items",
    foreignKeys = [
        ForeignKey(
            entity = TransactionEntity::class,
            parentColumns = ["id"],
            childColumns = ["transactionId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("transactionId"), Index("productId")]
)
data class TransactionItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val transactionId: String,
    val productId: Long?,
    val productName: String,
    val variantName: String? = null,
    val sku: String? = null,
    val unitPrice: Double,
    val quantity: Int,
    val taxRate: Double,
    val lineSubtotal: Double,
    val lineTax: Double,
    val lineTotal: Double,
    val notes: String? = null
)

@Entity(tableName = "business_settings")
data class BusinessSettingsEntity(
    @PrimaryKey val id: Int = 1,
    val businessName: String = "Food Truck",
    val vatNumber: String = "",
    val address: String = "",
    val phone: String = "",
    val email: String = "",
    val website: String = "",
    val logoUri: String? = null,
    val defaultCurrency: String = "CHF",
    val currencySymbol: String = "CHF",
    val defaultLanguage: String = "en",
    val tapToPayEnabled: Boolean = false,
    val adyenTerminalEnabled: Boolean = false,
    val adyenTerminalId: String = "",
    val adyenApiKey: String = "",
    val adyenMerchantAccount: String = "",
    val printerMacAddress: String? = null,
    val printerName: String? = null,
    val receiptBaseUrl: String = "https://receipts.foodtruckpos.app"
)
