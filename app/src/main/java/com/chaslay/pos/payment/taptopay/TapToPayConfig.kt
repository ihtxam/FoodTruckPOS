package com.chaslay.pos.payment.taptopay

/**
 * Process-wide config the Tap to Pay flow populates before the Adyen SDK runs.
 *
 * [TapToPayAuthenticationProvider] is instantiated by the SDK (via the manifest
 * <service> declaration), so it cannot be Hilt-injected — it reads the backend
 * base URL and bearer token from here instead. [AdyenTapToPayService] sets these
 * just before invoking the SDK and clears them on sign-out.
 */
object TapToPayConfig {
    @Volatile var apiBaseUrl: String? = null
    @Volatile var authToken: String? = null

    fun clear() {
        apiBaseUrl = null
        authToken = null
    }
}
