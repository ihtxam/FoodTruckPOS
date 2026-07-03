package com.chaslay.pos.printer

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.PrinterConfigEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.VatBreakdownRow
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.formatMoneyAmount
import com.chaslay.pos.domain.model.roundMoney
import com.chaslay.pos.receipt.ReceiptQrGenerator
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class DiscoveredPrinter(
    val name: String,
    val address: String
)

@Singleton
class BluetoothPrinterService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val usbPrinterManager: UsbPrinterManager,
    private val printerConfigDao: com.chaslay.pos.data.local.dao.PrinterConfigDao,
    private val receiptQrGenerator: ReceiptQrGenerator
) {
    private val kitchenQtyLine = Regex("^\\d+x\\s+", RegexOption.IGNORE_CASE)
    private val kitchenDiscountNote = Regex("""^\d+(\.\d+)?% off$|(?i)^adjusted from """)

    private fun bluetoothAdapter(): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter
    }

    fun simulatedPrinter(): DiscoveredPrinter = SIMULATED_PRINTER

    fun discoverPrinters(hasBluetoothPermission: Boolean): List<DiscoveredPrinter> {
        val printers = mutableListOf(SIMULATED_PRINTER)
        if (!hasBluetoothPermission) return printers
        return runCatching {
            val adapter = bluetoothAdapter() ?: return printers
            if (!adapter.isEnabled) return printers
            adapter.bondedDevices.orEmpty().mapTo(printers) { device ->
                DiscoveredPrinter(name = device.name ?: "Unknown", address = device.address)
            }
            printers
        }.getOrElse {
            Log.w(TAG, "Bluetooth discovery failed", it)
            printers
        }
    }

    /**
     * Scans the local Wi-Fi subnet (/24) for ESC/POS network printers listening on the
     * standard JetDirect/RAW port 9100. Returns any hosts that accept a TCP connection.
     */
    suspend fun discoverNetworkPrinters(
        port: Int = 9100,
        extraHosts: List<String> = emptyList()
    ): List<DiscoveredPrinter> =
        withContext(Dispatchers.IO) {
            val results = linkedMapOf<String, DiscoveredPrinter>()
            extraHosts.map { it.trim() }.filter { it.isNotBlank() }.forEach { raw ->
                val (host, probePort) = parseHostPort(raw)
                if (canReachNetworkPrinter(host, probePort)) {
                    results[host] = DiscoveredPrinter("Network printer ($host)", host)
                }
            }

            val localIp = localIpAddress()
            if (localIp == null) {
                Log.w(TAG, "Network scan skipped: no local IPv4 address")
                return@withContext results.values.toList()
            }
            val prefix = localIp.substringBeforeLast('.', "")
            if (prefix.isBlank()) {
                Log.w(TAG, "Network scan skipped: invalid local IP $localIp")
                return@withContext results.values.toList()
            }
            Log.i(TAG, "Scanning $prefix.1-254:$port from $localIp")
            val semaphore = Semaphore(16)
            coroutineScope {
                (1..254).map { host ->
                    async {
                        semaphore.withPermit {
                            val ip = "$prefix.$host"
                            if (ip in results) return@async null
                            if (canReachNetworkPrinter(ip, port)) {
                                DiscoveredPrinter("Network printer ($ip)", ip)
                            } else null
                        }
                    }
                }.mapNotNull { deferred ->
                    deferred.await()?.also { printer -> results[printer.address] = printer }
                }
            }
            Log.i(TAG, "Network scan finished: ${results.size} printer(s)")
            results.values.toList()
        }

    fun canReachNetworkPrinter(address: String, port: Int = 9100, timeoutMs: Int = 2000): Boolean {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        val (host, resolvedPort) = parseHostPort(trimmed)
        if (!isNetworkAddress(host)) return false
        return runCatching {
            val socket = java.net.Socket()
            try {
                localIpAddress()?.let { local ->
                    runCatching { socket.bind(java.net.InetSocketAddress(local, 0)) }
                }
                socket.connect(java.net.InetSocketAddress(host, resolvedPort), timeoutMs)
                true
            } finally {
                runCatching { socket.close() }
            }
        }.getOrDefault(false)
    }

    fun currentLocalIpv4(): String? = localIpAddress()

    /** Opens a short connection to verify the printer is reachable (Bluetooth / Wi-Fi / USB). */
    suspend fun warmupConnection(address: String, connectionType: String) = withContext(Dispatchers.IO) {
        if (address.isBlank() || isSimulated(address)) return@withContext
        runCatching {
            when {
                connectionType == "USB" || isUsbAddress(address) ->
                    usbPrinterManager.sendBytes(address, ESC_INIT)
                isNetworkAddress(address) -> {
                    val (host, port) = parseHostPort(address)
                    java.net.Socket().use { socket ->
                        socket.connect(java.net.InetSocketAddress(host, port), 3000)
                    }
                }
                else -> {
                    val adapter = bluetoothAdapter() ?: return@runCatching
                    val device = adapter.getRemoteDevice(address)
                    val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                    socket.close()
                }
            }
        }.onFailure { e -> Log.w(TAG, "Warmup failed for $address: ${e.message}") }
    }

    private fun localIpAddress(): String? = runCatching {
        val interfaces = java.net.NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .sortedByDescending { iface ->
                when {
                    iface.name.lowercase().startsWith("wlan") -> 3
                    iface.name.lowercase().startsWith("wifi") -> 3
                    iface.name.lowercase().startsWith("eth") -> 2
                    else -> 1
                }
            }
        interfaces.flatMap { it.inetAddresses.toList() }
            .firstOrNull { addr ->
                !addr.isLoopbackAddress &&
                    addr is java.net.Inet4Address &&
                    addr.isSiteLocalAddress
            }?.hostAddress
    }.getOrNull()

    private fun parseHostPort(address: String): Pair<String, Int> {
        val trimmed = address.trim()
        val colon = trimmed.lastIndexOf(':')
        return if (colon > 0 && trimmed.substring(colon + 1).toIntOrNull() != null) {
            trimmed.substring(0, colon) to trimmed.substring(colon + 1).toInt()
        } else {
            trimmed to 9100
        }
    }

    fun printReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>
    ): Result<Unit> {
        val payload = buildEscPosReceipt(settings, transaction, items)
        return sendBytes(settings.printerMacAddress, settings, payload, "Receipt ${transaction.transactionNumber}")
    }

    fun testPrint(settings: BusinessSettingsEntity): Result<Unit> {
        val payload = buildTestReceipt(settings)
        return sendBytes(settings.printerMacAddress, settings, payload, "Test print")
    }

    fun openCashDrawer(settings: BusinessSettingsEntity): Result<Unit> {
        val payload = ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        return sendBytes(settings.printerMacAddress, settings, payload, "Cash drawer")
    }

    suspend fun routeOpenCashDrawer(settings: BusinessSettingsEntity): Result<Unit> = withContext(Dispatchers.IO) {
        val payload = ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        val drawerPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.openCashDrawer && it.address.isNotBlank() }
        if (drawerPrinters.isEmpty()) {
            return@withContext openCashDrawer(settings)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in drawerPrinters) {
            last = sendBytes(printer.address, settings, payload, "Cash drawer ${printer.name}")
        }
        last
    }

    suspend fun routeCartReceipt(
        settings: BusinessSettingsEntity,
        cart: CartSummary,
        context: ReceiptPrintContext,
        discountAmount: Double,
        tipAmount: Double,
        total: Double
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            val payload = buildCartReceipt(settings, cart, context, discountAmount, tipAmount, total)
            return@withContext sendBytes(settings.printerMacAddress, settings, payload, "Receipt")
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildCartReceipt(
                settings, cart, context, discountAmount, tipAmount, total, lineWidth
            )
            last = sendBytes(printer.address, settings, payload, "Receipt ${printer.name}")
        }
        last
    }

    fun printCartPreview(
        settings: BusinessSettingsEntity,
        lines: List<Pair<String, Double>>,
        total: Double,
        title: String = "PREVIEW RECEIPT"
    ): Result<Unit> {
        val sb = StringBuilder()
        appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName })
        sb.appendLine(center(title))
        sb.appendLine(center("--------------------------------"))
        lines.forEach { (label, amount) ->
            sb.appendLine(label)
            sb.appendLine(right(formatMoney(amount, settings.currencySymbol)))
        }
        sb.appendLine("--------------------------------")
        sb.appendLine("TOTAL: ${formatMoney(total, settings.currencySymbol)}")
        appendFooter(sb, settings.receiptFooter)
        sb.appendLine("\n\n\n")
        return sendBytes(settings.printerMacAddress, settings, encodePayload(sb.toString()), "Preview receipt")
    }

    suspend fun routeCartPreview(
        settings: BusinessSettingsEntity,
        lines: List<Pair<String, Double>>,
        total: Double,
        title: String = "PREVIEW RECEIPT"
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            return@withContext printCartPreview(settings, lines, total, title)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val sb = StringBuilder()
            appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName }, lineWidth)
            sb.appendLine(center(title, lineWidth))
            sb.appendLine(center("-".repeat(lineWidth.coerceAtMost(32)), lineWidth))
            lines.forEach { (label, amount) ->
                sb.appendLine(label)
                sb.appendLine(right(formatMoney(amount, settings.currencySymbol), lineWidth))
            }
            sb.appendLine("-".repeat(lineWidth.coerceAtMost(32)))
            sb.appendLine("TOTAL: ${formatMoney(total, settings.currencySymbol)}")
            appendFooter(sb, settings.receiptFooter, lineWidth)
            sb.appendLine("\n\n\n")
            last = sendBytes(printer.address, settings, encodePayload(sb.toString()), "Preview ${printer.name}")
        }
        last
    }

    suspend fun routeEndOfDayReport(
        settings: BusinessSettingsEntity,
        report: EndOfDayReport
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val payload = buildEndOfDayReport(settings, report)
        val reportPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printEndOfDayReports && it.address.isNotBlank() }
        if (reportPrinters.isNotEmpty()) {
            var last: Result<Unit> = Result.success(Unit)
            for (printer in reportPrinters) {
                last = sendBytes(printer.address, settings, payload, "End of day ${printer.name}")
            }
            return@withContext last
        }
        val legacyAddress = settings.printerMacAddress?.takeIf { it.isNotBlank() }
            ?: return@withContext Result.failure(IllegalStateException("No report printer configured. Add a printer with ENDOFDAY REPORTS enabled."))
        sendBytes(legacyAddress, settings, payload, "End of day report")
    }

    suspend fun printEndOfDayReport(settings: BusinessSettingsEntity, report: EndOfDayReport): Result<Unit> =
        routeEndOfDayReport(settings, report)

    fun printKitchenTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        categories: List<CategoryEntity> = emptyList(),
        products: List<ProductEntity> = emptyList(),
        meta: KitchenPrintMeta = KitchenPrintMeta(),
        paperWidthMm: Int = 80
    ): Result<Unit> {
        if (items.isEmpty() && !isFollowUp) return Result.success(Unit)
        val lineWidth = lineWidthFor(paperWidthMm)
        val kitchenItems = items.filter {
            resolvePrintTarget(it.productId, categories, products) != PrintTarget.POS
        }
        val posItems = items.filter {
            val target = resolvePrintTarget(it.productId, categories, products)
            target == PrintTarget.POS || target == PrintTarget.BOTH
        }
        val ticketItems = when {
            isFollowUp -> emptyList()
            kitchenItems.isNotEmpty() -> kitchenItems
            else -> items
        }
        var lastResult: Result<Unit> = Result.success(Unit)
        if (ticketItems.isNotEmpty() || isFollowUp) {
            val payload = buildKitchenTicket(
                settings = settings,
                tableName = tableName,
                serviceType = serviceType,
                round = round,
                items = ticketItems,
                isFollowUp = isFollowUp,
                message = message,
                meta = meta,
                lineWidth = lineWidth
            )
            val mac = settings.kitchenPrinterMacAddress
                ?: settings.printerMacAddress
                ?: SIMULATED_ADDRESS
            lastResult = sendBytes(mac, settings, payload, "Kitchen ticket")
        }
        if (posItems.isNotEmpty() && !isFollowUp) {
            val barPayload = buildBarTicket(settings, tableName, round, posItems, lineWidth)
            val mac = settings.printerMacAddress ?: SIMULATED_ADDRESS
            lastResult = sendBytes(mac, settings, barPayload, "Bar ticket")
        }
        return lastResult
    }

    /**
     * Routes a kitchen ticket to every saved printer that is enabled and set to print kitchen
     * tickets, printing only the items linked to each printer (by product or category). Falls back
     * to the legacy single kitchen-printer behaviour when no kitchen printers are configured.
     */
    suspend fun routeKitchen(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        products: List<ProductEntity> = emptyList(),
        categories: List<CategoryEntity> = emptyList(),
        meta: KitchenPrintMeta = KitchenPrintMeta()
    ): Result<Unit> = withContext(Dispatchers.IO) {
        if (items.isEmpty() && !isFollowUp) return@withContext Result.success(Unit)
        val kitchenPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printKitchenTickets && it.address.isNotBlank() }
        if (kitchenPrinters.isEmpty()) {
            return@withContext printKitchenTicket(
                settings, tableName, serviceType, round, items, isFollowUp, message, categories, products, meta, 80
            )
        }
        var last: Result<Unit> = Result.success(Unit)
        var printedAny = false
        for (printer in kitchenPrinters) {
            val subset = if (isFollowUp) emptyList() else items.filter { matchesPrinter(it, printer, products) }
            if (!isFollowUp && subset.isEmpty()) continue
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildKitchenTicket(
                settings, tableName, serviceType, round, subset, isFollowUp, message, meta, lineWidth
            )
            last = sendBytes(printer.address, settings, payload, "Kitchen ${printer.name}")
            printedAny = true
        }
        if (printedAny) last else Result.success(Unit)
    }

    /**
     * Routes a customer receipt to every saved printer set to print order receipts. Falls back to
     * the legacy single receipt-printer behaviour when none are configured.
     */
    suspend fun routeReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            return@withContext printReceipt(settings, transaction, items)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildEscPosReceipt(settings, transaction, items, lineWidth)
            last = sendBytes(printer.address, settings, payload, "Receipt ${printer.name}")
            if (printer.openCashDrawer) {
                sendBytes(
                    printer.address,
                    settings,
                    ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte()),
                    "Cash drawer"
                )
            }
        }
        last
    }

    private fun matchesPrinter(
        item: TableOrderItemEntity,
        printer: PrinterConfigEntity,
        products: List<ProductEntity>
    ): Boolean {
        if (printer.printAllProducts) return true
        val productIds = printer.linkedProductIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
        if (item.productId in productIds) return true
        val categoryIds = printer.linkedCategoryIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
        val product = products.find { it.id == item.productId }
        return product != null && product.categoryId in categoryIds
    }

    fun resolvePrintTarget(
        productId: Long,
        categories: List<CategoryEntity>,
        products: List<ProductEntity>
    ): PrintTarget {
        val product = products.find { it.id == productId }
        product?.printTarget?.let { return it }
        val category = categories.find { it.id == product?.categoryId }
        return category?.printTarget ?: PrintTarget.KITCHEN
    }

    private fun buildBarTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        round: Int,
        items: List<TableOrderItemEntity>,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        appendHeader(sb, settings.kitchenTicketHeader, lineWidth)
        sb.appendLine(escBold(true))
        sb.appendLine(center("BAR / POS", lineWidth))
        sb.appendLine(escBold(false))
        sb.appendLine(center(settings.businessName, lineWidth))
        sb.appendLine("Table: $tableName  Round: $round")
        sb.appendLine(center("-".repeat(lineWidth.coerceAtMost(32)), lineWidth))
        items.forEach { item ->
            appendKitchenItemBlock(sb, item, settings, lineWidth)
        }
        appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    private fun buildKitchenTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        meta: KitchenPrintMeta = KitchenPrintMeta(),
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        val timeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth.coerceAtMost(32))
        val sepDash = "-".repeat(lineWidth.coerceAtMost(32))

        if (isFollowUp) {
            sb.appendLine(escBold(true))
            sb.appendLine(center("KITCHEN MESSAGE", lineWidth))
            sb.appendLine(escBold(false))
            if (tableName.isNotBlank()) sb.appendLine(center(tableName, lineWidth))
            sb.appendLine(center(sepDash, lineWidth))
            sb.appendLine(message.orEmpty())
            appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
            sb.appendLine("\n\n\n")
            return encodePayload(sb.toString())
        }

        sb.appendLine(escBold(true))
        sb.appendLine(center("KITCHEN", lineWidth))
        sb.appendLine(escBold(false))
        meta.orderNumber?.let { sb.appendLine(center("#$it", lineWidth)) }

        val fulfillmentLabel = when (meta.fulfillmentType) {
            FulfillmentType.PICKUP -> "TAKEAWAY"
            FulfillmentType.DELIVERY -> "DELIVERY"
            FulfillmentType.DINE_IN -> "DINE IN"
            FulfillmentType.WALK_IN -> "WALK IN"
            else -> serviceType.displayName.uppercase(Locale.getDefault())
        }
        if (effectiveKitchenHeaderScale(settings) > 1) {
            sb.append(escAlignCenter())
            sb.append(escKitchenSize(effectiveKitchenHeaderScale(settings), bold = true))
            sb.appendLine(fulfillmentLabel)
            sb.append(escKitchenSizeReset())
            sb.append(escAlignLeft())
        } else {
            sb.appendLine(escBold(true))
            sb.appendLine(center(fulfillmentLabel, lineWidth))
            sb.appendLine(escBold(false))
        }
        when (meta.fulfillmentType) {
            FulfillmentType.DELIVERY -> {
                meta.deliveryName?.takeIf { it.isNotBlank() }?.let {
                    sb.appendLine(center("Deliver to: $it", lineWidth))
                }
                meta.deliveryAddress?.takeIf { it.isNotBlank() }?.let { addr ->
                    addr.chunked(lineWidth.coerceAtMost(32)).forEach { sb.appendLine(it) }
                }
                meta.deliveryPhone?.takeIf { it.isNotBlank() }?.let {
                    sb.appendLine(center("Tel: $it", lineWidth))
                }
                val deliveryLabel = meta.pickupTimeMs?.let { timeFmt.format(Date(it)) } ?: "ASAP"
                sb.appendLine(center("Delivery time: $deliveryLabel", lineWidth))
            }
            FulfillmentType.PICKUP -> {
                val pickupLabel = meta.pickupTimeMs?.let { timeFmt.format(Date(it)) } ?: "ASAP"
                sb.appendLine(center("Pickup: $pickupLabel", lineWidth))
            }
            FulfillmentType.WALK_IN -> sb.appendLine(center("Walk-in", lineWidth))
            else -> Unit
        }
        if (tableName.isNotBlank() && meta.fulfillmentType != FulfillmentType.PICKUP &&
            meta.fulfillmentType != FulfillmentType.DELIVERY
        ) {
            sb.appendLine(center(tableName, lineWidth))
        }

        sb.appendLine(center(sepEq, lineWidth))
        val itemCount = items.sumOf { it.quantity }
        sb.appendLine("ITEMS${" ".repeat((lineWidth - 5 - "NUMS ($itemCount)".length).coerceAtLeast(1))}NUMS ($itemCount)")
        sb.appendLine(sepDash)

        meta.fireCourseNumber?.let { course ->
            sb.appendLine(escBold(true))
            sb.appendLine(center("*** FIRE COURSE $course ***", lineWidth))
            sb.appendLine(escBold(false))
        }

        val courses = items.groupBy { it.courseNumber }.toSortedMap()
        if (courses.size <= 1) {
            items.forEach { item ->
                appendKitchenItemBlock(sb, item, settings, lineWidth)
            }
        } else {
            courses.forEach { (course, courseItems) ->
                sb.appendLine(escBold(true))
                sb.appendLine(center("--- COURSE $course ---", lineWidth))
                sb.appendLine(escBold(false))
                courseItems.forEach { item ->
                    appendKitchenItemBlock(sb, item, settings, lineWidth)
                }
                sb.appendLine(sepDash)
            }
        }

        if (round > 1) sb.appendLine(center("Round: $round", lineWidth))
        meta.cashierName?.let { sb.appendLine(center("By: $it", lineWidth)) }
        appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    private fun buildCartReceipt(
        settings: BusinessSettingsEntity,
        cart: CartSummary,
        context: ReceiptPrintContext,
        discountAmount: Double,
        tipAmount: Double,
        total: Double,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        val dateTimeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth.coerceAtMost(32))
        val subtotal = cart.subtotal - cart.itemDiscountTotal
        val discountFactor = if (subtotal > 0.0) {
            ((subtotal - discountAmount) / subtotal).coerceIn(0.0, 1.0)
        } else 1.0
        val vatRows = ReceiptVatCalculator.vatRowsFromCartItems(cart.items, discountFactor)

        appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName }, lineWidth)
        if (settings.receiptHeader.isBlank()) {
            sb.appendLine(center(settings.businessName, lineWidth))
        }
        if (context.paymentMethod == null) {
            sb.appendLine(center("PROVISIONAL INVOICE", lineWidth))
        }
        if (settings.vatNumber.isNotBlank()) {
            sb.appendLine(center(settings.vatNumber, lineWidth))
        }
        sb.appendLine(center(sepEq, lineWidth))

        val orderType = when (context.fulfillmentType) {
            FulfillmentType.DINE_IN -> "DINE-IN"
            FulfillmentType.PICKUP -> "TAKEAWAY"
            FulfillmentType.DELIVERY -> "DELIVERY"
            else -> context.serviceType.displayName.uppercase(Locale.getDefault())
        }
        sb.append(escAlignCenter())
        sb.append(escDoubleHeight(true))
        sb.append(escBold(true))
        sb.appendLine(orderType)
        context.orderNumber?.let { sb.appendLine("Order #$it") }
        sb.append(escBold(false))
        sb.append(escDoubleHeight(false))
        sb.append(escAlignLeft())
        context.tableName?.let { sb.appendLine("Table: $it") }

        sb.appendLine(center(sepEq, lineWidth))
        cart.items.forEach { item ->
            val label = buildString {
                append("${item.quantity}x ${item.productName}")
                if (item.variantName != null) append(" (${item.variantName})")
            }
            sb.appendLine(
                leftRight(label.take(lineWidth - 12), formatMoney(item.lineSubtotal, settings.currencySymbol), lineWidth)
            )
            if (item.lineDiscount > 0) {
                sb.appendLine(
                    leftRight(
                        "  Item discount",
                        "-${formatMoney(item.lineDiscount, settings.currencySymbol)}",
                        lineWidth
                    )
                )
            }
            ReceiptVatCalculator.modifierSummary(item)?.let { mods ->
                sb.appendLine("  ($mods)")
            }
            item.notes?.lines()?.filter { line ->
                !Regex("^\\d+x\\s+").containsMatchIn(line.trim())
            }?.map { it.trim() }?.filter { it.isNotBlank() }?.forEach { note ->
                sb.appendLine("  Note: $note")
            }
        }

        if (discountAmount > 0.0) {
            sb.appendLine(leftRight("Discount:", "-${formatMoney(discountAmount, settings.currencySymbol)}", lineWidth))
        }

        sb.append(escAlignCenter())
        sb.append(escDoubleHeight(true))
        sb.append(escBold(true))
        sb.appendLine(leftRight("TOTAL", formatMoney(total, settings.currencySymbol), lineWidth))
        sb.append(escBold(false))
        sb.append(escDoubleHeight(false))
        sb.append(escAlignLeft())

        if (settings.receiptShowVatTable && vatRows.isNotEmpty()) {
            sb.appendLine("TVA")
            sb.appendLine(vatRow("Type", "Net", "TVA", "Brut"))
            vatRows.forEach { row ->
                sb.appendLine(vatRow(row.label.take(14), twoDp(row.net), twoDp(row.tva), twoDp(row.brut)))
            }
        }

        context.paymentMethod?.let { method ->
            sb.appendLine(leftRight("Payment:", paymentLabel(method), lineWidth))
            context.amountPaid?.let { paid ->
                sb.appendLine(leftRight("Paid:", twoDp(paid), lineWidth))
            }
        }
        if (tipAmount > 0.0) {
            sb.appendLine(leftRight("Tip:", formatMoney(tipAmount, settings.currencySymbol), lineWidth))
        }

        if (settings.receiptShowStaffLine) {
            sb.appendLine("Staff: ${context.staffName}")
        }
        sb.appendLine(dateTimeFmt.format(Date()))
        context.orderNumber?.let { sb.appendLine("Order #$it") }
        sb.appendLine("Source: ${context.sourceLabel}")
        appendFooter(sb, settings.receiptFooter, lineWidth)
        sb.appendLine("\n\n\n")
        return finalizePayload(sb.toString(), settings, lineWidth)
    }

    private fun buildEscPosReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        val dateTimeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth.coerceAtMost(32))
        val vatRows = items.filter { it.taxRate > 0.0 }
            .groupBy { it.taxRate }
            .map { (rate, groupItems) ->
                val brut = groupItems.sumOf { it.lineSubtotal + (it.lineSubtotal * it.taxRate / 100.0) }
                val net = brut / (1.0 + rate / 100.0)
                val tva = brut - net
                VatBreakdownRow("A: ${"%.1f".format(rate)}%", rate, net, tva, brut)
            }

        appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName }, lineWidth)
        if (settings.receiptHeader.isBlank()) {
            sb.appendLine(center(settings.businessName, lineWidth))
        }
        if (settings.vatNumber.isNotBlank()) {
            sb.appendLine(center(settings.vatNumber, lineWidth))
        }
        sb.appendLine(center(sepEq, lineWidth))

        sb.append(escAlignCenter())
        sb.append(escDoubleHeight(true))
        sb.append(escBold(true))
        sb.appendLine("Order #${transaction.transactionNumber}")
        sb.append(escBold(false))
        sb.append(escDoubleHeight(false))
        sb.append(escAlignLeft())

        sb.appendLine(center(sepEq, lineWidth))
        items.forEach { item ->
            val label = buildString {
                append("${item.quantity}x ${item.productName}")
                if (item.variantName != null) append(" (${item.variantName})")
            }
            sb.appendLine(
                leftRight(label.take(lineWidth - 12), formatMoney(item.lineSubtotal, settings.currencySymbol), lineWidth)
            )
            val lineDiscount = item.lineDiscountPerUnit * item.quantity
            if (lineDiscount > 0.0) {
                sb.appendLine(
                    leftRight(
                        "  Item discount",
                        "-${formatMoney(lineDiscount, settings.currencySymbol)}",
                        lineWidth
                    )
                )
            }
            ReceiptVatCalculator.modifierSummaryFromNotes(item.notes)?.let { mods ->
                sb.appendLine("  ($mods)")
            }
        }

        val orderDiscount = resolveReceiptDiscount(transaction)
        if (orderDiscount > 0.0) {
            val discountLabel = if (transaction.discountPercent > 0) {
                "Discount (${transaction.discountPercent.toInt()}%):"
            } else {
                "Discount:"
            }
            sb.appendLine(leftRight(discountLabel, "-${formatMoney(orderDiscount, settings.currencySymbol)}", lineWidth))
        }
        if (transaction.tipAmount > 0.0) {
            sb.appendLine(leftRight("Tip:", formatMoney(transaction.tipAmount, settings.currencySymbol), lineWidth))
        }

        sb.append(escAlignCenter())
        sb.append(escDoubleHeight(true))
        sb.append(escBold(true))
        sb.appendLine(leftRight("TOTAL", formatMoney(transaction.total, settings.currencySymbol), lineWidth))
        sb.append(escBold(false))
        sb.append(escDoubleHeight(false))
        sb.append(escAlignLeft())

        if (settings.receiptShowVatTable && vatRows.isNotEmpty()) {
            sb.appendLine("TVA")
            sb.appendLine(vatRow("Type", "Net", "TVA", "Brut"))
            vatRows.forEach { row ->
                sb.appendLine(vatRow(row.label.take(14), twoDp(row.net), twoDp(row.tva), twoDp(row.brut)))
            }
        }

        sb.appendLine(leftRight("Payment:", paymentLabel(transaction.paymentMethod), lineWidth))
        sb.appendLine(leftRight("Paid:", twoDp(transaction.total), lineWidth))
        transaction.cardReference?.takeIf { it.isNotBlank() }?.let { ref ->
            sb.appendLine(leftRight("Terminal ref:", ref.take(lineWidth - 14), lineWidth))
        }
        if (settings.receiptShowStaffLine) {
            sb.appendLine("Staff: ${transaction.userName}")
        }
        sb.appendLine(dateTimeFmt.format(Date(transaction.createdAt)))
        sb.appendLine("Order #${transaction.transactionNumber}")
        sb.appendLine("Source: POS")
        transaction.notes?.lines()?.filter { it.isNotBlank() }?.forEach { line ->
            sb.appendLine(line)
        }
        appendFooter(sb, settings.receiptFooter, lineWidth)
        val qrUrl = if (settings.receiptShowQrCode) {
            transaction.receiptUrl?.takeIf { it.isNotBlank() }
        } else null
        if (qrUrl != null) {
            sb.appendLine(center("-".repeat(lineWidth.coerceAtMost(32)), lineWidth))
            sb.appendLine(center("Scan for digital receipt", lineWidth))
        }
        return finalizePayload(sb.toString(), settings, lineWidth, qrUrl)
    }

    private fun buildEndOfDayReport(settings: BusinessSettingsEntity, report: EndOfDayReport): ByteArray {
        val sym = settings.currencySymbol
        val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val divider = "=".repeat(LINE_WIDTH)
        val dashes = "-".repeat(LINE_WIDTH)
        val sb = StringBuilder()

        sb.appendLine(divider)
        sb.appendLine(escBold(true))
        sb.appendLine(settings.businessName)
        sb.appendLine(escBold(false))
        sb.appendLine(divider)
        sb.appendLine("")
        sb.appendLine(escBold(true))
        sb.appendLine("Report Period")
        sb.appendLine(escBold(false))
        val periodLabel = if (report.periodStart > 0) {
            "${dateFmt.format(Date(report.periodStart))} to ${dateFmt.format(Date(report.periodEnd))}"
        } else {
            dateFmt.format(Date())
        }
        sb.appendLine(periodLabel)
        sb.appendLine("")
        sb.appendLine(dashes)
        sb.appendLine(center("SALES SUMMARY"))
        sb.appendLine(dashes)
        sb.appendLine(right(formatMoney(report.subtotal, sym)))
        sb.appendLine("Subtotal")
        sb.appendLine("")

        // VAT table
        sb.appendLine("TVA")
        sb.appendLine(vatRow("Type", "Net", "TVA", "Brut"))
        report.vatRows.forEach { row ->
            sb.appendLine(
                vatRow(
                    row.label,
                    twoDp(row.net),
                    twoDp(row.tva),
                    twoDp(row.brut)
                )
            )
        }
        sb.appendLine(
            vatRow(
                "Total",
                twoDp(report.netTotal),
                twoDp(report.taxTotal),
                twoDp(report.brutTotal)
            )
        )
        sb.appendLine(dashes)
        sb.appendLine(leftRight("TOTAL", formatMoney(report.brutTotal, sym)))
        if (report.tipsTotal > 0.0) {
            sb.appendLine(leftRight("Tips (not taxable)", formatMoney(report.tipsTotal, sym)))
            sb.appendLine(leftRight("GRAND TOTAL", formatMoney(report.grandTotal, sym)))
        }
        sb.appendLine(leftRight("Completed Orders", report.salesCount.toString()))
        sb.appendLine("")

        // Payment methods
        sb.appendLine(dashes)
        sb.appendLine(center("PAYMENT METHODS"))
        sb.appendLine(dashes)
        report.paymentRows.forEach { row ->
            sb.appendLine(payRow(row.label, "${"%.1f".format(row.percent)}%", formatMoney(row.amount, sym)))
        }
        sb.appendLine(dashes)
        sb.appendLine(leftRight("Total", formatMoney(report.paymentRows.sumOf { it.amount }, sym)))
        sb.appendLine("")

        // Order types
        sb.appendLine(dashes)
        sb.appendLine(center("ORDER TYPES"))
        sb.appendLine(dashes)
        report.orderTypeRows.forEach { row ->
            sb.appendLine(
                orderTypeRow(
                    row.label,
                    row.count.toString(),
                    "${"%.1f".format(row.percent)}%",
                    formatMoney(row.amount, sym)
                )
            )
        }
        sb.appendLine(dashes)
        sb.appendLine(leftRight("Total", formatMoney(report.orderTypeRows.sumOf { it.amount }, sym)))
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    private fun vatRow(type: String, net: String, tva: String, brut: String): String {
        val t = type.take(14).padEnd(14)
        return t + net.padStart(6) + tva.padStart(6) + brut.padStart(6)
    }

    private fun payRow(label: String, percent: String, amount: String): String {
        val l = label.take(12).padEnd(12)
        return l + percent.padStart(7) + amount.padStart(13)
    }

    private fun orderTypeRow(label: String, count: String, percent: String, amount: String): String {
        val l = label.take(9).padEnd(9)
        return l + count.padStart(3) + percent.padStart(8) + amount.padStart(12)
    }


    private fun buildTestReceipt(settings: BusinessSettingsEntity): ByteArray {
        val text = buildString {
            appendLine(center(settings.businessName))
            appendLine(center("TEST PRINT"))
            appendLine("Fran\u00E7ais: esp\u00E8ces caf\u00E9 cr\u00E8me")
            appendLine(center("Printer OK"))
            appendLine("\n\n\n")
        }
        return encodePayload(text)
    }

    private fun encodePayload(text: String): ByteArray {
        return buildPrintPayload(EscPosEncoder.encode(text))
    }

    private fun buildPrintPayload(
        body: ByteArray,
        settings: BusinessSettingsEntity? = null,
        lineWidth: Int = LINE_WIDTH_80,
        qrBytes: ByteArray = byteArrayOf(),
        cutFeedLines: Int = 4
    ): ByteArray {
        val logo = settings?.let { receiptLogoBytes(it, lineWidth) } ?: byteArrayOf()
        return ESC_INIT + ESC_CODEPAGE_CP850 + logo + body + qrBytes + paperCutCommand(cutFeedLines)
    }

    private fun paperCutCommand(feedLines: Int = 4): ByteArray =
        byteArrayOf(0x1B, 0x64, feedLines.coerceIn(0, 255).toByte()) + ESC_CUT

    private fun finalizePayload(
        text: String,
        settings: BusinessSettingsEntity,
        lineWidth: Int = LINE_WIDTH_80,
        receiptUrl: String? = null
    ): ByteArray {
        val body = EscPosEncoder.encode(text)
        val showQr = settings.receiptShowQrCode && !receiptUrl.isNullOrBlank()
        val qrBytes = if (showQr) receiptQrRaster(receiptUrl!!, lineWidth) else byteArrayOf()
        val cutFeed = if (showQr) 2 else 4
        return buildPrintPayload(body, settings, lineWidth, qrBytes, cutFeed)
    }

    private fun receiptQrRaster(url: String, lineWidth: Int): ByteArray {
        val maxWidthPx = if (lineWidth >= LINE_WIDTH_80) 200 else 160
        val bitmap = receiptQrGenerator.generateQrBitmap(url, maxWidthPx)
        val raster = EscPosImageEncoder.encodeRaster(bitmap, maxWidthPx, maxWidthPx) ?: return byteArrayOf()
        if (!bitmap.isRecycled) bitmap.recycle()
        return EscPosEncoder.encode(escAlignCenter()) + raster + EscPosEncoder.encode(escAlignLeft())
    }

    private var cachedLogoKey: String? = null
    private var cachedLogoBytes: ByteArray? = null

    private fun receiptLogoBytes(settings: BusinessSettingsEntity, lineWidth: Int): ByteArray? {
        val uriString = settings.logoUri?.trim()?.takeIf { it.isNotBlank() } ?: return null
        val cacheKey = "$uriString@$lineWidth"
        if (cacheKey == cachedLogoKey && cachedLogoBytes != null) return cachedLogoBytes
        val maxWidthPx = if (lineWidth >= LINE_WIDTH_80) 320 else 240
        val maxHeightPx = 160
        return runCatching {
            val uri = if (uriString.startsWith("/")) {
                Uri.fromFile(java.io.File(uriString))
            } else {
                Uri.parse(uriString)
            }
            val options = BitmapFactory.Options().apply { inSampleSize = 2 }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val bitmap = BitmapFactory.decodeStream(stream, null, options) ?: return null
                val raster = EscPosImageEncoder.encodeRaster(bitmap, maxWidthPx, maxHeightPx) ?: return null
                if (bitmap != null && !bitmap.isRecycled) bitmap.recycle()
                EscPosEncoder.encode("\n${escAlignCenter()}") + raster + EscPosEncoder.encode("${escAlignLeft()}\n")
            }.also { bytes ->
                if (bytes != null) {
                    cachedLogoKey = cacheKey
                    cachedLogoBytes = bytes
                }
            }
        }.getOrNull()
    }

    private fun resolveReceiptDiscount(transaction: TransactionEntity): Double {
        if (transaction.discountAmount > 0.0) return transaction.discountAmount
        if (transaction.discountPercent > 0.0) {
            return transaction.subtotal * (transaction.discountPercent / 100.0)
        }
        return 0.0
    }

    private fun effectiveKitchenItemScale(settings: BusinessSettingsEntity): Int {
        val scale = settings.kitchenItemTextScale
        if (scale in 1..3) return scale
        return if (settings.kitchenLargeItemText) 2 else 1
    }

    private fun effectiveKitchenHeaderScale(settings: BusinessSettingsEntity): Int {
        val scale = settings.kitchenHeaderTextScale
        if (scale in 1..3) return scale
        return if (settings.kitchenLargeHeaderText) 2 else 1
    }

    private fun escKitchenSize(scale: Int, bold: Boolean = false): String = buildString {
        when (scale.coerceIn(1, 3)) {
            3 -> append(escDoubleSize(true))
            2 -> append(escDoubleHeight(true))
            else -> Unit
        }
        if (bold || scale > 1) append(escBold(true))
    }

    private fun escKitchenSizeReset(): String =
        escBold(false) + escDoubleHeight(false) + escDoubleSize(false)

    private fun sendBytes(
        mac: String?,
        settings: BusinessSettingsEntity,
        payload: ByteArray,
        label: String
    ): Result<Unit> {
        if (mac.isNullOrBlank()) {
            return Result.failure(IllegalStateException("No printer configured"))
        }
        if (isSimulated(mac)) {
            Log.i(TAG, "$label (simulated):\n${EscPosEncoder.decodeForLog(payload)}")
            return Result.success(Unit)
        }
        if (isUsbAddress(mac)) {
            return usbPrinterManager.sendBytes(mac, payload)
        }
        if (isNetworkAddress(mac)) {
            return sendBytesOverNetwork(mac, payload)
        }
        return runCatching {
            val adapter = bluetoothAdapter() ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(mac)
            val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
            val output = socket.getOutputStream()
            transmitPayload(output, payload)
            output.flush()
            Thread.sleep(150)
            socket.close()
        }
    }

    private fun transmitPayload(output: java.io.OutputStream, payload: ByteArray) {
        val chunkSize = 512
        var offset = 0
        while (offset < payload.size) {
            val end = minOf(offset + chunkSize, payload.size)
            output.write(payload, offset, end - offset)
            output.flush()
            offset = end
            if (payload.size > chunkSize) {
                Thread.sleep(25)
            }
        }
        val waitMs = (payload.size / 512 * 80).coerceIn(100, 4000)
        Thread.sleep(waitMs.toLong())
    }

    private fun sendBytesOverNetwork(address: String, payload: ByteArray): Result<Unit> = runCatching {
        val (host, port) = parseHostPort(address)
        val socket = java.net.Socket()
        try {
            localIpAddress()?.let { local ->
                runCatching { socket.bind(java.net.InetSocketAddress(local, 0)) }
            }
            socket.connect(java.net.InetSocketAddress(host, port), 4000)
            socket.getOutputStream().apply {
                write(payload)
                flush()
            }
        } finally {
            runCatching { socket.close() }
        }
    }

    private fun appendKitchenItemBlock(
        sb: StringBuilder,
        item: TableOrderItemEntity,
        settings: BusinessSettingsEntity,
        lineWidth: Int
    ) {
        val label = buildString {
            append(item.productName)
            if (item.variantName != null) append(" (${item.variantName})")
        }
        val line = "${item.quantity}x $label"
        sb.append(escAlignLeft())
        val itemScale = effectiveKitchenItemScale(settings)
        if (itemScale > 1) {
            sb.append(escKitchenSize(itemScale, bold = true))
            sb.appendLine(line)
            sb.append(escKitchenSizeReset())
        } else {
            sb.appendLine(line)
        }
        appendKitchenNotes(sb, item.notes)
    }

    private fun appendKitchenNotes(sb: StringBuilder, notes: String?) {
        notes?.lines()?.map { it.trim() }?.filter { it.isNotBlank() }?.forEach { noteLine ->
            if (isKitchenDiscountNote(noteLine)) return@forEach
            if (kitchenQtyLine.containsMatchIn(noteLine)) {
                sb.appendLine("  $noteLine")
            } else {
                sb.appendLine("  Note: $noteLine")
            }
        }
    }

    private fun isKitchenDiscountNote(line: String): Boolean =
        kitchenDiscountNote.containsMatchIn(line.trim())

    private fun appendHeader(sb: StringBuilder, header: String, lineWidth: Int = LINE_WIDTH_80) {
        if (header.isBlank()) return
        header.lines().forEach { line ->
            if (line.isNotBlank()) sb.appendLine(center(line.trim(), lineWidth))
        }
    }

    private fun appendFooter(sb: StringBuilder, footer: String, lineWidth: Int = LINE_WIDTH_80) {
        if (footer.isBlank()) return
        sb.appendLine(center("-".repeat(lineWidth.coerceAtMost(32)), lineWidth))
        footer.lines().forEach { line ->
            if (line.isNotBlank()) sb.appendLine(center(line.trim(), lineWidth))
        }
    }

    private fun paymentLabel(method: PaymentMethod): String = when (method) {
        PaymentMethod.CASH -> "Cash"
        PaymentMethod.CARD -> "Card"
        PaymentMethod.TAP_TO_PAY -> "Tap-to-Pay"
        PaymentMethod.ADYEN_TERMINAL -> "Adyen"
        PaymentMethod.PAY_LATER -> "Pay Later"
    }

    private fun lineWidthFor(paperWidthMm: Int): Int =
        if (paperWidthMm >= 80) LINE_WIDTH_80 else LINE_WIDTH_58

    private fun center(text: String, width: Int = LINE_WIDTH_80): String {
        if (text.length >= width) return text
        val pad = (width - text.length) / 2
        return " ".repeat(pad.coerceAtLeast(0)) + text
    }

    private fun right(text: String, width: Int = LINE_WIDTH_80): String {
        if (text.length >= width) return text
        return " ".repeat(width - text.length) + text
    }

    private fun escBold(on: Boolean): String =
        if (on) "\u001B\u0045\u0001" else "\u001B\u0045\u0000"

    private fun leftRight(label: String, value: String, width: Int = LINE_WIDTH_80): String {
        val space = width - label.length - value.length
        return if (space < 1) "$label $value" else label + " ".repeat(space) + value
    }

    private fun escAlignCenter(): String = "\u001B\u0061\u0001"

    private fun escAlignLeft(): String = "\u001B\u0061\u0000"

    private fun escDoubleHeight(on: Boolean): String =
        if (on) "\u001D\u0021\u0001" else "\u001D\u0021\u0000"

    private fun escDoubleSize(on: Boolean): String =
        if (on) "\u001D\u0021\u0011" else "\u001D\u0021\u0000"

    private fun twoDp(value: Double): String =
        String.format(Locale.getDefault(), "%.2f", roundMoney(value))

    private fun formatMoney(amount: Double, symbol: String): String =
        formatMoneyAmount(amount, symbol)

    companion object {
        const val SIMULATED_ADDRESS = "simulated"
        val SIMULATED_PRINTER = DiscoveredPrinter("Simulated (test)", SIMULATED_ADDRESS)
        private const val TAG = "PrinterService"
        private const val LINE_WIDTH_58 = 32
        private const val LINE_WIDTH_80 = 48
        private const val LINE_WIDTH = LINE_WIDTH_80
        private val SPP_UUID = java.util.UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private val ESC_INIT = byteArrayOf(0x1B, 0x40)
        private val ESC_CODEPAGE_CP850 = byteArrayOf(0x1B, 0x74, 0x02)
        private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x00)

        fun isSimulated(address: String?): Boolean = address == SIMULATED_ADDRESS

        fun isUsbAddress(address: String?): Boolean = address?.startsWith("/dev/bus/usb") == true

        private val IPV4_REGEX =
            Regex("""^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$""")

        /** A WiFi/network printer address is an IPv4 host with an optional :port. */
        fun isNetworkAddress(address: String?): Boolean =
            address != null && IPV4_REGEX.matches(address.trim())
    }
}
