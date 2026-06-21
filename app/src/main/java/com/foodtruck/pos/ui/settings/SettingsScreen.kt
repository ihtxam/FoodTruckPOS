package com.foodtruck.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodtruck.pos.R
import com.foodtruck.pos.domain.model.AppLanguage
import com.foodtruck.pos.domain.model.SupportedCurrency
import com.foodtruck.pos.printer.DiscoveredPrinter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var currencyExpanded by remember { mutableStateOf(false) }
    var languageExpanded by remember { mutableStateOf(false) }
    var printerExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(stringResource(R.string.general_settings))
        OutlinedTextField(
            value = state.businessName,
            onValueChange = viewModel::updateBusinessName,
            label = { Text(stringResource(R.string.business_name)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.vatNumber,
            onValueChange = viewModel::updateVatNumber,
            label = { Text(stringResource(R.string.vat_number)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.address,
            onValueChange = viewModel::updateAddress,
            label = { Text(stringResource(R.string.address)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.phone,
            onValueChange = viewModel::updatePhone,
            label = { Text(stringResource(R.string.phone)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::updateEmail,
            label = { Text(stringResource(R.string.email)) },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.currency_settings))
        ExposedDropdownMenuBox(expanded = currencyExpanded, onExpandedChange = { currencyExpanded = it }) {
            OutlinedTextField(
                value = state.defaultCurrency,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.default_currency)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = currencyExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = currencyExpanded, onDismissRequest = { currencyExpanded = false }) {
                SupportedCurrency.entries.forEach { currency ->
                    DropdownMenuItem(
                        text = { Text("${currency.code} (${currency.symbol})") },
                        onClick = {
                            viewModel.updateCurrency(currency)
                            currencyExpanded = false
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.language_settings))
        ExposedDropdownMenuBox(expanded = languageExpanded, onExpandedChange = { languageExpanded = it }) {
            OutlinedTextField(
                value = state.language.displayName,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.language_settings)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = languageExpanded, onDismissRequest = { languageExpanded = false }) {
                AppLanguage.entries.forEach { language ->
                    DropdownMenuItem(
                        text = { Text(language.displayName) },
                        onClick = {
                            viewModel.updateLanguage(language)
                            languageExpanded = false
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.payment_settings))
        SettingSwitch(stringResource(R.string.tap_to_pay_enabled), state.tapToPayEnabled, viewModel::updateTapToPay)
        SettingSwitch(stringResource(R.string.adyen_terminal), state.adyenTerminalEnabled, viewModel::updateAdyenEnabled)
        if (state.adyenTerminalEnabled) {
            OutlinedTextField(
                value = state.adyenTerminalId,
                onValueChange = viewModel::updateAdyenTerminalId,
                label = { Text(stringResource(R.string.adyen_terminal)) },
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.printer_settings))
        Button(onClick = viewModel::discoverPrinters) {
            Text(stringResource(R.string.discover_printers))
        }
        if (state.printers.isNotEmpty()) {
            ExposedDropdownMenuBox(expanded = printerExpanded, onExpandedChange = { printerExpanded = it }) {
                OutlinedTextField(
                    value = state.selectedPrinter?.name ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Printer") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = printerExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )
                ExposedDropdownMenu(expanded = printerExpanded, onDismissRequest = { printerExpanded = false }) {
                    state.printers.forEach { printer ->
                        DropdownMenuItem(
                            text = { Text(printer.name) },
                            onClick = {
                                viewModel.selectPrinter(printer)
                                printerExpanded = false
                            }
                        )
                    }
                }
            }
        }
        Button(onClick = viewModel::testPrint) {
            Text(stringResource(R.string.test_print))
        }
        state.message?.let { Text(it) }

        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = viewModel::saveSettings, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.save))
        }
    }
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
