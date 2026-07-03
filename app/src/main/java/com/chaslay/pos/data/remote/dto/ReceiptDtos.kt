package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ReceiptPublishRequest(
    @SerializedName("id") val id: String,
    @SerializedName("transaction_number") val transactionNumber: String,
    @SerializedName("total") val total: Double,
    @SerializedName("currency") val currency: String,
    @SerializedName("payment_method") val paymentMethod: String,
    @SerializedName("card_reference") val cardReference: String? = null,
    @SerializedName("business_name") val businessName: String,
    @SerializedName("created_at") val createdAt: Long,
    @SerializedName("items") val items: List<ReceiptItemDto>,
    @SerializedName("subtotal") val subtotal: Double? = null,
    @SerializedName("tax_total") val taxTotal: Double? = null,
    @SerializedName("discount_amount") val discountAmount: Double? = null,
    @SerializedName("item_discount_total") val itemDiscountTotal: Double? = null
)

data class ReceiptItemDto(
    @SerializedName("product_name") val productName: String,
    @SerializedName("variant_name") val variantName: String? = null,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("line_total") val lineTotal: Double,
    @SerializedName("line_subtotal") val lineSubtotal: Double? = null,
    @SerializedName("line_discount") val lineDiscount: Double? = null,
    @SerializedName("unit_price") val unitPrice: Double? = null
)

data class ReceiptPublishResponse(
    @SerializedName("url") val url: String? = null,
    @SerializedName("id") val id: String? = null
)

data class ReceiptEmailRequest(
    @SerializedName("email") val email: String,
    @SerializedName("customer_name") val customerName: String? = null
)

data class ReceiptEmailResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("message") val message: String? = null
)
