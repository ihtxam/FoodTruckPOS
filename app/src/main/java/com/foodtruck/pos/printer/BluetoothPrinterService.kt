package com.foodtruck.pos.printer

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Context
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.local.entity.TransactionItemEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import java.nio.charset.Charset
import javax.inject.Inject
import javax.inject.Singleton

data class DiscoveredPrinter(
    val name: String,
    val address: String
)

@Singleton
class BluetoothPrinterService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun discoverPrinters(): List<DiscoveredPrinter> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        return adapter.bondedDevices.map { device ->
            DiscoveredPrinter(name = device.name ?: "Unknown", address = device.address)
        }
    }

    fun printReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>
    ): Result<Unit> {
        val mac = settings.printerMacAddress
            ?: return Result.failure(IllegalStateException("No printer configured"))

        return runCatching {
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(mac)
            val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
            socket.outputStream.use { output ->
                output.write(buildEscPosReceipt(settings, transaction, items))
            }
            socket.close()
        }
    }

    fun testPrint(settings: BusinessSettingsEntity): Result<Unit> {
        val mac = settings.printerMacAddress
            ?: return Result.failure(IllegalStateException("No printer configured"))
        return runCatching {
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(mac)
            val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
            socket.outputStream.use { output ->
                output.write(buildTestReceipt(settings))
            }
            socket.close()
        }
    }

    private fun buildEscPosReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>
    ): ByteArray {
        val sb = StringBuilder()
        sb.appendLine(center(settings.businessName))
        if (settings.address.isNotBlank()) sb.appendLine(center(settings.address))
        if (settings.phone.isNotBlank()) sb.appendLine(center(settings.phone))
        sb.appendLine(center("--------------------------------"))
        sb.appendLine("Receipt: ${transaction.transactionNumber}")
        items.forEach { item ->
            val label = buildString {
                append(item.productName)
                if (item.variantName != null) append(" (${item.variantName})")
            }
            sb.appendLine("$label x${item.quantity}")
            sb.appendLine(right(formatMoney(item.lineTotal, settings.currencySymbol)))
        }
        sb.appendLine("--------------------------------")
        sb.appendLine("Subtotal: ${formatMoney(transaction.subtotal, settings.currencySymbol)}")
        sb.appendLine("Tax: ${formatMoney(transaction.taxTotal, settings.currencySymbol)}")
        sb.appendLine("TOTAL: ${formatMoney(transaction.total, settings.currencySymbol)}")
        sb.appendLine("Paid: ${transaction.paymentMethod.name}")
        transaction.receiptUrl?.let { sb.appendLine("QR: $it") }
        sb.appendLine("\nThank you!\n\n\n")

        return ESC_INIT + sb.toString().toByteArray(Charset.forName("ISO-8859-1")) + ESC_CUT
    }

    private fun buildTestReceipt(settings: BusinessSettingsEntity): ByteArray {
        val text = buildString {
            appendLine(center(settings.businessName))
            appendLine(center("TEST PRINT"))
            appendLine(center("Printer OK"))
            appendLine("\n\n\n")
        }
        return ESC_INIT + text.toByteArray(Charset.forName("ISO-8859-1")) + ESC_CUT
    }

    private fun center(text: String): String = text
    private fun right(text: String): String = text

    private fun formatMoney(amount: Double, symbol: String): String =
        String.format("%s %.2f", symbol, amount)

    companion object {
        private val SPP_UUID = java.util.UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private val ESC_INIT = byteArrayOf(0x1B, 0x40)
        private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x00)
    }
}
