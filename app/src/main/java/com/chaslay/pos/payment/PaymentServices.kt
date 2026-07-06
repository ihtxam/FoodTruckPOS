package com.chaslay.pos.payment

import android.app.Activity
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.PaymentMethod
import kotlinx.coroutines.delay
import javax.inject.Inject
import javax.inject.Singleton

sealed class PaymentResult {
    data class Success(val reference: String? = null, val method: PaymentMethod) : PaymentResult()
    data class Failure(val message: String) : PaymentResult()
    data object Cancelled : PaymentResult()
}

@Singleton
class PaymentOrchestrator @Inject constructor(
    private val tapToPayService: TapToPayService,
    private val adyenTerminalService: AdyenTerminalService
) {
    suspend fun processAdyenTerminalPayment(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult = adyenTerminalService.processPayment(amount, currencyCode, settings)

    suspend fun processCardPayment(
        activity: Activity?,
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        return when {
            settings.tapToPayEnabled && activity != null -> {
                tapToPayService.processPayment(activity, amount, currencyCode)
            }
            settings.cardEnabled -> {
                PaymentResult.Success(
                    reference = "CARD-${System.currentTimeMillis()}",
                    method = PaymentMethod.CARD
                )
            }
            else -> PaymentResult.Failure("No card payment method configured. Enable card payments in Settings.")
        }
    }
}

@Singleton
class TapToPayService @Inject constructor() {
    /**
     * Integrates with Android Tap-to-Pay (SoftPOS) SDK.
     * Replace simulation with Stripe Terminal, Adyen Tap-to-Pay, or SumUp SDK.
     */
    suspend fun processPayment(activity: Activity, amount: Double, currencyCode: String): PaymentResult {
        // Production: launch NFC SoftPOS intent / SDK flow here
        delay(1500)
        return PaymentResult.Success(
            reference = "TTP-${System.currentTimeMillis()}",
            method = PaymentMethod.TAP_TO_PAY
        )
    }
}

@Singleton
class AdyenTerminalService @Inject constructor(
    private val adyenTerminalClient: AdyenTerminalClient
) {
    suspend fun processPayment(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        return when (val response = adyenTerminalClient.sendPaymentRequest(amount, currencyCode, settings)) {
            is AdyenTerminalResponse.Approved -> PaymentResult.Success(
                reference = response.reference,
                method = PaymentMethod.ADYEN_TERMINAL
            )
            is AdyenTerminalResponse.Cancelled -> PaymentResult.Cancelled
            is AdyenTerminalResponse.Declined -> PaymentResult.Failure(response.message)
            is AdyenTerminalResponse.Error -> PaymentResult.Failure(response.message)
        }
    }

    suspend fun testConnection(settings: BusinessSettingsEntity): String {
        val result = adyenTerminalClient.testConnection(settings)
        return result.message
    }

    suspend fun showDigitalReceipt(
        settings: BusinessSettingsEntity,
        items: List<com.chaslay.pos.domain.model.CartItem>,
        total: Double,
        currencySymbol: String,
        receiptUrl: String
    ) {
        val xml = AdyenDisplayReceiptBuilder.buildVirtualReceiptXml(
            businessName = settings.businessName,
            items = items,
            total = total,
            currencySymbol = currencySymbol,
            receiptUrl = receiptUrl
        )
        val base64 = android.util.Base64.encodeToString(
            xml.toByteArray(Charsets.UTF_8),
            android.util.Base64.NO_WRAP
        )
        adyenTerminalClient.sendDisplayReceipt(settings, base64)
    }

    fun cancelActivePayment() {
        adyenTerminalClient.cancelActivePaymentRequest()
    }

    suspend fun abortPayment(settings: BusinessSettingsEntity) {
        adyenTerminalClient.abortTerminalPayment(settings)
    }
}

@Singleton
class CashPaymentService @Inject constructor() {
    fun processPayment(): PaymentResult =
        PaymentResult.Success(method = PaymentMethod.CASH)
}
