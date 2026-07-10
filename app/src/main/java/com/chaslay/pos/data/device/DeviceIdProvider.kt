package com.chaslay.pos.data.device

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.deviceDataStore: DataStore<Preferences> by preferencesDataStore(name = "device")

@Singleton
class DeviceIdProvider @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val deviceIdKey = stringPreferencesKey("device_id")

    /** Human-friendly ID for support, e.g. AB12-CD34 (8 chars + dash). */
    suspend fun getDeviceId(): String {
        val existing = context.deviceDataStore.data.map { it[deviceIdKey] }.first()
        if (!existing.isNullOrBlank()) {
            val clean = existing.trim().uppercase().replace("[^A-Z0-9]".toRegex(), "")
            if (clean.length == 8) return formatDeviceId(existing)
            val id = generateShortDeviceId()
            context.deviceDataStore.edit { prefs -> prefs[deviceIdKey] = id }
            return id
        }
        val id = generateShortDeviceId()
        context.deviceDataStore.edit { prefs -> prefs[deviceIdKey] = id }
        return id
    }

    fun observeDeviceId() = context.deviceDataStore.data.map { prefs ->
        formatDeviceId(prefs[deviceIdKey].orEmpty())
    }

    private fun formatDeviceId(raw: String): String {
        val clean = raw.trim().uppercase().replace("[^A-Z0-9]".toRegex(), "")
        if (clean.length == 8) {
            return "${clean.substring(0, 4)}-${clean.substring(4, 8)}"
        }
        return raw.trim().uppercase()
    }

    private fun generateShortDeviceId(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val body = buildString {
            repeat(8) {
                append(chars[Random.nextInt(chars.length)])
            }
        }
        return "${body.substring(0, 4)}-${body.substring(4, 8)}"
    }
}
