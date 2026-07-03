package com.chaslay.pos.data.device

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.deviceDataStore: DataStore<Preferences> by preferencesDataStore(name = "device")

@Singleton
class DeviceIdProvider @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val deviceIdKey = stringPreferencesKey("device_id")

    suspend fun getDeviceId(): String {
        val existing = context.deviceDataStore.data.map { it[deviceIdKey] }.first()
        if (!existing.isNullOrBlank()) return existing
        val id = UUID.randomUUID().toString()
        context.deviceDataStore.edit { prefs -> prefs[deviceIdKey] = id }
        return id
    }

    fun observeDeviceId() = context.deviceDataStore.data.map { it[deviceIdKey].orEmpty() }
}
