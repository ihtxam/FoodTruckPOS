package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
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
    private val syncBusinessInfoKey = booleanPreferencesKey("sync_business_info")
    private val menuCloudSyncedKey = booleanPreferencesKey("menu_cloud_synced")
    private val dashboardTokenKey = stringPreferencesKey("dashboard_token")
    private val dashboardUserJsonKey = stringPreferencesKey("dashboard_user_json")
    private val dashboardUrlKey = stringPreferencesKey("dashboard_url")

    /** Sync read for Room [DatabaseCallback] (runs before DataStore is ready). */
    fun isMenuCloudSyncedBlocking(): Boolean =
        context.getSharedPreferences(SYNC_FLAGS_PREFS, Context.MODE_PRIVATE)
            .getBoolean(MENU_CLOUD_SYNCED_PREFS_KEY, false)

    private fun setMenuCloudSyncedBlocking(synced: Boolean) {
        context.getSharedPreferences(SYNC_FLAGS_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(MENU_CLOUD_SYNCED_PREFS_KEY, synced)
            .apply()
    }

    suspend fun isMenuCloudSynced(): Boolean =
        context.syncDataStore.data.map { it[menuCloudSyncedKey] ?: isMenuCloudSyncedBlocking() }.first()

    suspend fun setMenuCloudSynced(synced: Boolean = true) {
        setMenuCloudSyncedBlocking(synced)
        context.syncDataStore.edit { prefs ->
            if (synced) prefs[menuCloudSyncedKey] = true
            else prefs.remove(menuCloudSyncedKey)
        }
    }

    companion object {
        private const val SYNC_FLAGS_PREFS = "pos_sync_flags"
        private const val MENU_CLOUD_SYNCED_PREFS_KEY = "menu_cloud_synced"
        private const val LAST_MENU_SYNC_PREFS_KEY = "last_menu_sync_ms"

        fun hasRemoteMenuSync(context: Context): Boolean {
            val prefs = context.getSharedPreferences(SYNC_FLAGS_PREFS, Context.MODE_PRIVATE)
            return prefs.getBoolean(MENU_CLOUD_SYNCED_PREFS_KEY, false) ||
                prefs.getLong(LAST_MENU_SYNC_PREFS_KEY, 0L) > 0L
        }
    }

    suspend fun isSyncBusinessInfoEnabled(): Boolean =
        context.syncDataStore.data.map { it[syncBusinessInfoKey] ?: true }.first()

    suspend fun setSyncBusinessInfoEnabled(enabled: Boolean) {
        context.syncDataStore.edit { it[syncBusinessInfoKey] = enabled }
    }

    suspend fun getLastMenuSyncMs(): Long =
        context.syncDataStore.data.map { it[lastMenuSyncKey] ?: 0L }.first()

    suspend fun setLastMenuSyncMs(value: Long) {
        context.getSharedPreferences(SYNC_FLAGS_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(LAST_MENU_SYNC_PREFS_KEY, value)
            .apply()
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

    suspend fun getDashboardToken(): String? =
        context.syncDataStore.data.map { it[dashboardTokenKey] }.first()?.takeIf { it.isNotBlank() }

    suspend fun setDashboardToken(token: String?) {
        context.syncDataStore.edit { prefs ->
            if (token.isNullOrBlank()) prefs.remove(dashboardTokenKey)
            else prefs[dashboardTokenKey] = token
        }
    }

    suspend fun getDashboardUserJson(): String? =
        context.syncDataStore.data.map { it[dashboardUserJsonKey] }.first()?.takeIf { it.isNotBlank() }

    suspend fun setDashboardUserJson(json: String?) {
        context.syncDataStore.edit { prefs ->
            if (json.isNullOrBlank()) prefs.remove(dashboardUserJsonKey)
            else prefs[dashboardUserJsonKey] = json
        }
    }

    suspend fun getDashboardUrl(): String? =
        context.syncDataStore.data.map { it[dashboardUrlKey] }.first()?.takeIf { it.isNotBlank() }

    suspend fun setDashboardUrl(url: String?) {
        context.syncDataStore.edit { prefs ->
            if (url.isNullOrBlank()) prefs.remove(dashboardUrlKey)
            else prefs[dashboardUrlKey] = url.trim().trimEnd('/')
        }
    }
}
