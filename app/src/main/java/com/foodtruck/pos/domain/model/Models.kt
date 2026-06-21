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
    REFUNDED
}

enum class SyncStatus {
    PENDING,
    SYNCED,
    FAILED
}

enum class SupportedCurrency(val code: String, val symbol: String) {
    CHF("CHF", "CHF"),
    EUR("EUR", "€"),
    USD("USD", "$"),
    GBP("GBP", "£"),
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
    FRENCH("fr", "Français"),
    ITALIAN("it", "Italiano"),
    ARABIC("ar", "???????"),
    SPANISH("es", "Español");

    companion object {
        fun fromCode(code: String): AppLanguage =
            entries.find { it.code == code } ?: ENGLISH
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
    val sku: String? = null
) {
    val lineSubtotal: Double get() = unitPrice * quantity
    val lineTax: Double get() = lineSubtotal * (taxRate / 100.0)
    val lineTotal: Double get() = lineSubtotal + lineTax
}

data class CartSummary(
    val items: List<CartItem>,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val cartNotes: String? = null
) {
    val subtotal: Double get() = items.sumOf { it.lineSubtotal }
    val taxTotal: Double get() = items.sumOf { it.lineTax }
    val discountValue: Double
        get() = when {
            discountPercent > 0 -> subtotal * (discountPercent / 100.0)
            discountAmount > 0 -> discountAmount.coerceAtMost(subtotal)
            else -> 0.0
        }
    val total: Double get() = (subtotal + taxTotal - discountValue).coerceAtLeast(0.0)
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

data class DashboardStats(
    val todaySales: Double,
    val transactionCount: Int,
    val cashRevenue: Double,
    val cardRevenue: Double
)
