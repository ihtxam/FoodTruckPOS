package com.chaslay.pos.data.remote.dto

import com.google.gson.JsonObject

data class FloorRegisterRequest(
    val deviceId: String,
    val deviceName: String? = null,
    val role: String,
    val lanHost: String? = null,
    val appVersion: String? = null
)

data class FloorRegisterResponse(
    val ok: Boolean = false,
    val serverTime: Long = 0L
)

data class FloorOrderUpsertRequest(
    val tableId: Long,
    val tableName: String,
    val status: String,
    val serviceType: String,
    val userId: Long,
    val userName: String,
    val cart: JsonObject,
    val sourceDeviceId: String
)

data class FloorOrdersResponse(
    val serverTime: Long = 0L,
    val orders: List<FloorOrderDto> = emptyList()
)

data class FloorOrderDto(
    val local_order_id: String,
    val table_id: Long,
    val table_name: String,
    val status: String,
    val service_type: String,
    val user_id: Long,
    val user_name: String,
    val cart_json: JsonObject?,
    val source_device_id: String,
    val updated_at: String?
)

data class FloorPrintJobRequest(
    val jobType: String,
    val payload: JsonObject,
    val sourceDeviceId: String,
    val orderId: String? = null
)

data class FloorPrintJobResponse(
    val ok: Boolean = false,
    val jobId: String? = null
)

data class FloorPendingPrintJobsResponse(
    val serverTime: Long = 0L,
    val jobs: List<FloorPendingPrintJobDto> = emptyList()
)

data class FloorPendingPrintJobDto(
    val id: String,
    val job_type: String,
    val payload: JsonObject?,
    val source_device_id: String,
    val order_id: String?,
    val created_at: String?
)

data class FloorAckRequest(
    val status: String = "DONE"
)

data class FloorAckResponse(
    val ok: Boolean = false
)

data class FloorMainPosResponse(
    val lanHost: String? = null,
    val deviceName: String? = null,
    val lastSeenAt: String? = null
)
