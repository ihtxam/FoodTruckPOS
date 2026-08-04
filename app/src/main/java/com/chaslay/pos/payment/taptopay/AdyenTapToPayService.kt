package com.chaslay.pos.payment.taptopay

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import com.adyen.ipp.api.InPersonPayments
import com.adyen.ipp.api.payment.PaymentInterfaceType
import com.adyen.ipp.api.payment.TransactionRequest
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.payment.PaymentResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong

/**
 * Adyen Tap to Pay on Android (SoftPOS). Turns the phone's NFC reader into a
 * contactless card terminal via Adyen's In-Person Payments SDK.
 *
 * Flow per sale (see [processPayment]):
 *   1. Resolve the merchant's dashboard JWT + API base, populate [TapToPayConfig].
 *   2. Ask the SDK for its installationId — first time this triggers device
 *      attestation and [TapToPayAuthenticationProvider] → /api/tap-to-pay/sessions.
 *   3. POST /api/tap-to-pay/sale to build the Adyen Terminal API envelope.
 *   4. performTransaction() — the SDK presents the tap UI; the result arrives
 *      via the PaymentCallback registered in MainActivity → [TapToPayCallbackRouter].
 *
 * Requires a Play-Integrity-compliant device and Adyen SoftPOS enablement; it
 * cannot run on an emulator or on hardware that fails attestation.
 */
@Singleton
class AdyenTapToPayService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncPreferences: SyncPreferences,
) {
    private val http = OkHttpClient()

    /** True when the device exposes NFC. Attestation is still checked at runtime by the SDK. */
    fun isSupported(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)

    /**
     * Warm up the SDK (pre-loads native libs). Safe to call early; ignores failures.
     */
    suspend fun warmUp() {
        runCatching { withContext(Dispatchers.IO) { InPersonPayments.warmUp() } }
    }

    suspend fun processPayment(activity: Activity, amount: Double, currencyCode: String): PaymentResult {
        if (!isSupported()) {
            return PaymentResult.Failure("This device does not support Tap to Pay (no NFC).")
        }
        val authToken = syncPreferences.getDashboardToken()
            ?: return PaymentResult.Failure("Sign in with your online account to use Tap to Pay.")
        val baseUrl = BuildConfig.LICENSE_API_BASE_URL.trimEnd('/')
        val launcher = TapToPayCallbackRouter.launcher
            ?: return PaymentResult.Failure("Tap to Pay is not ready yet. Please try again.")

        // Adyen expects the amount in minor units. CHF/EUR/USD/GBP/AED/CAD are all
        // 2-decimal currencies (the app's supported set), so ×100 is correct here.
        val amountMinor = (amount * 100.0).roundToLong()
        if (amountMinor <= 0L) return PaymentResult.Failure("Invalid amount for Tap to Pay.")

        // Populate the process-wide config the SDK's AuthenticationProvider reads.
        TapToPayConfig.apiBaseUrl = baseUrl
        TapToPayConfig.authToken = authToken

        return try {
            val installationId = withContext(Dispatchers.IO) { InPersonPayments.getInstallationId() }
                .getOrElse { return PaymentResult.Failure("Tap to Pay setup failed: ${it.message}") }

            val envelopeJson = withContext(Dispatchers.IO) {
                fetchSaleEnvelope(baseUrl, authToken, amountMinor, currencyCode, installationId)
            }

            val transactionRequest = TransactionRequest.create(envelopeJson)
                .getOrElse { return PaymentResult.Failure("Tap to Pay request was invalid: ${it.message}") }

            val paymentInterface = withContext(Dispatchers.IO) {
                InPersonPayments.getPaymentInterface(PaymentInterfaceType.createTapToPayType())
            }.getOrElse { return PaymentResult.Failure("Tap to Pay is unavailable on this device: ${it.message}") }

            val deferred = CompletableDeferred<PaymentResult>()
            TapToPayCallbackRouter.arm(deferred)

            InPersonPayments.performTransaction(
                context = activity,
                paymentLauncher = launcher,
                paymentInterface = paymentInterface,
                transactionRequest = transactionRequest,
            )

            deferred.await()
        } catch (e: Throwable) {
            PaymentResult.Failure(e.message ?: "Tap to Pay failed.")
        }
    }

    /**
     * POST /api/tap-to-pay/sale → returns the Adyen Terminal API envelope JSON string.
     */
    private fun fetchSaleEnvelope(
        baseUrl: String,
        authToken: String,
        amountMinor: Long,
        currency: String,
        installationId: String,
    ): String {
        val payload = JSONObject()
            .put("amount_minor", amountMinor)
            .put("currency", currency)
            .put("platform", "android")
            .put("installation_id", installationId)

        val body = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$baseUrl/api/tap-to-pay/sale")
            .header("Authorization", "Bearer $authToken")
            .header("Accept", "application/json")
            .post(body)
            .build()

        http.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Backend /sale call failed: ${response.code} $responseBody")
            }
            val json = JSONObject(responseBody)
            val envelope = json.optJSONObject("terminal_api_request")
                ?: throw IOException("Backend /sale response missing terminal_api_request")
            return envelope.toString()
        }
    }
}
