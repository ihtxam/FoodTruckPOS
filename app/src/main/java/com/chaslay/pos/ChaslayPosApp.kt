package com.chaslay.pos

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.chaslay.pos.data.preferences.sessionDataStore
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.printer.PrinterConnectionManager
import com.chaslay.pos.printer.UsbPrinterManager
import com.chaslay.pos.sync.BackgroundSyncScheduler
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val startupLanguageKey = stringPreferencesKey("app_language")

@HiltAndroidApp
class ChaslayPosApp : Application(), Configuration.Provider {

    @Inject lateinit var crashLogger: CrashLogger
    @Inject lateinit var printerConnectionManager: PrinterConnectionManager
    @Inject lateinit var usbPrinterManager: UsbPrinterManager
    @Inject lateinit var backgroundSyncScheduler: BackgroundSyncScheduler
    @Inject lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        applySavedLocale()
        crashLogger.installGlobalHandler()
        printerConnectionManager.warmupOnStartup()
        usbPrinterManager.startMonitoring()
        backgroundSyncScheduler.schedule(this)
    }

    private fun applySavedLocale() {
        val languageCode = runBlocking {
            sessionDataStore.data.first()[startupLanguageKey] ?: AppLanguage.ENGLISH.code
        }
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(languageCode))
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
