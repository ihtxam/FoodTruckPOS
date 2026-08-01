package com.chaslay.pos.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.SyncStatus
import com.chaslay.pos.domain.model.TableOrderStatus

@Entity(tableName = "roles")
data class RoleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Comma-separated [com.chaslay.pos.domain.model.PosPermission] names */
    val permissions: String,
    val isSystem: Boolean = false
)

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val email: String?,
    val pinHash: String?,
    val passwordHash: String?,
    val roleId: Long,
    val isActive: Boolean = true,
    val biometricEnabled: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "categories", indices = [Index("remoteId")])
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val remoteId: String? = null,
    val name: String,
    val sortOrder: Int = 0,
    val colorHex: String = "#5B9BD5",
    val isActive: Boolean = true,
    val onlineVisible: Boolean = true,
    val printTarget: PrintTarget = PrintTarget.KITCHEN,
    val updatedAt: Long = System.currentTimeMillis()
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
    indices = [Index("categoryId"), Index("barcode"), Index("sku"), Index("remoteId")]
)
data class ProductEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val remoteId: String? = null,
    val name: String,
    val sku: String? = null,
    val barcode: String? = null,
    val categoryId: Long? = null,
    val taxRate: Double = 0.0,
    val price: Double = 0.0,
    val costPrice: Double? = null,
    val imageUri: String? = null,
    val isActive: Boolean = true,
    val onlineVisible: Boolean = true,
    val isOpenPrice: Boolean = false,
    /** Sold by weight (price is per kg); quantity in cart is stored in grams. */
    val isWeighed: Boolean = false,
    /** Fixed-price meal deal with slot-based picks (starter, main, drink, etc.). */
    val isCombo: Boolean = false,
    val printTarget: PrintTarget? = null,
    val sortOrder: Int = 0,
    val stockQuantity: Int? = null,
    val lowStockThreshold: Int? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "customers", indices = [Index("name"), Index("phone"), Index("email")])
data class CustomerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null,
    val zip: String? = null,
    val notes: String? = null,
    val createdAt: Long = System.currentTimeMillis()
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
    val pickupTimeMs: Long? = null,
    /** Serialized Adyen Terminal API CustomerReceipt for on-demand reprint. */
    val adyenCustomerReceiptJson: String? = null,
    /** Serialized Adyen Terminal API CashierReceipt (merchant copy) for on-demand reprint. */
    val adyenCashierReceiptJson: String? = null,
    /** Guest / cover count recorded at checkout (dine-in seating plan). */
    val guestCount: Int? = null,
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
    val originalUnitPrice: Double? = null,
    val lineDiscountPerUnit: Double = 0.0,
    val notes: String? = null,
    /** When true, [quantity] is grams and [unitPrice] is per kg. */
    val isWeighed: Boolean = false
)

@Entity(tableName = "business_settings")
data class BusinessSettingsEntity(
    @PrimaryKey val id: Int = 1,
    val businessName: String = "Chaslay",
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
    val adyenLiveEnvironment: Boolean = false,
    val adyenLiveRegion: String = "EU",
    val adyenUseLegacyEndpoint: Boolean = false,
    val roundingStep: Double = 0.05,
    /** Synced from merchant panel posCheckoutSettings */
    val tipsEnabled: Boolean = true,
    val allowCustomTip: Boolean = true,
    /** Comma-separated tip preset percents, e.g. "0,5,10,15" */
    val tipPresetsPercentCsv: String = "0,5,10,15",
    val discountsEnabled: Boolean = true,
    val quickCashEnabled: Boolean = true,
    /** Comma-separated quick-cash denominations, e.g. "10,20,50,100" */
    val quickCashDenominationsCsv: String = "10,20,50,100",
    val splitBillsEnabled: Boolean = true,
    val maxSplitParts: Int = 8,
    val openHour: Int = 10,
    val openMinute: Int = 0,
    val closeHour: Int = 22,
    val closeMinute: Int = 0,
    val cashEnabled: Boolean = true,
    val cardEnabled: Boolean = true,
    val terminalEnabled: Boolean = true,
    /** Quick one-tap cash sale (Xpress button). Synced from merchant panel. */
    val expressEnabled: Boolean = true,
    /** When true, payment method toggles are controlled by the merchant panel sync. */
    val paymentMethodsManagedByCloud: Boolean = false,
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
    /** When true, catalog prices already include VAT; tax is extracted from the price. */
    val vatIncludedInPrice: Boolean = false,
    val defaultServiceType: ServiceType = ServiceType.TAKEAWAY,
    val posMode: PosMode = PosMode.RESTAURANT,
    /** Synced from merchant panel — multi-course firing on dine-in tables. */
    val coursesEnabled: Boolean = false,
    val receiptBaseUrl: String = "https://pay.chaslay.com/receipts",
    val receiptHeader: String = "",
    val receiptFooter: String = "Merci / Thank you!",
    val kitchenTicketHeader: String = "",
    val kitchenTicketFooter: String = "",
    val receiptShowVatTable: Boolean = true,
    val receiptShowStaffLine: Boolean = true,
    val receiptShowQrCode: Boolean = true,
    val kitchenLargeItemText: Boolean = true,
    val kitchenLargeHeaderText: Boolean = true,
    /** 1 = normal, 2 = large (double height), 3 = extra large (double width + height) */
    val kitchenItemTextScale: Int = 2,
    val kitchenHeaderTextScale: Int = 2,
    val receiptTemplateName: String = "Default",
    val scaleEnabled: Boolean = false,
    /** Stable USB id, e.g. usb:6790:29987 */
    val scaleUsbAddress: String? = null,
    /** Enable cloud + LAN floor sync for waiter devices. */
    val floorSyncEnabled: Boolean = false,
    /** MAIN_POS, WAITER, or STANDARD */
    val floorDeviceRole: String = "STANDARD",
    /** When enabled, staff enter cover count when seating; EOD reports guests served. */
    val trackCoversFromSeatingPlan: Boolean = false,
    /** LAN URL of main POS, e.g. http://192.168.1.50:8787 */
    val mainPosLanUrl: String = "",
    /** AUTO, LAN, or CLOUD — how floor sync routes when this device is a waiter tablet. */
    val floorConnectionMode: String = "AUTO"
)

@Entity(tableName = "table_floors")
data class TableFloorEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sortOrder: Int = 0,
    val isActive: Boolean = true
)

@Entity(tableName = "restaurant_tables")
data class RestaurantTableEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val sortOrder: Int = 0,
    val isActive: Boolean = true,
    val floorId: Long = 1,
    /** Maximum guests / seat count for this table. */
    val seatCapacity: Int = 4,
    /** Normalized 0..1 position on floor plan. */
    val planX: Float = 0f,
    val planY: Float = 0f,
    val planWidth: Float = 0.12f,
    val planHeight: Float = 0.12f,
    /** ROUND, SQUARE, or RECT */
    val shape: String = "ROUND",
    val rotation: Float = 0f
)

@Entity(tableName = "floor_plan_elements")
data class FloorPlanElementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val floorId: Long = 1,
    /** WALL, BAR, or OBSTACLE */
    val elementType: String = "WALL",
    val label: String? = null,
    val planX: Float = 0.1f,
    val planY: Float = 0.1f,
    val planWidth: Float = 0.3f,
    val planHeight: Float = 0.04f,
    val rotation: Float = 0f
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
    /** Current seated guest / cover count for this table order. */
    val guestCount: Int? = null,
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
    val courseNumber: Int = 1,
    /** When true, [quantity] is grams and [unitPrice] is per kg. */
    val isWeighed: Boolean = false
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
    val courseNumber: Int = 1,
    /** When true, [quantity] is grams and [unitPrice] is per kg. */
    val isWeighed: Boolean = false
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

@Entity(
    tableName = "combo_slots",
    foreignKeys = [
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["comboProductId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("comboProductId")]
)
data class ComboSlotEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val comboProductId: Long,
    val name: String,
    val minPick: Int = 1,
    val maxPick: Int = 1,
    val sortOrder: Int = 0
)

@Entity(
    tableName = "combo_slot_options",
    foreignKeys = [
        ForeignKey(
            entity = ComboSlotEntity::class,
            parentColumns = ["id"],
            childColumns = ["slotId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("slotId"), Index("productId")]
)
data class ComboSlotOptionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val slotId: Long,
    val productId: Long,
    val sortOrder: Int = 0
)
