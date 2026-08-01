package com.chaslay.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.domain.model.UserAccess
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.TextButton
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.domain.model.CategoryPrintSetting
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.SupportedCurrency
import com.chaslay.pos.printer.DiscoveredPrinter
import com.chaslay.pos.ui.license.LicenseSettingsSection
import com.chaslay.pos.ui.tableplan.TablePlanDesignerScreen
import com.chaslay.pos.ui.theme.ChaslayBrand
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    userAccess: UserAccess = UserAccess.FULL_ACCESS,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var currencyExpanded by remember { mutableStateOf(false) }
    var languageExpanded by remember { mutableStateOf(false) }
    var printerExpanded by remember { mutableStateOf(false) }
    var kitchenPrinterExpanded by remember { mutableStateOf(false) }
    var hasBluetoothPermission by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                    PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        hasBluetoothPermission = grants.values.all { it }
        viewModel.discoverPrinters(hasBluetoothPermission)
    }

    var showTablePlanDesigner by remember { mutableStateOf(false) }
    if (showTablePlanDesigner) {
        TablePlanDesignerScreen(onBack = { showTablePlanDesigner = false })
        return
    }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(ChaslayBrand.White)
    ) {
        Column(
            modifier = Modifier
                .width(200.dp)
                .fillMaxHeight()
                .background(ChaslayBrand.Black)
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            SettingsSection.entries.filter { section ->
                when (section) {
                    SettingsSection.USERS_ACCOUNTS -> userAccess.canManageUsers()
                    SettingsSection.TABLES -> state.posMode == PosMode.RESTAURANT
                    else -> true
                }
            }.forEach { section ->
                TextButton(
                    onClick = { viewModel.selectSection(section) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        stringResource(section.titleRes),
                        fontWeight = if (state.selectedSection == section) FontWeight.Bold else FontWeight.Normal,
                        color = if (state.selectedSection == section) ChaslayBrand.White else ChaslayBrand.Gray400,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
        if (state.selectedSection == SettingsSection.GENERAL) {
        Text(stringResource(R.string.general_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)

        Text(stringResource(R.string.menu_sync_title), fontWeight = FontWeight.SemiBold)
        Text(stringResource(R.string.menu_sync_help), style = MaterialTheme.typography.bodySmall)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = state.syncBusinessInfo,
                onCheckedChange = viewModel::updateSyncBusinessInfo
            )
            Text(
                stringResource(R.string.menu_sync_business_info),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Button(
                onClick = viewModel::pullOnlineMenuReplace,
                enabled = !state.isMenuSyncing,
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    if (state.isMenuSyncing) stringResource(R.string.menu_syncing)
                    else stringResource(R.string.menu_sync_replace)
                )
            }
            OutlinedButton(
                onClick = viewModel::pullOnlineMenuMerge,
                enabled = !state.isMenuSyncing,
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.menu_sync_merge))
            }
        }
        OutlinedButton(
            onClick = viewModel::pushMenuToPanel,
            enabled = !state.isMenuSyncing,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.menu_sync_push))
        }
        Spacer(modifier = Modifier.height(8.dp))

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
        Text(stringResource(R.string.pos_mode), fontWeight = FontWeight.SemiBold)
        Text(stringResource(R.string.pos_mode_help), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PosMode.entries.forEach { mode ->
                FilterChip(
                    selected = state.posMode == mode,
                    onClick = { viewModel.updatePosMode(mode) },
                    label = {
                        Text(
                            when (mode) {
                                PosMode.RETAIL -> stringResource(R.string.pos_mode_retail)
                                PosMode.RESTAURANT -> stringResource(R.string.pos_mode_restaurant)
                            }
                        )
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.business_hours), fontWeight = FontWeight.SemiBold)
        Text(stringResource(R.string.business_hours_help), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = state.openHour,
                onValueChange = viewModel::updateOpenHour,
                label = { Text(stringResource(R.string.open_hour)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            OutlinedTextField(
                value = state.openMinute,
                onValueChange = viewModel::updateOpenMinute,
                label = { Text(stringResource(R.string.open_minute)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = state.closeHour,
                onValueChange = viewModel::updateCloseHour,
                label = { Text(stringResource(R.string.close_hour)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            OutlinedTextField(
                value = state.closeMinute,
                onValueChange = viewModel::updateCloseMinute,
                label = { Text(stringResource(R.string.close_minute)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
        }

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
            DropdownMenu(expanded = currencyExpanded, onDismissRequest = { currencyExpanded = false }) {
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
            DropdownMenu(expanded = languageExpanded, onDismissRequest = { languageExpanded = false }) {
                AppLanguage.supportedInSettings.forEach { language ->
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
        Text(stringResource(R.string.discount_presets))
        state.discountPresets.forEach { preset ->
            Text("• ${preset.name}: ${preset.percent.toInt()}%", style = MaterialTheme.typography.bodySmall)
        }
        OutlinedTextField(
            value = state.newPresetName,
            onValueChange = viewModel::updateNewPresetName,
            label = { Text(stringResource(R.string.preset_name)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.newPresetPercent,
            onValueChange = viewModel::updateNewPresetPercent,
            label = { Text(stringResource(R.string.discount_percent)) },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = viewModel::addDiscountPreset) {
            Text(stringResource(R.string.add_preset))
        }
        }

        if (state.selectedSection == SettingsSection.VAT) {
        Text(stringResource(R.string.vat_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        OutlinedTextField(
            value = state.dineInVatRate,
            onValueChange = viewModel::updateDineInVatRate,
            label = { Text(stringResource(R.string.dine_in_vat)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.takeawayVatRate,
            onValueChange = viewModel::updateTakeawayVatRate,
            label = { Text(stringResource(R.string.takeaway_vat)) },
            modifier = Modifier.fillMaxWidth()
        )
        Text(stringResource(R.string.vat_pricing_mode), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = !state.vatIncludedInPrice,
                onClick = { viewModel.updateVatIncludedInPrice(false) },
                label = { Text(stringResource(R.string.vat_excluded_in_price)) }
            )
            FilterChip(
                selected = state.vatIncludedInPrice,
                onClick = { viewModel.updateVatIncludedInPrice(true) },
                label = { Text(stringResource(R.string.vat_included_in_price)) }
            )
        }
        Text(
            if (state.vatIncludedInPrice) {
                stringResource(R.string.vat_included_hint)
            } else {
                stringResource(R.string.vat_excluded_hint)
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        }

        if (state.selectedSection == SettingsSection.TABLES && state.posMode == PosMode.RESTAURANT) {
        Text(stringResource(R.string.table_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(
            stringResource(R.string.table_plan_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Button(
            onClick = { showTablePlanDesigner = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.open_table_plan_designer))
        }
        SettingSwitch(
            stringResource(R.string.track_covers_seating_plan),
            state.trackCoversFromSeatingPlan,
            viewModel::updateTrackCoversFromSeatingPlan
        )
        Text(
            stringResource(R.string.track_covers_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = state.newTableName,
            onValueChange = viewModel::updateNewTableName,
            label = { Text(stringResource(R.string.table_name)) },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = viewModel::addTable) {
            Text(stringResource(R.string.add_table))
        }
        if (state.tables.isNotEmpty()) {
            Text(stringResource(R.string.existing_tables, state.tables.size))
            state.tables.take(8).forEach { name ->
                Text("• $name", style = MaterialTheme.typography.bodySmall)
            }
        }
        }

        if (state.selectedSection == SettingsSection.PAYMENTS) {
        Text(stringResource(R.string.payment_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        SettingSwitch(stringResource(R.string.tap_to_pay_enabled), state.tapToPayEnabled, viewModel::updateTapToPay)
        SettingSwitch(stringResource(R.string.adyen_terminal), state.adyenTerminalEnabled, viewModel::updateAdyenEnabled)
        if (state.adyenTerminalEnabled) {
            Text(
                stringResource(R.string.adyen_setup_help),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedTextField(
                value = state.adyenApiKey,
                onValueChange = viewModel::updateAdyenApiKey,
                label = { Text(stringResource(R.string.adyen_api_key)) },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = state.adyenMerchantAccount,
                onValueChange = viewModel::updateAdyenMerchantAccount,
                label = { Text(stringResource(R.string.adyen_merchant_account)) },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = state.adyenTerminalId,
                onValueChange = viewModel::updateAdyenTerminalId,
                label = { Text(stringResource(R.string.adyen_terminal_id)) },
                supportingText = { Text(stringResource(R.string.adyen_terminal_id_help)) },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = state.adyenClientId,
                onValueChange = viewModel::updateAdyenClientId,
                label = { Text(stringResource(R.string.adyen_sale_id)) },
                supportingText = { Text(stringResource(R.string.adyen_sale_id_help)) },
                modifier = Modifier.fillMaxWidth()
            )
            SettingSwitch(
                stringResource(R.string.adyen_live_environment),
                state.adyenLiveEnvironment,
                viewModel::updateAdyenLiveEnvironment
            )
            if (state.adyenLiveEnvironment) {
                Text(stringResource(R.string.adyen_live_region), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("EU", "US", "AU", "APSE").forEach { region ->
                        FilterChip(
                            selected = state.adyenLiveRegion.equals(region, ignoreCase = true),
                            onClick = { viewModel.updateAdyenLiveRegion(region) },
                            label = { Text(region) }
                        )
                    }
                }
            }
            SettingSwitch(
                stringResource(R.string.adyen_use_legacy),
                state.adyenUseLegacyEndpoint,
                viewModel::updateAdyenUseLegacyEndpoint
            )
            OutlinedButton(
                onClick = viewModel::testAdyenConnection,
                enabled = !state.isTestingAdyen,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    if (state.isTestingAdyen) stringResource(R.string.testing_adyen)
                    else stringResource(R.string.test_adyen_connection)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.default_rounding))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("0" to "None", "0.05" to "0.05", "0.10" to "0.10", "0.50" to "0.50", "1.00" to "1.00").forEach { (value, label) ->
                FilterChip(
                    selected = state.roundingStep == value,
                    onClick = { viewModel.updateRoundingStep(value) },
                    label = { Text(label) }
                )
            }
        }
        SettingSwitch(stringResource(R.string.payment_cash), state.cashEnabled, viewModel::updateCashEnabled, enabled = !state.paymentMethodsManagedByCloud)
        SettingSwitch(stringResource(R.string.payment_card), state.cardEnabled, viewModel::updateCardEnabled, enabled = !state.paymentMethodsManagedByCloud)
        SettingSwitch(stringResource(R.string.payment_terminal), state.terminalEnabled, viewModel::updateTerminalEnabled, enabled = !state.paymentMethodsManagedByCloud)
        if (state.paymentMethodsManagedByCloud) {
            Text(
                stringResource(R.string.payment_methods_managed_by_panel),
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        }

        if (state.selectedSection == SettingsSection.PRINTERS) {
        Text(stringResource(R.string.printers), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(stringResource(R.string.printers_help), style = MaterialTheme.typography.bodySmall)
        Text(
            "Tap Add Printer to scan for Bluetooth, Wi-Fi or USB printers and assign what each one prints.",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )

        if (state.savedPrinters.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(stringResource(R.string.saved_printers), fontWeight = FontWeight.SemiBold)
        }
        state.savedPrinters.forEach { printer ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(printer.name, fontWeight = FontWeight.Bold)
                    Text(
                        "${printer.connectionType} · ${viewModel.displayPrinterAddress(printer)}",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        buildList {
                            if (printer.printOrderReceipts) add("Receipts")
                            if (printer.printKitchenTickets) add("Kitchen")
                            if (printer.printEndOfDayReports) add("Reports")
                            if (printer.openCashDrawer) add("Drawer")
                        }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (printer.printKitchenTickets) {
                        val linkedCount = printer.linkedProductIds.split(",").count { it.isNotBlank() }
                        Text(
                            if (printer.printAllProducts) "Prints: all products" else "Prints: $linkedCount linked product(s)",
                            fontSize = 11.sp,
                            color = Color(0xFF2E7D32)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Button(
                            onClick = { viewModel.testSavedPrinter(printer) },
                            enabled = !state.isPrinterBusy
                        ) {
                            Text(stringResource(R.string.test_print), fontSize = 12.sp)
                        }
                        OutlinedButton(onClick = { viewModel.editPrinter(printer) }) {
                            Text(stringResource(R.string.edit), fontSize = 12.sp)
                        }
                        TextButton(onClick = { viewModel.deleteSavedPrinter(printer.id) }) {
                            Text(stringResource(R.string.delete))
                        }
                    }
                }
            }
        }

        if (state.usbDevices.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(stringResource(R.string.usb_printer), fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.usb_printer_help), fontSize = 12.sp)
        }
        state.usbDevices.forEach { device ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(device.displayName, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Button(onClick = { viewModel.requestUsbPermission(device.stableAddress) }) {
                            Text(
                                if (device.hasPermission) stringResource(R.string.usb_printer_allowed) else stringResource(R.string.usb_printer_permission),
                                fontSize = 11.sp
                            )
                        }
                        Button(
                            onClick = { viewModel.testUsbPrint(device.stableAddress) },
                            enabled = !state.isPrinterBusy && device.hasPermission
                        ) {
                            Text(stringResource(R.string.test_print), fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Text(stringResource(R.string.scale_section), fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text(stringResource(R.string.scale_help), fontSize = 12.sp, color = Color.Gray)
        SettingSwitch(stringResource(R.string.scale_enabled), state.scaleEnabled, viewModel::updateScaleEnabled)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = viewModel::scanScaleUsbDevices) {
                Text(stringResource(R.string.scale_scan_usb))
            }
            OutlinedButton(
                onClick = viewModel::testScaleReading,
                enabled = state.scaleEnabled && !state.scaleUsbAddress.isNullOrBlank()
            ) {
                Text(stringResource(R.string.scale_test_reading))
            }
        }
        state.scaleUsbAddress?.let { selected ->
            Text("Selected: $selected", fontSize = 12.sp, color = Color(0xFF16A085))
        }
        state.scaleTestReading?.let { reading ->
            Text(reading, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF16A085))
        }
        state.scaleDevices.forEach { device ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (device.stableAddress == state.scaleUsbAddress) {
                        Color(0xFFECFDF5)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(device.displayName, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Button(onClick = { viewModel.requestScalePermission(device.stableAddress) }) {
                            Text(
                                if (device.hasPermission) stringResource(R.string.usb_printer_allowed)
                                else stringResource(R.string.usb_printer_permission),
                                fontSize = 11.sp
                            )
                        }
                        Button(onClick = { viewModel.selectScaleDevice(device.stableAddress) }) {
                            Text(stringResource(R.string.scale_select_usb), fontSize = 11.sp)
                        }
                    }
                }
            }
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Button(onClick = viewModel::showAddPrinterDialog, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.add_printer))
        }
        }

        if (state.selectedSection == SettingsSection.RECEIPTS) {
        val logoPicker = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.GetContent()
        ) { uri -> uri?.let(viewModel::importLogo) }
        Text(stringResource(R.string.receipt_design), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(stringResource(R.string.receipt_logo_help), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { logoPicker.launch("image/*") }) {
                Text(stringResource(R.string.choose_receipt_logo))
            }
            if (!state.logoUri.isNullOrBlank()) {
                OutlinedButton(onClick = viewModel::clearLogo) {
                    Text(stringResource(R.string.remove_receipt_logo))
                }
            }
        }
        if (!state.logoUri.isNullOrBlank()) {
            Text(stringResource(R.string.receipt_logo_set), style = MaterialTheme.typography.bodySmall)
        }
        OutlinedTextField(
            value = state.receiptHeader,
            onValueChange = viewModel::updateReceiptHeader,
            label = { Text(stringResource(R.string.receipt_header)) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2
        )
        OutlinedTextField(
            value = state.receiptFooter,
            onValueChange = viewModel::updateReceiptFooter,
            label = { Text(stringResource(R.string.receipt_footer)) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2
        )
        if (state.posMode == PosMode.RESTAURANT) {
            OutlinedTextField(
                value = state.kitchenTicketHeader,
                onValueChange = viewModel::updateKitchenHeader,
                label = { Text(stringResource(R.string.kitchen_header)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
            OutlinedTextField(
                value = state.kitchenTicketFooter,
                onValueChange = viewModel::updateKitchenFooter,
                label = { Text(stringResource(R.string.kitchen_footer)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(stringResource(R.string.receipt_template), fontWeight = FontWeight.SemiBold)
        OutlinedTextField(
            value = state.receiptTemplateName,
            onValueChange = viewModel::updateReceiptTemplateName,
            label = { Text(stringResource(R.string.receipt_template)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = state.receiptShowVatTable, onCheckedChange = viewModel::updateReceiptShowVatTable)
            Text(stringResource(R.string.receipt_show_vat))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = state.receiptShowStaffLine, onCheckedChange = viewModel::updateReceiptShowStaffLine)
            Text(stringResource(R.string.receipt_show_staff))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = state.receiptShowQrCode, onCheckedChange = viewModel::updateReceiptShowQrCode)
            Text(stringResource(R.string.receipt_show_qr))
        }
        if (state.posMode == PosMode.RESTAURANT) {
            Text(stringResource(R.string.kitchen_text_size), fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.kitchen_item_text_size), style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(1 to R.string.kitchen_text_normal, 2 to R.string.kitchen_text_large, 3 to R.string.kitchen_text_extra)
                    .forEach { (scale, labelRes) ->
                        FilterChip(
                            selected = state.kitchenItemTextScale == scale,
                            onClick = { viewModel.updateKitchenItemTextScale(scale) },
                            label = { Text(stringResource(labelRes)) }
                        )
                    }
            }
            Text(stringResource(R.string.kitchen_header_text_size), style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(1 to R.string.kitchen_text_normal, 2 to R.string.kitchen_text_large, 3 to R.string.kitchen_text_extra)
                    .forEach { (scale, labelRes) ->
                        FilterChip(
                            selected = state.kitchenHeaderTextScale == scale,
                            onClick = { viewModel.updateKitchenHeaderTextScale(scale) },
                            label = { Text(stringResource(labelRes)) }
                        )
                    }
            }
        }
        }

        if (state.selectedSection == SettingsSection.FLOOR_DEVICES) {
            Text(stringResource(R.string.floor_sync_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(stringResource(R.string.floor_sync_help), style = MaterialTheme.typography.bodySmall)
            SettingSwitch(
                label = stringResource(R.string.floor_sync_enabled),
                checked = state.floorSyncEnabled,
                onCheckedChange = viewModel::updateFloorSyncEnabled
            )
            if (state.floorSyncEnabled) {
                Text(stringResource(R.string.floor_device_role), fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FloorDeviceRole.entries.forEach { role ->
                        FilterChip(
                            selected = state.floorDeviceRole == role,
                            onClick = { viewModel.updateFloorDeviceRole(role) },
                            label = {
                                Text(
                                    when (role) {
                                        FloorDeviceRole.MAIN_POS -> stringResource(R.string.floor_role_main_pos)
                                        FloorDeviceRole.WAITER -> stringResource(R.string.floor_role_waiter)
                                        FloorDeviceRole.STANDARD -> stringResource(R.string.floor_role_standard)
                                    }
                                )
                            }
                        )
                    }
                }
                if (state.floorDeviceRole == FloorDeviceRole.MAIN_POS) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(stringResource(R.string.local_lan_url), fontWeight = FontWeight.SemiBold)
                    Text(
                        state.localLanUrl ?: stringResource(R.string.local_lan_url_unknown),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(stringResource(R.string.local_lan_url_help), style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = viewModel::refreshLocalLanUrl) {
                        Text(stringResource(R.string.refresh_lan_address))
                    }
                }
                if (state.floorDeviceRole == FloorDeviceRole.WAITER) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(stringResource(R.string.floor_connection_mode), fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FloorConnectionMode.entries.forEach { mode ->
                            FilterChip(
                                selected = state.floorConnectionMode == mode,
                                onClick = { viewModel.updateFloorConnectionMode(mode) },
                                label = {
                                    Text(
                                        when (mode) {
                                            FloorConnectionMode.AUTO -> stringResource(R.string.floor_connection_auto)
                                            FloorConnectionMode.LAN_ONLY -> stringResource(R.string.floor_connection_lan)
                                            FloorConnectionMode.CLOUD_ONLY -> stringResource(R.string.floor_connection_cloud)
                                        }
                                    )
                                }
                            )
                        }
                    }
                    Text(stringResource(R.string.floor_connection_mode_help), style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = state.mainPosLanUrl,
                        onValueChange = viewModel::updateMainPosLanUrl,
                        label = { Text(stringResource(R.string.main_pos_lan_url)) },
                        placeholder = { Text("http://192.168.1.50:8787") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { viewModel.commitMainPosLanUrl() })
                    )
                    Text(stringResource(R.string.main_pos_lan_url_help), style = MaterialTheme.typography.bodySmall)
                    OutlinedButton(
                        onClick = viewModel::commitMainPosLanUrl,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(stringResource(R.string.save))
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedButton(
                            onClick = viewModel::discoverMainPos,
                            enabled = !state.isDiscoveringMainPos,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                if (state.isDiscoveringMainPos) {
                                    stringResource(R.string.discovering_main_pos)
                                } else {
                                    stringResource(R.string.discover_main_pos)
                                }
                            )
                        }
                        OutlinedButton(
                            onClick = viewModel::testMainPosConnection,
                            enabled = !state.isTestingMainPos,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                if (state.isTestingMainPos) {
                                    stringResource(R.string.testing_connection)
                                } else {
                                    stringResource(R.string.test_main_pos_connection)
                                }
                            )
                        }
                    }
                }
            }
        }

        if (state.selectedSection == SettingsSection.USERS_ACCOUNTS) {
            UsersRolesSection(canManageRoles = userAccess.canManageRoles())
        }

        if (state.selectedSection == SettingsSection.APPEARANCE) {
        Text(stringResource(R.string.appearance_settings), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = state.posThemeMode == PosThemeMode.LIGHT,
                onClick = { viewModel.updatePosThemeMode(PosThemeMode.LIGHT) },
                label = { Text(stringResource(R.string.theme_light)) }
            )
            FilterChip(
                selected = state.posThemeMode == PosThemeMode.DARK,
                onClick = { viewModel.updatePosThemeMode(PosThemeMode.DARK) },
                label = { Text(stringResource(R.string.theme_dark)) }
            )
        }
        Text(stringResource(R.string.theme_help), style = MaterialTheme.typography.bodySmall)
        }

        if (state.selectedSection == SettingsSection.LICENSE) {
            LicenseSettingsSection()
        }

        state.message?.let { Text(it) }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(R.string.app_version),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                stringResource(
                    R.string.app_version_format,
                    BuildConfig.VERSION_NAME,
                    BuildConfig.VERSION_CODE
                ),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = viewModel::saveSettings, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.save))
        }
        }
    }

    if (state.showAddPrinterDialog) {
        AddPrinterDialog(
            discoveredPrinters = state.printers,
            networkPrinters = state.networkPrinters,
            usbDevices = state.usbDevices,
            linkCategories = state.linkCategories,
            initialForm = state.editingPrinter?.toForm(),
            isEdit = state.editingPrinter != null,
            isBusy = state.isPrinterBusy,
            statusMessage = state.message,
            onScan = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission) {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.BLUETOOTH_CONNECT,
                            Manifest.permission.BLUETOOTH_SCAN
                        )
                    )
                } else {
                    viewModel.discoverPrinters(hasBluetoothPermission)
                }
            },
            onScanUsb = viewModel::discoverUsbDevices,
            onRequestUsbPermission = viewModel::requestUsbPermission,
            onScanNetwork = viewModel::discoverNetworkPrinters,
            onVerifyNetwork = viewModel::verifyNetworkPrinterAddress,
            onTestPrint = viewModel::testAddPrinterForm,
            onSave = viewModel::addPrinter,
            onDismiss = viewModel::dismissAddPrinterDialog
        )
    }
}

@Composable
private fun SettingSwitch(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = if (enabled) LocalContentColor.current else Color.Gray)
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrinterPicker(
    label: String,
    selected: String,
    printers: List<DiscoveredPrinter>,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelect: (DiscoveredPrinter) -> Unit
) {
    if (printers.isEmpty()) return
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = onExpandedChange) {
        OutlinedTextField(
            value = selected,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            printers.forEach { printer ->
                DropdownMenuItem(
                    text = { Text(printer.name) },
                    onClick = {
                        onSelect(printer)
                        onExpandedChange(false)
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryPrintRow(
    category: CategoryPrintSetting,
    onTargetChange: (PrintTarget) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = "${category.name}: ${category.printTarget.displayName}",
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth(),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PrintTarget.entries.forEach { target ->
                DropdownMenuItem(
                    text = { Text(target.displayName) },
                    onClick = {
                        onTargetChange(target)
                        expanded = false
                    }
                )
            }
        }
    }
}
