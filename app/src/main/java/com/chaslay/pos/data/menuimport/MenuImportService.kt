package com.chaslay.pos.data.menuimport

import com.chaslay.pos.domain.model.PrintTarget
import org.dhatim.fastexcel.Workbook
import org.dhatim.fastexcel.Worksheet
import org.dhatim.fastexcel.reader.Cell
import org.dhatim.fastexcel.reader.CellType
import org.dhatim.fastexcel.reader.ReadableWorkbook
import org.dhatim.fastexcel.reader.Row
import java.io.InputStream
import java.io.OutputStream
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MenuImportService @Inject constructor() {

    fun parse(inputStream: InputStream): ParsedMenuFile {
        val warnings = mutableListOf<String>()
        val categories = mutableListOf<ParsedCategoryRow>()
        val products = mutableListOf<ParsedProductRow>()

        ReadableWorkbook(inputStream).use { workbook ->
            val sheets = workbook.sheets.toList()
            if (sheets.isEmpty()) {
                warnings += "Workbook has no sheets"
                return ParsedMenuFile(emptyList(), emptyList(), warnings)
            }

            val categorySheet = sheets.firstOrNull {
                normalizeSheetName(it.name).contains("categor")
            }
            val productSheet = sheets.firstOrNull {
                normalizeSheetName(it.name).contains("product")
            } ?: sheets.lastOrNull { it != categorySheet }

            categorySheet?.let { sheet ->
                sheet.openStream().use { rows ->
                    var header: Map<String, Int>? = null
                    rows.forEach { row ->
                        if (header == null) {
                            header = parseHeader(row)
                            return@forEach
                        }
                        parseCategoryRow(row, header!!)?.let { categories += it }
                            ?: run {
                                if (rowHasData(row)) {
                                    warnings += "Skipped category row ${row.rowNum}: missing name"
                                }
                            }
                    }
                }
            }

            productSheet?.let { sheet ->
                sheet.openStream().use { rows ->
                    var header: Map<String, Int>? = null
                    rows.forEach { row ->
                        if (header == null) {
                            header = parseHeader(row)
                            return@forEach
                        }
                        parseProductRow(row, header!!)?.let { products += it }
                            ?: run {
                                if (rowHasData(row)) {
                                    warnings += "Skipped product row ${row.rowNum}: missing name"
                                }
                            }
                    }
                }
            }

            if (categorySheet == null && productSheet == null) {
                warnings += "Could not find Categories or Products sheet � check sheet names"
            }
        }

        return ParsedMenuFile(categories, products, warnings)
    }

    fun writeTemplate(outputStream: OutputStream) {
        Workbook(outputStream, "Chaslay POS", "1.0").use { workbook ->
            writeCategoriesSheet(workbook.newWorksheet("Categories"))
            writeProductsSheet(workbook.newWorksheet("Products"))
        }
    }

    private fun writeCategoriesSheet(sheet: Worksheet) {
        val headers = listOf("name", "sort_order", "color_hex", "print_target", "online_visible")
        headers.forEachIndexed { col, header -> sheet.value(0, col, header) }
        sheet.value(1, 0, "Beverages")
        sheet.value(1, 1, 0)
        sheet.value(1, 2, "#5B9BD5")
        sheet.value(1, 3, "KITCHEN")
        sheet.value(1, 4, true)
        sheet.value(2, 0, "Food")
        sheet.value(2, 1, 1)
        sheet.value(2, 2, "#70AD47")
        sheet.value(2, 3, "KITCHEN")
        sheet.value(2, 4, true)
        sheet.finish()
    }

    private fun writeProductsSheet(sheet: Worksheet) {
        val headers = listOf(
            "name", "category_name", "price", "tax_rate", "sku", "barcode",
            "is_open_price", "is_weighed", "sort_order", "stock_quantity",
            "low_stock_threshold", "online_visible", "print_target", "variants"
        )
        headers.forEachIndexed { col, header -> sheet.value(0, col, header) }
        sheet.value(1, 0, "Espresso")
        sheet.value(1, 1, "Beverages")
        sheet.value(1, 2, 3.50)
        sheet.value(1, 3, 2.6)
        sheet.value(1, 4, "BEV-001")
        sheet.value(1, 5, "7612345678901")
        sheet.value(1, 6, false)
        sheet.value(1, 7, false)
        sheet.value(1, 8, 0)
        sheet.value(1, 13, "Single|3.50;Double|4.50")
        sheet.value(2, 0, "Tomatoes")
        sheet.value(2, 1, "Food")
        sheet.value(2, 2, 4.90)
        sheet.value(2, 3, 2.6)
        sheet.value(2, 7, true)
        sheet.finish()
    }

    private fun parseHeader(row: Row): Map<String, Int> {
        val map = linkedMapOf<String, Int>()
        row.forEach { cell ->
            val key = normalizeHeader(cell.text?.trim().orEmpty())
            if (key.isNotBlank()) {
                map[key] = cell.columnIndex
            }
        }
        return map
    }

    private fun parseCategoryRow(row: Row, header: Map<String, Int>): ParsedCategoryRow? {
        val name = cellString(row, header, "name", "category", "category_name")?.trim().orEmpty()
        if (name.isBlank()) return null
        return ParsedCategoryRow(
            name = name,
            sortOrder = cellInt(row, header, "sort_order", "sort") ?: 0,
            colorHex = cellString(row, header, "color_hex", "color")?.trim()?.takeIf { it.isNotBlank() }
                ?: "#5B9BD5",
            printTarget = parsePrintTarget(cellString(row, header, "print_target")),
            onlineVisible = cellBoolean(row, header, "online_visible") ?: true
        )
    }

    private fun parseProductRow(row: Row, header: Map<String, Int>): ParsedProductRow? {
        val name = cellString(row, header, "name", "product", "product_name")?.trim().orEmpty()
        if (name.isBlank()) return null
        val isOpenPrice = cellBoolean(row, header, "is_open_price", "open_price") ?: false
        val isWeighed = cellBoolean(row, header, "is_weighed", "weighed", "sold_by_weight") ?: false
        val price = cellDouble(row, header, "price") ?: 0.0
        return ParsedProductRow(
            name = name,
            categoryName = cellString(row, header, "category_name", "category")?.trim()?.takeIf { it.isNotBlank() },
            price = price,
            taxRate = cellDouble(row, header, "tax_rate", "tax", "vat") ?: 2.6,
            sku = cellString(row, header, "sku")?.trim()?.takeIf { it.isNotBlank() },
            barcode = cellString(row, header, "barcode", "ean")?.trim()?.takeIf { it.isNotBlank() },
            isOpenPrice = isOpenPrice && !isWeighed,
            isWeighed = isWeighed && !isOpenPrice,
            sortOrder = cellInt(row, header, "sort_order", "sort") ?: 0,
            stockQuantity = cellInt(row, header, "stock_quantity", "stock"),
            lowStockThreshold = cellInt(row, header, "low_stock_threshold", "low_stock"),
            onlineVisible = cellBoolean(row, header, "online_visible") ?: true,
            printTarget = cellString(row, header, "print_target")?.let { parsePrintTarget(it) },
            variants = parseVariants(cellString(row, header, "variants", "variant"))
        )
    }

    private fun parseVariants(raw: String?): List<ParsedVariantRow> {
        val text = raw?.trim().orEmpty()
        if (text.isBlank()) return emptyList()
        return text.split(';').mapNotNull { segment ->
            val parts = segment.trim().split('|').map { it.trim() }
            if (parts.size >= 2) {
                ParsedVariantRow(
                    name = parts[0],
                    price = parts[1].replace(',', '.').toDoubleOrNull() ?: 0.0,
                    sku = parts.getOrNull(2),
                    barcode = parts.getOrNull(3)
                )
            } else null
        }
    }

    private fun parsePrintTarget(raw: String?): PrintTarget = when (raw?.trim()?.uppercase(Locale.US)) {
        "POS" -> PrintTarget.POS
        "BOTH" -> PrintTarget.BOTH
        else -> PrintTarget.KITCHEN
    }

    private fun normalizeSheetName(name: String?): String =
        name?.trim()?.lowercase(Locale.US).orEmpty()

    private fun normalizeHeader(raw: String): String = raw
        .lowercase(Locale.US)
        .replace(Regex("[^a-z0-9]+"), "_")
        .trim('_')

    private fun rowHasData(row: Row): Boolean =
        row.any { !it.text.isNullOrBlank() }

    private fun cellString(row: Row, header: Map<String, Int>, vararg keys: String): String? {
        val index = keys.firstNotNullOfOrNull { header[it] } ?: return null
        return row.getCellAsString(index).orElse(null)?.trim()?.takeIf { it.isNotEmpty() }
            ?: row.getCell(index)?.let { formatCell(it) }
    }

    private fun cellDouble(row: Row, header: Map<String, Int>, vararg keys: String): Double? {
        val index = keys.firstNotNullOfOrNull { header[it] } ?: return null
        val number = row.getCellAsNumber(index)
        if (number.isPresent) return number.get().toDouble()
        return cellString(row, header, *keys)?.replace(',', '.')?.toDoubleOrNull()
    }

    private fun cellInt(row: Row, header: Map<String, Int>, vararg keys: String): Int? {
        val index = keys.firstNotNullOfOrNull { header[it] } ?: return null
        val number = row.getCellAsNumber(index)
        if (number.isPresent) return number.get().toInt()
        return cellString(row, header, *keys)?.toIntOrNull()
    }

    private fun cellBoolean(row: Row, header: Map<String, Int>, vararg keys: String): Boolean? {
        val raw = cellString(row, header, *keys)?.lowercase(Locale.US) ?: return null
        return when (raw) {
            "true", "yes", "y", "1" -> true
            "false", "no", "n", "0" -> false
            else -> null
        }
    }

    private fun formatCell(cell: Cell): String? = when (cell.type) {
        CellType.NUMBER -> cell.asNumber()?.toPlainString()
        CellType.BOOLEAN -> cell.asBoolean()?.toString()
        else -> cell.text?.trim()
    }
}
