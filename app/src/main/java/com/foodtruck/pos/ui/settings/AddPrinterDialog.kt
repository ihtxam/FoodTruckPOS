package com.foodtruck.pos.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.foodtruck.pos.R
import com.foodtruck.pos.data.local.entity.PrinterConfigEntity
import com.foodtruck.pos.printer.DiscoveredPrinter
import java.util.UUID

data class AddPrinterForm(
    val name: String = "",
    val connectionType: String = "BLUETOOTH",
    val address: String = "",
    val paperWidthMm: Int = 80,
    val printKitchenTickets: Boolean = false,
    val printCustomerTickets: Boolean = false,
    val printOrderReceipts: Boolean = true,
    val printEndOfDayReports: Boolean = false,
    val openCashDrawer: Boolean = false,
    val printAllProducts: Boolean = true,
    val linkedCategoryIds: Set<Long> = emptySet(),
    val linkedProductIds: Set<Long> = emptySet()
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPrinterDialog(
    discoveredPrinters: List<DiscoveredPrinter>,
    networkPrinters: List<DiscoveredPrinter> = emptyList(),
    usbDevices: List<com.foodtruck.pos.printer.UsbPrinterDevice> = emptyList(),
    linkCategories: List<PrinterLinkCategory> = emptyList(),
    initialForm: AddPrinterForm? = null,
    isEdit: Boolean = false,
    isBusy: Boolean = false,
    statusMessage: String? = null,
    onScan: () -> Unit,
    onScanUsb: () -> Unit = {},
    onScanNetwork: (String) -> Unit = {},
    onVerifyNetwork: (String) -> Unit = {},
    onTestPrint: (AddPrinterForm) -> Unit,
    onSave: (AddPrinterForm) -> Unit,
    onDismiss: () -> Unit
) {
    var form by remember(initialForm) { mutableStateOf(initialForm ?: AddPrinterForm()) }
    var showLinkDialog by remember { mutableStateOf(false) }
    val scanResults = when (form.connectionType) {
        "WIFI" -> networkPrinters
        "BLUETOOTH" -> discoveredPrinters
        else -> emptyList()
    }
    val connectionTypes = listOf("BLUETOOTH", "WIFI", "USB")
    val canSave = form.address.trim().isNotBlank()

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.92f),
            shape = RoundedCornerShape(20.dp),
            color = Color.White
        ) {
            Column(modifier = Modifier.padding(24.dp).verticalScroll(rememberScrollState())) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("HARDWARE SETUP", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                        Text(if (isEdit) "EDIT PRINTER" else "ADD PRINTER", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null)
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                statusMessage?.takeIf { it.isNotBlank() }?.let { msg ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFF0FDF4)
                    ) {
                        Text(msg, modifier = Modifier.padding(12.dp), fontSize = 12.sp, color = Color(0xFF166534))
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    connectionTypes.forEach { type ->
                        val selected = form.connectionType == type
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { form = form.copy(connectionType = type) },
                            shape = RoundedCornerShape(10.dp),
                            color = if (selected) Color(0xFF111827) else Color(0xFFF3F4F6)
                        ) {
                            Text(
                                type,
                                color = if (selected) Color.White else Color(0xFF374151),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = form.name,
                            onValueChange = { form = form.copy(name = it) },
                            label = { Text(stringResource(R.string.printer_name)) },
                            placeholder = { Text("e.g. Kitchen Printer") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        val scanAction: () -> Unit = {
                            when (form.connectionType) {
                                "USB" -> onScanUsb()
                                "WIFI" -> onScanNetwork(form.address)
                                else -> onScan()
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = scanAction,
                                enabled = !isBusy,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    when (form.connectionType) {
                                        "USB" -> stringResource(R.string.select_usb_device)
                                        "WIFI" -> stringResource(R.string.scan_network)
                                        else -> stringResource(R.string.scan_for_devices)
                                    }
                                )
                            }
                            OutlinedButton(onClick = scanAction, enabled = !isBusy) {
                                Icon(Icons.Default.Search, contentDescription = null)
                            }
                        }
                        if (form.connectionType == "USB") {
                            usbDevices.take(5).forEach { device ->
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            form = form.copy(
                                                connectionType = "USB",
                                                name = form.name.ifBlank { "USB Printer" },
                                                address = device.deviceName
                                            )
                                        },
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFF8FAFC)
                                ) {
                                    Text(device.displayName, modifier = Modifier.padding(12.dp), fontSize = 12.sp)
                                }
                            }
                        } else if (scanResults.isNotEmpty()) {
                            scanResults.take(8).forEach { printer ->
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            form = form.copy(
                                                connectionType = form.connectionType,
                                                name = form.name.ifBlank { printer.name },
                                                address = printer.address
                                            )
                                        },
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFF8FAFC)
                                ) {
                                    Text(
                                        "${printer.name} (${printer.address})",
                                        modifier = Modifier.padding(12.dp),
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = form.address,
                            onValueChange = { form = form.copy(address = it) },
                            label = { Text(stringResource(R.string.printer_address)) },
                            placeholder = {
                                Text(
                                    when (form.connectionType) {
                                        "USB" -> "USB device path"
                                        "WIFI" -> "IP address (e.g. 192.168.1.50)"
                                        else -> "MAC address (e.g. 10:23:81:4C:5F:6F)"
                                    }
                                )
                            },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        if (form.connectionType == "WIFI" && form.address.trim().isNotBlank()) {
                            OutlinedButton(
                                onClick = { onVerifyNetwork(form.address) },
                                enabled = !isBusy,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(stringResource(R.string.verify_printer_ip))
                            }
                        }
                        if (form.name.isBlank() && form.address.trim().isNotBlank()) {
                            Text(
                                stringResource(R.string.printer_name_optional_hint),
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    }

                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PaperSizeCard("58MM", "Standard Receipt", form.paperWidthMm == 58) {
                                form = form.copy(paperWidthMm = 58)
                            }
                            PaperSizeCard("80MM", "Wide Invoice", form.paperWidthMm == 80) {
                                form = form.copy(paperWidthMm = 80)
                            }
                        }
                        RoleToggle("KITCHEN TICKETS", form.printKitchenTickets) {
                            form = form.copy(printKitchenTickets = it)
                        }
                        RoleToggle("CUSTOMER TICKETS", form.printCustomerTickets) {
                            form = form.copy(printCustomerTickets = it)
                        }
                        RoleToggle("ORDER RECEIPTS", form.printOrderReceipts) {
                            form = form.copy(printOrderReceipts = it)
                        }
                        RoleToggle("ENDOFDAY REPORTS", form.printEndOfDayReports) {
                            form = form.copy(printEndOfDayReports = it)
                        }
                        RoleToggle("CASH DRAWER", form.openCashDrawer) {
                            form = form.copy(openCashDrawer = it)
                        }

                        if (form.printKitchenTickets && linkCategories.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("WHICH PRODUCTS TO PRINT", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                            val totalProducts = linkCategories.sumOf { it.products.size }
                            val summary = if (form.printAllProducts) {
                                "All products"
                            } else {
                                "${form.linkedProductIds.size} of $totalProducts selected"
                            }
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { showLinkDialog = true },
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFF3F4F6)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(summary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    Text("Link products ›", fontSize = 13.sp, color = Color(0xFF0E9F6E))
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.discard_changes), color = Color(0xFFDC2626))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { onTestPrint(form.normalized()) }) {
                            Icon(Icons.Default.Print, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(stringResource(R.string.print_test_page))
                        }
                        Button(
                            onClick = { onSave(form.normalized()) },
                            enabled = canSave && !isBusy,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111827))
                        ) {
                            Text(if (isEdit) stringResource(R.string.save) else stringResource(R.string.add_printer))
                        }
                    }
                }
            }
        }
    }

    if (showLinkDialog) {
        LinkProductsDialog(
            categories = linkCategories,
            printAllProducts = form.printAllProducts,
            selectedProductIds = form.linkedProductIds,
            onConfirm = { all, ids ->
                form = form.copy(printAllProducts = all, linkedProductIds = ids, linkedCategoryIds = emptySet())
                showLinkDialog = false
            },
            onDismiss = { showLinkDialog = false }
        )
    }
}

@Composable
private fun LinkProductsDialog(
    categories: List<PrinterLinkCategory>,
    printAllProducts: Boolean,
    selectedProductIds: Set<Long>,
    onConfirm: (printAll: Boolean, productIds: Set<Long>) -> Unit,
    onDismiss: () -> Unit
) {
    val allIds = remember(categories) { categories.flatMap { it.products }.map { it.id }.toSet() }
    var selected by remember {
        mutableStateOf(if (printAllProducts) allIds else selectedProductIds)
    }
    var activeCategory by remember { mutableStateOf(categories.firstOrNull()?.id) }
    val linkAll = selected.size == allIds.size && allIds.isNotEmpty()

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.85f),
            shape = RoundedCornerShape(20.dp),
            color = Color.White
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Link product", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Link all (${selected.size}/${allIds.size})", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        androidx.compose.material3.Checkbox(
                            checked = linkAll,
                            onCheckedChange = { checked ->
                                selected = if (checked) allIds else emptySet()
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(modifier = Modifier.height(320.dp)) {
                    Column(
                        modifier = Modifier
                            .width(150.dp)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                    ) {
                        categories.forEach { category ->
                            val isActive = category.id == activeCategory
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { activeCategory = category.id },
                                color = if (isActive) Color(0xFFE8F5F0) else Color.White
                            ) {
                                Text(
                                    category.name,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 14.dp),
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isActive) Color(0xFF0E9F6E) else Color(0xFF374151)
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    val products = categories.find { it.id == activeCategory }?.products.orEmpty()
                    val catProductIds = products.map { it.id }.toSet()
                    val allInCat = catProductIds.isNotEmpty() && selected.containsAll(catProductIds)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    selected = if (allInCat) selected - catProductIds else selected + catProductIds
                                },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            androidx.compose.material3.Checkbox(
                                checked = allInCat,
                                onCheckedChange = { checked ->
                                    selected = if (checked) selected + catProductIds else selected - catProductIds
                                }
                            )
                            Text("All (${selected.count { it in catProductIds }}/${products.size})", fontWeight = FontWeight.SemiBold)
                        }
                        products.forEach { product ->
                            val checked = product.id in selected
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selected = if (checked) selected - product.id else selected + product.id
                                    },
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                androidx.compose.material3.Checkbox(
                                    checked = checked,
                                    onCheckedChange = { isChecked ->
                                        selected = if (isChecked) selected + product.id else selected - product.id
                                    }
                                )
                                Text(product.name)
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = { onConfirm(linkAll, selected) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0E9F6E))
                    ) {
                        Text(stringResource(R.string.confirm))
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.PaperSizeCard(
    label: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) Color(0xFF111827) else Color(0xFFE5E7EB),
                shape = RoundedCornerShape(12.dp)
            )
            .background(Color.White, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Text(label, fontWeight = FontWeight.Bold)
        Text(subtitle, fontSize = 11.sp, color = Color.Gray)
    }
}

@Composable
private fun RoleToggle(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

fun PrinterConfigEntity.toForm(): AddPrinterForm = AddPrinterForm(
    name = name,
    connectionType = connectionType,
    address = address,
    paperWidthMm = paperWidthMm,
    printKitchenTickets = printKitchenTickets,
    printCustomerTickets = printCustomerTickets,
    printOrderReceipts = printOrderReceipts,
    printEndOfDayReports = printEndOfDayReports,
    openCashDrawer = openCashDrawer,
    printAllProducts = printAllProducts,
    linkedCategoryIds = linkedCategoryIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet(),
    linkedProductIds = linkedProductIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
)

fun AddPrinterForm.normalized(): AddPrinterForm {
    val addr = address.trim()
    val host = addr.substringBefore(':').trim()
    val resolvedAddress = if (host.matches(IPV4_REGEX)) host else addr
    val resolvedName = name.trim().ifBlank {
        when (connectionType) {
            "WIFI" -> "Wi-Fi printer ($resolvedAddress)"
            "USB" -> "USB printer"
            else -> "Bluetooth printer"
        }
    }
    return copy(name = resolvedName, address = resolvedAddress)
}

private val IPV4_REGEX =
    Regex("^(?:25[0-5]|2[0-4]\\d|1?\\d{1,2})(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d{1,2})){3}$")

fun AddPrinterForm.toEntity(sortOrder: Int = 0): PrinterConfigEntity = normalized().let { form ->
    PrinterConfigEntity(
        id = UUID.randomUUID().toString(),
        name = form.name.trim(),
        connectionType = form.connectionType,
        address = form.address.trim(),
        paperWidthMm = form.paperWidthMm,
        printKitchenTickets = form.printKitchenTickets,
        printCustomerTickets = form.printCustomerTickets,
        printOrderReceipts = form.printOrderReceipts,
        printEndOfDayReports = form.printEndOfDayReports,
        openCashDrawer = form.openCashDrawer,
        printAllProducts = form.printAllProducts,
        linkedCategoryIds = form.linkedCategoryIds.joinToString(","),
        linkedProductIds = form.linkedProductIds.joinToString(","),
        sortOrder = sortOrder
    )
}
