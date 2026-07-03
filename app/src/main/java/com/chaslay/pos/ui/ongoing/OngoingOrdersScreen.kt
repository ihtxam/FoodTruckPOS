package com.chaslay.pos.ui.ongoing

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.OngoingOrderCard
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OngoingOrdersScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: OngoingOrdersViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val orders = run {
        val filter = state.filter
        if (filter == null) state.orders else state.orders.filter { it.serviceType == filter }
    }
    val currencySymbol = "CHF"
    val colors = vectronColors()

    LaunchedEffect(Unit) {
        viewModel.refresh()
    }

    val content: @Composable (Modifier) -> Unit = { paddingMod ->
        Column(
            modifier = paddingMod
                .fillMaxSize()
                .background(colors.background)
                .padding(12.dp)
        ) {
            if (state.isLoading) {
                Text(stringResource(R.string.loading), color = colors.textSecondary, modifier = Modifier.padding(8.dp))
            }
            state.errorMessage?.let { msg ->
                Text(msg, color = Color(0xFFC0392B), modifier = Modifier.padding(8.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.filter == null,
                    onClick = { viewModel.setFilter(null) },
                    label = { Text(stringResource(R.string.all)) }
                )
                FilterChip(
                    selected = state.filter == ServiceType.TAKEAWAY,
                    onClick = { viewModel.setFilter(ServiceType.TAKEAWAY) },
                    label = { Text(stringResource(R.string.take_away_delivery)) }
                )
                FilterChip(
                    selected = state.filter == ServiceType.DINE_IN,
                    onClick = { viewModel.setFilter(ServiceType.DINE_IN) },
                    label = { Text(stringResource(R.string.dine_in)) }
                )
            }

            if (orders.isEmpty() && !state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.no_ongoing_orders), color = colors.textSecondary)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 180.dp),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 12.dp),
                    contentPadding = PaddingValues(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(orders, key = { "${it.source}-${it.id}" }) { order ->
                        OngoingOrderCardView(
                            order = order,
                            currencySymbol = currencySymbol,
                            onClick = { viewModel.resumeOrder(order, onBack) },
                            onPrint = { viewModel.printReceiptForOrder(order) },
                            onSendKitchen = { viewModel.sendKitchenForOrder(order) }
                        )
                    }
                }
            }
        }
    }

    if (embedded) {
        content(Modifier.fillMaxSize())
    } else {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.ongoing_orders)) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    }
                )
            }
        ) { padding ->
            content(Modifier.padding(padding))
        }
    }
}

@Composable
private fun OngoingOrderCardView(
    order: OngoingOrderCard,
    currencySymbol: String,
    onClick: () -> Unit,
    onPrint: () -> Unit,
    onSendKitchen: () -> Unit
) {
    val headerColor = when (order.fulfillmentType) {
        FulfillmentType.DELIVERY -> Color(0xFFE67E22)
        FulfillmentType.PICKUP -> Color(0xFF0288D1)
        FulfillmentType.DINE_IN -> Color(0xFF2E7D32)
        FulfillmentType.WALK_IN -> when (order.serviceType) {
            ServiceType.DINE_IN -> Color(0xFF2E7D32)
            ServiceType.TAKEAWAY -> Color(0xFF0288D1)
        }
    }
    val typeLabel = when (order.fulfillmentType) {
        FulfillmentType.PICKUP -> stringResource(R.string.pickup)
        FulfillmentType.DELIVERY -> stringResource(R.string.delivery)
        else -> order.serviceType.displayName
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(188.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF2A2A2A))
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(headerColor)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(typeLabel, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text("#${order.orderNumber}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = formatMoney(order.total, currencySymbol),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
                Text(
                    order.statusLabel,
                    color = Color(0xFFF1C40F),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    order.tableName ?: typeLabel,
                    color = Color(0xFFAAAAAA),
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("${order.itemCount} items", color = Color(0xFFAAAAAA), fontSize = 11.sp)
                    Text(
                        formatElapsed(order.updatedAt),
                        color = Color(0xFFE74C3C),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1F1F1F))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OngoingActionIcon(Icons.Default.Print, onPrint)
                OngoingActionIcon(Icons.Default.Restaurant, onSendKitchen)
            }
        }
    }
}

@Composable
private fun OngoingActionIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF3A3A3A)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        }
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatElapsed(updatedAt: Long): String {
    val minutes = ((System.currentTimeMillis() - updatedAt) / 60_000).toInt().coerceAtLeast(0)
    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes} min"
        else -> "${minutes / 60}h ${minutes % 60}m"
    }
}
