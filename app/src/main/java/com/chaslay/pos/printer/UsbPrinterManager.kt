package com.chaslay.pos.printer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import com.chaslay.pos.printer.EscPosEncoder
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

data class UsbPrinterDevice(
    /** Stable id stored in printer config, e.g. usb:1234:5678 */
    val stableAddress: String,
    val vendorId: Int,
    val productId: Int,
    val displayName: String,
    val hasPermission: Boolean = false,
    /** Ephemeral Android path — changes when replugged; not stored. */
    val deviceName: String = stableAddress
)

@Singleton
class UsbPrinterManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val usbManager: UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

    private val permissionAction = "${context.packageName}.USB_PERMISSION"
    private val pendingCallbacks = ConcurrentHashMap<String, (Boolean) -> Unit>()
    private var permissionReceiverRegistered = false
    private var attachReceiverRegistered = false

    private val attachReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) return
            val device = intent.getUsbDeviceExtra() ?: return
            if (!isLikelyPrinter(device)) return
            // Do not auto-prompt on attach — user grants once from Settings when adding a printer.
        }
    }

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != permissionAction) return
            val device = intent.getUsbDeviceExtra()
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            val key = device?.let { stableAddress(it) } ?: return
            pendingCallbacks.remove(key)?.invoke(granted && device != null)
        }
    }

    fun listDevices(): List<UsbPrinterDevice> {
        val manager = usbManager ?: return emptyList()
        return manager.deviceList.values
            .filter { isLikelyPrinter(it) }
            .map { deviceToInfo(it, manager.hasPermission(it)) }
    }

    fun hasPermission(address: String): Boolean {
        val manager = usbManager ?: return false
        val device = resolveDevice(address) ?: return false
        return manager.hasPermission(device)
    }

    fun requestPermission(address: String, onResult: (Boolean) -> Unit) {
        val manager = usbManager ?: run {
            onResult(false)
            return
        }
        val device = resolveDevice(address) ?: run {
            onResult(false)
            return
        }
        if (manager.hasPermission(device)) {
            onResult(true)
            return
        }
        runCatching {
            ensurePermissionReceiverRegistered()
            val key = stableAddress(device)
            pendingCallbacks[key] = onResult
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val requestCode = (key.hashCode() xor device.vendorId xor device.productId)
            val permissionIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                Intent(permissionAction).setPackage(context.packageName),
                flags
            )
            manager.requestPermission(device, permissionIntent)
        }.onFailure {
            pendingCallbacks.remove(stableAddress(device))
            onResult(false)
        }
    }

    /** Register USB receivers only — no permission dialogs on startup. */
    fun startMonitoring() {
        ensurePermissionReceiverRegistered()
        ensureAttachReceiverRegistered()
    }

    fun normalizeStoredAddress(address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) return trimmed
        resolveDevice(trimmed)?.let { return stableAddress(it) }
        return trimmed
    }

    fun formatAddressForDisplay(address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) {
            parseStableAddress(trimmed)?.let { (vid, pid, _) ->
                val device = resolveDevice(trimmed)
                return if (device != null) buildDisplayName(device) else "USB printer ($vid:$pid)"
            }
        }
        if (trimmed.startsWith("/dev/bus/usb")) {
            resolveDevice(trimmed)?.let { return buildDisplayName(it) }
            return "USB printer"
        }
        return trimmed
    }

    fun buildTestPayload(): ByteArray {
        val text = "ChaslayPOS\nUSB: é è ü Ø\n\n\n"
        return byteArrayOf(0x1B, 0x40, 0x1B, 0x74, 0x02) +
            EscPosEncoder.encode(text) +
            byteArrayOf(0x1D, 0x56, 0x00)
    }

    fun sendBytes(address: String, payload: ByteArray): Result<Unit> = runCatching {
        val manager = usbManager ?: error("USB not available")
        val device = resolveDevice(address) ?: error("USB printer not found — replug USB and re-select in Settings")
        if (!manager.hasPermission(device)) error("USB permission not granted — open Settings → Printers and allow access")
        val connection = manager.openDevice(device) ?: error("Could not open USB printer")
        try {
            val candidates = findPrintEndpoints(device)
            if (candidates.isEmpty()) error("No USB print endpoint found")
            var lastError: Exception? = null
            for ((usbInterface, endpoint) in candidates) {
                try {
                    if (!connection.claimInterface(usbInterface, true)) {
                        lastError = IllegalStateException("Could not claim USB interface")
                        continue
                    }
                    transferBulk(connection, endpoint, payload)
                    connection.releaseInterface(usbInterface)
                    return@runCatching
                } catch (e: Exception) {
                    lastError = e as? Exception ?: Exception(e.message)
                    runCatching { connection.releaseInterface(usbInterface) }
                }
            }
            throw lastError ?: IllegalStateException("USB transfer failed")
        } finally {
            connection.close()
        }
    }

    fun resolveDevice(address: String): UsbDevice? {
        val manager = usbManager ?: return null
        val trimmed = address.trim()
        if (trimmed.isBlank()) return null
        val devices = manager.deviceList.values

        devices.find { it.deviceName == trimmed }?.let { return it }

        parseStableAddress(trimmed)?.let { (vid, pid, serial) ->
            devices.find { device ->
                device.vendorId == vid &&
                    device.productId == pid &&
                    (serial == null || deviceSerial(device) == serial)
            }?.let { return it }
        }

        // Legacy configs saved only VID:PID inside parentheses, e.g. "/dev/bus/usb/001/003 (1234:5678)"
        LEGACY_VID_PID_REGEX.find(trimmed)?.let { match ->
            val vid = match.groupValues[1].toIntOrNull() ?: return@let
            val pid = match.groupValues[2].toIntOrNull() ?: return@let
            devices.find { it.vendorId == vid && it.productId == pid }?.let { return it }
        }

        val printers = devices.filter { isLikelyPrinter(it) }
        if (printers.size == 1) return printers.first()

        return null
    }

    private fun deviceToInfo(device: UsbDevice, hasPermission: Boolean) = UsbPrinterDevice(
        stableAddress = stableAddress(device),
        vendorId = device.vendorId,
        productId = device.productId,
        displayName = buildDisplayName(device),
        hasPermission = hasPermission,
        deviceName = device.deviceName
    )

    private fun buildDisplayName(device: UsbDevice): String {
        val brand = listOfNotNull(
            device.productName?.trim()?.takeIf { it.isNotEmpty() },
            device.manufacturerName?.trim()?.takeIf { it.isNotEmpty() }
        ).distinct().joinToString(" ")
            .ifBlank { "USB ESC/POS printer" }
        return "$brand (${device.vendorId}:${device.productId})"
    }

    private fun transferBulk(
        connection: android.hardware.usb.UsbDeviceConnection,
        endpoint: UsbEndpoint,
        payload: ByteArray
    ) {
        val chunkSize = 512
        var offset = 0
        while (offset < payload.size) {
            val length = min(chunkSize, payload.size - offset)
            val sent = connection.bulkTransfer(endpoint, payload, offset, length, 15_000)
            if (sent < 0) {
                error("USB transfer failed (code $sent) — check cable and printer power")
            }
            offset += sent
            if (offset < payload.size) {
                Thread.sleep(25)
            }
        }
        Thread.sleep(100)
    }

    private fun findPrintEndpoints(device: UsbDevice): List<Pair<UsbInterface, UsbEndpoint>> {
        val endpoints = mutableListOf<Pair<UsbInterface, UsbEndpoint>>()
        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            for (endpointIndex in 0 until usbInterface.endpointCount) {
                val endpoint = usbInterface.getEndpoint(endpointIndex)
                if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    endpoint.direction == UsbConstants.USB_DIR_OUT
                ) {
                    endpoints.add(usbInterface to endpoint)
                }
            }
        }
        return endpoints.sortedByDescending { (usbInterface, _) ->
            when (usbInterface.interfaceClass) {
                UsbConstants.USB_CLASS_PRINTER -> 3
                UsbConstants.USB_CLASS_VENDOR_SPEC -> 2
                else -> if (hasBulkOut(usbInterface)) 1 else 0
            }
        }
    }

    private fun isLikelyPrinter(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        return (0 until device.interfaceCount).any { index ->
            val usbInterface = device.getInterface(index)
            usbInterface.interfaceClass == UsbConstants.USB_CLASS_PRINTER ||
                (hasBulkOut(usbInterface) && usbInterface.interfaceClass !in NON_PRINTER_USB_CLASSES)
        }
    }

    private fun hasBulkOut(usbInterface: UsbInterface): Boolean =
        (0 until usbInterface.endpointCount).any { index ->
            val endpoint = usbInterface.getEndpoint(index)
            endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                endpoint.direction == UsbConstants.USB_DIR_OUT
        }

    private fun ensureAttachReceiverRegistered() {
        if (attachReceiverRegistered) return
        val filter = IntentFilter(UsbManager.ACTION_USB_DEVICE_ATTACHED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(attachReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(attachReceiver, filter)
        }
        attachReceiverRegistered = true
    }

    private fun ensurePermissionReceiverRegistered() {
        if (permissionReceiverRegistered) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(
                permissionReceiver,
                IntentFilter(permissionAction),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(permissionReceiver, IntentFilter(permissionAction))
        }
        permissionReceiverRegistered = true
    }

    private fun Intent.getUsbDeviceExtra(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }

    private fun deviceSerial(device: UsbDevice): String? = runCatching { device.serialNumber }.getOrNull()

    companion object {
        private const val USB_PREFIX = "usb:"
        private val LEGACY_VID_PID_REGEX = Regex("\\((\\d+):(\\d+)\\)\\s*$")

        fun stableAddress(device: UsbDevice): String {
            val serial = runCatching { device.serialNumber?.trim() }.getOrNull()?.takeIf { it.isNotEmpty() }
            return if (serial != null) {
                "${USB_PREFIX}${device.vendorId}:${device.productId}:$serial"
            } else {
                "${USB_PREFIX}${device.vendorId}:${device.productId}"
            }
        }

        fun parseStableAddress(address: String): Triple<Int, Int, String?>? {
            if (!address.startsWith(USB_PREFIX)) return null
            val body = address.removePrefix(USB_PREFIX)
            val parts = body.split(":")
            val vid = parts.getOrNull(0)?.toIntOrNull() ?: return null
            val pid = parts.getOrNull(1)?.toIntOrNull() ?: return null
            val serial = parts.drop(2).joinToString(":").takeIf { it.isNotEmpty() }
            return Triple(vid, pid, serial)
        }

        fun isUsbAddress(address: String?): Boolean {
            if (address.isNullOrBlank()) return false
            return address.startsWith(USB_PREFIX) || address.startsWith("/dev/bus/usb")
        }

        private val NON_PRINTER_USB_CLASSES = setOf(
            UsbConstants.USB_CLASS_HID,
            UsbConstants.USB_CLASS_HUB,
            UsbConstants.USB_CLASS_CDC_DATA,
            UsbConstants.USB_CLASS_COMM
        )
    }
}
