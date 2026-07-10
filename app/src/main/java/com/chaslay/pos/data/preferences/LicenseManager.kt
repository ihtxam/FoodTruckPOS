package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.chaslay.pos.domain.model.LicenseSnapshot
import com.chaslay.pos.domain.model.LicenseStatus
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.licenseDataStore: DataStore<Preferences> by preferencesDataStore(name = "license")

@Singleton
class LicenseManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val statusKey = stringPreferencesKey("status")
    private val deviceIdKey = stringPreferencesKey("device_id")
    private val trialEndsAtKey = longPreferencesKey("trial_ends_at")
    private val expiresAtKey = longPreferencesKey("expires_at")
    private val activatedAtKey = longPreferencesKey("activated_at")
    private val customerNameKey = stringPreferencesKey("customer_name")
    private val planLabelKey = stringPreferencesKey("plan_label")
    private val lastValidatedAtKey = longPreferencesKey("last_validated_at")
    private val tenantSlugKey = stringPreferencesKey("tenant_slug")

    val snapshot: Flow<LicenseSnapshot> = context.licenseDataStore.data.map { prefs ->
        LicenseSnapshot(
            status = LicenseStatus.entries.find { it.name == prefs[statusKey] } ?: LicenseStatus.TRIAL,
            deviceId = prefs[deviceIdKey].orEmpty(),
            trialEndsAt = prefs[trialEndsAtKey] ?: 0L,
            expiresAt = prefs[expiresAtKey] ?: 0L,
            activatedAt = prefs[activatedAtKey] ?: 0L,
            customerName = prefs[customerNameKey],
            planLabel = prefs[planLabelKey],
            lastValidatedAt = prefs[lastValidatedAtKey] ?: 0L
        )
    }

    suspend fun readSnapshot(): LicenseSnapshot = snapshot.first()

    suspend fun hasTrialStarted(): Boolean = readSnapshot().trialEndsAt > 0L

    suspend fun startTrial(deviceId: String, trialEndsAt: Long) {
        context.licenseDataStore.edit { prefs ->
            prefs[statusKey] = LicenseStatus.TRIAL.name
            prefs[deviceIdKey] = deviceId
            prefs[trialEndsAtKey] = trialEndsAt
        }
    }

    suspend fun saveActivation(
        deviceId: String,
        expiresAt: Long,
        customerName: String?,
        planLabel: String?,
        tenantSlug: String? = null
    ) {
        val now = System.currentTimeMillis()
        context.licenseDataStore.edit { prefs ->
            prefs[statusKey] = LicenseStatus.ACTIVE.name
            prefs[deviceIdKey] = deviceId
            prefs[expiresAtKey] = expiresAt
            prefs[activatedAtKey] = now
            prefs[lastValidatedAtKey] = now
            customerName?.let { prefs[customerNameKey] = it }
            planLabel?.let { prefs[planLabelKey] = it }
            tenantSlug?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let { prefs[tenantSlugKey] = it }
        }
    }

    suspend fun markExpired() {
        context.licenseDataStore.edit { prefs ->
            prefs[statusKey] = LicenseStatus.EXPIRED.name
        }
    }

    suspend fun getTenantSlug(): String = context.licenseDataStore.data.map { it[tenantSlugKey].orEmpty() }.first()

    suspend fun setTenantSlug(slug: String) {
        context.licenseDataStore.edit { prefs ->
            prefs[tenantSlugKey] = slug.trim().lowercase()
        }
    }
}
