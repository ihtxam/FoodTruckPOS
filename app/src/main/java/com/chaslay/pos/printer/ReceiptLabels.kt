package com.chaslay.pos.printer

import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.ServiceType
import java.util.Locale

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
    val payLater: String,
    val kitchenTitle: String,
    val kitchenMessageTitle: String,
    val itemsHeader: String,
    val pickupAt: String,
    val deliveryAt: String,
    val deliverTo: String,
    val tel: String,
    val asap: String,
    val roundLabel: String,
    val fireCourse: String,
    val courseLabel: String,
    val byStaff: String,
    val sourcePos: String,
    val sourceWaiter: String,
    val sourceWeb: String,
    val sourceOnline: String
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

    fun orderSourceLabel(source: String?): String {
        val key = source?.trim()?.uppercase(Locale.ROOT).orEmpty()
        return when {
            key.contains("WAITER") -> sourceWaiter
            key.contains("WEB") -> sourceWeb
            key.contains("ONLINE") || key.contains("SHOP") || key.contains("KIOSK") -> sourceOnline
            else -> sourcePos
        }
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
            payLater = "Pay Later",
            kitchenTitle = "KITCHEN",
            kitchenMessageTitle = "KITCHEN MESSAGE",
            itemsHeader = "ITEMS",
            pickupAt = "Pickup",
            deliveryAt = "Delivery time",
            deliverTo = "Deliver to",
            tel = "Tel",
            asap = "ASAP",
            roundLabel = "Round",
            fireCourse = "FIRE COURSE",
            courseLabel = "COURSE",
            byStaff = "By",
            sourcePos = "POS",
            sourceWaiter = "Waiter app",
            sourceWeb = "WebPOS",
            sourceOnline = "Online"
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
            payLater = "Payer plus tard",
            kitchenTitle = "CUISINE",
            kitchenMessageTitle = "MESSAGE CUISINE",
            itemsHeader = "ARTICLES",
            pickupAt = "Retrait",
            deliveryAt = "Heure livraison",
            deliverTo = "Livrer à",
            tel = "Tél",
            asap = "Dès que possible",
            roundLabel = "Tour",
            fireCourse = "ENVOYER PLAT",
            courseLabel = "PLAT",
            byStaff = "Par",
            sourcePos = "Caisse",
            sourceWaiter = "App serveur",
            sourceWeb = "WebPOS",
            sourceOnline = "En ligne"
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
            payLater = "Sp\u00E4ter zahlen",
            kitchenTitle = "KUECHE",
            kitchenMessageTitle = "KUECHEN-NACHRICHT",
            itemsHeader = "ARTIKEL",
            pickupAt = "Abholung",
            deliveryAt = "Lieferzeit",
            deliverTo = "Lieferung an",
            tel = "Tel",
            asap = "Sofort",
            roundLabel = "Gang",
            fireCourse = "GANG SENDEN",
            courseLabel = "GANG",
            byStaff = "Von",
            sourcePos = "Kasse",
            sourceWaiter = "Kellner-App",
            sourceWeb = "WebPOS",
            sourceOnline = "Online"
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
            payLater = "Paga dopo",
            kitchenTitle = "CUCINA",
            kitchenMessageTitle = "MESSAGGIO CUCINA",
            itemsHeader = "ARTICOLI",
            pickupAt = "Ritiro",
            deliveryAt = "Orario consegna",
            deliverTo = "Consegna a",
            tel = "Tel",
            asap = "Subito",
            roundLabel = "Turno",
            fireCourse = "INVIA PORTATA",
            courseLabel = "PORTATA",
            byStaff = "Da",
            sourcePos = "POS",
            sourceWaiter = "App cameriere",
            sourceWeb = "WebPOS",
            sourceOnline = "Online"
        )
    }
}
