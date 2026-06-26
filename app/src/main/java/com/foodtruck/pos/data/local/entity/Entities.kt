package com.foodtruck.pos.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.foodtruck.pos.domain.model.HeldOrderStatus
import com.foodtruck.pos.domain.model.PrintTarget
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.FulfillmentType
import com.foodtruck.pos.domain.model.ServiceType
import com.foodtruck.pos.domain.model.SyncStatus
import com.foodtruck.pos.domain.model.TableOrderStatus
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
    val colorHex: String = "#5B9BD5",
    val isActive: Boolean = true,
    val printTarget: PrintTarget = PrintTarget.KITCHEN
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
    val printTarget: PrintTarget? = null,
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
    val tipAmount: Double = 0.0,
    val roundingAmount: Double = 0.0,
    val total: Double,
    val paymentMethod: PaymentMethod,
    val paymentStatus: PaymentStatus,
    val currencyCode: String,
    val notes: String? = null,
    val receiptUrl: String? = null,
    val cardReference: String? = null,
    val tableId: Long? = null,
    val serviceType: ServiceType? = null,
    val syncStatus: SyncStatus = SyncStatus.PENDING,
    val refundAmount: Double = 0.0,
    val cancelReason: String? = null,
    val cancelledAt: Long? = null,
    val masterOrderId: String? = null,
    val splitCheckNumber: Int? = null,
    val amountTendered: Double? = null,
    val changeDue: Double? = null,
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
    val adyenClientId: String = "",
    val adyenMerchantAccount: String = "",
    val roundingStep: Double = 0.0,
    val cashEnabled: Boolean = true,
    val cardEnabled: Boolean = true,
    val terminalEnabled: Boolean = true,
    val printerPrintReceipts: Boolean = true,
    val printerPrintReports: Boolean = true,
    val printerPrintKitchen: Boolean = false,
    val kitchenPrinterPrintKitchen: Boolean = true,
    val printerMacAddress: String? = null,
    val printerName: String? = null,
    val kitchenPrinterMacAddress: String? = null,
    val kitchenPrinterName: String? = null,
    val dineInVatRate: Double = 8.1,
    val takeawayVatRate: Double = 2.6,
    val defaultServiceType: ServiceType = ServiceType.TAKEAWAY,
    val receiptBaseUrl: String = "https://receipts.foodtruckpos.app",
    val receiptHeader: String = "",
    val receiptFooter: String = "Merci / Thank you!",
    val kitchenTicketHeader: String = "",
    val kitchenTicketFooter: String = "",
    val receiptShowVatTable: Boolean = true,
    val receiptShowStaffLine: Boolean = true,
    val kitchenLargeItemText: Boolean = true,
    val kitchenLargeHeaderText: Boolean = true,
    val receiptTemplateName: String = "Default"
)

@Entity(tableName = "restaurant_tables")
data class RestaurantTableEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "table_orders",
    foreignKeys = [
        ForeignKey(
            entity = RestaurantTableEntity::class,
            parentColumns = ["id"],
            childColumns = ["tableId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("tableId"), Index("status")]
)
data class TableOrderEntity(
    @PrimaryKey val id: String,
    val tableId: Long,
    val serviceType: ServiceType,
    val status: TableOrderStatus,
    val userId: Long,
    val userName: String,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val notes: String? = null,
    val lastSentAt: Long? = null,
    val kitchenRound: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "table_order_items",
    foreignKeys = [
        ForeignKey(
            entity = TableOrderEntity::class,
            parentColumns = ["id"],
            childColumns = ["orderId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("orderId"), Index("productId")]
)
data class TableOrderItemEntity(
    @PrimaryKey val id: String,
    val orderId: String,
    val productId: Long,
    val productName: String,
    val variantName: String? = null,
    val sku: String? = null,
    val unitPrice: Double,
    val quantity: Int,
    val taxRate: Double,
    val originalUnitPrice: Double? = null,
    val lineDiscountPerUnit: Double = 0.0,
    val notes: String? = null,
    val sentToKitchenAt: Long? = null,
    val kitchenRound: Int = 0,
    val courseNumber: Int = 1
)

@Entity(tableName = "discount_presets")
data class DiscountPresetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val percent: Double,
    val isActive: Boolean = true,
    val sortOrder: Int = 0
)

@Entity(tableName = "printer_configs")
data class PrinterConfigEntity(
    @PrimaryKey val id: String,
    val name: String,
    val connectionType: String = "BLUETOOTH",
    val address: String,
    val paperWidthMm: Int = 80,
    val printKitchenTickets: Boolean = false,
    val printCustomerTickets: Boolean = false,
    val printOrderReceipts: Boolean = true,
    val printEndOfDayReports: Boolean = false,
    val openCashDrawer: Boolean = false,
    val isEnabled: Boolean = true,
    val printerMode: String = "GRAPHIC",
    val printRetry: Boolean = true,
    // Product/category routing for kitchen tickets. When printAllProducts is true the printer
    // prints every kitchen item; otherwise only items whose product or category id is linked.
    val printAllProducts: Boolean = true,
    val linkedCategoryIds: String = "",
    val linkedProductIds: String = "",
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "kitchen_messages",
    foreignKeys = [
        ForeignKey(
            entity = TableOrderEntity::class,
            parentColumns = ["id"],
            childColumns = ["orderId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("orderId"), Index("tableId")]
)
data class KitchenMessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val orderId: String,
    val tableId: Long,
    val tableName: String,
    val message: String,
    val sentAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cancel_reasons")
data class CancelReasonEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val label: String,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "held_orders",
    indices = [Index("status"), Index("createdAt")]
)
data class HeldOrderEntity(
    @PrimaryKey val id: String,
    val orderNumber: String,
    val serviceType: ServiceType,
    val status: HeldOrderStatus,
    val userId: Long,
    val userName: String,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val subtotal: Double,
    val taxTotal: Double,
    val total: Double,
    val tableId: Long? = null,
    val tableName: String? = null,
    val tableOrderId: String? = null,
    val notes: String? = null,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val pickupTimeMs: Long? = null,
    val deliveryName: String? = null,
    val deliveryAddress: String? = null,
    val deliveryZip: String? = null,
    val deliveryPhone: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "held_order_items",
    foreignKeys = [
        ForeignKey(
            entity = HeldOrderEntity::class,
            parentColumns = ["id"],
            childColumns = ["heldOrderId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("heldOrderId")]
)
data class HeldOrderItemEntity(
    @PrimaryKey val id: String,
    val heldOrderId: String,
    val productId: Long,
    val productName: String,
    val variantName: String? = null,
    val sku: String? = null,
    val unitPrice: Double,
    val quantity: Int,
    val taxRate: Double,
    val originalUnitPrice: Double? = null,
    val lineDiscountPerUnit: Double = 0.0,
    val notes: String? = null,
    val courseNumber: Int = 1
)

@Entity(tableName = "modifier_groups")
data class ModifierGroupEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val limitQuantity: Int = 1,
    val required: Boolean = false,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "modifier_options",
    foreignKeys = [
        ForeignKey(
            entity = ModifierGroupEntity::class,
            parentColumns = ["id"],
            childColumns = ["groupId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("groupId")]
)
data class ModifierOptionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val groupId: Long,
    val name: String,
    val sortOrder: Int = 0,
    val inStock: Boolean = true,
    val isActive: Boolean = true
)

@Entity(tableName = "addon_groups")
data class AddonGroupEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val limitQuantity: Int = 1,
    val required: Boolean = false,
    val allowMultipleSame: Boolean = false,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(
    tableName = "addon_options",
    foreignKeys = [
        ForeignKey(
            entity = AddonGroupEntity::class,
            parentColumns = ["id"],
            childColumns = ["groupId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("groupId")]
)
data class AddonOptionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val groupId: Long,
    val name: String,
    val price: Double = 0.0,
    val sortOrder: Int = 0,
    val inStock: Boolean = true,
    val isActive: Boolean = true
)

@Entity(
    tableName = "product_modifier_groups",
    primaryKeys = ["productId", "groupId"],
    foreignKeys = [
        ForeignKey(entity = ProductEntity::class, parentColumns = ["id"], childColumns = ["productId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = ModifierGroupEntity::class, parentColumns = ["id"], childColumns = ["groupId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index("productId"), Index("groupId")]
)
data class ProductModifierGroupEntity(
    val productId: Long,
    val groupId: Long,
    val sortOrder: Int = 0
)

@Entity(
    tableName = "product_addon_groups",
    primaryKeys = ["productId", "groupId"],
    foreignKeys = [
        ForeignKey(entity = ProductEntity::class, parentColumns = ["id"], childColumns = ["productId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = AddonGroupEntity::class, parentColumns = ["id"], childColumns = ["groupId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index("productId"), Index("groupId")]
)
data class ProductAddonGroupEntity(
    val productId: Long,
    val groupId: Long,
    val sortOrder: Int = 0
)
