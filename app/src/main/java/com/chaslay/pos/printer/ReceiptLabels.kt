package com.chaslay.pos.printer

import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.ServiceType

/** Localized receipt / print labels (uses business default language). */
data class ReceiptLabels(
    val provisionalInvoice: String,
    val orderNumber: String,
    val table: String,
    val itemDiscount: String,
    val discount: String,
    val discountPercent: String,
    val tip: String,
    val total: String,
    val vatTitle: String,
    val vatType: String,
    val vatNet: String,
    val vatTax: String,
    val vatGross: String,
    val vatIncludedNote: String,
    val payment: String,
    val paid: String,
    val staff: String,
    val source: String,
    val scanDigitalReceipt: String,
    val note: String,
    val rounding: String,
    val dineIn: String,
    val takeaway: String,
    val delivery: String,
    val cash: String,
    val card: String,
    val tapToPay: String,
    val terminal: String,
    val payLater: String
) {
    fun fulfillmentLabel(fulfillmentType: FulfillmentType, serviceType: ServiceType): String =
        when (fulfillmentType) {
            FulfillmentType.DINE_IN -> dineIn
            FulfillmentType.PICKUP -> takeaway
            FulfillmentType.DELIVERY -> delivery
            else -> when (serviceType) {
                ServiceType.DINE_IN -> dineIn
                ServiceType.TAKEAWAY -> takeaway
            }
        }

    fun paymentMethod(method: PaymentMethod): String = when (method) {
        PaymentMethod.CASH -> cash
        PaymentMethod.CARD -> card
        PaymentMethod.TAP_TO_PAY -> tapToPay
        PaymentMethod.ADYEN_TERMINAL -> terminal
        PaymentMethod.PAY_LATER -> payLater
    }

    companion object {
        fun forLanguage(languageCode: String): ReceiptLabels =
            when (AppLanguage.fromCode(languageCode)) {
                AppLanguage.FRENCH -> french()
                AppLanguage.GERMAN -> german()
                AppLanguage.ITALIAN -> italian()
                else -> english()
            }

        private fun english() = ReceiptLabels(
            provisionalInvoice = "PROVISIONAL INVOICE",
            orderNumber = "Order #",
            table = "Table:",
            itemDiscount = "Item discount",
            discount = "Discount:",
            discountPercent = "Discount (%d%%):",
            tip = "Tip:",
            total = "TOTAL",
            vatTitle = "VAT",
            vatType = "Type",
            vatNet = "Net",
            vatTax = "VAT",
            vatGross = "Gross",
            vatIncludedNote = "VAT included in prices",
            payment = "Payment:",
            paid = "Paid:",
            staff = "Staff:",
            source = "Source:",
            scanDigitalReceipt = "Scan for digital receipt",
            note = "Note:",
            rounding = "Rounding:",
            dineIn = "DINE-IN",
            takeaway = "TAKEAWAY",
            delivery = "DELIVERY",
            cash = "Cash",
            card = "Card",
            tapToPay = "Tap-to-Pay",
            terminal = "Terminal",
            payLater = "Pay Later"
        )

        private fun french() = ReceiptLabels(
            provisionalInvoice = "FACTURE PROVISOIRE",
            orderNumber = "Commande n\u00B0",
            table = "Table :",
            itemDiscount = "Remise article",
            discount = "Remise :",
            discountPercent = "Remise (%d%%) :",
            tip = "Pourboire :",
            total = "TOTAL",
            vatTitle = "TVA",
            vatType = "Type",
            vatNet = "Net",
            vatTax = "TVA",
            vatGross = "Brut",
            vatIncludedNote = "TVA incluse dans les prix",
            payment = "Paiement :",
            paid = "Pay\u00E9 :",
            staff = "Personnel :",
            source = "Source :",
            scanDigitalReceipt = "Scannez pour le re\u00E7u digital",
            note = "Note :",
            rounding = "Arrondi :",
            dineIn = "SUR PLACE",
            takeaway = "EMPORTER",
            delivery = "LIVRAISON",
            cash = "Esp\u00E8ces",
            card = "Carte",
            tapToPay = "Tap-to-Pay",
            terminal = "Terminal",
            payLater = "Payer plus tard"
        )

        private fun german() = ReceiptLabels(
            provisionalInvoice = "PROVISORISCHE RECHNUNG",
            orderNumber = "Bestellung Nr.",
            table = "Tisch:",
            itemDiscount = "Artikelrabatt",
            discount = "Rabatt:",
            discountPercent = "Rabatt (%d%%):",
            tip = "Trinkgeld:",
            total = "TOTAL",
            vatTitle = "MwSt.",
            vatType = "Typ",
            vatNet = "Netto",
            vatTax = "MwSt.",
            vatGross = "Brutto",
            vatIncludedNote = "MwSt. im Preis enthalten",
            payment = "Zahlung:",
            paid = "Bezahlt:",
            staff = "Personal:",
            source = "Quelle:",
            scanDigitalReceipt = "Scannen f\u00FCr digitalen Beleg",
            note = "Notiz:",
            rounding = "Rundung:",
            dineIn = "VOR ORT",
            takeaway = "ZUM MITNEHMEN",
            delivery = "LIEFERUNG",
            cash = "Bar",
            card = "Karte",
            tapToPay = "Tap-to-Pay",
            terminal = "Terminal",
            payLater = "Sp\u00E4ter zahlen"
        )

        private fun italian() = ReceiptLabels(
            provisionalInvoice = "FATTURA PROVVISORIA",
            orderNumber = "Ordine n.",
            table = "Tavolo:",
            itemDiscount = "Sconto articolo",
            discount = "Sconto:",
            discountPercent = "Sconto (%d%%):",
            tip = "Mancia:",
            total = "TOTALE",
            vatTitle = "IVA",
            vatType = "Tipo",
            vatNet = "Netto",
            vatTax = "IVA",
            vatGross = "Lordo",
            vatIncludedNote = "IVA inclusa nei prezzi",
            payment = "Pagamento:",
            paid = "Pagato:",
            staff = "Personale:",
            source = "Origine:",
            scanDigitalReceipt = "Scansiona per ricevuta digitale",
            note = "Nota:",
            rounding = "Arrotondamento:",
            dineIn = "SUL POSTO",
            takeaway = "ASPORTO",
            delivery = "CONSEGNA",
            cash = "Contanti",
            card = "Carta",
            tapToPay = "Tap-to-Pay",
            terminal = "Terminale",
            payLater = "Paga dopo"
        )
    }
}
