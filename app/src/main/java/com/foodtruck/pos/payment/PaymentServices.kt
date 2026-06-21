package com.foodtruck.pos.payment

import android.app.Activity
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.domain.model.PaymentMethod
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
            settings.adyenTerminalEnabled && settings.adyenTerminalId.isNotBlank() -> {
                adyenTerminalService.processPayment(amount, currencyCode, settings)
            }
            else -> PaymentResult.Failure("No card payment method configured. Enable Tap-to-Pay or Adyen Terminal in Settings.")
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
class AdyenTerminalService @Inject constructor() {
    /**
     * Adyen Terminal API integration placeholder.
     * Production: POST to https://terminal-api-test.adyen.com/sync
     */
    suspend fun processPayment(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        if (settings.adyenApiKey.isBlank()) {
            return PaymentResult.Failure("Adyen API key not configured")
        }
        delay(2000)
        return PaymentResult.Success(
            reference = "ADY-${System.currentTimeMillis()}",
            method = PaymentMethod.ADYEN_TERMINAL
        )
    }
}

@Singleton
class CashPaymentService @Inject constructor() {
    fun processPayment(): PaymentResult =
        PaymentResult.Success(method = PaymentMethod.CASH)
}
