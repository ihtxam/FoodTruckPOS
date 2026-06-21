package com.foodtruck.pos.ui.settings

import androidx.appcompat.app.AppCompatDelegate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.domain.model.AppLanguage
import com.foodtruck.pos.domain.model.SupportedCurrency
import com.foodtruck.pos.printer.BluetoothPrinterService
import com.foodtruck.pos.printer.DiscoveredPrinter
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

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
    val printers: List<DiscoveredPrinter> = emptyList(),
    val selectedPrinter: DiscoveredPrinter? = null,
    val message: String? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val sessionManager: SessionManager,
    private val printerService: BluetoothPrinterService
) : ViewModel() {

    private var currentSettings = BusinessSettingsEntity()
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            currentSettings = settings
            val language = sessionManager.appLanguage.first()
            _uiState.update {
                it.copy(
                    businessName = settings.businessName,
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
                    selectedPrinter = settings.printerMacAddress?.let { mac ->
                        DiscoveredPrinter(settings.printerName ?: mac, mac)
                    }
                )
            }
        }
    }

    fun updateBusinessName(value: String) = _uiState.update { it.copy(businessName = value) }
    fun updateVatNumber(value: String) = _uiState.update { it.copy(vatNumber = value) }
    fun updateAddress(value: String) = _uiState.update { it.copy(address = value) }
    fun updatePhone(value: String) = _uiState.update { it.copy(phone = value) }
    fun updateEmail(value: String) = _uiState.update { it.copy(email = value) }
    fun updateTapToPay(enabled: Boolean) = _uiState.update { it.copy(tapToPayEnabled = enabled) }
    fun updateAdyenEnabled(enabled: Boolean) = _uiState.update { it.copy(adyenTerminalEnabled = enabled) }
    fun updateAdyenTerminalId(value: String) = _uiState.update { it.copy(adyenTerminalId = value) }

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

    fun discoverPrinters() {
        val printers = printerService.discoverPrinters()
        _uiState.update { it.copy(printers = printers, message = "${printers.size} printer(s) found") }
    }

    fun selectPrinter(printer: DiscoveredPrinter) {
        _uiState.update { it.copy(selectedPrinter = printer) }
    }

    fun testPrint() {
        viewModelScope.launch {
            val settings = buildSettingsFromState()
            printerService.testPrint(settings)
                .onSuccess { _uiState.update { it.copy(message = "Test print sent") } }
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
            printerMacAddress = state.selectedPrinter?.address,
            printerName = state.selectedPrinter?.name
        )
    }
}
