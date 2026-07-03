package com.chaslay.pos.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import java.util.Locale

@Composable
fun DashboardScreen(
    onBackToPos: () -> Unit = {},
    onOpenReports: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val stats by viewModel.stats.collectAsStateWithLifecycle()
    val currency = viewModel.currencySymbol.collectAsStateWithLifecycle().value

    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Text("MAIN STATION", color = Color(0xFF27AE60), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(
            text = stringResource(R.string.tactical_dashboard),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = stringResource(R.string.tactical_dashboard_subtitle),
            color = Color.Gray,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 4.dp, bottom = 16.dp)
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MiniStat(stringResource(R.string.today_sales), formatMoney(stats.todaySales, currency), Color(0xFF27AE60), Modifier.weight(1f))
            MiniStat(stringResource(R.string.transactions), stats.transactionCount.toString(), Color(0xFF3498DB), Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(16.dp))

        val modules = listOf(
            DashboardModule("MODULE 01", stringResource(R.string.point_of_sale), "Direct terminal transaction entry.", Icons.Default.PointOfSale, listOf(Color(0xFF8E44AD), Color(0xFFE91E63)), onBackToPos),
            DashboardModule("MODULE 02", stringResource(R.string.nav_reports), "Sales analytics and reconciliation.", Icons.Default.BarChart, listOf(Color(0xFF3498DB), Color(0xFF5DADE2)), onOpenReports),
            DashboardModule("MODULE 03", stringResource(R.string.nav_settings), "Printers, payments, and hardware.", Icons.Default.Settings, listOf(Color(0xFF16A085), Color(0xFF1ABC9C)), onOpenSettings),
            DashboardModule("MODULE 04", stringResource(R.string.printer_settings), "Assign receipt, kitchen, and report jobs.", Icons.Default.Print, listOf(Color(0xFFE67E22), Color(0xFFF39C12)), onOpenSettings),
            DashboardModule("MODULE 05", stringResource(R.string.nav_products), "Categories, products, and modifiers.", Icons.Default.Restaurant, listOf(Color(0xFF2ECC71), Color(0xFF58D68D)), onOpenSettings)
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(modules) { module ->
                ModuleCard(module)
            }
        }
    }
}

private data class DashboardModule(
    val id: String,
    val title: String,
    val description: String,
    val icon: ImageVector,
    val gradient: List<Color>,
    val onClick: () -> Unit
)

@Composable
private fun ModuleCard(module: DashboardModule) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp)
            .clickable(onClick = module.onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Icon(module.icon, contentDescription = null, tint = module.gradient.first(), modifier = Modifier.size(28.dp))
                Text(module.id, fontSize = 10.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(module.title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(module.description, fontSize = 11.sp, color = Color.Gray, modifier = Modifier.padding(top = 4.dp))
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(Brush.horizontalGradient(module.gradient), RoundedCornerShape(2.dp))
            )
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(label, fontSize = 11.sp, color = Color.Gray)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = accent)
        }
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
