package com.chaslay.pos.data.menuimport

import com.chaslay.pos.domain.model.PrintTarget

enum class MenuImportMode {
    REPLACE_ALL,
    MERGE
}

data class ParsedCategoryRow(
    val name: String,
    val sortOrder: Int = 0,
    val colorHex: String = "#5B9BD5",
    val printTarget: PrintTarget = PrintTarget.KITCHEN,
    val onlineVisible: Boolean = true
)

data class ParsedProductRow(
    val name: String,
    val categoryName: String?,
    val price: Double,
    val taxRate: Double = 2.6,
    val sku: String? = null,
    val barcode: String? = null,
    val isOpenPrice: Boolean = false,
    val isWeighed: Boolean = false,
    val sortOrder: Int = 0,
    val stockQuantity: Int? = null,
    val lowStockThreshold: Int? = null,
    val onlineVisible: Boolean = true,
    val printTarget: PrintTarget? = null,
    val variants: List<ParsedVariantRow> = emptyList()
)

data class ParsedVariantRow(
    val name: String,
    val price: Double,
    val sku: String? = null,
    val barcode: String? = null
)

data class ParsedMenuFile(
    val categories: List<ParsedCategoryRow>,
    val products: List<ParsedProductRow>,
    val warnings: List<String> = emptyList()
)

data class MenuImportResult(
    val categoriesAdded: Int = 0,
    val categoriesUpdated: Int = 0,
    val productsAdded: Int = 0,
    val productsUpdated: Int = 0,
    val warnings: List<String> = emptyList()
)
