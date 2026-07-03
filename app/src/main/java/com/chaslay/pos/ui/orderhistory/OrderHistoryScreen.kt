package com.chaslay.pos.ui.orderhistory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val PageBg = Color(0xFFF3F4F6)
private val CardBg = Color.White
private val HeaderBg = Color(0xFFFAFAFA)
private val TextPrimary = Color(0xFF111827)
private val TextMuted = Color(0xFF6B7280)
private val AccentGreen = Color(0xFF059669)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: OrderHistoryViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showSearchDialog by remember { mutableStateOf(false) }

    if (showSearchDialog) {
        var searchText by remember(state.searchQuery) { mutableStateOf(state.searchQuery) }
        AlertDialog(
            onDismissRequest = { showSearchDialog = false },
            title = { Text("Search orders") },
            text = {
                OutlinedTextField(
                    value = searchText,
                    onValueChange = { searchText = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("ORDER ID...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.setSearchQuery(searchText)
                    showSearchDialog = false
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = {
                    searchText = ""
                    viewModel.setSearchQuery("")
                    showSearchDialog = false
                }) { Text("Clear") }
            }
        )
    }

    state.message?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text(stringResource(R.string.confirm)) } },
            title = { Text(stringResource(R.string.order_history)) },
            text = { Text(message) }
        )
    }

    state.selectedOrder?.let { order ->
        OrderDetailDialog(
            order = order,
            items = state.selectedItems,
            splitOrders = state.splitOrders,
            splitItemsByOrderId = state.splitItemsByOrderId,
            currencySymbol = state.currencySymbol,
            canCancel = order.paymentStatus == PaymentStatus.COMPLETED,
            canRefund = order.paymentStatus == PaymentStatus.COMPLETED ||
                order.paymentStatus == PaymentStatus.PARTIALLY_REFUNDED,
            onDismiss = viewModel::closeOrderDetail,
            onPrint = viewModel::printSelectedOrder,
            onPrintAllSplits = viewModel::printAllSplitOrders,
            onPrintSplit = viewModel::printSplitOrder,
            onCancel = viewModel::showCancelDialog,
            onRefund = viewModel::showRefundDialog
        )
    }

    if (state.showCancelDialog) {
        CancelOrderDialog(
            reasons = state.cancelReasons,
            onDismiss = viewModel::dismissCancelDialog,
            onConfirm = viewModel::cancelSelectedOrder
        )
    }

    if (state.showRefundDialog) {
        RefundOrderDialog(
            maxAmount = state.selectedOrder?.total ?: 0.0,
            currencySymbol = state.currencySymbol,
            onDismiss = viewModel::dismissRefundDialog,
            onConfirm = { amount, full -> viewModel.refundSelectedOrder(amount, full) }
        )
    }

    if (embedded) {
        LaunchedEffect(Unit) { viewModel.refresh() }
        OrderHistoryContent(
            modifier = Modifier.fillMaxSize(),
            state = state,
            viewModel = viewModel,
            showRefresh = true
        )
    } else {
        Scaffold(
            containerColor = PageBg,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text("ORDER RECORDS", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(
                                stringResource(R.string.order_history),
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    },
                    actions = {
                        IconButton(onClick = { showSearchDialog = true }) {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = "Search",
                                tint = if (state.searchQuery.isNotBlank()) AccentGreen else Color.Unspecified
                            )
                        }
                        IconButton(onClick = viewModel::refresh) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                        }
                    }
                )
            }
        ) { padding ->
            OrderHistoryContent(
                modifier = Modifier.padding(padding),
                state = state,
                viewModel = viewModel,
                showRefresh = false
            )
        }
    }
}

@Composable
private fun OrderHistoryContent(
    modifier: Modifier = Modifier,
    state: OrderHistoryUiState,
    viewModel: OrderHistoryViewModel,
    showRefresh: Boolean = false
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        if (showRefresh) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = viewModel::refresh) {
                    Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
                }
            }
        }
            RecordsFilterBar(
                state = state,
                onDate = viewModel::setDateFilter,
                onStatus = viewModel::setStatusFilter,
                onType = viewModel::setServiceFilter,
                onPayment = viewModel::setPaymentFilter
            )

            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                modifier = Modifier.fillMaxSize(),
                shape = RoundedCornerShape(12.dp),
                color = CardBg,
                shadowElevation = 1.dp
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    RecordsTableHeader()
                    HorizontalDivider(color = Color(0xFFE5E7EB))
                    if (state.orders.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No orders found", color = TextMuted)
                        }
                    } else {
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            itemsIndexed(state.orders, key = { _, order -> order.id }) { index, order ->
                                val isSplit = order.masterOrderId?.let { (state.splitCounts[it] ?: 0) > 1 } == true
                                RecordsTableRow(
                                    index = index + 1,
                                    order = order,
                                    tableLabel = order.tableId?.let { state.tableNames[it] },
                                    isSplit = isSplit,
                                    currencySymbol = state.currencySymbol,
                                    onClick = { viewModel.openOrder(order) }
                                )
                                HorizontalDivider(color = Color(0xFFF3F4F6))
                            }
                        }
                    }
                }
            }
    }
}

@Composable
private fun RecordsFilterBar(
    state: OrderHistoryUiState,
    onDate: (HistoryDateFilter) -> Unit,
    onStatus: (PaymentStatus?) -> Unit,
    onType: (ServiceType?) -> Unit,
    onPayment: (PaymentMethod?) -> Unit
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Color.White,
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("DATE", fontSize = 10.sp, color = TextMuted, fontWeight = FontWeight.Bold)
                Text(state.dateRangeLabel, fontSize = 11.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold)
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf(
                    HistoryDateFilter.TODAY to stringResource(R.string.today),
                    HistoryDateFilter.YESTERDAY to stringResource(R.string.yesterday),
                    HistoryDateFilter.WEEK to "Last Week",
                    HistoryDateFilter.MONTH to stringResource(R.string.month),
                    HistoryDateFilter.THREE_MONTHS to "Last 3 Months",
                    HistoryDateFilter.ALL to stringResource(R.string.all)
                ).forEach { (filter, label) ->
                    RecordsTabChip(
                        label = label,
                        selected = state.dateFilter == filter,
                        onClick = { onDate(filter) }
                    )
                }
            }

            FilterChipRow(
                label = "STATUS",
                options = listOf(null to "All") + PaymentStatus.entries
                    .filter { it != PaymentStatus.PENDING && it != PaymentStatus.FAILED }
                    .map { it to it.name.replace('_', ' ') },
                selected = state.statusFilter,
                onSelect = onStatus
            )
            FilterChipRow(
                label = "TYPE",
                options = listOf(
                    null to "All",
                    ServiceType.DINE_IN to "Dine In",
                    ServiceType.TAKEAWAY to "Takeaway"
                ),
                selected = state.serviceFilter,
                onSelect = onType
            )
            FilterChipRow(
                label = "PAYMENT",
                options = listOf(null to "All") + PaymentMethod.entries.map { method ->
                    method to paymentLabel(method)
                },
                selected = state.paymentFilter,
                onSelect = onPayment
            )
        }
    }
}

@Composable
private fun <T> FilterChipRow(
    label: String,
    options: List<Pair<T?, String>>,
    selected: T?,
    onSelect: (T?) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            label,
            fontSize = 10.sp,
            color = TextMuted,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(56.dp)
        )
        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            options.forEach { (value, text) ->
                RecordsTabChip(
                    label = text,
                    selected = selected == value,
                    compact = true,
                    onClick = { onSelect(value) }
                )
            }
        }
    }
}

@Composable
private fun RecordsTabChip(
    label: String,
    selected: Boolean,
    compact: Boolean = false,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(if (compact) 8.dp else 20.dp),
        color = if (selected) Color(0xFF111827) else Color.White,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (selected) Color(0xFF111827) else Color(0xFFE5E7EB)
        )
    ) {
        Text(
            label,
            modifier = Modifier.padding(
                horizontal = if (compact) 8.dp else 14.dp,
                vertical = if (compact) 4.dp else 8.dp
            ),
            color = if (selected) Color.White else TextPrimary,
            fontSize = if (compact) 10.sp else 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun RecordsTableHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(HeaderBg)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HeaderCell("#", 28.dp)
        HeaderCell("ORDER", 88.dp)
        HeaderCell("TIME", 72.dp)
        HeaderCell("TABLE", 100.dp)
        HeaderCell("TYPE", 72.dp)
        HeaderCell("STATUS", 88.dp)
        HeaderCell("SRC", 44.dp)
        HeaderCell("AMOUNT", 80.dp)
        HeaderCell("PAY", 52.dp)
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp) {
    Text(text, modifier = Modifier.width(width), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextMuted)
}

@Composable
private fun RecordsTableRow(
    index: Int,
    order: TransactionEntity,
    tableLabel: String?,
    isSplit: Boolean,
    currencySymbol: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (index % 2 == 0) Color.White else Color(0xFFFAFAFA))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CellText(index.toString(), 28.dp, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.width(88.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                shortOrderId(order.transactionNumber),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isSplit) {
                Spacer(Modifier.width(4.dp))
                StatusPill("SPLIT", Color(0xFFF97316), compact = true)
            }
        }
        CellText(
            SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date(order.createdAt)),
            72.dp,
            color = TextMuted
        )
        CellText(tableLabel ?: "—", 100.dp, color = TextMuted)
        Box(modifier = Modifier.width(72.dp)) {
            StatusPill(orderTypeLabel(order.serviceType), orderTypeColor(order.serviceType))
        }
        Box(modifier = Modifier.width(88.dp)) {
            StatusPill(order.paymentStatus.name.replace('_', ' '), statusColor(order.paymentStatus))
        }
        Box(modifier = Modifier.width(44.dp)) {
            StatusPill("POS", AccentGreen, compact = true)
        }
        CellText(
            formatMoney(order.total, currencySymbol),
            80.dp,
            fontWeight = FontWeight.Bold
        )
        CellText(paymentLabel(order.paymentMethod), 52.dp, color = TextMuted)
    }
}

@Composable
private fun CellText(
    text: String,
    width: Dp,
    color: Color = TextPrimary,
    fontWeight: FontWeight = FontWeight.Normal
) {
    Text(
        text,
        modifier = Modifier.width(width),
        fontSize = 12.sp,
        color = color,
        fontWeight = fontWeight,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
private fun StatusPill(text: String, color: Color, compact: Boolean = false) {
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.35f))
    ) {
        Text(
            text,
            modifier = Modifier.padding(
                horizontal = if (compact) 5.dp else 8.dp,
                vertical = if (compact) 2.dp else 4.dp
            ),
            fontSize = if (compact) 9.sp else 10.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            maxLines = 1
        )
    }
}

private fun shortOrderId(number: String): String =
    number.removePrefix("TX-").takeLast(6).uppercase(Locale.getDefault())

private fun orderTypeLabel(serviceType: ServiceType?): String = when (serviceType) {
    ServiceType.DINE_IN -> "DINE IN"
    ServiceType.TAKEAWAY -> "PICKUP"
    else -> "WALK IN"
}

private fun orderTypeColor(serviceType: ServiceType?): Color = when (serviceType) {
    ServiceType.DINE_IN -> Color(0xFF92400E)
    ServiceType.TAKEAWAY -> Color(0xFF7C3AED)
    else -> Color(0xFF0891B2)
}

private fun statusColor(status: PaymentStatus): Color = when (status) {
    PaymentStatus.COMPLETED -> Color(0xFF059669)
    PaymentStatus.CANCELLED -> Color(0xFFDC2626)
    PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED -> Color(0xFFD97706)
    else -> Color(0xFF6B7280)
}

private fun paymentLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> "Cash"
    PaymentMethod.CARD -> "Card"
    PaymentMethod.ADYEN_TERMINAL -> "Terminal"
    PaymentMethod.TAP_TO_PAY -> "Tap"
    PaymentMethod.PAY_LATER -> "Pay Later"
}

private fun resolveOrderDiscount(order: TransactionEntity): Double {
    if (order.discountAmount > 0.0) return order.discountAmount
    if (order.discountPercent > 0.0) {
        return order.subtotal * (order.discountPercent / 100.0)
    }
    return 0.0
}

@Composable
private fun OrderDetailDialog(
    order: TransactionEntity,
    items: List<com.chaslay.pos.data.local.entity.TransactionItemEntity>,
    splitOrders: List<TransactionEntity>,
    splitItemsByOrderId: Map<String, List<com.chaslay.pos.data.local.entity.TransactionItemEntity>>,
    currencySymbol: String,
    canCancel: Boolean,
    canRefund: Boolean,
    onDismiss: () -> Unit,
    onPrint: () -> Unit,
    onPrintAllSplits: () -> Unit,
    onPrintSplit: (String) -> Unit,
    onCancel: () -> Unit,
    onRefund: () -> Unit
) {
    val isSplit = splitOrders.size > 1
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("#${shortOrderId(order.transactionNumber)}")
                IconButton(onClick = onPrint) {
                    Icon(Icons.Default.Print, contentDescription = stringResource(R.string.print_receipt))
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("Payment: ${order.paymentMethod.name}", fontSize = 12.sp)
                if (isSplit) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Split order (${splitOrders.size} bills)", fontWeight = FontWeight.Bold)
                        TextButton(onClick = onPrintAllSplits) {
                            Text(stringResource(R.string.print_receipt))
                        }
                    }
                    splitOrders.forEachIndexed { index, split ->
                        val splitItems = splitItemsByOrderId[split.id].orEmpty()
                        Surface(
                            color = Color(0xFFF5F5F5),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        split.splitCheckNumber?.let {
                                            stringResource(R.string.split_bill_n, it)
                                        } ?: stringResource(R.string.split_bill_n, index + 1),
                                        fontWeight = FontWeight.Bold
                                    )
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(formatMoney(split.total, currencySymbol), fontWeight = FontWeight.Bold)
                                        IconButton(onClick = { onPrintSplit(split.id) }, modifier = Modifier.size(32.dp)) {
                                            Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                                splitItems.forEach { item ->
                                    Text("${item.quantity}x ${item.productName}")
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Order total: ${formatMoney(splitOrders.sumOf { it.total }, currencySymbol)}",
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    items.forEach { item ->
                        Text("${item.quantity}x ${item.productName} - ${formatMoney(item.lineTotal, currencySymbol)}")
                    }
                    val orderDiscount = resolveOrderDiscount(order)
                    if (orderDiscount > 0.0) {
                        val discountLabel = if (order.discountPercent > 0) {
                            "Discount (${order.discountPercent.toInt()}%)"
                        } else {
                            "Discount"
                        }
                        Text("$discountLabel: -${formatMoney(orderDiscount, currencySymbol)}")
                    }
                    Text("Total: ${formatMoney(order.total, currencySymbol)}", fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (canCancel) {
                    TextButton(onClick = onCancel) { Text(stringResource(R.string.cancel_order)) }
                }
                if (canRefund) {
                    Button(onClick = onRefund) { Text(stringResource(R.string.refund_order)) }
                }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

@Composable
private fun CancelOrderDialog(
    reasons: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var selected by remember { mutableStateOf(reasons.firstOrNull().orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.cancel_order)) },
        text = {
            Column {
                reasons.forEach { reason ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selected = reason }
                    ) {
                        RadioButton(selected = selected == reason, onClick = { selected = reason })
                        Text(reason)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selected) }, enabled = selected.isNotBlank()) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

@Composable
private fun RefundOrderDialog(
    maxAmount: Double,
    currencySymbol: String,
    onDismiss: () -> Unit,
    onConfirm: (Double, Boolean) -> Unit
) {
    var partial by remember { mutableStateOf(false) }
    var amountText by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.refund_order)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = !partial, onClick = { partial = false })
                    Text(stringResource(R.string.refund_full))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = partial, onClick = { partial = true })
                    Text(stringResource(R.string.refund_partial))
                }
                if (partial) {
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amountText = it },
                        label = { Text(formatMoney(maxAmount, currencySymbol)) },
                        singleLine = true
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (partial) {
                    onConfirm(amountText.toDoubleOrNull() ?: 0.0, false)
                } else {
                    onConfirm(maxAmount, true)
                }
            }) { Text(stringResource(R.string.confirm)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
