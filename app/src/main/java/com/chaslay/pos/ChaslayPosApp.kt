package com.chaslay.pos

import android.app.Application
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.startup.AppInitializer
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.adyen.ipp.api.InPersonPaymentsInitializer
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

        // Force the Adyen Tap to Pay SDK's androidx.startup initializer to run now so
        // its applicationContext is ready before any Activity invokes the SDK. The
        // MerchantAuthenticationService is auto-detected from the manifest <service>.
        try {
            AppInitializer.getInstance(this)
                .initializeComponent(InPersonPaymentsInitializer::class.java)
        } catch (t: Throwable) {
            Log.e("ChaslayPosApp", "Adyen Tap to Pay init failed", t)
        }
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
