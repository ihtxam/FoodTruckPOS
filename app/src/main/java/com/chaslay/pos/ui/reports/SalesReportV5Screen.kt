package com.chaslay.pos.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AttachMoney
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
import kotlin.math.roundToInt

private object DashColors {
    val SurfaceDeep = Color(0xFFF7F7F7)
    val SurfaceDeeper = Color(0xFFFFFFFF)
    val HairlineLight = Color(0x1A000000)
    val HairlineSoft = Color(0x0F000000)
    val Accent = Color(0xFF13A99A)
    val OnAccent = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF121826)
    val TextSecondary = Color(0xFF556377)
    val TextMuted = Color(0xFF8896A8)
    val Success = Color(0xFF1F8F55)
    val Warning = Color(0xFFB8862F)
    val Danger = Color(0xFFD64545)
    val Info = Color(0xFF3477D1)
}

private val MonoFont = FontFamily.Monospace

private enum class SalesRange(val label: String) {
    Today("TODAY"),
    Yesterday("YESTERDAY"),
    LastWeek("LAST WEEK"),
    LastMonth("LAST MONTH"),
    Last3Months("LAST 3 MONTHS"),
}

private data class BreakdownRow(val label: String, val count: Int, val total: Double)
private data class TaxRow(val orderTypeLabel: String, val rate: Double, val net: Double, val tax: Double, val gross: Double)
private data class TopProduct(val name: String, val category: String?, val qty: Int, val revenue: Double)

private data class SalesReportData(
    val totalSales: Double,
    val completedOrders: Int,
    val averageOrderValue: Double,
    val totalTips: Double,
    val totalDiscount: Double,
    val totalRefunded: Double,
    val paymentRows: List<BreakdownRow>,
    val orderTypeRows: List<BreakdownRow>,
    val orderSourceRows: List<BreakdownRow>,
    val taxRows: List<TaxRow>,
    val topProducts: List<TopProduct>,
)

private fun dummyReport(range: SalesRange): SalesReportData = when (range) {
    SalesRange.Today -> SalesReportData(
        totalSales = 2148.60,
        completedOrders = 47,
        averageOrderValue = 45.72,
        totalTips = 128.40,
        totalDiscount = 42.10,
        totalRefunded = 18.50,
        paymentRows = listOf(
            BreakdownRow("Cash", 21, 892.30),
            BreakdownRow("Card", 22, 1156.80),
            BreakdownRow("TWINT", 4, 99.50),
        ),
        orderTypeRows = listOf(
            BreakdownRow("Takeaway", 28, 1128.40),
            BreakdownRow("Dine-in", 14, 812.20),
            BreakdownRow("Delivery", 5, 208.00),
        ),
        orderSourceRows = listOf(
            BreakdownRow("In-store", 40, 1876.10),
            BreakdownRow("Online shop", 7, 272.50),
        ),
        taxRows = listOf(
            TaxRow("Takeaway", 2.6, 1099.80, 28.60, 1128.40),
            TaxRow("Dine-in", 8.1, 751.32, 60.88, 812.20),
            TaxRow("Delivery", 2.6, 202.72, 5.28, 208.00),
        ),
        topProducts = listOf(
            TopProduct("Sushi Saumon", "Sushi", 42, 336.00),
            TopProduct("Tulipe Saumon", "Signature Roll", 28, 224.00),
            TopProduct("Sushi Thon", "Sushi", 21, 168.00),
            TopProduct("Sushi Ebi Crevette", "Sushi", 18, 144.00),
            TopProduct("Bao Poulet", "Bao & Yakitori", 15, 90.00),
        ),
    )
    SalesRange.Yesterday -> SalesReportData(
        totalSales = 1893.20,
        completedOrders = 41,
        averageOrderValue = 46.18,
        totalTips = 101.10,
        totalDiscount = 28.00,
        totalRefunded = 0.0,
        paymentRows = listOf(
            BreakdownRow("Cash", 19, 780.20),
            BreakdownRow("Card", 20, 998.00),
            BreakdownRow("TWINT", 2, 115.00),
        ),
        orderTypeRows = listOf(
            BreakdownRow("Takeaway", 25, 1042.10),
            BreakdownRow("Dine-in", 12, 640.90),
            BreakdownRow("Delivery", 4, 210.20),
        ),
        orderSourceRows = listOf(
            BreakdownRow("In-store", 36, 1720.10),
            BreakdownRow("Online shop", 5, 173.10),
        ),
        taxRows = listOf(
            TaxRow("Takeaway", 2.6, 1015.68, 26.42, 1042.10),
            TaxRow("Dine-in", 8.1, 592.87, 48.03, 640.90),
        ),
        topProducts = listOf(
            TopProduct("Sushi Saumon", "Sushi", 38, 304.00),
            TopProduct("Sushi Thon", "Sushi", 22, 176.00),
            TopProduct("Tulipe Cheese", "Signature Roll", 14, 112.00),
        ),
    )
    SalesRange.LastWeek -> SalesReportData(
        totalSales = 14380.90,
        completedOrders = 312,
        averageOrderValue = 46.09,
        totalTips = 682.30,
        totalDiscount = 218.00,
        totalRefunded = 82.20,
        paymentRows = listOf(
            BreakdownRow("Cash", 148, 6180.20),
            BreakdownRow("Card", 145, 7532.10),
            BreakdownRow("TWINT", 19, 668.60),
        ),
        orderTypeRows = listOf(
            BreakdownRow("Takeaway", 198, 8410.20),
            BreakdownRow("Dine-in", 88, 4820.30),
            BreakdownRow("Delivery", 26, 1150.40),
        ),
        orderSourceRows = listOf(
            BreakdownRow("In-store", 265, 12240.30),
            BreakdownRow("Online shop", 47, 2140.60),
        ),
        taxRows = listOf(
            TaxRow("Takeaway", 2.6, 8197.55, 212.65, 8410.20),
            TaxRow("Dine-in", 8.1, 4459.35, 360.95, 4820.30),
            TaxRow("Delivery", 2.6, 1121.28, 29.12, 1150.40),
        ),
        topProducts = listOf(
            TopProduct("Sushi Saumon", "Sushi", 280, 2240.00),
            TopProduct("Sushi Thon", "Sushi", 165, 1320.00),
            TopProduct("Tulipe Saumon", "Signature Roll", 142, 1136.00),
            TopProduct("Sushi Ebi Crevette", "Sushi", 118, 944.00),
        ),
    )
    SalesRange.LastMonth -> SalesReportData(
        totalSales = 58720.40,
        completedOrders = 1284,
        averageOrderValue = 45.73,
        totalTips = 2841.10,
        totalDiscount = 942.30,
        totalRefunded = 218.50,
        paymentRows = listOf(
            BreakdownRow("Cash", 612, 25120.10),
            BreakdownRow("Card", 592, 30840.50),
            BreakdownRow("TWINT", 80, 2759.80),
        ),
        orderTypeRows = listOf(
            BreakdownRow("Takeaway", 820, 34410.20),
            BreakdownRow("Dine-in", 356, 19680.60),
            BreakdownRow("Delivery", 108, 4629.60),
        ),
        orderSourceRows = listOf(
            BreakdownRow("In-store", 1091, 50120.10),
            BreakdownRow("Online shop", 193, 8600.30),
        ),
        taxRows = listOf(
            TaxRow("Takeaway", 2.6, 33538.55, 871.65, 34410.20),
            TaxRow("Dine-in", 8.1, 18208.86, 1471.74, 19680.60),
        ),
        topProducts = listOf(
            TopProduct("Sushi Saumon", "Sushi", 1120, 8960.00),
            TopProduct("Sushi Thon", "Sushi", 680, 5440.00),
        ),
    )
    SalesRange.Last3Months -> SalesReportData(
        totalSales = 178320.80,
        completedOrders = 3912,
        averageOrderValue = 45.58,
        totalTips = 8540.20,
        totalDiscount = 2820.10,
        totalRefunded = 684.90,
        paymentRows = listOf(
            BreakdownRow("Cash", 1860, 76210.30),
            BreakdownRow("Card", 1810, 93520.10),
            BreakdownRow("TWINT", 242, 8590.40),
        ),
        orderTypeRows = listOf(
            BreakdownRow("Takeaway", 2510, 104210.60),
            BreakdownRow("Dine-in", 1080, 59810.20),
            BreakdownRow("Delivery", 322, 14300.00),
        ),
        orderSourceRows = listOf(
            BreakdownRow("In-store", 3320, 152410.20),
            BreakdownRow("Online shop", 592, 25910.60),
        ),
        taxRows = listOf(
            TaxRow("Takeaway", 2.6, 101569.71, 2640.89, 104210.60),
        ),
        topProducts = listOf(
            TopProduct("Sushi Saumon", "Sushi", 3410, 27280.00),
        ),
    )
}

@Composable
fun SalesReportV5Screen(modifier: Modifier = Modifier) {
    var range by remember { mutableStateOf(SalesRange.Today) }
    val report = remember(range) { dummyReport(range) }
    val currencySymbol = "CHF"

    Column(modifier = modifier.fillMaxSize()) {
        Header(
            currentRange = range,
            onSelectRange = { range = it },
        )
        Body(report = report, sym = currencySymbol)
    }
}

@Composable
private fun Header(
    currentRange: SalesRange,
    onSelectRange: (SalesRange) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Sales Report",
            color = DashColors.TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Spacer(Modifier.size(20.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.weight(1f),
        ) {
            SalesRange.entries.forEach { r ->
                val active = r == currentRange
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (active) DashColors.Accent else DashColors.SurfaceDeeper)
                        .border(
                            1.dp,
                            if (active) DashColors.Accent else DashColors.HairlineLight,
                            RoundedCornerShape(10.dp),
                        )
                        .clickable { onSelectRange(r) }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Text(
                        r.label,
                        color = if (active) DashColors.OnAccent else DashColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(DashColors.Accent)
                .clickable { }
                .padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Print, contentDescription = null, tint = DashColors.OnAccent, modifier = Modifier.size(15.dp))
            Spacer(Modifier.size(6.dp))
            Text(
                "PRINT",
                color = DashColors.OnAccent,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.3.sp,
            )
        }
        Spacer(Modifier.size(8.dp))
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(DashColors.SurfaceDeeper)
                .clickable { },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Refresh, contentDescription = null, tint = DashColors.TextSecondary, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun Body(report: SalesReportData, sym: String) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { KpiGrid(report = report, sym = sym) }
        item {
            BreakdownCard(
                title = "Payment Breakdown",
                icon = Icons.Outlined.CreditCard,
                accent = DashColors.Info,
                rows = report.paymentRows,
                sym = sym,
            )
        }
        item {
            BreakdownCard(
                title = "Order Type",
                icon = Icons.Outlined.PointOfSale,
                accent = DashColors.Success,
                rows = report.orderTypeRows,
                sym = sym,
            )
        }
        if (report.orderSourceRows.isNotEmpty()) {
            item {
                BreakdownCard(
                    title = "Order Source",
                    icon = Icons.Outlined.TrendingUp,
                    accent = DashColors.Warning,
                    rows = report.orderSourceRows,
                    sym = sym,
                )
            }
        }
        if (report.taxRows.isNotEmpty()) {
            item { TaxBreakdownCard(rows = report.taxRows, sym = sym) }
        }
        if (report.topProducts.isNotEmpty()) {
            item {
                Text(
                    "Top Products",
                    color = DashColors.TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            items(report.topProducts) { TopProductRow(item = it, sym = sym) }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun KpiGrid(report: SalesReportData, sym: String) {
    val netSales = report.totalSales - report.totalRefunded
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = DashColors.Success,
                label = "TOTAL SALES",
                value = money(sym, report.totalSales),
            )
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.Receipt,
                accent = DashColors.Info,
                label = "ORDERS",
                value = report.completedOrders.toString(),
            )
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.TrendingUp,
                accent = DashColors.Accent,
                label = "AVG TICKET",
                value = money(sym, report.averageOrderValue),
            )
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.CardGiftcard,
                accent = DashColors.Warning,
                label = "TIPS",
                value = money(sym, report.totalTips),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.LocalOffer,
                accent = DashColors.Warning,
                label = "DISCOUNTS",
                value = money(sym, report.totalDiscount),
                muted = report.totalDiscount == 0.0,
            )
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.LocalOffer,
                accent = DashColors.Danger,
                label = "REFUNDS",
                value = money(sym, report.totalRefunded),
                muted = report.totalRefunded == 0.0,
            )
            KpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = DashColors.Success,
                label = "NET SALES",
                value = money(sym, netSales),
            )
        }
    }
}

@Composable
private fun KpiCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    accent: Color,
    label: String,
    value: String,
    muted: Boolean = false,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(DashColors.SurfaceDeeper)
            .border(1.dp, DashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(16.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(accent.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.size(10.dp))
        Text(
            label,
            color = DashColors.TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
        )
        Spacer(Modifier.size(4.dp))
        Text(
            value,
            color = if (muted) DashColors.TextMuted else DashColors.TextPrimary,
            fontSize = 19.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = MonoFont,
        )
    }
}

@Composable
private fun BreakdownCard(
    title: String,
    icon: ImageVector,
    accent: Color,
    rows: List<BreakdownRow>,
    sym: String,
) {
    val total = rows.sumOf { it.total }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DashColors.SurfaceDeeper)
            .border(1.dp, DashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(title, color = DashColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        if (rows.isEmpty()) {
            Text("No data", color = DashColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        } else {
            rows.forEach { row ->
                val pct = if (total > 0.0) (row.total / total * 100.0) else 0.0
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        row.label,
                        color = DashColors.TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${"%.1f".format(Locale.US, pct)}%",
                        color = accent,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Spacer(Modifier.size(10.dp))
                    Text(
                        "${row.count}×",
                        color = DashColors.TextSecondary,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = MonoFont,
                    )
                    Spacer(Modifier.size(10.dp))
                    Text(
                        money(sym, row.total),
                        color = DashColors.TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = MonoFont,
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(DashColors.HairlineSoft),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (pct / 100.0).coerceIn(0.0, 1.0).toFloat())
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(accent),
                    )
                }
                Spacer(Modifier.size(4.dp))
            }
            Spacer(Modifier.size(4.dp))
            HairlineDivider()
            Spacer(Modifier.size(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "TOTAL",
                    color = DashColors.TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    money(sym, total),
                    color = DashColors.TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = MonoFont,
                )
            }
        }
    }
}

@Composable
private fun TaxBreakdownCard(rows: List<TaxRow>, sym: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(DashColors.SurfaceDeeper)
            .border(1.dp, DashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = DashColors.Info, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text("Tax Breakdown", color = DashColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Text("TYPE", color = DashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1.4f))
            Text("NET", color = DashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("TAX", color = DashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("GROSS", color = DashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.size(8.dp))
        rows.forEach { r ->
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1.4f)) {
                    Text(r.orderTypeLabel, color = DashColors.TextPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold)
                    Text("${"%.1f".format(Locale.US, r.rate)}%", color = DashColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(money(sym, r.net), color = DashColors.TextPrimary, fontSize = 12.5.sp, fontFamily = MonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(money(sym, r.tax), color = DashColors.Info, fontSize = 12.5.sp, fontFamily = MonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(money(sym, r.gross), color = DashColors.TextPrimary, fontSize = 12.5.sp, fontFamily = MonoFont, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun TopProductRow(item: TopProduct, sym: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(DashColors.SurfaceDeeper)
            .border(1.dp, DashColors.HairlineLight, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.name, color = DashColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
            item.category?.let {
                Text(it, color = DashColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Text("${item.qty}×", color = DashColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = MonoFont)
        Spacer(Modifier.size(16.dp))
        Text(money(sym, item.revenue), color = DashColors.Success, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = MonoFont)
    }
}

@Composable
private fun HairlineDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(DashColors.HairlineSoft),
    )
}

private fun money(sym: String, value: Double): String =
    "$sym ${"%.2f".format(Locale.US, value)}"

@Suppress("unused")
private fun Int.orderMagnitude(): Int = when {
    this <= 0 -> 0
    else -> Math.log10(this.toDouble()).roundToInt()
}
