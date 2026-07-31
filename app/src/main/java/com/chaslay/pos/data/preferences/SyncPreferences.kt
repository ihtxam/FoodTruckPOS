package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.syncDataStore: DataStore<Preferences> by preferencesDataStore(name = "sync")

@Singleton
class SyncPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val lastMenuSyncKey = longPreferencesKey("last_menu_sync_ms")
    private val lastOrdersSyncKey = longPreferencesKey("last_orders_sync_ms")
    private val syncApiKeyKey = stringPreferencesKey("sync_api_key")
    private val merchantIdKey = stringPreferencesKey("merchant_id")

    suspend fun getLastMenuSyncMs(): Long =
        context.syncDataStore.data.map { it[lastMenuSyncKey] ?: 0L }.first()

    suspend fun setLastMenuSyncMs(value: Long) {
        context.syncDataStore.edit { it[lastMenuSyncKey] = value }
    }

    suspend fun resetMenuSyncCursor() {
        setLastMenuSyncMs(0L)
    }

    suspend fun getLastOrdersSyncMs(): Long =
        context.syncDataStore.data.map { it[lastOrdersSyncKey] ?: 0L }.first()

    suspend fun setLastOrdersSyncMs(value: Long) {
        context.syncDataStore.edit { it[lastOrdersSyncKey] = value }
    }

    suspend fun readStoredSyncApiKey(): String =
        context.syncDataStore.data.map { it[syncApiKeyKey].orEmpty() }.first()

    suspend fun setSyncApiKey(key: String?) {
        context.syncDataStore.edit { prefs ->
            if (key.isNullOrBlank()) prefs.remove(syncApiKeyKey)
            else prefs[syncApiKeyKey] = key
        }
    }

    suspend fun getMerchantId(): String? =
        context.syncDataStore.data.map { it[merchantIdKey] }.first()?.takeIf { it.isNotBlank() }

    suspend fun setMerchantId(id: String?) {
        context.syncDataStore.edit { prefs ->
            if (id.isNullOrBlank()) prefs.remove(merchantIdKey)
            else prefs[merchantIdKey] = id
        }
    }
}
