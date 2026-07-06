package com.chaslay.pos.payment

import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

sealed class AdyenTerminalResponse {
    data class Approved(val reference: String?) : AdyenTerminalResponse()
    data class Declined(val message: String) : AdyenTerminalResponse()
    data class Cancelled(val message: String = "Payment cancelled on terminal") : AdyenTerminalResponse()
    data class Error(val message: String) : AdyenTerminalResponse()
}

data class AdyenConnectionTestResult(
    val success: Boolean,
    val message: String
)

private data class AdyenApiError(
    val errorCode: String?,
    val detail: String?,
    val requestId: String?,
    val title: String?
)

@Singleton
class AdyenTerminalClient @Inject constructor() {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val timestampFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(160, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var activePaymentCall: Call? = null

    fun cancelActivePaymentRequest() {
        activePaymentCall?.cancel()
    }

    suspend fun abortTerminalPayment(settings: BusinessSettingsEntity) = withContext(Dispatchers.IO) {
        if (validateSettings(settings) != null) return@withContext
        val apiKey = settings.adyenApiKey.trim()
        val live = settings.adyenLiveEnvironment
        val saleId = settings.adyenClientId.trim().ifBlank { "ChaslayPOS" }
        val terminalId = normalizeTerminalId(settings.adyenTerminalId)
        val merchantAccount = settings.adyenMerchantAccount.trim()
        val body = buildAbortRequestBody(saleId, terminalId).toRequestBody(jsonMediaType)
        val url = if (settings.adyenUseLegacyEndpoint) {
            legacySyncUrl(live)
        } else {
            cloudDeviceSyncUrl(live, settings.adyenLiveRegion, merchantAccount, terminalId)
        }
        runCatching { postAbortSync(apiKey, url, body) }
            .onFailure { error -> Log.w(TAG, "Adyen abort request failed", error) }
    }

    suspend fun testConnection(settings: BusinessSettingsEntity): AdyenConnectionTestResult =
        withContext(Dispatchers.IO) {
            val validation = validateSettings(settings)
            if (validation != null) {
                return@withContext AdyenConnectionTestResult(false, validation)
            }

            val merchantAccount = settings.adyenMerchantAccount.trim()
            val terminalId = normalizeTerminalId(settings.adyenTerminalId)
            val apiKey = settings.adyenApiKey.trim()
            val live = settings.adyenLiveEnvironment
            val saleId = settings.adyenClientId.trim().ifBlank { "ChaslayPOS" }

            if (settings.adyenUseLegacyEndpoint) {
                return@withContext testLegacyConnection(apiKey, live, saleId, terminalId)
            }

            val cloudResult = testCloudDeviceStatus(apiKey, live, settings.adyenLiveRegion, merchantAccount, terminalId)
            if (!cloudResult.success && cloudResult.message.contains("00_403", ignoreCase = true)) {
                val legacyResult = testLegacyConnection(apiKey, live, saleId, terminalId)
                if (legacyResult.success) {
                    return@withContext AdyenConnectionTestResult(
                        success = true,
                        message = buildString {
                            append(legacyResult.message)
                            append("\n\nCloud Device API returned 00_403 (missing POS ? Cloud Device API role). ")
                            append("Payments will use the legacy Terminal API endpoint. ")
                            append("Keep \"Use legacy Terminal API\" enabled, or add Cloud Device API to your Web service user for the newer endpoint.")
                        }
                    )
                }
            }
            cloudResult
        }

    private fun testCloudDeviceStatus(
        apiKey: String,
        live: Boolean,
        region: String,
        merchantAccount: String,
        terminalId: String
    ): AdyenConnectionTestResult {
        val url = deviceStatusUrl(live, region, merchantAccount, terminalId)
        val request = Request.Builder()
            .url(url)
            .get()
            .header("X-API-Key", apiKey)
            .build()

        return runCatching {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                Log.d(TAG, "Adyen status HTTP ${response.code}: ${body.take(500)}")
                if (!response.isSuccessful) {
                    val apiError = parseAdyenApiError(body)
                    return AdyenConnectionTestResult(
                        success = false,
                        message = formatHttpError(response.code, apiError, triedLegacy = false)
                    )
                }
                val status = runCatching {
                    gson.fromJson(body, JsonObject::class.java).get("status")?.asString
                }.getOrNull()
                when (status?.uppercase()) {
                    "ONLINE" -> AdyenConnectionTestResult(
                        success = true,
                        message = "Terminal $terminalId is ONLINE and reachable via Adyen cloud."
                    )
                    "OFFLINE" -> AdyenConnectionTestResult(
                        success = false,
                        message = "API key works, but terminal $terminalId is OFFLINE. Check terminal network/power."
                    )
                    else -> AdyenConnectionTestResult(
                        success = true,
                        message = "Adyen API credentials accepted. Response: ${body.take(120)}"
                    )
                }
            }
        }.getOrElse { e ->
            AdyenConnectionTestResult(false, "Network error: ${e.message ?: "Could not reach Adyen"}")
        }
    }

    private fun testLegacyConnection(
        apiKey: String,
        live: Boolean,
        saleId: String,
        terminalId: String
    ): AdyenConnectionTestResult {
        val url = legacySyncUrl(live)
        val body = buildDiagnosisRequestBody(saleId, terminalId).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .build()

        return runCatching {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                Log.d(TAG, "Adyen legacy diagnosis HTTP ${response.code}: ${responseBody.take(500)}")
                if (!response.isSuccessful) {
                    val apiError = parseAdyenApiError(responseBody)
                    return AdyenConnectionTestResult(
                        success = false,
                        message = formatHttpError(response.code, apiError, triedLegacy = true)
                    )
                }
                val result = runCatching {
                    gson.fromJson(responseBody, JsonObject::class.java)
                        .getAsJsonObject("SaleToPOIResponse")
                        ?.getAsJsonObject("DiagnosisResponse")
                        ?.getAsJsonObject("Response")
                        ?.get("Result")
                        ?.asString
                }.getOrNull()
                if (result.equals("Success", ignoreCase = true)) {
                    AdyenConnectionTestResult(
                        success = true,
                        message = "Legacy Terminal API accepted your credentials. Terminal $terminalId responded to a diagnosis request."
                    )
                } else {
                    AdyenConnectionTestResult(
                        success = true,
                        message = "Legacy Terminal API credentials accepted. Response: ${responseBody.take(120)}"
                    )
                }
            }
        }.getOrElse { e ->
            AdyenConnectionTestResult(false, "Network error: ${e.message ?: "Could not reach Adyen"}")
        }
    }

    private fun buildAbortRequestBody(saleId: String, poiId: String): String {
        val serviceId = generateServiceId()
        val payload = mapOf(
            "SaleToPOIRequest" to mapOf(
                "MessageHeader" to mapOf(
                    "ProtocolVersion" to "3.0",
                    "MessageClass" to "Service",
                    "MessageCategory" to "Abort",
                    "MessageType" to "Request",
                    "ServiceID" to serviceId,
                    "SaleID" to saleId,
                    "POIID" to poiId
                ),
                "AbortRequest" to mapOf(
                    "AbortReason" to "MerchantAbort"
                )
            )
        )
        return gson.toJson(payload)
    }

    private fun buildDiagnosisRequestBody(saleId: String, poiId: String): String {
        val serviceId = generateServiceId()
        val payload = mapOf(
            "SaleToPOIRequest" to mapOf(
                "MessageHeader" to mapOf(
                    "ProtocolVersion" to "3.0",
                    "MessageClass" to "Service",
                    "MessageCategory" to "Diagnosis",
                    "MessageType" to "Request",
                    "ServiceID" to serviceId,
                    "SaleID" to saleId,
                    "POIID" to poiId
                ),
                "DiagnosisRequest" to mapOf(
                    "HostDiagnosisFlag" to true
                )
            )
        )
        return gson.toJson(payload)
    }

    suspend fun sendPaymentRequest(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): AdyenTerminalResponse = withContext(Dispatchers.IO) {
        runCatching {
            sendPaymentRequestInternal(amount, currencyCode, settings)
        }.getOrElse { error ->
            Log.e(TAG, "Adyen payment request failed", error)
            AdyenTerminalResponse.Error(error.message ?: "Adyen terminal payment failed")
        }
    }

    private fun sendPaymentRequestInternal(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): AdyenTerminalResponse {
        val validation = validateSettings(settings)
        if (validation != null) {
            return AdyenTerminalResponse.Error(validation)
        }

        val merchantAccount = settings.adyenMerchantAccount.trim()
        val terminalId = normalizeTerminalId(settings.adyenTerminalId)
        val apiKey = settings.adyenApiKey.trim()
        val saleId = settings.adyenClientId.trim().ifBlank { "ChaslayPOS" }
        val live = settings.adyenLiveEnvironment

        val requestBody = buildPaymentRequestBody(
            amount = amount,
            currencyCode = currencyCode.uppercase(),
            saleId = saleId,
            poiId = terminalId
        )
        val body = requestBody.toRequestBody(jsonMediaType)

        if (settings.adyenUseLegacyEndpoint) {
            val legacyUrl = legacySyncUrl(live)
            Log.d(TAG, "Sending Adyen payment via legacy endpoint $legacyUrl")
            return postSync(apiKey, legacyUrl, body, triedLegacy = true)
        }

        val cloudUrl = cloudDeviceSyncUrl(live, settings.adyenLiveRegion, merchantAccount, terminalId)
        Log.d(TAG, "Sending Adyen terminal payment to $cloudUrl")

        val cloudResult = postSync(apiKey, cloudUrl, body, triedLegacy = false)
        if (cloudResult is AdyenTerminalResponse.Error && shouldRetryLegacy(cloudResult)) {
            val legacyUrl = legacySyncUrl(live)
            Log.d(TAG, "Cloud Device API failed, retrying legacy endpoint $legacyUrl")
            return postSync(apiKey, legacyUrl, body, triedLegacy = true)
        }
        return cloudResult
    }

    suspend fun sendDisplayReceipt(
        settings: BusinessSettingsEntity,
        outputXhtmlBase64: String
    ): AdyenTerminalResponse = withContext(Dispatchers.IO) {
        val validation = validateSettings(settings)
        if (validation != null) {
            return@withContext AdyenTerminalResponse.Error(validation)
        }

        val merchantAccount = settings.adyenMerchantAccount.trim()
        val terminalId = normalizeTerminalId(settings.adyenTerminalId)
        val apiKey = settings.adyenApiKey.trim()
        val saleId = settings.adyenClientId.trim().ifBlank { "ChaslayPOS" }
        val live = settings.adyenLiveEnvironment
        val requestBody = buildDisplayRequestBody(saleId, terminalId, outputXhtmlBase64)
        val body = requestBody.toRequestBody(jsonMediaType)

        val cloudUrl = cloudDeviceSyncUrl(live, settings.adyenLiveRegion, merchantAccount, terminalId)
        Log.d(TAG, "Sending Adyen display receipt to $cloudUrl")
        postDisplaySync(apiKey, cloudUrl, body)
    }

    private fun postDisplaySync(
        apiKey: String,
        url: String,
        body: okhttp3.RequestBody
    ): AdyenTerminalResponse {
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                Log.d(TAG, "Adyen display HTTP ${response.code}: ${responseBody.take(500)}")
                if (!response.isSuccessful) {
                    val apiError = parseAdyenApiError(responseBody)
                    return AdyenTerminalResponse.Error(
                        formatHttpError(response.code, apiError, triedLegacy = false)
                    )
                }
                val result = runCatching {
                    gson.fromJson(responseBody, JsonObject::class.java)
                        .getAsJsonObject("SaleToPOIResponse")
                        ?.getAsJsonObject("DisplayResponse")
                        ?.getAsJsonArray("OutputResult")
                        ?.firstOrNull()
                        ?.asJsonObject
                        ?.getAsJsonObject("Response")
                        ?.get("Result")
                        ?.asString
                }.getOrNull()
                if (result.equals("Success", ignoreCase = true)) {
                    AdyenTerminalResponse.Approved(reference = null)
                } else {
                    AdyenTerminalResponse.Error("Could not show receipt on terminal display.")
                }
            }
        } catch (e: IOException) {
            AdyenTerminalResponse.Error("Network error showing terminal receipt: ${e.message ?: "Unknown"}")
        }
    }

    private fun buildDisplayRequestBody(
        saleId: String,
        poiId: String,
        outputXhtmlBase64: String
    ): String {
        val serviceId = generateServiceId()
        val payload = mapOf(
            "SaleToPOIRequest" to mapOf(
                "MessageHeader" to mapOf(
                    "ProtocolVersion" to "3.0",
                    "MessageClass" to "Device",
                    "MessageCategory" to "Display",
                    "MessageType" to "Request",
                    "ServiceID" to serviceId,
                    "SaleID" to saleId,
                    "POIID" to poiId
                ),
                "DisplayRequest" to mapOf(
                    "DisplayOutput" to listOf(
                        mapOf(
                            "Device" to "CustomerDisplay",
                            "InfoQualify" to "Display",
                            "OutputContent" to mapOf(
                                "OutputFormat" to "XHTML",
                                "OutputXHTML" to outputXhtmlBase64
                            )
                        )
                    )
                )
            )
        )
        return gson.toJson(payload)
    }

    private fun validateSettings(settings: BusinessSettingsEntity): String? {
        if (settings.adyenApiKey.isBlank()) return "Adyen API key not configured"
        if (settings.adyenMerchantAccount.isBlank()) return "Adyen merchant account not configured"
        if (settings.adyenTerminalId.isBlank()) {
            return "Adyen terminal ID not configured (POIID, e.g. V400m-324688179)"
        }
        if (looksLikeClientKey(settings.adyenApiKey)) {
            return "This looks like an Adyen client key, not a Web service API key. " +
                "In Customer Area go to Developers ? API credentials ? your Web service user ? " +
                "generate an API key with the Cloud Device API role."
        }
        return null
    }

    private fun looksLikeClientKey(key: String): Boolean {
        val trimmed = key.trim()
        return trimmed.startsWith("live_") ||
            trimmed.startsWith("test_") ||
            trimmed.startsWith("pub_")
    }

    private fun shouldRetryLegacy(error: AdyenTerminalResponse.Error): Boolean {
        val msg = error.message
        return msg.contains("HTTP 404", ignoreCase = true) ||
            msg.contains("00_403", ignoreCase = true) ||
            msg.contains("HTTP 403", ignoreCase = true)
    }

    private fun postSync(
        apiKey: String,
        url: String,
        body: okhttp3.RequestBody,
        triedLegacy: Boolean
    ): AdyenTerminalResponse {
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .build()

        val call = httpClient.newCall(request)
        activePaymentCall = call
        return try {
            call.execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                Log.d(TAG, "Adyen response HTTP ${response.code} from $url: ${responseBody.take(500)}")

                if (!response.isSuccessful) {
                    val apiError = parseAdyenApiError(responseBody)
                    return AdyenTerminalResponse.Error(
                        formatHttpError(response.code, apiError, triedLegacy)
                    )
                }
                parsePaymentResponse(responseBody)
            }
        } catch (e: IOException) {
            if (call.isCanceled()) {
                Log.d(TAG, "Adyen payment request cancelled")
                AdyenTerminalResponse.Cancelled()
            } else {
                Log.e(TAG, "Adyen terminal network error", e)
                AdyenTerminalResponse.Error("Network error: ${e.message ?: "Could not reach Adyen"}")
            }
        } finally {
            if (activePaymentCall == call) {
                activePaymentCall = null
            }
        }
    }

    private fun postAbortSync(
        apiKey: String,
        url: String,
        body: okhttp3.RequestBody
    ) {
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .build()
        httpClient.newCall(request).execute().close()
    }

    private fun formatHttpError(code: Int, apiError: AdyenApiError?, triedLegacy: Boolean): String {
        if (apiError?.errorCode == "00_403") {
            return buildString {
                append("Adyen permission denied (00_403). The POS API key is not allowed to call this Adyen endpoint.\n\n")
                append("Note: a terminal showing ONLINE in Adyen Customer Area only means the device reached Adyen. ")
                append("It does not mean your Web service API key has Cloud Device API permission.\n\n")
                append("Fix in Adyen Customer Area:\n")
                append("1. Developers ? API credentials ? open your Web service user (not the client key)\n")
                append("2. Permissions ? Roles ? POS ? enable \"Cloud Device API\"\n")
                append("3. Generate a new API key and paste it here\n")
                append("4. Match the Test/Live toggle to your key environment\n")
                append("5. Enable Terminal API under In-person payments ? Terminal settings\n\n")
                if (!triedLegacy) {
                    append("Tip: enable \"Use legacy Terminal API\" in Settings and test again if your account is not migrated to Cloud Device API yet.\n\n")
                } else {
                    append("Legacy Terminal API also returned 00_403. Your Web service user likely needs Terminal API / POS payment roles as well.\n\n")
                }
                apiError.detail?.takeIf { it.isNotBlank() }?.let { append("Adyen: $it\n") }
                apiError.requestId?.takeIf { it.isNotBlank() }?.let { append("Request ID: $it") }
            }.trim()
        }

        val detail = apiError?.let { formatApiErrorSummary(it) }
        return when (code) {
            401 -> detail ?: "Invalid Adyen API key. Use a Web service API key with the Cloud Device API role."
            403 -> detail ?: "Adyen rejected the request (403). Check API key roles and merchant account access."
            404 -> "Terminal or merchant not found (404). Check merchant account and terminal POIID " +
                "(format: Model-Serial, e.g. V400m-324688179)."
            422 -> detail ?: "Invalid payment request sent to Adyen terminal."
            else -> detail ?: "Adyen terminal request failed (HTTP $code)."
        }
    }

    private fun formatApiErrorSummary(apiError: AdyenApiError): String? {
        val parts = listOfNotNull(
            apiError.errorCode?.let { "Adyen error: $it" },
            apiError.detail,
            apiError.requestId?.let { "Request ID: $it" }
        )
        return parts.joinToString(" ? ").ifBlank { null }
    }

    private fun parseAdyenApiError(body: String): AdyenApiError? {
        if (body.isBlank()) return null
        return runCatching {
            val json = gson.fromJson(body, JsonObject::class.java)
            AdyenApiError(
                errorCode = json.get("errorCode")?.asString,
                detail = json.get("detail")?.asString ?: json.get("message")?.asString,
                requestId = json.get("requestId")?.asString,
                title = json.get("title")?.asString
            )
        }.getOrNull()
    }

    private fun parsePaymentResponse(body: String): AdyenTerminalResponse {
        if (body.isBlank()) {
            return AdyenTerminalResponse.Error("Empty response from Adyen terminal.")
        }

        return runCatching {
            val root = gson.fromJson(body, JsonObject::class.java)
            val saleToPoi = root.getAsJsonObject("SaleToPOIResponse")
                ?: return AdyenTerminalResponse.Error("Unexpected Adyen response format.")
            val paymentResponse = saleToPoi.getAsJsonObject("PaymentResponse")
            if (paymentResponse == null) {
                Log.w(TAG, "Non-payment Adyen response: ${body.take(500)}")
                val message = when {
                    saleToPoi.has("EventNotification") ->
                        "Terminal is busy or updating. Cancel and try again, or use another payment method."
                    saleToPoi.has("ReversalResponse") ->
                        "Terminal returned an unexpected reversal response."
                    else ->
                        "Terminal is not ready for payment. It may be updating, offline, or busy."
                }
                return AdyenTerminalResponse.Error(message)
            }

            val responseNode = paymentResponse.getAsJsonObject("Response")
                ?: return AdyenTerminalResponse.Error("Missing payment response from terminal.")

            val result = responseNode.get("Result")?.asString.orEmpty()
            val errorCondition = responseNode.get("ErrorCondition")?.asString
            val additionalResponse = responseNode.get("AdditionalResponse")?.asString

            when {
                result.equals("Success", ignoreCase = true) -> {
                    val transactionId = paymentResponse
                        .getAsJsonObject("POIData")
                        ?.getAsJsonObject("POITransactionID")
                        ?.get("TransactionID")
                        ?.asString
                    AdyenTerminalResponse.Approved(reference = transactionId)
                }
                result.equals("Failure", ignoreCase = true) &&
                    errorCondition.equals("Cancel", ignoreCase = true) -> {
                    AdyenTerminalResponse.Cancelled()
                }
                else -> {
                    val message = buildString {
                        append("Terminal payment failed")
                        if (!errorCondition.isNullOrBlank()) append(": $errorCondition")
                        if (!additionalResponse.isNullOrBlank()) append(" ($additionalResponse)")
                    }
                    AdyenTerminalResponse.Declined(message)
                }
            }
        }.getOrElse { error ->
            Log.e(TAG, "Failed to parse Adyen response", error)
            AdyenTerminalResponse.Error("Could not parse Adyen terminal response.")
        }
    }

    private fun buildPaymentRequestBody(
        amount: Double,
        currencyCode: String,
        saleId: String,
        poiId: String
    ): String {
        val serviceId = generateServiceId()
        val transactionId = UUID.randomUUID().toString().replace("-", "").take(16)
        val timestamp = timestampFormatter.format(Date())
        val requestedAmount = kotlin.math.round(amount * 100.0) / 100.0

        val payload = mapOf(
            "SaleToPOIRequest" to mapOf(
                "MessageHeader" to mapOf(
                    "ProtocolVersion" to "3.0",
                    "MessageClass" to "Service",
                    "MessageCategory" to "Payment",
                    "MessageType" to "Request",
                    "ServiceID" to serviceId,
                    "SaleID" to saleId,
                    "POIID" to poiId
                ),
                "PaymentRequest" to mapOf(
                    "SaleData" to mapOf(
                        "SaleTransactionID" to mapOf(
                            "TransactionID" to transactionId,
                            "TimeStamp" to timestamp
                        )
                    ),
                    "PaymentTransaction" to mapOf(
                        "AmountsReq" to mapOf(
                            "Currency" to currencyCode,
                            "RequestedAmount" to requestedAmount
                        )
                    )
                )
            )
        )
        return gson.toJson(payload)
    }

    private fun generateServiceId(): String =
        (System.currentTimeMillis() % 10_000_000_000L).toString().padStart(10, '0')

    private fun normalizeTerminalId(raw: String): String = raw.trim()

    private fun cloudDeviceSyncUrl(
        live: Boolean,
        region: String,
        merchantAccount: String,
        terminalId: String
    ): String {
        val host = cloudDeviceHost(live, region)
        return "https://$host/v1/merchants/${encodePathSegment(merchantAccount)}/devices/${encodePathSegment(terminalId)}/sync"
    }

    private fun deviceStatusUrl(
        live: Boolean,
        region: String,
        merchantAccount: String,
        terminalId: String
    ): String {
        val host = cloudDeviceHost(live, region)
        return "https://$host/v1/merchants/${encodePathSegment(merchantAccount)}/devices/${encodePathSegment(terminalId)}/status"
    }

    private fun cloudDeviceHost(live: Boolean, region: String): String {
        if (!live) return "device-api-test.adyen.com"
        return when (region.uppercase()) {
            "US" -> "device-api-live-us.adyen.com"
            "AU" -> "device-api-live-au.adyen.com"
            "APSE" -> "device-api-live-apse.adyen.com"
            else -> "device-api-live.adyen.com"
        }
    }

    private fun legacySyncUrl(live: Boolean): String =
        if (live) "https://terminal-api-live.adyen.com/sync"
        else "https://terminal-api-test.adyen.com/sync"

    private fun encodePathSegment(value: String): String =
        okhttp3.HttpUrl.Builder()
            .scheme("https")
            .host("example.com")
            .addPathSegment(value)
            .build()
            .encodedPathSegments
            .first()

    companion object {
        private const val TAG = "AdyenTerminal"
    }
}
