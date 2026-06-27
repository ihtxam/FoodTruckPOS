package com.foodtruck.pos.data.remote.dto

import com.google.gson.JsonElement

data class SyncCategoryDto(
    val id: String,
    val name: String,
    val sort_order: Int? = null,
    val color_hex: String? = null,
    val online_visible: Boolean? = null,
    val kiosk_visible: Boolean? = null,
    val updated_at: String? = null,
    val deleted_at: String? = null
)

data class SyncProductDto(
    val id: String,
    val category_id: String? = null,
    val name: String,
    val description: String? = null,
    val price: Double = 0.0,
    val tax_rate: Double? = null,
    val sku: String? = null,
    val image_url: String? = null,
    val sort_order: Int? = null,
    val in_stock: Boolean? = null,
    val online_visible: Boolean? = null,
    val kiosk_visible: Boolean? = null,
    val updated_at: String? = null,
    val deleted_at: String? = null
)

data class MenuBootstrapResponse(
    val serverTime: Long,
    val categories: List<SyncCategoryDto> = emptyList(),
    val products: List<SyncProductDto> = emptyList()
)

data class MenuChangesResponse(
    val serverTime: Long,
    val categories: List<SyncCategoryDto> = emptyList(),
    val products: List<SyncProductDto> = emptyList()
)

data class OnlineOrderItemDto(
    val productName: String? = null,
    val name: String? = null,
    val quantity: Int = 1,
    val unitPrice: Double = 0.0,
    val lineTotal: Double? = null,
    val notes: String? = null
)

data class IncomingOnlineOrderDto(
    val id: String,
    val order_number: String,
    val source: String? = null,
    val status: String? = null,
    val service_type: String? = null,
    val fulfillment_type: String? = null,
    val customer_name: String? = null,
    val customer_phone: String? = null,
    val delivery_address: String? = null,
    val pickup_time_ms: Long? = null,
    val subtotal: Double = 0.0,
    val tax_total: Double = 0.0,
    val total: Double = 0.0,
    val notes: String? = null,
    val payload: JsonElement? = null,
    val created_at: String? = null
)

data class IncomingOrdersResponse(
    val serverTime: Long,
    val orders: List<IncomingOnlineOrderDto> = emptyList()
)

data class AckResponse(
    val ok: Boolean = true
)
