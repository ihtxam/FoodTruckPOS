package com.chaslay.pos.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

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
    @SerializedName("is_open_price") val isOpenPrice: Boolean? = null,
    @SerializedName("sold_by_weight") val soldByWeight: Boolean? = null,
    @SerializedName("product_type") val productType: String? = null,
    val online_visible: Boolean? = null,
    val kiosk_visible: Boolean? = null,
    val updated_at: String? = null,
    val deleted_at: String? = null
)

data class SyncBusinessDto(
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null,
    @SerializedName("vat_number") val vatNumber: String? = null,
    @SerializedName("vat_rate") val vatRate: Double? = null,
    @SerializedName("tax_takeaway_rate") val taxTakeawayRate: Double? = null,
    @SerializedName("tax_dine_in_rate") val taxDineInRate: Double? = null,
    @SerializedName("tax_delivery_rate") val taxDeliveryRate: Double? = null,
    @SerializedName("tax_included_in_price") val taxIncludedInPrice: Boolean? = null,
    @SerializedName("default_language") val defaultLanguage: String? = null,
    @SerializedName("store_hours") val storeHours: Map<String, Map<String, List<SyncStoreHoursSlotDto>>>? = null
)

data class SyncStoreHoursSlotDto(
    val open: String,
    val close: String
)

data class MenuBootstrapResponse(
    val serverTime: Long,
    val business: SyncBusinessDto? = null,
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

data class SyncAdyenConfigDto(
    val merchant_account: String? = null,
    val api_key: String? = null,
    val client_id: String? = null
)

data class SyncPaymentTerminalDto(
    val id: String? = null,
    val terminal_id: String,
    val terminal_name: String? = null,
    val serial_number: String? = null,
    val status: String? = null
)

data class SyncPaymentMethodsDto(
    val express: Boolean = true,
    val cash: Boolean = true,
    val card: Boolean = true,
    val terminal: Boolean = false
)

data class SyncFeaturesDto(
    @SerializedName("courses_enabled") val coursesEnabled: Boolean = false,
    @SerializedName("floor_plan_enabled") val floorPlanEnabled: Boolean = false,
    @SerializedName("pax_ordering_enabled") val paxOrderingEnabled: Boolean = false
)

data class SyncCheckoutDiscountPresetDto(
    val id: String? = null,
    val name: String? = null,
    val percent: Double = 0.0
)

data class SyncCheckoutDto(
    val tipsEnabled: Boolean = true,
    val tipPresetsPercent: List<Double> = listOf(0.0, 5.0, 10.0, 15.0),
    val allowCustomTip: Boolean = true,
    val discountsEnabled: Boolean = true,
    val discountPresets: List<SyncCheckoutDiscountPresetDto> = emptyList(),
    val roundingStep: Double = 0.05,
    val quickCashEnabled: Boolean = true,
    val quickCashDenominations: List<Double> = listOf(10.0, 20.0, 50.0, 100.0),
    val splitBillsEnabled: Boolean = true,
    val maxSplitParts: Int = 8,
    val vatIncludedInPrice: Boolean = false
)

data class PaymentConfigResponse(
    val serverTime: Long = 0L,
    val adyen: SyncAdyenConfigDto? = null,
    val default_terminal_id: String? = null,
    val terminals: List<SyncPaymentTerminalDto> = emptyList(),
    val terminal_ready: Boolean = false,
    val methods: SyncPaymentMethodsDto? = null,
    val features: SyncFeaturesDto? = null,
    val checkout: SyncCheckoutDto? = null
)

data class PushTerminalItemDto(
    val terminalId: String,
    val terminalName: String? = null,
    val serialNumber: String? = null,
    val status: String? = null
)

data class PushTerminalsRequest(
    val terminals: List<PushTerminalItemDto>? = null,
    val defaultTerminalId: String? = null,
    val adyenMerchantAccount: String? = null,
    val adyenApiKey: String? = null,
    val adyenClientId: String? = null,
    val adyenTerminalEnabled: Boolean? = null,
    val deviceLabel: String? = null
)

data class PushTerminalsResponse(
    val ok: Boolean = true,
    val upserted: Int = 0,
    val serverTime: Long = 0L
)

data class SyncStaffRoleDto(
    val id: String,
    val name: String,
    val permissions: List<String> = emptyList(),
    val isSystem: Boolean = false
)

data class SyncStaffMemberDto(
    val id: String,
    val name: String,
    val roleId: String,
    val pinHash: String? = null,
    val isActive: Boolean = true
)

data class StaffSyncResponse(
    val roles: List<SyncStaffRoleDto> = emptyList(),
    val staff: List<SyncStaffMemberDto> = emptyList()
)

data class VerifyStaffPinRequest(
    val pin: String
)

data class VerifyStaffPinResponse(
    val success: Boolean = true,
    val staff: SyncStaffProfileDto? = null
)

data class SyncStaffProfileDto(
    val id: String,
    val name: String,
    val roleId: String,
    val roleName: String,
    val permissions: List<String> = emptyList()
)

data class PushCatalogCategoryDto(
    val clientId: String,
    val name: String,
    val sortOrder: Int = 0,
    val color: String? = null
)

data class PushCatalogProductDto(
    val clientId: String,
    val name: String,
    val price: Double,
    val categoryClientId: String? = null,
    val sku: String? = null,
    val barcode: String? = null,
    val isTaxable: Boolean = true,
    val sortOrder: Int = 0
)

data class PushCatalogRequest(
    val categories: List<PushCatalogCategoryDto> = emptyList(),
    val products: List<PushCatalogProductDto> = emptyList()
)

data class PushCatalogResponse(
    val ok: Boolean = true,
    val serverTime: Long = 0L,
    val categoryMap: Map<String, String> = emptyMap(),
    val productMap: Map<String, String> = emptyMap()
)
