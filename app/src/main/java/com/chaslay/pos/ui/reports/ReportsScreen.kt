package com.chaslay.pos.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.formatMoneyAmount
import com.chaslay.pos.domain.model.EndOfDayReport
import java.util.Locale

@Composable
fun ReportsScreen(viewModel: ReportsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val currency by viewModel.currencySymbol.collectAsStateWithLifecycle()
    var tab by remember { mutableIntStateOf(0) }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.end_of_day)) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.sales_report)) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text(stringResource(R.string.product_sales)) })
            Tab(selected = tab == 3, onClick = { tab = 3 }, text = { Text(stringResource(R.string.user_performance)) })
        }

        when (tab) {
            0 -> EndOfDayTab(state.endOfDayReport, currency, viewModel::printEndOfDayReport)
            1 -> SalesReportV5Screen(
                state = state,
                currencySymbol = currency,
                onRangeSelected = viewModel::selectRange,
                onRefresh = viewModel::refresh,
                onPrint = viewModel::printSalesReport,
                modifier = Modifier.weight(1f)
            )
            2 -> ProductSalesTab(state.topProducts, currency)
            3 -> UserPerformanceTab(state.userPerformance, currency)
        }
    }
}

@Composable
private fun SalesReportTab(
    state: ReportsUiState,
    currency: String,
    onRangeSelected: (ReportRange) -> Unit,
    onPrintReport: () -> Unit
) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.sales_report), fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Button(onClick = onPrintReport) {
                Text(stringResource(R.string.print_report))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                ReportRange.TODAY to stringResource(R.string.today),
                ReportRange.YESTERDAY to stringResource(R.string.yesterday),
                ReportRange.LAST_WEEK to stringResource(R.string.last_week),
                ReportRange.LAST_MONTH to stringResource(R.string.last_month)
            ).forEach { (range, label) ->
                FilterChip(
                    selected = state.selectedRange == range,
                    onClick = { onRangeSelected(range) },
                    label = { Text(label) }
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.gross_sales), formatMoney(state.salesReport.grossSales, currency), Color(0xFF27AE60), Modifier.weight(1f))
            KpiCard(stringResource(R.string.net_sales), formatMoney(state.salesReport.netSales, currency), Color(0xFF16A085), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.average_ticket), formatMoney(state.salesReport.averageTicket, currency), Color(0xFF3498DB), Modifier.weight(1f))
            KpiCard(stringResource(R.string.transactions), state.salesReport.orderCount.toString(), Color(0xFF8E44AD), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.cancelled_orders), "${state.salesReport.cancelledCount} · ${formatMoney(state.salesReport.cancelledTotal, currency)}", Color(0xFFE74C3C), Modifier.weight(1f))
            KpiCard(stringResource(R.string.total_tips), formatMoney(state.salesReport.totalTips, currency), Color(0xFFE67E22), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.tax), formatMoney(state.salesReport.taxTotal, currency), Color(0xFF9B59B6), Modifier.weight(1f))
            Spacer(Modifier.weight(1f))
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("PAYMENT DISTRIBUTION", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                PaymentBar(stringResource(R.string.cash), state.salesReport.cashTotal, state.salesReport.grossSales, Color(0xFFE67E22), currency)
                PaymentBar(stringResource(R.string.card), state.salesReport.cardTotal, state.salesReport.grossSales, Color(0xFF27AE60), currency)
                ReportRow(stringResource(R.string.tax), formatMoney(state.salesReport.taxTotal, currency))
                ReportRow(
                    stringResource(R.string.dine_in_vat_rate),
                    "${state.salesReport.dineInVatRate}% · ${state.salesReport.dineInCount} · ${formatMoney(state.salesReport.dineInTotal, currency)}"
                )
                ReportRow(
                    stringResource(R.string.takeaway_vat_rate),
                    "${state.salesReport.takeawayVatRate}% · ${state.salesReport.takeawayCount} · ${formatMoney(state.salesReport.takeawayTotal, currency)}"
                )
            }
        }
    }
}

@Composable
private fun KpiCard(title: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .height(40.dp)
                    .padding(end = 10.dp)
                    .fillMaxWidth(0.02f)
                    .background(accent, RoundedCornerShape(2.dp))
            )
            Column {
                Text(title, fontSize = 11.sp, color = Color.Gray)
                Text(value, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
        }
    }
}

@Composable
private fun PaymentBar(label: String, amount: Double, total: Double, color: Color, currency: String) {
    val fraction = if (total <= 0) 0f else (amount / total).toFloat().coerceIn(0f, 1f)
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label)
            Text(formatMoney(amount, currency))
        }
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction)
                .height(8.dp)
                .background(color, RoundedCornerShape(4.dp))
        )
    }
}

@Composable
private fun DailySalesTab(state: ReportsUiState, currency: String) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ReportRow(stringResource(R.string.transactions), state.dailyReport.salesCount.toString())
        ReportRow(stringResource(R.string.today_sales), formatMoney(state.dailyReport.revenue, currency))
        ReportRow(stringResource(R.string.tax), formatMoney(state.dailyReport.tax, currency))
        ReportRow(stringResource(R.string.cash_revenue), formatMoney(state.dailyReport.cashTotal, currency))
        ReportRow(stringResource(R.string.card_revenue), formatMoney(state.dailyReport.cardTotal, currency))
    }
}

@Composable
private fun EndOfDayTab(report: EndOfDayReport, currency: String, onPrint: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.end_of_day), fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Button(onClick = onPrint) {
                Text(stringResource(R.string.print_end_of_day))
            }
        }
        Text("SALES SUMMARY", fontWeight = FontWeight.Bold)
        report.vatRows.forEach { row ->
            ReportRow(
                row.label,
                "Net ${formatMoney(row.net, currency)} · TVA ${formatMoney(row.tva, currency)} · Brut ${formatMoney(row.brut, currency)}"
            )
        }
        ReportRow("Net total", formatMoney(report.netTotal, currency))
        ReportRow("TVA total", formatMoney(report.taxTotal, currency))
        ReportRow("TOTAL", formatMoney(report.brutTotal, currency))
        if (report.tipsTotal > 0.0) {
            ReportRow("Tips (not taxable)", formatMoney(report.tipsTotal, currency))
            ReportRow("Grand total", formatMoney(report.grandTotal, currency))
        }
        ReportRow(stringResource(R.string.transactions), report.salesCount.toString())

        Spacer(modifier = Modifier.height(4.dp))
        Text("PAYMENT METHODS", fontWeight = FontWeight.Bold)
        report.paymentRows.forEach { row ->
            ReportRow(row.label, "${"%.1f".format(row.percent)}% · ${formatMoney(row.amount, currency)}")
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text("ORDER TYPES", fontWeight = FontWeight.Bold)
        report.orderTypeRows.forEach { row ->
            ReportRow(row.label, "${row.count} · ${"%.1f".format(row.percent)}% · ${formatMoney(row.amount, currency)}")
        }

        if (report.productsSold.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(stringResource(R.string.products_sold).uppercase(), fontWeight = FontWeight.Bold)
            ReportRow(
                stringResource(R.string.total_products_sold),
                report.productsSold.sumOf { it.quantitySold }.toString()
            )
            report.productsSold.forEach { product ->
                ReportRow(product.productName, product.quantitySold.toString())
            }
        }
    }
}

@Composable
private fun ProductSalesTab(products: List<com.chaslay.pos.domain.model.ProductSalesReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products) { product ->
            ReportRow(product.productName, "${product.quantitySold} · ${formatMoney(product.revenue, currency)}")
        }
    }
}

@Composable
private fun UserPerformanceTab(users: List<com.chaslay.pos.domain.model.UserPerformanceReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(users) { user ->
            ReportRow(user.userName, "${user.transactionCount} · ${formatMoney(user.revenue, currency)}")
        }
    }
}

@Composable
private fun ReportRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Text(value, fontWeight = FontWeight.SemiBold)
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
}

private fun formatMoney(amount: Double, symbol: String): String = formatMoneyAmount(amount, symbol)
