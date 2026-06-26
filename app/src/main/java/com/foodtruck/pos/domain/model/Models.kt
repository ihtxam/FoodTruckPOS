package com.foodtruck.pos.domain.model

enum class UserRole {
    ADMIN,
    MANAGER,
    CASHIER;

    fun canAccessSettings(): Boolean = this == ADMIN
    fun canAccessReports(): Boolean = this == ADMIN || this == MANAGER
    fun canManageProducts(): Boolean = this == ADMIN || this == MANAGER
}

enum class PaymentMethod {
    CASH,
    CARD,
    TAP_TO_PAY,
    ADYEN_TERMINAL
}

enum class PaymentStatus {
    PENDING,
    COMPLETED,
    FAILED,
    REFUNDED,
    CANCELLED,
    PARTIALLY_REFUNDED
}

enum class SyncStatus {
    PENDING,
    SYNCED,
    FAILED
}

enum class SupportedCurrency(val code: String, val symbol: String) {
    CHF("CHF", "CHF"),
    EUR("EUR", "\u20AC"),
    USD("USD", "$"),
    GBP("GBP", "\u00A3"),
    AED("AED", "AED"),
    CAD("CAD", "C$");

    companion object {
        fun fromCode(code: String): SupportedCurrency =
            entries.find { it.code == code } ?: CHF
    }
}

enum class AppLanguage(val code: String, val displayName: String) {
    ENGLISH("en", "English"),
    GERMAN("de", "Deutsch"),
    FRENCH("fr", "Fran\u00E7ais"),
    ITALIAN("it", "Italiano"),
    ARABIC("ar", "\u0627\u0644\u0639\u0631\u0628\u064A\u0629"),
    SPANISH("es", "Espa\u00F1ol");

    companion object {
        fun fromCode(code: String): AppLanguage =
            entries.find { it.code == code } ?: ENGLISH
    }
}

enum class ServiceType(val displayName: String) {
    DINE_IN("Dine-in"),
    TAKEAWAY("Take away");

    companion object {
        fun fromName(name: String): ServiceType =
            entries.find { it.name == name } ?: TAKEAWAY
    }
}

enum class FulfillmentType(val displayName: String) {
    WALK_IN("Walk-in"),
    DINE_IN("Dine-in"),
    PICKUP("Takeaway"),
    DELIVERY("Delivery");

    companion object {
        fun fromName(name: String): FulfillmentType =
            entries.find { it.name == name } ?: WALK_IN
    }
}

enum class TableOrderStatus {
    OPEN,
    SENT,
    PAID,
    CANCELLED,
    HELD
}

enum class PosThemeMode(val displayName: String) {
    LIGHT("Light"),
    DARK("Dark");

    companion object {
        fun fromName(name: String?): PosThemeMode =
            entries.find { it.name == name } ?: LIGHT
    }
}

enum class HeldOrderStatus {
    HELD,
    SENT_TO_KITCHEN
}

enum class PrintTarget(val displayName: String) {
    POS("Receipt printer"),
    KITCHEN("Kitchen printer"),
    BOTH("Both printers");

    companion object {
        fun fromName(name: String): PrintTarget =
            entries.find { it.name == name } ?: KITCHEN
    }
}

fun applyCashRounding(amount: Double, step: Double): Double {
    if (step <= 0.0) return amount
    return kotlin.math.round(amount / step) * step
}

/** Round monetary values to 2 decimal places (half-up). */
fun roundMoney(amount: Double): Double =
    java.math.BigDecimal.valueOf(amount).setScale(2, java.math.RoundingMode.HALF_UP).toDouble()

fun formatMoneyAmount(amount: Double, symbol: String): String =
    String.format(java.util.Locale.getDefault(), "%s %.2f", symbol, roundMoney(amount))

fun resolveVatRate(productTaxRate: Double, serviceType: ServiceType, settings: com.foodtruck.pos.data.local.entity.BusinessSettingsEntity): Double {
    if (productTaxRate == 0.0) return 0.0
    return when (serviceType) {
        ServiceType.DINE_IN -> settings.dineInVatRate
        ServiceType.TAKEAWAY -> settings.takeawayVatRate
    }
}

data class CartItem(
    val id: String,
    val productId: Long,
    val productName: String,
    val variantName: String? = null,
    val unitPrice: Double,
    val quantity: Int,
    val taxRate: Double,
    val notes: String? = null,
    val sku: String? = null,
    val originalUnitPrice: Double? = null,
    val lineDiscountPerUnit: Double = 0.0,
    val categoryId: Long? = null,
    val courseNumber: Int = 1,
    val sentToKitchen: Boolean = false,
    val splitCheck: Int = 1,
    val modifiers: List<SelectedModifier> = emptyList(),
    val addons: List<SelectedAddon> = emptyList()
) {
    val catalogUnitPrice: Double get() = originalUnitPrice ?: unitPrice
    val lineSubtotal: Double get() = unitPrice * quantity
    val lineDiscount: Double get() = lineDiscountPerUnit * quantity
    val lineTax: Double get() = lineSubtotal * (taxRate / 100.0)
    val lineTotal: Double get() = lineSubtotal + lineTax

    fun optionNotes(): String? {
        val lines = mutableListOf<String>()
        modifiers.forEach { lines.add("${it.quantity}x ${it.name}") }
        addons.forEach { lines.add("${it.quantity}x ${it.name}") }
        notes?.trim()?.takeIf { it.isNotBlank() }?.let { lines.add(it) }
        return lines.joinToString("\n").ifBlank { null }
    }

    fun modifierSummary(): String =
        (modifiers.map { it.name } + addons.map { it.name }).joinToString(", ")
}

data class CartSummary(
    val items: List<CartItem>,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val cartNotes: String? = null,
    val serviceType: ServiceType = ServiceType.TAKEAWAY,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val orderNumber: String? = null,
    val pickupTimeMs: Long? = null,
    val deliveryName: String? = null,
    val deliveryAddress: String? = null,
    val deliveryZip: String? = null,
    val deliveryPhone: String? = null,
    val tableId: Long? = null,
    val tableOrderId: String? = null,
    val tableName: String? = null,
    val activeCourse: Int = 1,
    val courseCount: Int = 1,
    val splitCount: Int = 1,
    val splitByItems: Boolean = false,
    val activeSplitCheck: Int = 1
) {
    val visibleItems: List<CartItem>
        get() = if (splitByItems && splitCount > 1) {
            items.filter { it.splitCheck == activeSplitCheck }
        } else items

    val displayTotal: Double
        get() = if (splitByItems && splitCount > 1) {
            CartSummary(items = visibleItems).total
        } else if (splitCount > 1) {
            total / splitCount
        } else total

    val fullTotal: Double get() = total
    val subtotal: Double get() = items.sumOf { it.catalogUnitPrice * it.quantity }
    val itemDiscountTotal: Double get() = items.sumOf { it.lineDiscount }
    val taxTotal: Double get() = items.sumOf { it.lineTax }
    val discountValue: Double
        get() = when {
            discountPercent > 0 -> subtotal * (discountPercent / 100.0)
            discountAmount > 0 -> discountAmount.coerceAtMost(subtotal)
            else -> 0.0
        }
    val total: Double
        get() = (subtotal + taxTotal - itemDiscountTotal - discountValue).coerceAtLeast(0.0)
    val isEmpty: Boolean get() = items.isEmpty()
}

data class ProductWithVariants(
    val id: Long,
    val name: String,
    val sku: String?,
    val barcode: String?,
    val categoryId: Long?,
    val categoryName: String?,
    val taxRate: Double,
    val price: Double,
    val costPrice: Double?,
    val imageUri: String?,
    val isActive: Boolean,
    val isOpenPrice: Boolean,
    val variants: List<ProductVariantModel>
)

data class ProductVariantModel(
    val id: Long,
    val name: String,
    val price: Double,
    val sku: String?,
    val barcode: String?
)

data class ModifierOptionModel(val id: Long, val name: String, val inStock: Boolean = true)

data class ModifierGroupModel(
    val id: Long,
    val name: String,
    val limitQuantity: Int = 1,
    val required: Boolean = false,
    val options: List<ModifierOptionModel> = emptyList(),
    val linkedProductIds: List<Long> = emptyList()
) {
    val isSingleSelect: Boolean get() = limitQuantity <= 1
}

data class AddonOptionModel(val id: Long, val name: String, val price: Double, val inStock: Boolean = true)

data class AddonGroupModel(
    val id: Long,
    val name: String,
    val limitQuantity: Int = 1,
    val required: Boolean = false,
    val allowMultipleSame: Boolean = false,
    val options: List<AddonOptionModel> = emptyList(),
    val linkedProductIds: List<Long> = emptyList()
)

data class ProductCustomizeState(
    val product: ProductWithVariants,
    val modifierGroups: List<ModifierGroupModel>,
    val addonGroups: List<AddonGroupModel>,
    val openPrice: Double? = null,
    val editingItemId: String? = null,
    val initialQuantity: Int = 1,
    val initialVariantName: String? = null,
    val initialModifiers: List<SelectedModifier> = emptyList(),
    val initialAddons: List<SelectedAddon> = emptyList(),
    val initialNotes: String? = null
)

data class SelectedModifier(val name: String, val quantity: Int = 1)

data class SelectedAddon(val name: String, val price: Double, val quantity: Int = 1)

data class OptionChoice(val name: String, val price: Double = 0.0)

data class OptionGroupPicker(
    val groupName: String,
    val choices: List<OptionChoice>,
    val limitQuantity: Int,
    val required: Boolean,
    val isAddon: Boolean,
    val selectedNames: Set<String> = emptySet()
)

data class DailySalesReport(
    val salesCount: Int,
    val revenue: Double,
    val tax: Double,
    val cashTotal: Double,
    val cardTotal: Double
)

data class ProductSalesReport(
    val productName: String,
    val quantitySold: Int,
    val revenue: Double
)

data class UserPerformanceReport(
    val userName: String,
    val transactionCount: Int,
    val revenue: Double
)

enum class TableStatus {
    FREE,
    ACTIVE,
    OCCUPIED
}

enum class OngoingOrderSource {
    HELD,
    TABLE
}

data class OngoingOrderCard(
    val id: String,
    val orderNumber: String,
    val serviceType: ServiceType,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val total: Double,
    val itemCount: Int,
    val statusLabel: String,
    val source: OngoingOrderSource,
    val tableName: String? = null,
    val updatedAt: Long
)

data class TableWithOrderInfo(
    val id: Long,
    val name: String,
    val sortOrder: Int,
    val openOrderId: String?,
    val itemCount: Int,
    val unsentItemCount: Int,
    val sentItemCount: Int,
    val orderTotal: Double,
    val status: TableStatus = TableStatus.FREE
)

data class KitchenMessagePreset(
    val label: String,
    val message: String
)

data class DashboardStats(
    val todaySales: Double,
    val transactionCount: Int,
    val cashRevenue: Double,
    val cardRevenue: Double
)

data class VatBreakdownRow(
    val label: String,
    val rate: Double,
    val net: Double,
    val tva: Double,
    val brut: Double
)

data class PaymentMethodRow(
    val label: String,
    val amount: Double,
    val percent: Double
)

data class OrderTypeRow(
    val label: String,
    val count: Int,
    val percent: Double,
    val amount: Double
)

data class EndOfDayReport(
    val periodStart: Long = 0L,
    val periodEnd: Long = 0L,
    val salesCount: Int,
    val revenue: Double,
    val taxTotal: Double,
    val subtotal: Double = 0.0,
    val netTotal: Double = 0.0,
    val brutTotal: Double = 0.0,
    val tipsTotal: Double = 0.0,
    val grandTotal: Double = 0.0,
    val vatRows: List<VatBreakdownRow> = emptyList(),
    val paymentRows: List<PaymentMethodRow> = emptyList(),
    val orderTypeRows: List<OrderTypeRow> = emptyList(),
    val cashTotal: Double,
    val cardTotal: Double,
    val tapToPayTotal: Double,
    val adyenTotal: Double,
    val dineInTotal: Double,
    val dineInCount: Int,
    val takeawayTotal: Double,
    val takeawayCount: Int
)

data class DiscountPreset(
    val id: Long,
    val name: String,
    val percent: Double
)

data class CategoryPrintSetting(
    val id: Long,
    val name: String,
    val printTarget: PrintTarget
)
