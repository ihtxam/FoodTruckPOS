package com.chaslay.pos.payment

import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.IOException
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX")

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(160, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

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
            val url = deviceStatusUrl(live, settings.adyenLiveRegion, merchantAccount, terminalId)

            val request = Request.Builder()
                .url(url)
                .get()
                .header("X-API-Key", apiKey)
                .build()

            runCatching {
                httpClient.newCall(request).execute().use { response ->
                    val body = response.body?.string().orEmpty()
                    Log.d(TAG, "Adyen status HTTP ${response.code}: ${body.take(500)}")
                    if (!response.isSuccessful) {
                        val apiError = parseAdyenApiError(body)
                        return@withContext AdyenConnectionTestResult(
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

    suspend fun sendPaymentRequest(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
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
            return@withContext postSync(apiKey, legacyUrl, body, triedLegacy = true)
        }

        val cloudUrl = cloudDeviceSyncUrl(live, settings.adyenLiveRegion, merchantAccount, terminalId)
        Log.d(TAG, "Sending Adyen terminal payment to $cloudUrl")

        val cloudResult = postSync(apiKey, cloudUrl, body, triedLegacy = false)
        if (cloudResult is AdyenTerminalResponse.Error && shouldRetryLegacy(cloudResult)) {
            val legacyUrl = legacySyncUrl(live)
            Log.d(TAG, "Cloud Device API failed, retrying legacy endpoint $legacyUrl")
            return@withContext postSync(apiKey, legacyUrl, body, triedLegacy = true)
        }
        cloudResult
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

        return try {
            httpClient.newCall(request).execute().use { response ->
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
            Log.e(TAG, "Adyen terminal network error", e)
            AdyenTerminalResponse.Error("Network error: ${e.message ?: "Could not reach Adyen"}")
        }
    }

    private fun formatHttpError(code: Int, apiError: AdyenApiError?, triedLegacy: Boolean): String {
        if (apiError?.errorCode == "00_403") {
            return buildString {
                append("Adyen permission denied (00_403). The request never reached your terminal.\n\n")
                append("Fix in Adyen Customer Area:\n")
                append("1. Developers ? API credentials ? open your Web service user\n")
                append("2. Permissions ? Roles ? POS ? enable \"Cloud Device API\"\n")
                append("3. Generate a new API key and paste it here (not the client key)\n")
                append("4. Match the Test/Live toggle to your key environment\n")
                append("5. Enable Terminal API under In-person payments ? Terminal settings\n\n")
                if (!triedLegacy) {
                    append("Tip: enable \"Use legacy Terminal API\" in Settings if your account is not migrated yet.\n\n")
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
        return parts.joinToString("  ").ifBlank { null }
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
            val paymentResponse = root
                .getAsJsonObject("SaleToPOIResponse")
                ?.getAsJsonObject("PaymentResponse")
                ?: return AdyenTerminalResponse.Error("Unexpected Adyen response format.")

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
        val timestamp = OffsetDateTime.now(ZoneOffset.UTC).format(timestampFormatter)
        val requestedAmount = "%.2f".format(amount).toDouble()

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
