package com.foodtruck.pos

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.foodtruck.pos.debug.CrashLogger
import com.foodtruck.pos.printer.PrinterConnectionManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class FoodTruckPosApp : Application() {

    @Inject lateinit var crashLogger: CrashLogger
    @Inject lateinit var printerConnectionManager: PrinterConnectionManager

    override fun onCreate() {
        super.onCreate()
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("en"))
        crashLogger.installGlobalHandler()
        printerConnectionManager.warmupOnStartup()
    }
}
