package com.foodtruck.pos.domain.model

enum class LicenseStatus {
    TRIAL,
    ACTIVE,
    EXPIRED
}

data class LicenseSnapshot(
    val status: LicenseStatus = LicenseStatus.TRIAL,
    val deviceId: String = "",
    val trialEndsAt: Long = 0L,
    val expiresAt: Long = 0L,
    val activatedAt: Long = 0L,
    val customerName: String? = null,
    val planLabel: String? = null,
    val lastValidatedAt: Long = 0L
)

enum class LicenseGateState {
    LOADING,
    ALLOWED,
    TRIAL,
    NEEDS_ACTIVATION,
    EXPIRED
}

data class LicenseUiState(
    val gateState: LicenseGateState = LicenseGateState.LOADING,
    val snapshot: LicenseSnapshot = LicenseSnapshot(),
    val trialDaysRemaining: Int = 0,
    val daysUntilExpiry: Int? = null,
    val showRenewalWarning: Boolean = false,
    val activationCode: String = "",
    val isActivating: Boolean = false,
    val errorMessage: String? = null
)
