package com.chaslay.pos.payment

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.chaslay.pos.data.local.entity.TransactionEntity
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

data class AdyenReceiptLine(
    val text: String,
    val bold: Boolean = false,
    val centered: Boolean = false,
    val endOfLine: Boolean = true
)

data class AdyenTerminalReceipt(
    val documentQualifier: String,
    val lines: List<AdyenReceiptLine>
)

object AdyenPaymentReceiptParser {

    fun parsePaymentReceipts(paymentResponse: JsonObject): Pair<AdyenTerminalReceipt?, AdyenTerminalReceipt?> {
        val receipts = paymentResponse.getAsJsonArray("PaymentReceipt") ?: return null to null
        var customer: AdyenTerminalReceipt? = null
        var cashier: AdyenTerminalReceipt? = null
        for (element in receipts) {
            val receipt = element.asJsonObject
            val qualifier = receipt.get("DocumentQualifier")?.asString.orEmpty()
            val outputText = receipt
                .getAsJsonObject("OutputContent")
                ?.getAsJsonArray("OutputText")
                ?: continue
            val parsed = AdyenTerminalReceipt(
                documentQualifier = qualifier,
                lines = parseOutputText(outputText)
            )
            when {
                qualifier.equals("CustomerReceipt", ignoreCase = true) -> customer = parsed
                qualifier.equals("CashierReceipt", ignoreCase = true) -> cashier = parsed
            }
        }
        return customer to cashier
    }

    private fun parseOutputText(outputText: JsonArray): List<AdyenReceiptLine> {
        val lines = mutableListOf<AdyenReceiptLine>()
        for (element in outputText) {
            val obj = element.asJsonObject
            val rawText = obj.get("Text")?.asString.orEmpty()
            val bold = obj.get("CharacterStyle")?.asString
                ?.equals("Bold", ignoreCase = true) == true
            val alignment = obj.get("Alignment")?.asString.orEmpty()
            val centered = alignment.equals("Centred", ignoreCase = true) ||
                alignment.equals("Center", ignoreCase = true) ||
                alignment.equals("Right", ignoreCase = true)
            val endOfLine = obj.get("EndOfLineFlag")?.asBoolean ?: true
            lines += AdyenReceiptLine(
                text = renderLine(rawText),
                bold = bold,
                centered = centered,
                endOfLine = endOfLine
            )
        }
        return lines
    }

    private fun renderLine(rawText: String): String {
        val decoded = urlDecode(rawText)
        if (!decoded.contains('=')) return decoded

        val params = decoded.split('&').associate { part ->
            val separator = part.indexOf('=')
            if (separator < 0) {
                part to ""
            } else {
                part.substring(0, separator) to urlDecode(part.substring(separator + 1))
            }
        }

        val key = params["key"].orEmpty()
        val name = params["name"].orEmpty()
        val value = params["value"].orEmpty()

        return when (key.lowercase()) {
            "filler" -> ""
            "sigline", "merchantsigline" -> "____________________________"
            "signature" -> ""
            "header1", "header2", "thanks", "approved", "refused", "void", "cardholderheader" ->
                value.ifBlank { name }
            else -> when {
                name.isNotBlank() && value.isNotBlank() -> leftRight(name, value, 32)
                name.isNotBlank() -> name
                value.isNotBlank() -> value
                else -> ""
            }
        }
    }

    private fun leftRight(left: String, right: String, width: Int): String {
        val leftText = left.take(width - right.length - 1)
        val padding = (width - leftText.length - right.length).coerceAtLeast(1)
        return leftText + " ".repeat(padding) + right
    }

    private fun urlDecode(value: String): String = runCatching {
        URLDecoder.decode(value, StandardCharsets.UTF_8.name())
    }.getOrDefault(value)
}

object AdyenPaymentReceiptStorage {
    private val gson = Gson()

    fun toJson(receipt: AdyenTerminalReceipt?): String? =
        receipt?.let { gson.toJson(it) }

    fun fromJson(json: String?): AdyenTerminalReceipt? =
        json?.takeIf { it.isNotBlank() }?.let {
            runCatching { gson.fromJson(it, AdyenTerminalReceipt::class.java) }.getOrNull()
        }

    fun customerReceipt(transaction: TransactionEntity): AdyenTerminalReceipt? =
        fromJson(transaction.adyenCustomerReceiptJson)

    fun cashierReceipt(transaction: TransactionEntity): AdyenTerminalReceipt? =
        fromJson(transaction.adyenCashierReceiptJson)
}

object AdyenPaymentReceiptFormatter {

    fun toPlainText(receipt: AdyenTerminalReceipt, lineWidth: Int = 32): String = buildString {
        var pending = ""
        receipt.lines.forEach { line ->
            val segment = when {
                line.centered -> center(line.text, lineWidth)
                line.bold -> line.text.uppercase()
                else -> line.text
            }
            if (line.endOfLine) {
                appendLine(pending + segment)
                pending = ""
            } else {
                pending += segment
            }
        }
        if (pending.isNotEmpty()) appendLine(pending)
        appendLine("\n\n")
    }

    private fun center(text: String, width: Int): String {
        if (text.length >= width) return text
        val pad = (width - text.length) / 2
        return " ".repeat(pad.coerceAtLeast(0)) + text
    }
}
