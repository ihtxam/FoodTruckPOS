package com.foodtruck.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.foodtruck.pos.domain.model.AppLanguage
import com.foodtruck.pos.domain.model.PosThemeMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val userIdKey = longPreferencesKey("user_id")
    private val userNameKey = stringPreferencesKey("user_name")
    private val userRoleKey = stringPreferencesKey("user_role")
    private val languageKey = stringPreferencesKey("app_language")
    private val themeModeKey = stringPreferencesKey("pos_theme_mode")

    val currentUserId: Flow<Long?> = context.sessionDataStore.data.map { prefs ->
        prefs[userIdKey]
    }

    val currentUserName: Flow<String?> = context.sessionDataStore.data.map { prefs ->
        prefs[userNameKey]
    }

    val currentUserRole: Flow<String?> = context.sessionDataStore.data.map { prefs ->
        prefs[userRoleKey]
    }

    val appLanguage: Flow<AppLanguage> = context.sessionDataStore.data.map { prefs ->
        AppLanguage.fromCode(prefs[languageKey] ?: AppLanguage.ENGLISH.code)
    }

    val posThemeMode: Flow<PosThemeMode> = context.sessionDataStore.data.map { prefs ->
        PosThemeMode.fromName(prefs[themeModeKey])
    }

    suspend fun saveSession(userId: Long, userName: String, role: String) {
        context.sessionDataStore.edit { prefs ->
            prefs[userIdKey] = userId
            prefs[userNameKey] = userName
            prefs[userRoleKey] = role
        }
    }

    suspend fun clearSession() {
        context.sessionDataStore.edit { it.clear() }
    }

    suspend fun setLanguage(language: AppLanguage) {
        context.sessionDataStore.edit { prefs ->
            prefs[languageKey] = language.code
        }
    }

    suspend fun setPosThemeMode(mode: PosThemeMode) {
        context.sessionDataStore.edit { prefs ->
            prefs[themeModeKey] = mode.name
        }
    }
}
