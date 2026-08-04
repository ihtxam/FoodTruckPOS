package com.chaslay.pos.payment.taptopay

import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.payment.PaymentResult
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.atomic.AtomicReference
import com.adyen.ipp.api.payment.PaymentResult as AdyenPaymentResult

/**
 * One-slot router that holds:
 *   1. The ActivityResultLauncher registered by MainActivity (set once at startup).
 *   2. The pending [CompletableDeferred] for the in-flight sale (armed per
 *      [AdyenTapToPayService.processPayment] call, completed by the SDK's
 *      PaymentCallback registered in MainActivity).
 *
 * The Adyen SDK delivers the result asynchronously via that callback, so the
 * service awaits the deferred rather than getting a return value directly.
 */
object TapToPayCallbackRouter {
    @Volatile var launcher: ActivityResultLauncher<Intent>? = null

    private val pending = AtomicReference<CompletableDeferred<PaymentResult>?>(null)

    fun arm(deferred: CompletableDeferred<PaymentResult>) {
        val previous = pending.getAndSet(deferred)
        previous?.complete(PaymentResult.Failure("Tap to Pay request was replaced by a new one."))
    }

    fun onSuccess(result: AdyenPaymentResult) {
        val deferred = pending.getAndSet(null) ?: return
        deferred.complete(
            if (result.success) {
                PaymentResult.Success(
                    reference = result.data?.takeIf { it.isNotBlank() },
                    method = PaymentMethod.TAP_TO_PAY
                )
            } else {
                PaymentResult.Failure("Tap to Pay was declined.")
            }
        )
    }

    fun onFailure(error: Throwable) {
        val deferred = pending.getAndSet(null) ?: return
        deferred.complete(PaymentResult.Failure(error.message ?: "Tap to Pay failed."))
    }
}
