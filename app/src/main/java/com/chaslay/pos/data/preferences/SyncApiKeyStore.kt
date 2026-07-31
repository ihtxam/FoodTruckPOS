package com.chaslay.pos.data.preferences

import com.chaslay.pos.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Runtime sync API key for the logged-in merchant.
 * Falls back to BuildConfig.SYNC_API_KEY (demo) until cloud login stores the merchant key.
 */
@Singleton
class SyncApiKeyStore @Inject constructor(
    private val syncPreferences: SyncPreferences
) {
    @Volatile
    private var cachedKey: String = BuildConfig.SYNC_API_KEY

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        scope.launch {
            cachedKey = syncPreferences.readStoredSyncApiKey().ifBlank { BuildConfig.SYNC_API_KEY }
        }
    }

    fun current(): String {
        val key = cachedKey.trim()
        return key.ifBlank { BuildConfig.SYNC_API_KEY.trim() }
    }

    fun hasKey(): Boolean = current().isNotBlank()

    suspend fun setKey(key: String?) {
        val trimmed = key?.trim().orEmpty()
        cachedKey = trimmed.ifBlank { BuildConfig.SYNC_API_KEY }
        syncPreferences.setSyncApiKey(trimmed.takeIf { it.isNotBlank() })
    }

    /** Blocking read used only if cache not ready yet. */
    fun currentBlocking(): String = runBlocking {
        if (cachedKey.isNotBlank()) return@runBlocking cachedKey
        val stored = syncPreferences.readStoredSyncApiKey()
        cachedKey = stored.ifBlank { BuildConfig.SYNC_API_KEY }
        cachedKey
    }
}
