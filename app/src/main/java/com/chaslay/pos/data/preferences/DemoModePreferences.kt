package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.demoModeDataStore: DataStore<Preferences> by preferencesDataStore(name = "demo_mode")

@Singleton
class DemoModePreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val isDemoModeKey = booleanPreferencesKey("is_demo_mode")

    val isDemoMode: Flow<Boolean> = context.demoModeDataStore.data.map { prefs ->
        prefs[isDemoModeKey] ?: DEFAULT_DEMO_MODE
    }

    suspend fun isDemoModeEnabled(): Boolean = isDemoMode.first()

    suspend fun setDemoMode(enabled: Boolean) {
        context.demoModeDataStore.edit { prefs ->
            prefs[isDemoModeKey] = enabled
        }
    }

    companion object {
        /** Fresh installs start in demo mode until the merchant taps GO LIVE. */
        const val DEFAULT_DEMO_MODE = true
    }
}
