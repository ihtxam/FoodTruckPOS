package com.chaslay.pos.data.repository

import android.os.Build
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.preferences.LicenseManager
import com.chaslay.pos.data.remote.LicenseApi
import com.chaslay.pos.data.remote.dto.ActivateLicenseRequest
import com.chaslay.pos.domain.model.LicenseGateState
import com.chaslay.pos.domain.model.LicenseSnapshot
import com.chaslay.pos.domain.model.LicenseStatus
import com.chaslay.pos.domain.model.LicenseUiState
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

@Singleton
class LicenseRepository @Inject constructor(
    private val licenseManager: LicenseManager,
    private val deviceIdProvider: DeviceIdProvider,
    private val licenseApi: LicenseApi
) {
    private val trialDays: Int get() = BuildConfig.TRIAL_DAYS
    private val renewalWarningDays: Int get() = BuildConfig.LICENSE_RENEWAL_WARNING_DAYS

    val uiState: Flow<LicenseUiState> = combine(
        licenseManager.snapshot,
        deviceIdProvider.observeDeviceId()
    ) { snapshot, liveDeviceId ->
        evaluate(snapshot, liveDeviceId)
    }

    suspend fun ensureInitialized() {
        val deviceId = deviceIdProvider.getDeviceId()
        val current = licenseManager.readSnapshot()
        if (!licenseManager.hasTrialStarted()) {
            val trialEndsAt = System.currentTimeMillis() + TimeUnit.DAYS.toMillis(trialDays.toLong())
            licenseManager.startTrial(deviceId, trialEndsAt)
        } else if (current.deviceId.isBlank()) {
            val trialEndsAt = current.trialEndsAt.takeIf { it > 0 }
                ?: System.currentTimeMillis() + TimeUnit.DAYS.toMillis(trialDays.toLong())
            licenseManager.startTrial(deviceId, trialEndsAt)
        }
    }

    suspend fun activate(code: String): Result<Unit> = withContext(Dispatchers.IO) {
        val trimmed = code.trim()
        if (trimmed.isBlank()) return@withContext Result.failure(IllegalArgumentException("Enter an activation code"))
        val deviceId = deviceIdProvider.getDeviceId()
        val tenantSlug = licenseManager.getTenantSlug().takeIf { it.isNotBlank() }
            ?: BuildConfig.TENANT_SLUG.takeIf { it.isNotBlank() }
        runCatching {
            val response = licenseApi.activate(
                ActivateLicenseRequest(
                    deviceId = deviceId,
                    activationCode = trimmed,
                    appVersion = BuildConfig.VERSION_NAME,
                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                    tenantSlug = tenantSlug
                )
            )
            licenseManager.saveActivation(
                deviceId = deviceId,
                expiresAt = response.expiresAt,
                customerName = response.customerName,
                planLabel = response.planLabel
            )
        }
    }

    suspend fun getTenantSlug(): String {
        return licenseManager.getTenantSlug().ifBlank { BuildConfig.TENANT_SLUG }
    }

    suspend fun setTenantSlug(slug: String) {
        licenseManager.setTenantSlug(slug)
    }

    private fun evaluate(snapshot: LicenseSnapshot, liveDeviceId: String): LicenseUiState {
        val now = System.currentTimeMillis()
        val trialDaysRemaining = if (snapshot.trialEndsAt > now) {
            TimeUnit.MILLISECONDS.toDays(snapshot.trialEndsAt - now).toInt() + 1
        } else 0

        val gateState = when (snapshot.status) {
            LicenseStatus.TRIAL -> if (snapshot.trialEndsAt > now) LicenseGateState.TRIAL else LicenseGateState.NEEDS_ACTIVATION
            LicenseStatus.ACTIVE -> if (snapshot.expiresAt > now) LicenseGateState.ALLOWED else LicenseGateState.EXPIRED
            LicenseStatus.EXPIRED -> LicenseGateState.EXPIRED
        }

        val daysUntilExpiry = if (snapshot.status == LicenseStatus.ACTIVE && snapshot.expiresAt > now) {
            TimeUnit.MILLISECONDS.toDays(snapshot.expiresAt - now).toInt()
        } else null

        val showRenewalWarning = daysUntilExpiry != null && daysUntilExpiry <= renewalWarningDays

        return LicenseUiState(
            gateState = gateState,
            snapshot = snapshot.copy(deviceId = liveDeviceId.ifBlank { snapshot.deviceId }),
            trialDaysRemaining = trialDaysRemaining,
            daysUntilExpiry = daysUntilExpiry,
            showRenewalWarning = showRenewalWarning,
            liveDeviceId = liveDeviceId
        )
    }
}
