package com.chaslay.pos.scale

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Log
import com.chaslay.pos.printer.UsbPrinterManager
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

data class ScaleUsbDevice(
    val stableAddress: String,
    val vendorId: Int,
    val productId: Int,
    val displayName: String,
    val hasPermission: Boolean
)

@Singleton
class AclasScaleService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val usbPrinterManager: UsbPrinterManager
) {
    private val usbManager: UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var readJob: Job? = null
    private var activePort: UsbSerialPort? = null
    private var connectedAddress: String? = null

    private val _reading = MutableStateFlow<AclasScaleReading?>(null)
    val reading: StateFlow<AclasScaleReading?> = _reading.asStateFlow()

    private val _connectionMessage = MutableStateFlow<String?>(null)
    val connectionMessage: StateFlow<String?> = _connectionMessage.asStateFlow()

    fun listDevices(): List<ScaleUsbDevice> {
        val manager = usbManager ?: return emptyList()
        return manager.deviceList.values
            .filter { isLikelyScale(it) }
            .map { device ->
                ScaleUsbDevice(
                    stableAddress = UsbPrinterManager.stableAddress(device),
                    vendorId = device.vendorId,
                    productId = device.productId,
                    displayName = buildDisplayName(device),
                    hasPermission = manager.hasPermission(device)
                )
            }
    }

    fun hasPermission(address: String): Boolean = usbPrinterManager.hasPermission(address)

    fun requestPermission(address: String, onResult: (Boolean) -> Unit) {
        usbPrinterManager.requestPermission(address, onResult)
    }

    fun connect(address: String) {
        val normalized = usbPrinterManager.normalizeStoredAddress(address.trim())
        if (normalized.isBlank()) return
        if (connectedAddress == normalized && readJob?.isActive == true) return
        disconnect()
        readJob = scope.launch {
            runCatching { openAndRead(normalized) }
                .onFailure { error ->
                    Log.w(TAG, "Scale connection failed", error)
                    _connectionMessage.value = error.message ?: "Scale connection failed"
                    _reading.value = null
                }
        }
    }

    fun disconnect() {
        readJob?.cancel()
        readJob = null
        runCatching { activePort?.close() }
        activePort = null
        connectedAddress = null
        _reading.value = null
    }

    suspend fun readOnce(address: String, timeoutMs: Long = 3_000): Result<AclasScaleReading> =
        withContext(Dispatchers.IO) {
            val normalized = usbPrinterManager.normalizeStoredAddress(address.trim())
            val port = openPort(normalized).getOrElse { return@withContext Result.failure(it) }
            try {
                val buffer = ByteArray(256)
                val deadline = System.currentTimeMillis() + timeoutMs
                while (System.currentTimeMillis() < deadline) {
                    val bytesRead = port.read(buffer, 500)
                    if (bytesRead > 0) {
                        AclasScaleProtocol.findLatestReading(buffer, bytesRead)?.let { reading ->
                            return@withContext Result.success(reading)
                        }
                    }
                    delay(50)
                }
                Result.failure(IllegalStateException("No stable reading from scale � check USB cable and power"))
            } finally {
                runCatching { port.close() }
            }
        }

    private suspend fun openAndRead(address: String) {
        val port = openPort(address).getOrThrow()
        activePort = port
        connectedAddress = address
        _connectionMessage.value = "Scale connected"
        val buffer = ByteArray(512)
        while (scope.isActive) {
            val bytesRead = runCatching { port.read(buffer, 1_000) }.getOrDefault(0)
            if (bytesRead > 0) {
                AclasScaleProtocol.findLatestReading(buffer, bytesRead)?.let { parsed ->
                    _reading.value = parsed
                }
            }
            delay(20)
        }
    }

    private fun openPort(address: String): Result<UsbSerialPort> = runCatching {
        val manager = usbManager ?: error("USB not available on this device")
        val device = usbPrinterManager.resolveDevice(address)
            ?: error("Scale not found � connect Aclas OS6X via USB OTG")
        if (!manager.hasPermission(device)) {
            error("USB permission not granted � allow access in Settings ? Printers & Scale")
        }
        val driver = findSerialDriver(device) ?: error("No serial interface found on scale")
        val connection = manager.openDevice(device) ?: error("Could not open USB scale")
        val port = driver.ports.firstOrNull() ?: error("Scale serial port not found")
        port.open(connection)
        port.setParameters(BAUD_RATE, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
        port.dtr = true
        port.rts = true
        port
    }

    private fun findSerialDriver(device: UsbDevice): UsbSerialDriver? {
        val manager = usbManager ?: return null
        val defaultDriver = UsbSerialProber.getDefaultProber().probeDevice(device)
        if (defaultDriver != null) return defaultDriver
        return UsbSerialProber.getDefaultProber().findAllDrivers(manager)
            .firstOrNull { it.device.deviceId == device.deviceId }
    }

    private fun isLikelyScale(device: UsbDevice): Boolean {
        if (device.vendorId == ACLAS_VENDOR_ID && device.productId == ACLAS_PRODUCT_ID) return true
        if (device.vendorId == QINHENG_VENDOR_ID) return true
        return (0 until device.interfaceCount).any { index ->
            val usbInterface = device.getInterface(index)
            usbInterface.interfaceClass == UsbConstants.USB_CLASS_CDC_DATA ||
                usbInterface.interfaceClass == UsbConstants.USB_CLASS_COMM
        }
    }

    private fun buildDisplayName(device: UsbDevice): String {
        val label = listOfNotNull(
            device.productName?.trim()?.takeIf { it.isNotEmpty() },
            device.manufacturerName?.trim()?.takeIf { it.isNotEmpty() }
        ).distinct().joinToString(" ").ifBlank { "USB scale" }
        return "$label (${device.vendorId}:${device.productId})"
    }

    companion object {
        private const val TAG = "AclasScale"
        private const val BAUD_RATE = 9600
        private const val ACLAS_VENDOR_ID = 6790 // 0x1A86 CH340 used by Aclas OS6X USB adapter
        private const val ACLAS_PRODUCT_ID = 29987 // 0x7523
        private const val QINHENG_VENDOR_ID = 0x1A86
    }
}
