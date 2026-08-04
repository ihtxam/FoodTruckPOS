package com.chaslay.pos.payment.taptopay

import com.adyen.ipp.api.authentication.MerchantAuthenticationService

/**
 * Adyen-mandated MerchantAuthenticationService. The SDK auto-detects this via
 * the <service> declaration in AndroidManifest.xml and uses its
 * [authenticationProvider] to obtain SoftPOS sessions.
 */
class ChaslayMerchantAuthenticationService : MerchantAuthenticationService() {
    override val authenticationProvider = TapToPayAuthenticationProvider()
}
