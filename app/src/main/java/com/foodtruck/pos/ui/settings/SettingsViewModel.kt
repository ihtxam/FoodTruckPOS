package com.foodtruck.pos.ui.settings

import androidx.appcompat.app.AppCompatDelegate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.data.repository.ProductRepository
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.data.repository.TableOrderRepository
import com.foodtruck.pos.data.repository.TransactionRepository
import com.foodtruck.pos.debug.CrashLogEntry
import com.foodtruck.pos.debug.CrashLogger
import com.foodtruck.pos.domain.model.AppLanguage
import com.foodtruck.pos.domain.model.PosThemeMode
import com.foodtruck.pos.domain.model.CategoryPrintSetting
import com.foodtruck.pos.domain.model.PrintTarget
import com.foodtruck.pos.domain.model.SupportedCurrency
import com.foodtruck.pos.printer.BluetoothPrinterService
import com.foodtruck.pos.printer.DiscoveredPrinter
import com.foodtruck.pos.printer.UsbPrinterDevice
import com.foodtruck.pos.printer.UsbPrinterManager
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class PrinterLinkProduct(val id: Long, val name: String)
data class PrinterLinkCategory(val id: Long, val name: String, val products: List<PrinterLinkProduct>)

enum class SettingsSection(val title: String) {
    GENERAL("General"),
    VAT_TABLES("VAT & Tables"),
    PAYMENTS("Payments"),
    PRINTERS("Printers"),
    RECEIPTS("Receipts"),
    APPEARANCE("Appearance"),
    DIAGNOSTICS("Diagnostics")
}

data class SettingsUiState(
    val businessName: String = "",
    val vatNumber: String = "",
    val address: String = "",
    val phone: String = "",
    val email: String = "",
    val website: String = "",
    val defaultCurrency: String = "CHF",
    val currencySymbol: String = "CHF",
    val language: AppLanguage = AppLanguage.ENGLISH,
    val tapToPayEnabled: Boolean = false,
    val adyenTerminalEnabled: Boolean = false,
    val adyenTerminalId: String = "",
    val adyenApiKey: String = "",
    val adyenClientId: String = "",
    val adyenMerchantAccount: String = "",
    val roundingStep: String = "0",
    val cashEnabled: Boolean = true,
    val cardEnabled: Boolean = true,
    val terminalEnabled: Boolean = true,
    val printerPrintReceipts: Boolean = true,
    val printerPrintReports: Boolean = true,
    val printerPrintKitchen: Boolean = false,
    val kitchenPrinterPrintKitchen: Boolean = true,
    val dineInVatRate: String = "8.1",
    val takeawayVatRate: String = "2.6",
    val newTableName: String = "",
    val tables: List<String> = emptyList(),
    val printers: List<DiscoveredPrinter> = emptyList(),
    val networkPrinters: List<DiscoveredPrinter> = emptyList(),
    val selectedPrinter: DiscoveredPrinter? = null,
    val selectedKitchenPrinter: DiscoveredPrinter? = null,
    val receiptHeader: String = "",
    val receiptFooter: String = "",
    val kitchenTicketHeader: String = "",
    val kitchenTicketFooter: String = "",
    val receiptShowVatTable: Boolean = true,
    val receiptShowStaffLine: Boolean = true,
    val kitchenLargeItemText: Boolean = true,
    val kitchenLargeHeaderText: Boolean = true,
    val receiptTemplateName: String = "Default",
    val categoryPrintSettings: List<CategoryPrintSetting> = emptyList(),
    val discountPresets: List<com.foodtruck.pos.domain.model.DiscountPreset> = emptyList(),
    val newPresetName: String = "",
    val newPresetPercent: String = "",
    val savedPrinters: List<com.foodtruck.pos.data.local.entity.PrinterConfigEntity> = emptyList(),
    val showAddPrinterDialog: Boolean = false,
    val editingPrinter: com.foodtruck.pos.data.local.entity.PrinterConfigEntity? = null,
    val linkCategories: List<PrinterLinkCategory> = emptyList(),
    val usbDevices: List<UsbPrinterDevice> = emptyList(),
    val message: String? = null,
    val selectedSection: SettingsSection = SettingsSection.GENERAL,
    val posThemeMode: PosThemeMode = PosThemeMode.LIGHT,
    val crashLogs: List<CrashLogEntry> = emptyList(),
    val selectedCrashLog: String? = null,
    val crashLogContent: String = "",
    val isPrinterBusy: Boolean = false,
    val showDeleteOrdersDialog: Boolean = false,
    val isDeletingOrders: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val productRepository: ProductRepository,
    private val transactionRepository: TransactionRepository,
    private val heldOrderRepository: com.foodtruck.pos.data.repository.HeldOrderRepository,
    private val sessionManager: SessionManager,
    private val printerService: BluetoothPrinterService,
    private val usbPrinterManager: UsbPrinterManager,
    private val crashLogger: CrashLogger
) : ViewModel() {

    private var currentSettings = BusinessSettingsEntity()
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            currentSettings = settings
            val language = sessionManager.appLanguage.first()
            val themeMode = sessionManager.posThemeMode.first()
            val categories = productRepository.getAllCategories()
            _uiState.update {
                it.copy(
                    businessName = settings.businessName,
                    posThemeMode = themeMode,
                    vatNumber = settings.vatNumber,
                    address = settings.address,
                    phone = settings.phone,
                    email = settings.email,
                    website = settings.website,
                    defaultCurrency = settings.defaultCurrency,
                    currencySymbol = settings.currencySymbol,
                    language = language,
                    tapToPayEnabled = settings.tapToPayEnabled,
                    adyenTerminalEnabled = settings.adyenTerminalEnabled,
                    adyenTerminalId = settings.adyenTerminalId,
                    adyenApiKey = settings.adyenApiKey,
                    adyenClientId = settings.adyenClientId,
                    adyenMerchantAccount = settings.adyenMerchantAccount,
                    roundingStep = settings.roundingStep.toString(),
                    cashEnabled = settings.cashEnabled,
                    cardEnabled = settings.cardEnabled,
                    terminalEnabled = settings.terminalEnabled,
                    printerPrintReceipts = settings.printerPrintReceipts,
                    printerPrintReports = settings.printerPrintReports,
                    printerPrintKitchen = settings.printerPrintKitchen,
                    kitchenPrinterPrintKitchen = settings.kitchenPrinterPrintKitchen,
                    dineInVatRate = settings.dineInVatRate.toString(),
                    takeawayVatRate = settings.takeawayVatRate.toString(),
                    receiptHeader = settings.receiptHeader,
                    receiptFooter = settings.receiptFooter,
                    kitchenTicketHeader = settings.kitchenTicketHeader,
                    kitchenTicketFooter = settings.kitchenTicketFooter,
                    receiptShowVatTable = settings.receiptShowVatTable,
                    receiptShowStaffLine = settings.receiptShowStaffLine,
                    kitchenLargeItemText = settings.kitchenLargeItemText,
                    kitchenLargeHeaderText = settings.kitchenLargeHeaderText,
                    receiptTemplateName = settings.receiptTemplateName,
                    selectedPrinter = resolvePrinter(settings.printerMacAddress, settings.printerName),
                    selectedKitchenPrinter = resolvePrinter(
                        settings.kitchenPrinterMacAddress,
                        settings.kitchenPrinterName
                    ) ?: BluetoothPrinterService.SIMULATED_PRINTER,
                    printers = listOf(BluetoothPrinterService.SIMULATED_PRINTER),
                    categoryPrintSettings = categories.map { c ->
                        CategoryPrintSetting(c.id, c.name, c.printTarget)
                    }
                )
            }
            loadTables()
            loadDiscountPresets()
            loadSavedPrinters()
            loadLinkCategories()
            refreshCrashLogs()
        }
    }

    private fun loadLinkCategories() {
        viewModelScope.launch {
            val categories = productRepository.getAllCategories()
            val products = productRepository.getAllProducts()
            val linkCategories = categories.map { category ->
                PrinterLinkCategory(
                    id = category.id,
                    name = category.name,
                    products = products.filter { it.categoryId == category.id }
                        .map { PrinterLinkProduct(it.id, it.name) }
                )
            }
            _uiState.update { it.copy(linkCategories = linkCategories) }
        }
    }

    fun selectSection(section: SettingsSection) {
        _uiState.update { it.copy(selectedSection = section) }
        if (section == SettingsSection.DIAGNOSTICS) refreshCrashLogs()
    }

    fun updatePosThemeMode(mode: PosThemeMode) {
        _uiState.update { it.copy(posThemeMode = mode) }
        viewModelScope.launch { sessionManager.setPosThemeMode(mode) }
    }

    fun refreshCrashLogs() {
        _uiState.update {
            it.copy(crashLogs = crashLogger.listLogs())
        }
    }

    fun selectCrashLog(fileName: String) {
        _uiState.update {
            it.copy(
                selectedCrashLog = fileName,
                crashLogContent = crashLogger.readLog(fileName)
            )
        }
    }

    fun clearCrashLogs() {
        crashLogger.clearLogs()
        refreshCrashLogs()
        _uiState.update { it.copy(selectedCrashLog = null, crashLogContent = "") }
    }

    fun showDeleteOrdersDialog() = _uiState.update { it.copy(showDeleteOrdersDialog = true) }
    fun dismissDeleteOrdersDialog() = _uiState.update { it.copy(showDeleteOrdersDialog = false) }

    /** Wipes all sales/order history (transactions, table orders, held orders). Keeps products & settings. */
    fun deleteAllOrderData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isDeletingOrders = true) }
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    transactionRepository.clearAllTransactions()
                    tableOrderRepository.clearAllOrders()
                    heldOrderRepository.clearAll()
                }
            }
            _uiState.update {
                it.copy(
                    isDeletingOrders = false,
                    showDeleteOrdersDialog = false,
                    message = result.fold(
                        onSuccess = { "All order data deleted" },
                        onFailure = { e -> e.message ?: "Could not delete order data" }
                    )
                )
            }
        }
    }

    private fun loadSavedPrinters() {
        viewModelScope.launch {
            val printers = settingsRepository.getPrinters()
            _uiState.update { it.copy(savedPrinters = printers) }
        }
    }

    fun showAddPrinterDialog() = _uiState.update { it.copy(showAddPrinterDialog = true, editingPrinter = null) }
    fun dismissAddPrinterDialog() = _uiState.update { it.copy(showAddPrinterDialog = false, editingPrinter = null) }

    fun editPrinter(printer: com.foodtruck.pos.data.local.entity.PrinterConfigEntity) {
        _uiState.update { it.copy(showAddPrinterDialog = true, editingPrinter = printer) }
    }

    fun addPrinter(form: AddPrinterForm) {
        viewModelScope.launch {
            val resolved = form.normalized()
            if (resolved.address.isBlank()) {
                _uiState.update { it.copy(message = "Enter a printer address") }
                return@launch
            }
            val editing = _uiState.value.editingPrinter
            val entity = if (editing != null) {
                resolved.toEntity(editing.sortOrder).copy(id = editing.id, createdAt = editing.createdAt)
            } else {
                resolved.toEntity(_uiState.value.savedPrinters.size)
            }
            settingsRepository.savePrinter(entity)
            loadSavedPrinters()
            dismissAddPrinterDialog()
            _uiState.update { it.copy(message = if (editing != null) "Printer updated" else "Printer added") }
        }
    }

    fun deleteSavedPrinter(id: String) {
        viewModelScope.launch {
            settingsRepository.deletePrinter(id)
            loadSavedPrinters()
        }
    }

    fun testAddPrinterForm(form: AddPrinterForm) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val result = withContext(Dispatchers.IO) {
                when (form.connectionType) {
                    "USB" -> usbPrinterManager.sendBytes(form.address, usbPrinterManager.buildTestPayload())
                    else -> {
                        val settings = buildSettingsFromState().copy(
                            printerMacAddress = form.address,
                            printerName = form.name
                        )
                        printerService.testPrint(settings)
                    }
                }
            }
            _uiState.update {
                it.copy(
                    isPrinterBusy = false,
                    message = result.fold(
                        onSuccess = { "Test print sent" },
                        onFailure = { e -> e.message ?: "Test print failed" }
                    )
                )
            }
        }
    }

    private fun loadDiscountPresets() {
        viewModelScope.launch {
            val presets = settingsRepository.getDiscountPresets()
            _uiState.update { it.copy(discountPresets = presets) }
        }
    }

    private fun resolvePrinter(mac: String?, name: String?): DiscoveredPrinter? {
        if (mac.isNullOrBlank()) return null
        return if (BluetoothPrinterService.isSimulated(mac)) {
            BluetoothPrinterService.SIMULATED_PRINTER
        } else {
            DiscoveredPrinter(name ?: mac, mac)
        }
    }

    private fun loadTables() {
        viewModelScope.launch {
            val tables = tableOrderRepository.getAllTables().map { it.name }
            _uiState.update { it.copy(tables = tables) }
        }
    }

    fun updateBusinessName(value: String) = _uiState.update { it.copy(businessName = value) }
    fun updateVatNumber(value: String) = _uiState.update { it.copy(vatNumber = value) }
    fun updateAddress(value: String) = _uiState.update { it.copy(address = value) }
    fun updatePhone(value: String) = _uiState.update { it.copy(phone = value) }
    fun updateEmail(value: String) = _uiState.update { it.copy(email = value) }
    fun updateReceiptHeader(value: String) = _uiState.update { it.copy(receiptHeader = value) }
    fun updateReceiptFooter(value: String) = _uiState.update { it.copy(receiptFooter = value) }
    fun updateKitchenHeader(value: String) = _uiState.update { it.copy(kitchenTicketHeader = value) }
    fun updateKitchenFooter(value: String) = _uiState.update { it.copy(kitchenTicketFooter = value) }
    fun updateReceiptShowVatTable(value: Boolean) = _uiState.update { it.copy(receiptShowVatTable = value) }
    fun updateReceiptShowStaffLine(value: Boolean) = _uiState.update { it.copy(receiptShowStaffLine = value) }
    fun updateKitchenLargeItems(value: Boolean) = _uiState.update { it.copy(kitchenLargeItemText = value) }
    fun updateKitchenLargeHeader(value: Boolean) = _uiState.update { it.copy(kitchenLargeHeaderText = value) }
    fun updateReceiptTemplateName(value: String) = _uiState.update { it.copy(receiptTemplateName = value) }
    fun updateTapToPay(enabled: Boolean) = _uiState.update { it.copy(tapToPayEnabled = enabled) }
    fun updateAdyenEnabled(enabled: Boolean) = _uiState.update { it.copy(adyenTerminalEnabled = enabled) }
    fun updateAdyenTerminalId(value: String) = _uiState.update { it.copy(adyenTerminalId = value) }
    fun updateAdyenApiKey(value: String) = _uiState.update { it.copy(adyenApiKey = value) }
    fun updateAdyenClientId(value: String) = _uiState.update { it.copy(adyenClientId = value) }
    fun updateAdyenMerchantAccount(value: String) = _uiState.update { it.copy(adyenMerchantAccount = value) }
    fun updateRoundingStep(value: String) = _uiState.update { it.copy(roundingStep = value) }
    fun updateCashEnabled(enabled: Boolean) = _uiState.update { it.copy(cashEnabled = enabled) }
    fun updateCardEnabled(enabled: Boolean) = _uiState.update { it.copy(cardEnabled = enabled) }
    fun updateTerminalEnabled(enabled: Boolean) = _uiState.update { it.copy(terminalEnabled = enabled) }
    fun updatePrinterPrintReceipts(enabled: Boolean) = _uiState.update { it.copy(printerPrintReceipts = enabled) }
    fun updatePrinterPrintReports(enabled: Boolean) = _uiState.update { it.copy(printerPrintReports = enabled) }
    fun updatePrinterPrintKitchen(enabled: Boolean) = _uiState.update { it.copy(printerPrintKitchen = enabled) }
    fun updateKitchenPrinterPrintKitchen(enabled: Boolean) = _uiState.update { it.copy(kitchenPrinterPrintKitchen = enabled) }
    fun updateDineInVatRate(value: String) = _uiState.update { it.copy(dineInVatRate = value) }
    fun updateTakeawayVatRate(value: String) = _uiState.update { it.copy(takeawayVatRate = value) }
    fun updateNewTableName(value: String) = _uiState.update { it.copy(newTableName = value) }

    fun updateNewPresetName(value: String) = _uiState.update { it.copy(newPresetName = value) }
    fun updateNewPresetPercent(value: String) = _uiState.update { it.copy(newPresetPercent = value) }

    fun addDiscountPreset() {
        viewModelScope.launch {
            val name = _uiState.value.newPresetName.trim()
            val percent = _uiState.value.newPresetPercent.toDoubleOrNull()
            if (name.isEmpty() || percent == null) {
                _uiState.update { it.copy(message = "Enter preset name and percent") }
                return@launch
            }
            settingsRepository.saveDiscountPreset(name, percent)
            _uiState.update { it.copy(newPresetName = "", newPresetPercent = "", message = "Preset added") }
            loadDiscountPresets()
        }
    }

    fun addTable() {
        viewModelScope.launch {
            val name = _uiState.value.newTableName.trim()
            if (name.isEmpty()) {
                _uiState.update { it.copy(message = "Enter a table name") }
                return@launch
            }
            tableOrderRepository.addTable(name)
            _uiState.update { it.copy(newTableName = "", message = "Table added") }
            loadTables()
        }
    }

    fun updateCurrency(currency: SupportedCurrency) {
        _uiState.update { it.copy(defaultCurrency = currency.code, currencySymbol = currency.symbol) }
    }

    fun updateLanguage(language: AppLanguage) {
        viewModelScope.launch {
            sessionManager.setLanguage(language)
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.code))
            _uiState.update { it.copy(language = language) }
        }
    }

    fun updateCategoryPrintTarget(categoryId: Long, target: PrintTarget) {
        viewModelScope.launch {
            productRepository.updateCategoryPrintTarget(categoryId, target)
            _uiState.update { state ->
                state.copy(
                    categoryPrintSettings = state.categoryPrintSettings.map {
                        if (it.id == categoryId) it.copy(printTarget = target) else it
                    },
                    message = "Category routing updated"
                )
            }
        }
    }

    fun discoverPrinters(hasBluetoothPermission: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            try {
                val printers = withContext(Dispatchers.IO) {
                    printerService.discoverPrinters(hasBluetoothPermission)
                }
                _uiState.update {
                    it.copy(
                        printers = printers,
                        message = if (hasBluetoothPermission) {
                            "${printers.size} printer(s) found"
                        } else {
                            "Simulated printer only. Grant Bluetooth to scan paired devices."
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(message = "Bluetooth scan failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    fun discoverNetworkPrinters(manualAddress: String = "") {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true, message = "Scanning Wi-Fi network…") }
            try {
                val extras = manualAddress.trim().takeIf { it.isNotBlank() }?.let { listOf(it) }.orEmpty()
                val found = withContext(Dispatchers.IO) {
                    printerService.discoverNetworkPrinters(extraHosts = extras)
                }
                val localIp = printerService.currentLocalIpv4()
                _uiState.update {
                    it.copy(
                        networkPrinters = found,
                        message = when {
                            found.isNotEmpty() -> "${found.size} network printer(s) found"
                            localIp == null ->
                                "Cannot detect Wi-Fi IP. Connect this device to the same Wi-Fi as the printer."
                            manualAddress.isNotBlank() ->
                                "No reply from ${manualAddress.trim()} or subnet $localIp. Check IP and port 9100."
                            else ->
                                "No network printers found on $localIp (port 9100). Enter the IP and tap Verify."
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(message = "Network scan failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    fun verifyNetworkPrinterAddress(address: String) {
        val trimmed = address.trim()
        if (trimmed.isBlank()) {
            _uiState.update { it.copy(message = "Enter an IP address first") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true, message = "Checking $trimmed…") }
            try {
                val reachable = withContext(Dispatchers.IO) {
                    printerService.canReachNetworkPrinter(trimmed)
                }
                if (reachable) {
                    val (host, _) = parseHostPortForUi(trimmed)
                    val printer = DiscoveredPrinter("Network printer ($host)", host)
                    _uiState.update {
                        it.copy(
                            networkPrinters = (listOf(printer) + it.networkPrinters).distinctBy { p -> p.address },
                            message = "Printer reachable at $host — tap Add printer to save"
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(message = "Cannot reach $trimmed on port 9100. Check IP and Wi-Fi.")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(message = "Connection check failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    private fun parseHostPortForUi(address: String): Pair<String, Int> {
        val trimmed = address.trim()
        val colon = trimmed.lastIndexOf(':')
        return if (colon > 0 && trimmed.substring(colon + 1).toIntOrNull() != null) {
            trimmed.substring(0, colon) to trimmed.substring(colon + 1).toInt()
        } else {
            trimmed to 9100
        }
    }

    fun selectPrinter(printer: DiscoveredPrinter) {
        _uiState.update { it.copy(selectedPrinter = printer) }
    }

    fun selectKitchenPrinter(printer: DiscoveredPrinter) {
        _uiState.update { it.copy(selectedKitchenPrinter = printer) }
    }

    fun assignUsbAsReceipt(device: UsbPrinterDevice) {
        _uiState.update {
            it.copy(selectedPrinter = DiscoveredPrinter(name = device.displayName, address = device.deviceName))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for receipts") }
    }

    fun assignUsbAsKitchen(device: UsbPrinterDevice) {
        _uiState.update {
            it.copy(selectedKitchenPrinter = DiscoveredPrinter(name = device.displayName, address = device.deviceName))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for kitchen") }
    }

    fun discoverUsbDevices() {
        val devices = usbPrinterManager.listDevices()
        _uiState.update {
            it.copy(
                usbDevices = devices,
                message = if (devices.isEmpty()) "No USB printers detected" else "${devices.size} USB device(s) found"
            )
        }
    }

    fun requestUsbPermission(deviceName: String) {
        usbPrinterManager.requestPermission(deviceName) { granted ->
            viewModelScope.launch {
                _uiState.update {
                    it.copy(
                        usbDevices = usbPrinterManager.listDevices(),
                        message = if (granted) "USB permission granted" else "USB permission denied"
                    )
                }
            }
        }
    }

    fun testPrint() {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val settings = buildSettingsFromState()
            val result = withContext(Dispatchers.IO) {
                printerService.testPrint(settings)
            }
            _uiState.update {
                it.copy(
                    isPrinterBusy = false,
                    message = result.fold(
                        onSuccess = {
                            if (BluetoothPrinterService.isSimulated(settings.printerMacAddress)) {
                                "Test print sent to simulated printer (see Logcat)"
                            } else {
                                "Test print sent"
                            }
                        },
                        onFailure = { e -> e.message ?: "Test print failed" }
                    )
                )
            }
        }
    }

    fun testUsbPrint(deviceName: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val result = withContext(Dispatchers.IO) {
                usbPrinterManager.sendBytes(deviceName, usbPrinterManager.buildTestPayload())
            }
            _uiState.update {
                it.copy(
                    isPrinterBusy = false,
                    message = result.fold(
                        onSuccess = { "USB test print sent" },
                        onFailure = { e -> e.message ?: "USB test print failed" }
                    )
                )
            }
        }
    }

    fun testSavedPrinter(printer: com.foodtruck.pos.data.local.entity.PrinterConfigEntity) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val result = withContext(Dispatchers.IO) {
                if (printer.connectionType == "USB") {
                    usbPrinterManager.sendBytes(printer.address, usbPrinterManager.buildTestPayload())
                } else {
                    printerService.testPrint(
                        buildSettingsFromState().copy(
                            printerMacAddress = printer.address,
                            printerName = printer.name
                        )
                    )
                }
            }
            _uiState.update {
                it.copy(
                    isPrinterBusy = false,
                    message = result.fold(
                        onSuccess = { "Test print sent to ${printer.name}" },
                        onFailure = { e -> e.message ?: "Test print failed" }
                    )
                )
            }
        }
    }

    fun printEndOfDayReport() {
        viewModelScope.launch {
            val settings = buildSettingsFromState()
            val report = transactionRepository.getEndOfDayReport()
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report)
            }.onSuccess { _uiState.update { it.copy(message = "End of day report printed") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message) } }
        }
    }

    fun saveSettings() {
        viewModelScope.launch {
            val settings = buildSettingsFromState()
            settingsRepository.saveSettings(settings)
            currentSettings = settings
            _uiState.update { it.copy(message = "Settings saved") }
        }
    }

    private fun buildSettingsFromState(): BusinessSettingsEntity {
        val state = _uiState.value
        return currentSettings.copy(
            businessName = state.businessName,
            vatNumber = state.vatNumber,
            address = state.address,
            phone = state.phone,
            email = state.email,
            website = state.website,
            defaultCurrency = state.defaultCurrency,
            currencySymbol = state.currencySymbol,
            defaultLanguage = state.language.code,
            tapToPayEnabled = state.tapToPayEnabled,
            adyenTerminalEnabled = state.adyenTerminalEnabled,
            adyenTerminalId = state.adyenTerminalId,
            adyenApiKey = state.adyenApiKey,
            adyenClientId = state.adyenClientId,
            adyenMerchantAccount = state.adyenMerchantAccount,
            roundingStep = state.roundingStep.toDoubleOrNull() ?: 0.0,
            cashEnabled = state.cashEnabled,
            cardEnabled = state.cardEnabled,
            terminalEnabled = state.terminalEnabled,
            printerPrintReceipts = state.printerPrintReceipts,
            printerPrintReports = state.printerPrintReports,
            printerPrintKitchen = state.printerPrintKitchen,
            kitchenPrinterPrintKitchen = state.kitchenPrinterPrintKitchen,
            dineInVatRate = state.dineInVatRate.toDoubleOrNull() ?: 8.1,
            takeawayVatRate = state.takeawayVatRate.toDoubleOrNull() ?: 2.6,
            printerMacAddress = state.selectedPrinter?.address,
            printerName = state.selectedPrinter?.name,
            kitchenPrinterMacAddress = state.selectedKitchenPrinter?.address,
            kitchenPrinterName = state.selectedKitchenPrinter?.name,
            receiptHeader = state.receiptHeader,
            receiptFooter = state.receiptFooter,
            kitchenTicketHeader = state.kitchenTicketHeader,
            kitchenTicketFooter = state.kitchenTicketFooter,
            receiptShowVatTable = state.receiptShowVatTable,
            receiptShowStaffLine = state.receiptShowStaffLine,
            kitchenLargeItemText = state.kitchenLargeItemText,
            kitchenLargeHeaderText = state.kitchenLargeHeaderText,
            receiptTemplateName = state.receiptTemplateName
        )
    }
}
