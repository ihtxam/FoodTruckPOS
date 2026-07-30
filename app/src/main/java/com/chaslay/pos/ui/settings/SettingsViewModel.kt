package com.chaslay.pos.ui.settings

import androidx.appcompat.app.AppCompatDelegate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.debug.CrashLogEntry
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.domain.model.AppLanguage
import androidx.annotation.StringRes
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.domain.model.CategoryPrintSetting
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.SupportedCurrency
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.DiscoveredPrinter
import com.chaslay.pos.printer.UsbPrinterDevice
import com.chaslay.pos.printer.UsbPrinterManager
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import android.net.Uri
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.chaslay.pos.sync.FloorLanServer
import com.chaslay.pos.sync.NetworkAddress
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import javax.inject.Inject

data class PrinterLinkProduct(val id: Long, val name: String)
data class PrinterLinkCategory(val id: Long, val name: String, val products: List<PrinterLinkProduct>)

enum class SettingsSection(@StringRes val titleRes: Int) {
    GENERAL(R.string.settings_section_general),
    VAT_TABLES(R.string.settings_section_vat_tables),
    PAYMENTS(R.string.settings_section_payments),
    PRINTERS(R.string.settings_section_printers),
    RECEIPTS(R.string.settings_section_receipts),
    FLOOR_DEVICES(R.string.settings_section_floor_devices),
    USERS_ACCOUNTS(R.string.settings_section_users),
    APPEARANCE(R.string.settings_section_appearance),
    LICENSE(R.string.settings_section_license)
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
    val adyenLiveEnvironment: Boolean = false,
    val adyenLiveRegion: String = "EU",
    val adyenUseLegacyEndpoint: Boolean = false,
    val isTestingAdyen: Boolean = false,
    val roundingStep: String = "0.05",
    val cashEnabled: Boolean = true,
    val cardEnabled: Boolean = true,
    val terminalEnabled: Boolean = true,
    val expressEnabled: Boolean = true,
    val paymentMethodsManagedByCloud: Boolean = false,
    val printerPrintReceipts: Boolean = true,
    val printerPrintReports: Boolean = true,
    val printerPrintKitchen: Boolean = false,
    val kitchenPrinterPrintKitchen: Boolean = true,
    val dineInVatRate: String = "8.1",
    val takeawayVatRate: String = "2.6",
    val vatIncludedInPrice: Boolean = false,
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
    val receiptShowQrCode: Boolean = true,
    val kitchenLargeItemText: Boolean = true,
    val kitchenLargeHeaderText: Boolean = true,
    val kitchenItemTextScale: Int = 2,
    val kitchenHeaderTextScale: Int = 2,
    val logoUri: String? = null,
    val receiptTemplateName: String = "Default",
    val categoryPrintSettings: List<CategoryPrintSetting> = emptyList(),
    val discountPresets: List<com.chaslay.pos.domain.model.DiscountPreset> = emptyList(),
    val newPresetName: String = "",
    val newPresetPercent: String = "",
    val savedPrinters: List<com.chaslay.pos.data.local.entity.PrinterConfigEntity> = emptyList(),
    val showAddPrinterDialog: Boolean = false,
    val editingPrinter: com.chaslay.pos.data.local.entity.PrinterConfigEntity? = null,
    val linkCategories: List<PrinterLinkCategory> = emptyList(),
    val usbDevices: List<UsbPrinterDevice> = emptyList(),
    val scaleEnabled: Boolean = false,
    val scaleUsbAddress: String? = null,
    val scaleDevices: List<com.chaslay.pos.scale.ScaleUsbDevice> = emptyList(),
    val scaleTestReading: String? = null,
    val message: String? = null,
    val selectedSection: SettingsSection = SettingsSection.GENERAL,
    val posThemeMode: PosThemeMode = PosThemeMode.LIGHT,
    val crashLogs: List<CrashLogEntry> = emptyList(),
    val selectedCrashLog: String? = null,
    val crashLogContent: String = "",
    val isPrinterBusy: Boolean = false,
    val posMode: PosMode = PosMode.RESTAURANT,
    val openHour: String = "10",
    val openMinute: String = "0",
    val closeHour: String = "22",
    val closeMinute: String = "0",
    val trackCoversFromSeatingPlan: Boolean = false,
    val floorSyncEnabled: Boolean = false,
    val floorDeviceRole: FloorDeviceRole = FloorDeviceRole.STANDARD,
    val floorConnectionMode: FloorConnectionMode = FloorConnectionMode.AUTO,
    val mainPosLanUrl: String = "",
    val localLanUrl: String? = null,
    val isTestingMainPos: Boolean = false,
    val isDiscoveringMainPos: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val settingsRepository: SettingsRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val productRepository: ProductRepository,
    private val transactionRepository: TransactionRepository,
    private val heldOrderRepository: com.chaslay.pos.data.repository.HeldOrderRepository,
    private val sessionManager: SessionManager,
    private val printerService: BluetoothPrinterService,
    private val usbPrinterManager: UsbPrinterManager,
    private val crashLogger: CrashLogger,
    private val adyenTerminalService: com.chaslay.pos.payment.AdyenTerminalService,
    private val scaleService: com.chaslay.pos.scale.AclasScaleService,
    private val floorSyncRepository: com.chaslay.pos.sync.FloorSyncRepository,
    private val terminalSyncRepository: com.chaslay.pos.sync.TerminalSyncRepository
) : ViewModel() {

    private var currentSettings = BusinessSettingsEntity()
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            currentSettings = settings
            val sessionLanguage = sessionManager.appLanguage.first()
            val settingsLanguage = AppLanguage.fromCode(settings.defaultLanguage)
            val language = sessionLanguage.takeIf { it != AppLanguage.ENGLISH } ?: settingsLanguage
            if (language != sessionLanguage) {
                sessionManager.setLanguage(language)
            }
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.code))
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
                    adyenLiveEnvironment = settings.adyenLiveEnvironment,
                    adyenLiveRegion = settings.adyenLiveRegion,
                    adyenUseLegacyEndpoint = settings.adyenUseLegacyEndpoint,
                    roundingStep = settings.roundingStep.takeIf { it > 0.0 }?.toString() ?: "0.05",
                    openHour = settings.openHour.toString(),
                    openMinute = settings.openMinute.toString(),
                    closeHour = settings.closeHour.toString(),
                    closeMinute = settings.closeMinute.toString(),
                    cashEnabled = settings.cashEnabled,
                    cardEnabled = settings.cardEnabled,
                    terminalEnabled = settings.terminalEnabled,
                    expressEnabled = settings.expressEnabled,
                    paymentMethodsManagedByCloud = settings.paymentMethodsManagedByCloud,
                    printerPrintReceipts = settings.printerPrintReceipts,
                    printerPrintReports = settings.printerPrintReports,
                    printerPrintKitchen = settings.printerPrintKitchen,
                    kitchenPrinterPrintKitchen = settings.kitchenPrinterPrintKitchen,
                    dineInVatRate = settings.dineInVatRate.toString(),
                    takeawayVatRate = settings.takeawayVatRate.toString(),
                    vatIncludedInPrice = settings.vatIncludedInPrice,
                    receiptHeader = settings.receiptHeader,
                    receiptFooter = settings.receiptFooter,
                    kitchenTicketHeader = settings.kitchenTicketHeader,
                    kitchenTicketFooter = settings.kitchenTicketFooter,
                    receiptShowVatTable = settings.receiptShowVatTable,
                    receiptShowStaffLine = settings.receiptShowStaffLine,
                    receiptShowQrCode = settings.receiptShowQrCode,
                    kitchenLargeItemText = settings.kitchenLargeItemText,
                    kitchenLargeHeaderText = settings.kitchenLargeHeaderText,
                    kitchenItemTextScale = settings.kitchenItemTextScale.coerceIn(1, 3),
                    kitchenHeaderTextScale = settings.kitchenHeaderTextScale.coerceIn(1, 3),
                    logoUri = settings.logoUri,
                    receiptTemplateName = settings.receiptTemplateName,
                    posMode = settings.posMode,
                    trackCoversFromSeatingPlan = settings.trackCoversFromSeatingPlan,
                    floorSyncEnabled = settings.floorSyncEnabled,
                    floorDeviceRole = FloorDeviceRole.fromApi(settings.floorDeviceRole),
                    floorConnectionMode = FloorConnectionMode.fromApi(settings.floorConnectionMode),
                    mainPosLanUrl = settings.mainPosLanUrl,
                    localLanUrl = NetworkAddress.localLanUrl(FloorLanServer.PORT),
                    scaleEnabled = settings.scaleEnabled,
                    scaleUsbAddress = settings.scaleUsbAddress,
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

    private fun loadSavedPrinters() {
        viewModelScope.launch {
            val printers = settingsRepository.getPrinters()
            printers.filter { it.connectionType == "USB" && !it.address.startsWith("usb:") }
                .forEach { printer ->
                    val migrated = usbPrinterManager.normalizeStoredAddress(printer.address)
                    if (migrated.startsWith("usb:") && migrated != printer.address) {
                        settingsRepository.savePrinter(printer.copy(address = migrated))
                    }
                }
            _uiState.update { it.copy(savedPrinters = settingsRepository.getPrinters()) }
        }
    }

    fun showAddPrinterDialog() = _uiState.update { it.copy(showAddPrinterDialog = true, editingPrinter = null) }
    fun dismissAddPrinterDialog() = _uiState.update { it.copy(showAddPrinterDialog = false, editingPrinter = null) }

    fun editPrinter(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity) {
        _uiState.update { it.copy(showAddPrinterDialog = true, editingPrinter = printer) }
    }

    fun addPrinter(form: AddPrinterForm) {
        viewModelScope.launch {
            val resolved = form.normalized()
            if (resolved.address.isBlank()) {
                _uiState.update { it.copy(message = "Enter a printer address") }
                return@launch
            }
            val address = if (resolved.connectionType == "USB") {
                usbPrinterManager.normalizeStoredAddress(resolved.address)
            } else {
                resolved.address
            }
            if (resolved.connectionType == "USB" && !usbPrinterManager.hasPermission(address)) {
                _uiState.update { it.copy(message = "Allow USB access first, then save again") }
                usbPrinterManager.requestPermission(address) { granted ->
                    viewModelScope.launch {
                        _uiState.update {
                            it.copy(
                                usbDevices = usbPrinterManager.listDevices(),
                                message = if (granted) "USB permission granted — tap Save again" else "USB permission denied"
                            )
                        }
                    }
                }
                return@launch
            }
            val finalForm = resolved.copy(address = address)
            val editing = _uiState.value.editingPrinter
            val entity = if (editing != null) {
                finalForm.toEntity(editing.sortOrder).copy(id = editing.id, createdAt = editing.createdAt)
            } else {
                finalForm.toEntity(_uiState.value.savedPrinters.size)
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
                    "USB" -> usbPrinterManager.sendBytes(
                        usbPrinterManager.normalizeStoredAddress(form.address),
                        usbPrinterManager.buildTestPayload()
                    )
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
    fun updatePosMode(mode: PosMode) = _uiState.update { it.copy(posMode = mode) }
    fun updateTrackCoversFromSeatingPlan(enabled: Boolean) =
        _uiState.update { it.copy(trackCoversFromSeatingPlan = enabled) }

    fun updateFloorSyncEnabled(enabled: Boolean) {
        _uiState.update { it.copy(floorSyncEnabled = enabled) }
        persistFloorSettings()
    }

    fun updateFloorDeviceRole(role: FloorDeviceRole) {
        _uiState.update { it.copy(floorDeviceRole = role) }
        persistFloorSettings()
    }

    fun updateFloorConnectionMode(mode: FloorConnectionMode) {
        _uiState.update { it.copy(floorConnectionMode = mode) }
        persistFloorSettings()
    }

    fun updateMainPosLanUrl(value: String) {
        _uiState.update { it.copy(mainPosLanUrl = value) }
    }

    fun commitMainPosLanUrl() = persistFloorSettings()

    fun refreshLocalLanUrl() {
        _uiState.update { it.copy(localLanUrl = NetworkAddress.localLanUrl(FloorLanServer.PORT)) }
    }

    fun testMainPosConnection() {
        val url = _uiState.value.mainPosLanUrl.trim().trimEnd('/')
        if (url.isBlank()) {
            _uiState.update { it.copy(message = "Enter the main POS LAN URL first") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingMainPos = true) }
            val message = withContext(Dispatchers.IO) {
                runCatching {
                    val client = OkHttpClient.Builder()
                        .connectTimeout(3, TimeUnit.SECONDS)
                        .readTimeout(5, TimeUnit.SECONDS)
                        .build()
                    val response = client.newCall(
                        Request.Builder().url("$url/health").get().build()
                    ).execute()
                    response.close()
                    if (response.isSuccessful) "Main POS reachable on LAN" else "Main POS returned ${response.code}"
                }.getOrElse { "Cannot reach main POS: ${it.message ?: "unknown error"}" }
            }
            _uiState.update { it.copy(isTestingMainPos = false, message = message) }
        }
    }

    fun discoverMainPos() {
        viewModelScope.launch {
            _uiState.update { it.copy(isDiscoveringMainPos = true) }
            val url = floorSyncRepository.discoverMainPosUrl()
            if (url != null) {
                _uiState.update {
                    it.copy(
                        isDiscoveringMainPos = false,
                        mainPosLanUrl = url,
                        message = appContext.getString(R.string.floor_main_pos_found, url)
                    )
                }
                persistFloorSettings()
            } else {
                _uiState.update {
                    it.copy(
                        isDiscoveringMainPos = false,
                        message = appContext.getString(R.string.floor_main_pos_not_found)
                    )
                }
            }
        }
    }

    private fun persistFloorSettings() {
        viewModelScope.launch {
            val state = _uiState.value
            val updated = currentSettings.copy(
                floorSyncEnabled = state.floorSyncEnabled,
                floorDeviceRole = state.floorDeviceRole.apiValue,
                floorConnectionMode = state.floorConnectionMode.apiValue,
                mainPosLanUrl = state.mainPosLanUrl.trim()
            )
            settingsRepository.saveSettings(updated)
            currentSettings = updated
            runCatching { floorSyncRepository.registerDevice(updated) }
            _uiState.update {
                it.copy(
                    message = appContext.getString(R.string.floor_settings_saved),
                    localLanUrl = if (state.floorDeviceRole == FloorDeviceRole.MAIN_POS) {
                        NetworkAddress.localLanUrl(FloorLanServer.PORT)
                    } else {
                        it.localLanUrl
                    }
                )
            }
        }
    }

    fun updateOpenHour(value: String) = _uiState.update { it.copy(openHour = value) }
    fun updateOpenMinute(value: String) = _uiState.update { it.copy(openMinute = value) }
    fun updateCloseHour(value: String) = _uiState.update { it.copy(closeHour = value) }
    fun updateCloseMinute(value: String) = _uiState.update { it.copy(closeMinute = value) }
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
    fun updateReceiptShowQrCode(value: Boolean) = _uiState.update { it.copy(receiptShowQrCode = value) }
    fun updateKitchenLargeItems(value: Boolean) = _uiState.update { it.copy(kitchenLargeItemText = value) }
    fun updateKitchenLargeHeader(value: Boolean) = _uiState.update { it.copy(kitchenLargeHeaderText = value) }
    fun updateKitchenItemTextScale(scale: Int) = _uiState.update {
        it.copy(
            kitchenItemTextScale = scale.coerceIn(1, 3),
            kitchenLargeItemText = scale > 1
        )
    }
    fun updateKitchenHeaderTextScale(scale: Int) = _uiState.update {
        it.copy(
            kitchenHeaderTextScale = scale.coerceIn(1, 3),
            kitchenLargeHeaderText = scale > 1
        )
    }
    fun updateLogoUri(uri: String?) = _uiState.update { it.copy(logoUri = uri) }
    fun clearLogo() = _uiState.update { it.copy(logoUri = null) }

    fun importLogo(sourceUri: Uri) {
        viewModelScope.launch {
            runCatching {
                val dest = File(appContext.filesDir, "receipt_logo.png")
                appContext.contentResolver.openInputStream(sourceUri)?.use { input ->
                    dest.outputStream().use { output -> input.copyTo(output) }
                } ?: error("Could not read image")
                _uiState.update { it.copy(logoUri = dest.absolutePath, message = "Logo updated") }
            }.onFailure { e ->
                _uiState.update { it.copy(message = e.message ?: "Logo import failed") }
            }
        }
    }
    fun updateReceiptTemplateName(value: String) = _uiState.update { it.copy(receiptTemplateName = value) }
    fun updateTapToPay(enabled: Boolean) = _uiState.update { it.copy(tapToPayEnabled = enabled) }
    fun updateAdyenEnabled(enabled: Boolean) = _uiState.update { it.copy(adyenTerminalEnabled = enabled) }
    fun updateAdyenTerminalId(value: String) = _uiState.update { it.copy(adyenTerminalId = value) }
    fun updateAdyenApiKey(value: String) = _uiState.update { it.copy(adyenApiKey = value) }
    fun updateAdyenClientId(value: String) = _uiState.update { it.copy(adyenClientId = value) }
    fun updateAdyenMerchantAccount(value: String) = _uiState.update { it.copy(adyenMerchantAccount = value) }
    fun updateAdyenLiveEnvironment(enabled: Boolean) = _uiState.update { it.copy(adyenLiveEnvironment = enabled) }
    fun updateAdyenLiveRegion(value: String) = _uiState.update { it.copy(adyenLiveRegion = value) }
    fun updateAdyenUseLegacyEndpoint(enabled: Boolean) = _uiState.update { it.copy(adyenUseLegacyEndpoint = enabled) }

    fun testAdyenConnection() {
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingAdyen = true) }
            val settings = buildSettingsFromState()
            val message = adyenTerminalService.testConnection(settings)
            _uiState.update { it.copy(isTestingAdyen = false, message = message) }
        }
    }
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
    fun updateVatIncludedInPrice(value: Boolean) {
        _uiState.update { it.copy(vatIncludedInPrice = value) }
        saveSettings()
    }
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
            it.copy(selectedPrinter = DiscoveredPrinter(name = device.displayName, address = device.stableAddress))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for receipts") }
    }

    fun assignUsbAsKitchen(device: UsbPrinterDevice) {
        _uiState.update {
            it.copy(selectedKitchenPrinter = DiscoveredPrinter(name = device.displayName, address = device.stableAddress))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for kitchen") }
    }

    fun discoverUsbDevices() {
        val devices = usbPrinterManager.listDevices()
        _uiState.update {
            it.copy(
                usbDevices = devices,
                message = if (devices.isEmpty()) {
                    "No USB printers detected — connect POS-80 via USB OTG"
                } else {
                    "${devices.size} USB printer(s) found — tap one, allow access once, then Save"
                }
            )
        }
    }

    fun requestUsbPermission(address: String) {
        usbPrinterManager.requestPermission(address) { granted ->
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

    fun testUsbPrint(address: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val normalized = usbPrinterManager.normalizeStoredAddress(address)
            val result = withContext(Dispatchers.IO) {
                usbPrinterManager.sendBytes(normalized, usbPrinterManager.buildTestPayload())
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

    fun displayPrinterAddress(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity): String {
        return if (printer.connectionType == "USB") {
            usbPrinterManager.formatAddressForDisplay(printer.address)
        } else {
            printer.address
        }
    }

    fun testSavedPrinter(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            val result = withContext(Dispatchers.IO) {
                if (printer.connectionType == "USB") {
                    usbPrinterManager.sendBytes(
                        usbPrinterManager.normalizeStoredAddress(printer.address),
                        usbPrinterManager.buildTestPayload()
                    )
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
            val terminalSync = runCatching { terminalSyncRepository.pushLocalTerminalOnly() }
                .getOrDefault(com.chaslay.pos.sync.TerminalSyncResult())
            val syncNote = when {
                terminalSync.skipped -> null
                terminalSync.error != null -> " · terminal sync failed"
                terminalSync.pushed -> " · terminal synced to panel"
                else -> null
            }
            _uiState.update {
                it.copy(message = "Settings saved${syncNote ?: ""}")
            }
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
            adyenLiveEnvironment = state.adyenLiveEnvironment,
            adyenLiveRegion = state.adyenLiveRegion,
            adyenUseLegacyEndpoint = state.adyenUseLegacyEndpoint,
            roundingStep = state.roundingStep.toDoubleOrNull()?.takeIf { it > 0.0 } ?: 0.05,
            openHour = state.openHour.toIntOrNull()?.coerceIn(0, 23) ?: 10,
            openMinute = state.openMinute.toIntOrNull()?.coerceIn(0, 59) ?: 0,
            closeHour = state.closeHour.toIntOrNull()?.coerceIn(0, 23) ?: 22,
            closeMinute = state.closeMinute.toIntOrNull()?.coerceIn(0, 59) ?: 0,
            cashEnabled = if (currentSettings.paymentMethodsManagedByCloud) {
                currentSettings.cashEnabled
            } else {
                state.cashEnabled
            },
            cardEnabled = if (currentSettings.paymentMethodsManagedByCloud) {
                currentSettings.cardEnabled
            } else {
                state.cardEnabled
            },
            terminalEnabled = if (currentSettings.paymentMethodsManagedByCloud) {
                currentSettings.terminalEnabled
            } else {
                state.terminalEnabled
            },
            expressEnabled = if (currentSettings.paymentMethodsManagedByCloud) {
                currentSettings.expressEnabled
            } else {
                state.expressEnabled
            },
            paymentMethodsManagedByCloud = currentSettings.paymentMethodsManagedByCloud,
            printerPrintReceipts = state.printerPrintReceipts,
            printerPrintReports = state.printerPrintReports,
            printerPrintKitchen = state.printerPrintKitchen,
            kitchenPrinterPrintKitchen = state.kitchenPrinterPrintKitchen,
            dineInVatRate = state.dineInVatRate.toDoubleOrNull() ?: 8.1,
            takeawayVatRate = state.takeawayVatRate.toDoubleOrNull() ?: 2.6,
            vatIncludedInPrice = state.vatIncludedInPrice,
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
            receiptShowQrCode = state.receiptShowQrCode,
            kitchenLargeItemText = state.kitchenLargeItemText,
            kitchenLargeHeaderText = state.kitchenLargeHeaderText,
            kitchenItemTextScale = state.kitchenItemTextScale.coerceIn(1, 3),
            kitchenHeaderTextScale = state.kitchenHeaderTextScale.coerceIn(1, 3),
            logoUri = state.logoUri,
            receiptTemplateName = state.receiptTemplateName,
            posMode = state.posMode,
            trackCoversFromSeatingPlan = state.trackCoversFromSeatingPlan,
            floorSyncEnabled = state.floorSyncEnabled,
            floorDeviceRole = state.floorDeviceRole.apiValue,
            floorConnectionMode = state.floorConnectionMode.apiValue,
            mainPosLanUrl = state.mainPosLanUrl.trim(),
            scaleEnabled = state.scaleEnabled,
            scaleUsbAddress = state.scaleUsbAddress?.trim()?.takeIf { it.isNotEmpty() }
        )
    }

    fun updateScaleEnabled(enabled: Boolean) = _uiState.update { it.copy(scaleEnabled = enabled) }

    fun selectScaleDevice(address: String) = _uiState.update {
        it.copy(scaleUsbAddress = address, message = "Scale device selected — tap Save")
    }

    fun scanScaleUsbDevices() {
        val devices = scaleService.listDevices()
        _uiState.update {
            it.copy(
                scaleDevices = devices,
                message = if (devices.isEmpty()) {
                    "No USB scale found — connect Aclas OS6X via USB OTG"
                } else {
                    "${devices.size} scale device(s) found — tap one and allow USB access"
                }
            )
        }
    }

    fun requestScalePermission(address: String) {
        scaleService.requestPermission(address) { granted ->
            _uiState.update {
                it.copy(
                    scaleDevices = scaleService.listDevices(),
                    message = if (granted) "Scale USB permission granted — tap Save" else "USB permission denied"
                )
            }
        }
    }

    fun testScaleReading() {
        val address = _uiState.value.scaleUsbAddress?.trim().orEmpty()
        if (address.isBlank()) {
            _uiState.update { it.copy(message = "Select a scale USB device first") }
            return
        }
        viewModelScope.launch {
            scaleService.readOnce(address)
                .onSuccess { reading ->
                    _uiState.update {
                        it.copy(
                            scaleTestReading = com.chaslay.pos.scale.AclasScaleProtocol.formatWeight(reading.weightKg),
                            message = "Scale reading OK"
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            scaleTestReading = null,
                            message = error.message ?: "Scale test failed"
                        )
                    }
                }
        }
    }
}
