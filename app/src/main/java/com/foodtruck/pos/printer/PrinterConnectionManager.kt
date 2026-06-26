package com.foodtruck.pos.printer

import com.foodtruck.pos.data.local.dao.PrinterConfigDao
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PrinterConnectionManager @Inject constructor(
    private val printerConfigDao: PrinterConfigDao,
    private val printerService: BluetoothPrinterService
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun warmupOnStartup() {
        scope.launch {
            val printers = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
                .filter { it.isEnabled && it.address.isNotBlank() }
            printers.forEach { printer ->
                printerService.warmupConnection(printer.address, printer.connectionType)
            }
        }
    }
}
