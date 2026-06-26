package com.foodtruck.pos.printer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

data class UsbPrinterDevice(
    val deviceName: String,
    val vendorId: Int,
    val productId: Int,
    val displayName: String,
    val hasPermission: Boolean = false
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

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != permissionAction) return
            val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            }
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            val deviceName = device?.deviceName ?: return
            pendingCallbacks.remove(deviceName)?.invoke(granted && device != null)
        }
    }

    fun listDevices(): List<UsbPrinterDevice> {
        val manager = usbManager ?: return emptyList()
        return manager.deviceList.values.map { device ->
            UsbPrinterDevice(
                deviceName = device.deviceName,
                vendorId = device.vendorId,
                productId = device.productId,
                displayName = "${device.deviceName} (${device.vendorId}:${device.productId})",
                hasPermission = manager.hasPermission(device)
            )
        }
    }

    fun hasPermission(deviceName: String): Boolean {
        val manager = usbManager ?: return false
        val device = manager.deviceList.values.find { it.deviceName == deviceName } ?: return false
        return manager.hasPermission(device)
    }

    fun requestPermission(deviceName: String, onResult: (Boolean) -> Unit) {
        val manager = usbManager ?: run {
            onResult(false)
            return
        }
        val device = manager.deviceList.values.find { it.deviceName == deviceName } ?: run {
            onResult(false)
            return
        }
        if (manager.hasPermission(device)) {
            onResult(true)
            return
        }
        runCatching {
            ensurePermissionReceiverRegistered()
            pendingCallbacks[deviceName] = onResult
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val requestCode = (deviceName.hashCode() xor device.vendorId xor device.productId)
            val permissionIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                Intent(permissionAction).setPackage(context.packageName),
                flags
            )
            manager.requestPermission(device, permissionIntent)
        }.onFailure {
            pendingCallbacks.remove(deviceName)
            onResult(false)
        }
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

    fun buildTestPayload(): ByteArray {
        val text = "Food Truck POS\nUSB test print\n\n\n"
        return byteArrayOf(0x1B, 0x40) + text.toByteArray(Charsets.ISO_8859_1) + byteArrayOf(0x1D, 0x56, 0x00)
    }

    fun sendBytes(deviceName: String, payload: ByteArray): Result<Unit> = runCatching {
        val manager = usbManager ?: error("USB not available")
        val device = manager.deviceList.values.find { it.deviceName == deviceName }
            ?: error("USB device not found")
        if (!manager.hasPermission(device)) error("USB permission not granted")
        val connection = manager.openDevice(device) ?: error("Could not open USB device")
        try {
            val usbInterface = findPrinterInterface(device)
            connection.claimInterface(usbInterface, true)
            val endpoint = findBulkOutEndpoint(usbInterface)
                ?: error("No USB print endpoint found")
            val sent = connection.bulkTransfer(endpoint, payload, payload.size, 8000)
            if (sent < 0) error("USB transfer failed")
            connection.releaseInterface(usbInterface)
        } finally {
            connection.close()
        }
    }

    private fun findPrinterInterface(device: UsbDevice) =
        (0 until device.interfaceCount)
            .map { device.getInterface(it) }
            .firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
            ?: if (device.interfaceCount > 0) device.getInterface(0) else error("No USB interfaces")

    private fun findBulkOutEndpoint(usbInterface: android.hardware.usb.UsbInterface) =
        (0 until usbInterface.endpointCount)
            .map { usbInterface.getEndpoint(it) }
            .firstOrNull {
                it.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    it.direction == UsbConstants.USB_DIR_OUT
            }
}
