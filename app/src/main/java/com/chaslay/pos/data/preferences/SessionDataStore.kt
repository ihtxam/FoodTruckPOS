package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

internal val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")
