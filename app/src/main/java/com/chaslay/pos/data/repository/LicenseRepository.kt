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
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.HttpException

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
        val trimmed = code.trim().uppercase().replace("[^A-Z0-9-]".toRegex(), "")
        if (trimmed.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Enter an activation code"))
        }
        val deviceId = deviceIdProvider.getDeviceId()
        runCatching {
            val response = licenseApi.activate(
                ActivateLicenseRequest(
                    deviceId = deviceId,
                    activationCode = trimmed,
                    appVersion = BuildConfig.VERSION_NAME,
                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}"
                )
            )
            licenseManager.saveActivation(
                deviceId = deviceId,
                expiresAt = response.expiresAt,
                customerName = response.customerName,
                planLabel = response.planLabel,
                tenantSlug = response.tenantSlug ?: BuildConfig.TENANT_SLUG.takeIf { it.isNotBlank() }
            )
        }.recoverCatching { error ->
            throw IllegalStateException(readApiError(error), error)
        }
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

    private fun readApiError(error: Throwable): String {
        if (error is HttpException) {
            val raw = error.response()?.errorBody()?.string()
            if (!raw.isNullOrBlank()) {
                runCatching {
                    JSONObject(raw).optString("error").takeIf { it.isNotBlank() }
                }.getOrNull()?.let { return it }
            }
            return "Activation failed (HTTP ${error.code()})"
        }
        return error.message ?: "Activation failed. Check internet and code."
    }
}
