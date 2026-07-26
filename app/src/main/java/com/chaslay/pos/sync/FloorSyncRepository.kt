package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.remote.FloorApi
import com.chaslay.pos.data.remote.dto.FloorAckRequest
import com.chaslay.pos.data.remote.dto.FloorOrderUpsertRequest
import com.chaslay.pos.data.remote.dto.FloorPrintJobRequest
import com.chaslay.pos.data.remote.dto.FloorRegisterRequest
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.KitchenPrintMeta
import com.google.gson.Gson
import com.google.gson.JsonObject
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Singleton
class FloorSyncRepository @Inject constructor(
    private val floorApi: FloorApi,
    private val deviceIdProvider: DeviceIdProvider,
    private val settingsRepository: SettingsRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val printerService: BluetoothPrinterService,
    private val floorSyncEvents: FloorSyncEvents
) {
    private val gson = Gson()
    private var lastCloudOrderSyncMs = 0L
    private val lanClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .build()

    suspend fun registerDevice(settings: BusinessSettingsEntity) {
        if (!settings.floorSyncEnabled || BuildConfig.SYNC_API_KEY.isBlank()) return
        val role = FloorDeviceRole.fromApi(settings.floorDeviceRole)
        val lanHost = if (role == FloorDeviceRole.MAIN_POS) {
            NetworkAddress.localLanUrl(FloorLanServer.PORT)
        } else {
            null
        }
        runCatching {
            floorApi.register(
                FloorRegisterRequest(
                    deviceId = deviceIdProvider.getDeviceId(),
                    deviceName = settings.businessName,
                    role = settings.floorDeviceRole,
                    lanHost = lanHost,
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
        }.onFailure { Log.w(TAG, "Floor register failed", it) }
        if (role == FloorDeviceRole.WAITER && settings.mainPosLanUrl.isBlank()) {
            discoverAndSaveMainPosUrl()
        }
    }

    suspend fun discoverMainPosUrl(): String? {
        if (BuildConfig.SYNC_API_KEY.isBlank()) return null
        return runCatching {
            floorApi.getMainPos().lanHost?.trim()?.takeIf { it.isNotBlank() }
        }.onFailure { Log.w(TAG, "Main POS discover failed", it) }
            .getOrNull()
    }

    private suspend fun discoverAndSaveMainPosUrl() {
        val url = discoverMainPosUrl() ?: return
        val current = settingsRepository.getSettings()
        if (current.mainPosLanUrl.isBlank()) {
            settingsRepository.saveSettings(current.copy(mainPosLanUrl = url))
            Log.i(TAG, "Auto-filled main POS LAN URL from cloud: $url")
        }
    }

    suspend fun handleLanOrder(
        localOrderId: String,
        body: FloorOrderUpsertRequest,
        notifyUi: Boolean = true
    ): Boolean {
        return runCatching {
            val cart: CartSummary = gson.fromJson(body.cart, CartSummary::class.java)
            val serviceType = runCatching { ServiceType.valueOf(body.serviceType) }
                .getOrDefault(ServiceType.DINE_IN)
            val cartWithIds = cart.copy(
                tableId = body.tableId,
                tableName = body.tableName,
                tableOrderId = localOrderId,
                serviceType = serviceType
            )
            tableOrderRepository.syncCartToTable(cartWithIds, body.userId, body.userName)
            if (notifyUi) {
                floorSyncEvents.notifyTableOrdersChanged()
            }
            true
        }.onFailure { Log.w(TAG, "LAN order apply failed", it) }
            .getOrDefault(false)
    }

    suspend fun pullCloudOrders(settings: BusinessSettingsEntity): Int {
        if (!settings.floorSyncEnabled || BuildConfig.SYNC_API_KEY.isBlank()) return 0
        if (FloorDeviceRole.fromApi(settings.floorDeviceRole) != FloorDeviceRole.MAIN_POS) return 0
        val response = runCatching { floorApi.orders(lastCloudOrderSyncMs) }.getOrNull() ?: return 0
        if (response.serverTime > 0L) {
            lastCloudOrderSyncMs = response.serverTime
        }
        val ownDeviceId = deviceIdProvider.getDeviceId()
        var applied = 0
        for (order in response.orders) {
            if (order.source_device_id == ownDeviceId) continue
            val cartJson = order.cart_json ?: continue
            val body = FloorOrderUpsertRequest(
                tableId = order.table_id,
                tableName = order.table_name,
                status = order.status,
                serviceType = order.service_type,
                userId = order.user_id,
                userName = order.user_name,
                cart = cartJson,
                sourceDeviceId = order.source_device_id
            )
            if (handleLanOrder(order.local_order_id, body, notifyUi = false)) {
                applied++
            }
        }
        if (applied > 0) {
            floorSyncEvents.notifyTableOrdersChanged()
        }
        return applied
    }

    suspend fun handleLanPrintJob(request: FloorPrintJobRequest): Boolean {
        val settings = settingsRepository.getSettings()
        return runCatching {
            when (request.jobType.uppercase()) {
                "KITCHEN" -> executeKitchenJob(settings, request.payload)
                else -> true
            }
        }.getOrDefault(false)
    }

    suspend fun pushTableOrder(
        settings: BusinessSettingsEntity,
        orderId: String,
        cart: CartSummary,
        userId: Long,
        userName: String
    ) {
        if (!settings.floorSyncEnabled || BuildConfig.SYNC_API_KEY.isBlank()) return
        val deviceId = deviceIdProvider.getDeviceId()
        val cartJson = gson.toJsonTree(cart).asJsonObject
        val body = FloorOrderUpsertRequest(
            tableId = cart.tableId ?: 0L,
            tableName = cart.tableName.orEmpty(),
            status = "OPEN",
            serviceType = cart.serviceType.name,
            userId = userId,
            userName = userName,
            cart = cartJson,
            sourceDeviceId = deviceId
        )
        when (FloorConnectionMode.fromApi(settings.floorConnectionMode)) {
            FloorConnectionMode.LAN_ONLY -> pushLanOrder(settings, orderId, body)
            FloorConnectionMode.CLOUD_ONLY -> pushCloudOrder(orderId, body)
            FloorConnectionMode.AUTO -> {
                pushCloudOrder(orderId, body)
                pushLanOrder(settings, orderId, body)
            }
        }
    }

    suspend fun queueKitchenPrint(
        settings: BusinessSettingsEntity,
        orderId: String,
        tableName: String,
        serviceType: String,
        round: Int,
        items: List<TableOrderItemEntity>,
        meta: KitchenPrintMeta
    ) {
        if (!settings.floorSyncEnabled) return
        val payload = JsonObject().apply {
            addProperty("tableName", tableName)
            addProperty("serviceType", serviceType)
            addProperty("round", round)
            add("items", gson.toJsonTree(items))
            add("meta", gson.toJsonTree(meta))
        }
        val deviceId = deviceIdProvider.getDeviceId()
        val role = FloorDeviceRole.fromApi(settings.floorDeviceRole)
        if (role == FloorDeviceRole.WAITER) {
            val mode = FloorConnectionMode.fromApi(settings.floorConnectionMode)
            when (mode) {
                FloorConnectionMode.LAN_ONLY -> pushLanPrintJob(settings, payload)
                FloorConnectionMode.CLOUD_ONLY -> pushCloudPrintJob(deviceId, orderId, payload)
                FloorConnectionMode.AUTO -> {
                    pushCloudPrintJob(deviceId, orderId, payload)
                    pushLanPrintJob(settings, payload)
                }
            }
        }
    }

    suspend fun processPendingPrintJobs(settings: BusinessSettingsEntity): Int {
        if (!settings.floorSyncEnabled || BuildConfig.SYNC_API_KEY.isBlank()) return 0
        if (FloorDeviceRole.fromApi(settings.floorDeviceRole) != FloorDeviceRole.MAIN_POS) return 0
        val pending = runCatching { floorApi.pendingPrintJobs() }.getOrNull()?.jobs.orEmpty()
        var processed = 0
        for (job in pending) {
            val success = runCatching {
                when (job.job_type.uppercase()) {
                    "KITCHEN" -> executeKitchenJob(settings, job.payload)
                    else -> true
                }
            }.getOrDefault(false)
            runCatching {
                floorApi.ackPrintJob(
                    job.id,
                    FloorAckRequest(status = if (success) "DONE" else "FAILED")
                )
            }
            if (success) processed++
        }
        return processed
    }

    private suspend fun executeKitchenJob(settings: BusinessSettingsEntity, payload: JsonObject?): Boolean {
        if (payload == null) return false
        val tableName = payload.get("tableName")?.asString.orEmpty()
        val serviceType = com.chaslay.pos.domain.model.ServiceType.valueOf(
            payload.get("serviceType")?.asString ?: "DINE_IN"
        )
        val round = payload.get("round")?.asInt ?: 1
        val itemsType = object : com.google.gson.reflect.TypeToken<List<TableOrderItemEntity>>() {}.type
        val items: List<TableOrderItemEntity> = gson.fromJson(payload.get("items"), itemsType) ?: return false
        val metaType = object : com.google.gson.reflect.TypeToken<KitchenPrintMeta>() {}.type
        val meta: KitchenPrintMeta = gson.fromJson(payload.get("meta"), metaType) ?: KitchenPrintMeta()
        return withContext(Dispatchers.IO) {
            printerService.routeKitchen(
                settings = settings,
                tableName = tableName,
                serviceType = serviceType,
                round = round,
                items = items,
                isFollowUp = false,
                message = null,
                categories = emptyList(),
                products = emptyList(),
                meta = meta
            ).isSuccess
        }
    }

    private suspend fun pushCloudOrder(orderId: String, body: FloorOrderUpsertRequest) {
        runCatching {
            floorApi.upsertOrder(orderId, body)
        }.onFailure { Log.w(TAG, "Cloud order push failed", it) }
    }

    private suspend fun pushCloudPrintJob(deviceId: String, orderId: String, payload: JsonObject) {
        runCatching {
            floorApi.createPrintJob(
                FloorPrintJobRequest(
                    jobType = "KITCHEN",
                    payload = payload,
                    sourceDeviceId = deviceId,
                    orderId = orderId
                )
            )
        }.onFailure { Log.w(TAG, "Cloud print queue failed", it) }
    }

    private suspend fun pushLanOrder(
        settings: BusinessSettingsEntity,
        orderId: String,
        body: FloorOrderUpsertRequest
    ) {
        val base = settings.mainPosLanUrl.trim().trimEnd('/')
        if (base.isBlank()) return
        withContext(Dispatchers.IO) {
            runCatching {
                val json = gson.toJson(body)
                val request = Request.Builder()
                    .url("$base/v1/floor/orders/$orderId")
                    .put(json.toRequestBody(JSON_MEDIA))
                    .build()
                lanClient.newCall(request).execute().close()
            }.onFailure { Log.w(TAG, "LAN order push failed", it) }
        }
    }

    private suspend fun pushLanPrintJob(settings: BusinessSettingsEntity, payload: JsonObject) {
        val base = settings.mainPosLanUrl.trim().trimEnd('/')
        if (base.isBlank()) return
        withContext(Dispatchers.IO) {
            runCatching {
                val body = gson.toJson(
                    FloorPrintJobRequest(
                        jobType = "KITCHEN",
                        payload = payload,
                        sourceDeviceId = deviceIdProvider.getDeviceId()
                    )
                )
                val request = Request.Builder()
                    .url("$base/v1/floor/print-jobs")
                    .post(body.toRequestBody(JSON_MEDIA))
                    .build()
                lanClient.newCall(request).execute().close()
            }.onFailure { Log.w(TAG, "LAN print push failed", it) }
        }
    }

    companion object {
        private const val TAG = "FloorSync"
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }
}
