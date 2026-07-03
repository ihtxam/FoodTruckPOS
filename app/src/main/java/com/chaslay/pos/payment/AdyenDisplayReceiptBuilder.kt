package com.chaslay.pos.payment

import com.chaslay.pos.domain.model.CartItem
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale

object AdyenDisplayReceiptBuilder {

    fun buildVirtualReceiptXml(
        businessName: String,
        items: List<CartItem>,
        total: Double,
        currencySymbol: String,
        receiptUrl: String
    ): String {
        val encodedQr = URLEncoder.encode(receiptUrl, StandardCharsets.UTF_8.toString())
        val lineItems = buildString {
            items.forEach { item ->
                val label = buildString {
                    append(item.productName)
                    item.variantName?.let { append(" ($it)") }
                }.escapeXml()
                append(
                    """
                    <lineitem>
                        <count>${item.quantity}</count>
                        <description>$label</description>
                        <amount>
                            <currency>${currencySymbol.escapeXml()}</currency>
                            <value>${"%.2f".format(Locale.US, item.lineTotal)}</value>
                        </amount>
                    </lineitem>
                    """.trimIndent()
                )
            }
        }

        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <screen name="virtual-receipt-with-qr-code.xslt">
                <receipt>
                    <qrcodeblock>
                        <qrheader>
                            <description>Scan for digital receipt</description>
                        </qrheader>
                        <call-to-action>Scan</call-to-action>
                        <qrcodedata>$encodedQr</qrcodedata>
                        <qrfooter>
                            <description>Digital receipt</description>
                        </qrfooter>
                    </qrcodeblock>
                    <list-header>${businessName.escapeXml()}</list-header>
                    <lines>
                        $lineItems
                    </lines>
                    <total>
                        <description>Total amount:</description>
                        <amount>
                            <currency>${currencySymbol.escapeXml()}</currency>
                            <value>${"%.2f".format(Locale.US, total)}</value>
                        </amount>
                    </total>
                </receipt>
            </screen>
            """.trimIndent()
    }

    private fun String.escapeXml(): String = this
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}
