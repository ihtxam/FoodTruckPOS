package com.chaslay.pos.domain.model

enum class UserRole {
    ADMIN,
    MANAGER,
    CASHIER,
    WAITER,
    DELIVERY;

    @Deprecated("Use UserAccess with PosPermission instead")
    fun canAccessSettings(): Boolean = this == ADMIN
    @Deprecated("Use UserAccess with PosPermission instead")
    fun canAccessReports(): Boolean = this == ADMIN || this == MANAGER
    @Deprecated("Use UserAccess with PosPermission instead")
    fun canManageProducts(): Boolean = this == ADMIN || this == MANAGER
}

enum class PaymentMethod {
    CASH,
    CARD,
    TAP_TO_PAY,
    ADYEN_TERMINAL,
    PAY_LATER
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
        val supportedInSettings = listOf(ENGLISH, FRENCH, GERMAN, ITALIAN)

        fun fromCode(code: String): AppLanguage =
            entries.find { it.code == code } ?: ENGLISH
    }
}

data class BarcodeLookupResult(
    val productId: Long,
    val variantId: Long? = null,
    val variantName: String? = null,
    val variantPrice: Double? = null
)

enum class PosMode(val displayName: String) {
    RETAIL("Retail"),
    RESTAURANT("Restaurant");

    companion object {
        fun fromName(name: String?): PosMode =
            entries.find { it.name == name } ?: RESTAURANT
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

fun resolveVatRate(productTaxRate: Double, serviceType: ServiceType, settings: com.chaslay.pos.data.local.entity.BusinessSettingsEntity): Double {
    if (productTaxRate == 0.0) return 0.0
    return when (serviceType) {
        ServiceType.DINE_IN -> settings.dineInVatRate
        ServiceType.TAKEAWAY -> settings.takeawayVatRate
    }
}

fun computeLineTax(lineSubtotal: Double, taxRate: Double, vatIncludedInPrice: Boolean): Double {
    if (taxRate <= 0.0 || lineSubtotal <= 0.0) return 0.0
    return if (vatIncludedInPrice) {
        roundMoney(lineSubtotal - lineSubtotal / (1.0 + taxRate / 100.0))
    } else {
        roundMoney(lineSubtotal * (taxRate / 100.0))
    }
}

fun computeLineTotal(lineSubtotal: Double, taxRate: Double, vatIncludedInPrice: Boolean): Double {
    if (lineSubtotal <= 0.0) return 0.0
    return if (vatIncludedInPrice) {
        roundMoney(lineSubtotal)
    } else {
        roundMoney(lineSubtotal + computeLineTax(lineSubtotal, taxRate, false))
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
    val addons: List<SelectedAddon> = emptyList(),
    val vatIncludedInPrice: Boolean = false,
    /** When true, [quantity] stores grams and [unitPrice] is per kg. */
    val isWeighed: Boolean = false,
    val isCombo: Boolean = false,
    val comboSelections: List<ComboSelection> = emptyList()
) {
    val catalogUnitPrice: Double get() = originalUnitPrice ?: unitPrice
    val weightKg: Double? get() = if (isWeighed) quantity / 1000.0 else null
    /** Catalog amount before item discount (weight-aware). */
    val catalogLineSubtotal: Double
        get() = if (isWeighed) catalogUnitPrice * (quantity / 1000.0) else catalogUnitPrice * quantity
    val lineSubtotal: Double get() = if (isWeighed) unitPrice * (quantity / 1000.0) else unitPrice * quantity
    val lineDiscount: Double get() = if (isWeighed) lineDiscountPerUnit * (quantity / 1000.0) else lineDiscountPerUnit * quantity
    val lineTax: Double get() = computeLineTax(lineSubtotal, taxRate, vatIncludedInPrice)
    val lineTotal: Double get() = computeLineTotal(lineSubtotal, taxRate, vatIncludedInPrice)

    /** Cart / receipt primary label, e.g. `0.794 kg Salmon` or `2x Burger`. */
    fun displayQtyLabel(): String =
        if (isWeighed) {
            val kg = weightKg ?: (quantity / 1000.0)
            String.format(java.util.Locale.US, "%.3f kg %s", kg, productName)
        } else {
            "${quantity}x $productName"
        }

    /** Small rate line for weighed items, e.g. `15.00 CHF/kg`. */
    fun displayRateLabel(currencySymbol: String): String? =
        if (isWeighed) {
            String.format(java.util.Locale.US, "%.2f %s/kg", unitPrice, currencySymbol)
        } else null


    fun optionNotes(): String? {
        val lines = mutableListOf<String>()
        if (isCombo) {
            lines.add(COMBO_NOTES_MARKER)
            comboSelections.forEach { lines.add("${it.slotName}: ${it.productName}") }
        } else {
            modifiers.forEach { lines.add("${it.quantity}x ${it.name}") }
            addons.forEach { lines.add("${it.quantity}x ${it.name}") }
            notes?.trim()?.takeIf { it.isNotBlank() }?.let { lines.add(it) }
        }
        return lines.joinToString("\n").ifBlank { null }
    }

    fun modifierSummary(): String =
        if (isCombo) {
            comboSelections.joinToString(", ") { it.productName }
        } else {
            (modifiers.map { it.name } + addons.map { it.name }).joinToString(", ")
        }
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
    val guestCount: Int? = null,
    val activeCourse: Int = 1,
    val courseCount: Int = 1,
    val splitCount: Int = 1,
    val splitByItems: Boolean = false,
    val activeSplitCheck: Int = 1,
    val vatIncludedInPrice: Boolean = false
) {
    val visibleItems: List<CartItem>
        get() = if (splitByItems && splitCount > 1) {
            items.filter { it.splitCheck == activeSplitCheck }
        } else items

    val displayTotal: Double
        get() = when {
            splitByItems && splitCount > 1 -> CartSummary(
                items = visibleItems,
                discountPercent = discountPercent,
                discountAmount = discountAmount,
                vatIncludedInPrice = vatIncludedInPrice
            ).total
            splitCount > 1 -> total / splitCount
            else -> total
        }

    val fullTotal: Double get() = total
    /** Uses weight-aware catalog amounts so grams are never treated as unit counts. */
    val subtotal: Double get() = items.sumOf { it.catalogLineSubtotal }
    val itemDiscountTotal: Double get() = items.sumOf { it.lineDiscount }
    val taxTotal: Double get() = items.sumOf { it.lineTax }
    val discountValue: Double
        get() = when {
            discountPercent > 0 -> subtotal * (discountPercent / 100.0)
            discountAmount > 0 -> discountAmount.coerceAtMost(subtotal)
            else -> 0.0
        }
    val total: Double
        get() = if (vatIncludedInPrice) {
            (subtotal - itemDiscountTotal - discountValue).coerceAtLeast(0.0)
        } else {
            (subtotal + taxTotal - itemDiscountTotal - discountValue).coerceAtLeast(0.0)
        }
    val isEmpty: Boolean get() = items.isEmpty()

    /** Amount due for products before tip and cash rounding. */
    fun merchandiseTotal(checkoutDiscountPercent: Double = 0.0): Double {
        val netSubtotal = subtotal - itemDiscountTotal
        val discount = if (checkoutDiscountPercent > 0) {
            netSubtotal * (checkoutDiscountPercent / 100.0)
        } else {
            discountValue
        }
        return if (vatIncludedInPrice) {
            roundMoney((netSubtotal - discount).coerceAtLeast(0.0))
        } else {
            roundMoney((netSubtotal + taxTotal - discount).coerceAtLeast(0.0))
        }
    }
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
    val isWeighed: Boolean = false,
    val isCombo: Boolean = false,
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

data class ComboSelection(val slotName: String, val productId: Long, val productName: String)

data class ComboSlotOptionModel(val id: Long, val productId: Long, val productName: String)

data class ComboSlotModel(
    val id: Long,
    val name: String,
    val minPick: Int,
    val maxPick: Int,
    val options: List<ComboSlotOptionModel> = emptyList()
)

data class ComboMealModel(
    val product: ProductWithVariants,
    val slots: List<ComboSlotModel>
)

data class ComboPickState(val combo: ComboMealModel)

const val COMBO_NOTES_MARKER = "__COMBO__"

fun parseComboSelectionsFromNotes(notes: String?): Pair<Boolean, List<ComboSelection>> {
    if (notes.isNullOrBlank()) return false to emptyList()
    val lines = notes.lines().map { it.trim() }.filter { it.isNotBlank() }
    if (lines.firstOrNull() != COMBO_NOTES_MARKER) return false to emptyList()
    val selections = lines.drop(1).mapNotNull { line ->
        val idx = line.indexOf(':')
        if (idx <= 0) return@mapNotNull null
        val slot = line.substring(0, idx).trim()
        val product = line.substring(idx + 1).trim()
        if (slot.isBlank() || product.isBlank()) null else ComboSelection(slot, 0L, product)
    }
    return true to selections
}

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

enum class ProgrammedOrderSource {
    HELD,
    TRANSACTION
}

data class ProgrammedOrderCard(
    val id: String,
    val orderNumber: String,
    val serviceType: ServiceType,
    val fulfillmentType: FulfillmentType,
    val total: Double,
    val itemCount: Int,
    val pickupTimeMs: Long,
    val isPaid: Boolean,
    val source: ProgrammedOrderSource,
    val customerLabel: String? = null,
    val statusLabel: String = ""
)

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

enum class FloorPlanElementType(val apiValue: String) {
    WALL("WALL"),
    BAR("BAR"),
    OBSTACLE("OBSTACLE");

    companion object {
        fun fromApi(value: String?): FloorPlanElementType = entries.find {
            it.apiValue.equals(value, ignoreCase = true)
        } ?: WALL
    }
}

enum class TableShape(val apiValue: String) {
    ROUND("ROUND"),
    SQUARE("SQUARE"),
    RECT("RECT");

    companion object {
        fun fromApi(value: String?): TableShape = entries.find {
            it.apiValue.equals(value, ignoreCase = true)
        } ?: ROUND
    }
}

data class TableWithOrderInfo(
    val id: Long,
    val name: String,
    val sortOrder: Int,
    val openOrderId: String?,
    val itemCount: Int,
    val unsentItemCount: Int,
    val sentItemCount: Int,
    val orderTotal: Double,
    val status: TableStatus = TableStatus.FREE,
    val floorId: Long = 1,
    val seatCapacity: Int = 4,
    val planX: Float = 0f,
    val planY: Float = 0f,
    val planWidth: Float = 0.12f,
    val planHeight: Float = 0.12f,
    val shape: String = "ROUND",
    val rotation: Float = 0f,
    val guestCount: Int? = null
) {
    val hasPlanPosition: Boolean get() = planX > 0f || planY > 0f
}

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
    val takeawayCount: Int,
    val productsSold: List<ProductSalesReport> = emptyList(),
    /** Sum of guest/cover counts from dine-in transactions (when seating plan tracking enabled). */
    val coversServed: Int? = null
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
