package com.chaslay.pos.data.menuimport

import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.data.repository.MenuRepository
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.ui.catalog.CategoryColorPresets
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MenuImportRepository @Inject constructor(
    private val importService: MenuImportService,
    private val productRepository: ProductRepository,
    private val menuRepository: MenuRepository,
    private val productDao: ProductDao,
    private val categoryDao: CategoryDao
) {

    fun parse(inputStream: java.io.InputStream): ParsedMenuFile =
        importService.parse(inputStream)

    fun writeTemplate(outputStream: java.io.OutputStream) =
        importService.writeTemplate(outputStream)

    suspend fun applyImport(mode: MenuImportMode, parsed: ParsedMenuFile): MenuImportResult {
        val warnings = parsed.warnings.toMutableList()
        if (parsed.categories.isEmpty() && parsed.products.isEmpty()) {
            warnings += "No categories or products found in file"
            return MenuImportResult(warnings = warnings)
        }

        if (mode == MenuImportMode.REPLACE_ALL) {
            productDao.deactivateAll()
            categoryDao.deactivateAll()
        }

        var categoriesAdded = 0
        var categoriesUpdated = 0
        var productsAdded = 0
        var productsUpdated = 0

        val categoryIdByName = mutableMapOf<String, Long>()
        val existingCategories = if (mode == MenuImportMode.MERGE) {
            productRepository.getAllCategories().associateBy { it.name.normalizedKey() }.toMutableMap()
        } else {
            mutableMapOf()
        }

        var colorIndex = existingCategories.size
        parsed.categories.forEachIndexed { index, row ->
            val key = row.name.normalizedKey()
            val existing = existingCategories[key]
            val autoColor = CategoryColorPresets[colorIndex % CategoryColorPresets.size].first
            val resolvedColor = row.colorHex.trim().takeIf { it.isNotBlank() && it.startsWith("#") }
                ?: autoColor
            if (existing != null && mode == MenuImportMode.MERGE) {
                categoryDao.update(
                    existing.copy(
                        sortOrder = row.sortOrder,
                        colorHex = if (row.colorHex.isNotBlank()) resolvedColor else existing.colorHex,
                        printTarget = row.printTarget,
                        onlineVisible = row.onlineVisible,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                categoryIdByName[key] = existing.id
                categoriesUpdated++
            } else {
                val id = productRepository.saveCategory(
                    CategoryEntity(
                        name = row.name.trim(),
                        sortOrder = row.sortOrder,
                        colorHex = resolvedColor,
                        printTarget = row.printTarget,
                        onlineVisible = row.onlineVisible
                    )
                )
                categoryIdByName[key] = id
                categoriesAdded++
                colorIndex++
            }
        }

        if (mode == MenuImportMode.MERGE) {
            productRepository.getAllCategories().forEach { cat ->
                categoryIdByName.putIfAbsent(cat.name.normalizedKey(), cat.id)
            }
        }

        val existingProducts = if (mode == MenuImportMode.MERGE) {
            productRepository.getAllProducts()
        } else {
            emptyList()
        }

        parsed.products.forEach { row ->
            val categoryId = row.categoryName?.let { categoryIdByName[it.normalizedKey()] }
            if (row.categoryName != null && categoryId == null) {
                warnings += "Product \"${row.name}\": category \"${row.categoryName}\" not found � skipped"
                return@forEach
            }

            if (mode == MenuImportMode.MERGE) {
                val match = findExistingProduct(existingProducts, row, categoryId)
                if (match != null) {
                    productRepository.upsertProduct(
                        match.copy(
                            price = row.price,
                            taxRate = row.taxRate,
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                    productsUpdated++
                    return@forEach
                }
            }

            val productId = productRepository.upsertProduct(
                ProductEntity(
                    name = row.name.trim(),
                    categoryId = categoryId,
                    price = row.price,
                    taxRate = row.taxRate,
                    sku = row.sku,
                    barcode = row.barcode,
                    isOpenPrice = row.isOpenPrice,
                    isWeighed = row.isWeighed,
                    sortOrder = row.sortOrder,
                    stockQuantity = row.stockQuantity,
                    lowStockThreshold = row.lowStockThreshold,
                    onlineVisible = row.onlineVisible,
                    printTarget = row.printTarget
                )
            )
            if (row.variants.isNotEmpty()) {
                menuRepository.replaceProductVariants(
                    productId,
                    row.variants.map {
                        ProductVariantEntity(
                            productId = productId,
                            name = it.name,
                            price = it.price,
                            sku = it.sku,
                            barcode = it.barcode
                        )
                    }
                )
            }
            productsAdded++
        }

        return MenuImportResult(
            categoriesAdded = categoriesAdded,
            categoriesUpdated = categoriesUpdated,
            productsAdded = productsAdded,
            productsUpdated = productsUpdated,
            warnings = warnings
        )
    }

    private suspend fun findExistingProduct(
        products: List<ProductEntity>,
        row: ParsedProductRow,
        categoryId: Long?
    ): ProductEntity? {
        row.sku?.let { sku ->
            productDao.getBySku(sku)?.let { return it }
        }
        row.barcode?.let { barcode ->
            productDao.getByBarcode(barcode)?.let { return it }
        }
        return products.find { product ->
            product.name.normalizedKey() == row.name.normalizedKey() &&
                product.categoryId == categoryId
        }
    }

    private fun String.normalizedKey(): String =
        trim().lowercase(Locale.US)
}
