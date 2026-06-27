package com.foodtruck.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
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

    suspend fun getLastMenuSyncMs(): Long =
        context.syncDataStore.data.map { it[lastMenuSyncKey] ?: 0L }.first()

    suspend fun setLastMenuSyncMs(value: Long) {
        context.syncDataStore.edit { it[lastMenuSyncKey] = value }
    }

    suspend fun getLastOrdersSyncMs(): Long =
        context.syncDataStore.data.map { it[lastOrdersSyncKey] ?: 0L }.first()

    suspend fun setLastOrdersSyncMs(value: Long) {
        context.syncDataStore.edit { it[lastOrdersSyncKey] = value }
    }
}
