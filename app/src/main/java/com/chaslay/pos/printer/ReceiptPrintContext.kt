package com.chaslay.pos.printer

import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.VatBreakdownRow

data class ReceiptPrintContext(
    val orderNumber: String? = null,
    val serviceType: ServiceType = ServiceType.TAKEAWAY,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val tableName: String? = null,
    val paymentMethod: PaymentMethod? = null,
    val amountPaid: Double? = null,
    val staffName: String = "Staff",
    val sourceLabel: String = "POS",
    val isProvisional: Boolean = paymentMethod == null
)

object ReceiptVatCalculator {
    fun vatRowsFromCartItems(items: List<CartItem>, discountFactor: Double = 1.0): List<VatBreakdownRow> =
        items.filter { it.taxRate > 0.0 }
            .groupBy { it.taxRate }
            .map { (rate, groupItems) ->
                val brut = groupItems.sumOf { it.lineTotal } * discountFactor
                val net = brut / (1.0 + rate / 100.0)
                val tva = brut - net
                VatBreakdownRow(
                    label = "${formatRate(rate)}%",
                    rate = rate,
                    net = net,
                    tva = tva,
                    brut = brut
                )
            }
            .sortedByDescending { it.rate }

    /** VAT breakdown from saved transaction lines (applies order-level discount proportionally). */
    fun vatRowsFromTransactionItems(
        items: List<com.chaslay.pos.data.local.entity.TransactionItemEntity>,
        discountFactor: Double = 1.0
    ): List<VatBreakdownRow> =
        items.filter { it.taxRate > 0.0 }
            .groupBy { it.taxRate }
            .map { (rate, groupItems) ->
                val brut = groupItems.sumOf { it.lineTotal } * discountFactor
                val net = brut / (1.0 + rate / 100.0)
                val tva = brut - net
                VatBreakdownRow(
                    label = "${formatRate(rate)}%",
                    rate = rate,
                    net = net,
                    tva = tva,
                    brut = brut
                )
            }
            .sortedByDescending { it.rate }

    fun modifierSummaryFromNotes(notes: String?): String? {
        if (notes.isNullOrBlank()) return null
        val names = notes.lines().mapNotNull { line ->
            Regex("^(\\d+)x\\s+(.+)$").find(line.trim())?.groupValues?.get(2)
        }
        return names.takeIf { it.isNotEmpty() }?.joinToString(", ")
    }

    fun modifierSummary(item: CartItem): String? {
        val names = buildList {
            item.modifiers.forEach { add(it.name) }
            item.addons.forEach { add(it.name) }
        }
        return names.takeIf { it.isNotEmpty() }?.joinToString(", ")
            ?: modifierSummaryFromNotes(item.notes)
    }

    fun formatRate(rate: Double): String =
        if (rate % 1.0 == 0.0) rate.toInt().toString() else String.format("%.1f", rate)
}
