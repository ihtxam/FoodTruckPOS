package com.foodtruck.pos.ui.reports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodtruck.pos.R
import java.util.Locale

@Composable
fun ReportsScreen(viewModel: ReportsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var tab by remember { mutableIntStateOf(0) }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.daily_sales)) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.product_sales)) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text(stringResource(R.string.user_performance)) })
        }

        when (tab) {
            0 -> DailySalesTab(state, viewModel.currencySymbol.collectAsStateWithLifecycle().value)
            1 -> ProductSalesTab(state.topProducts, viewModel.currencySymbol.collectAsStateWithLifecycle().value)
            2 -> UserPerformanceTab(state.userPerformance, viewModel.currencySymbol.collectAsStateWithLifecycle().value)
        }
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
private fun ProductSalesTab(products: List<com.foodtruck.pos.domain.model.ProductSalesReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products) { product ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(product.productName, fontWeight = FontWeight.SemiBold)
                    Text("Qty: ${product.quantitySold} | ${formatMoney(product.revenue, currency)}")
                }
            }
        }
    }
}

@Composable
private fun UserPerformanceTab(users: List<com.foodtruck.pos.domain.model.UserPerformanceReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(users) { user ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(user.userName, fontWeight = FontWeight.SemiBold)
                    Text("${user.transactionCount} sales | ${formatMoney(user.revenue, currency)}")
                }
            }
        }
    }
}

@Composable
private fun ReportRow(label: String, value: String) {
    Column {
        RowText(label, value)
        HorizontalDivider(modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun RowText(label: String, value: String) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.titleMedium)
        Text(value, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
