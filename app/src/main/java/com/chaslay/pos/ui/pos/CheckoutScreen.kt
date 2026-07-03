package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocalAtm
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.applyCashRounding
import java.util.Locale
import kotlin.math.ceil

data class CheckoutState(
    val method: PaymentMethod = PaymentMethod.CASH,
    val tipAmount: Double = 0.0,
    val tipPercent: Double = 0.0,
    val discountPercent: Double = 0.0,
    val roundingStep: Double = 0.05,
    val tenderAmount: Double = 0.0,
    val printReceipt: Boolean = false,
    val showTipPanel: Boolean = false,
    val showDiscountPanel: Boolean = false
)

@Composable
fun CheckoutScreen(
    cart: CartSummary,
    currencySymbol: String,
    discountPresets: List<DiscountPreset>,
    checkoutState: CheckoutState,
    isProcessing: Boolean,
    splitBillIndex: Int? = null,
    splitBillCount: Int? = null,
    isEqualSplit: Boolean = false,
    equalSplitPaidCount: Int = 0,
    onBack: () -> Unit,
    onSelectMethod: (PaymentMethod) -> Unit,
    onTipAmount: (Double) -> Unit,
    onTipPercent: (Double) -> Unit,
    onDiscountPercent: (Double) -> Unit,
    onRoundingStep: (Double) -> Unit,
    onToggleTipPanel: () -> Unit,
    onToggleDiscountPanel: () -> Unit,
    onSplitClick: () -> Unit,
    onOpenCashDrawer: () -> Unit,
    onPrintReceipt: () -> Unit = {},
    onQuickCash: (Double) -> Unit,
    onComplete: () -> Unit,
    onPrevSplitBill: () -> Unit = {},
    onNextSplitBill: () -> Unit = {},
    onScanBarcode: () -> Unit = {}
) {
    val equalSplitCount = if (isEqualSplit) splitBillCount ?: 1 else 1
    val totals = rememberCheckoutTotals(cart, checkoutState, equalSplitCount)
    val vc = vectronColors()
    val showSplitNav = splitBillIndex != null && splitBillCount != null && splitBillCount > 1

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(vc.background)
    ) {
        Column(
            modifier = Modifier
                .weight(1.15f)
                .fillMaxHeight()
                .background(vc.panelDark)
                .padding(20.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(onClick = onBack, shape = RoundedCornerShape(20.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.checkout_back), color = vc.textPrimary)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CheckoutCircleAction(
                        icon = Icons.Default.QrCodeScanner,
                        onClick = onScanBarcode,
                        accent = vc.cardBlue
                    )
                    CheckoutCircleAction(
                        icon = Icons.Default.Print,
                        onClick = onPrintReceipt,
                        accent = vc.textPrimary
                    )
                    CheckoutCircleAction(
                        icon = Icons.Default.LocalAtm,
                        onClick = onOpenCashDrawer,
                        accent = vc.cardBlue
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text(stringResource(R.string.checkout_title), fontSize = 28.sp, fontWeight = FontWeight.Bold, color = vc.textPrimary)
            if (showSplitNav) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = onPrevSplitBill,
                        enabled = splitBillIndex!! > 1,
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text(stringResource(R.string.prev_bill), color = vc.textPrimary, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            stringResource(R.string.bill_x_of_y, splitBillIndex, splitBillCount!!),
                            fontWeight = FontWeight.Bold,
                            color = vc.textPrimary,
                            fontSize = 16.sp
                        )
                        if (isEqualSplit && equalSplitPaidCount > 0) {
                            Text(
                                stringResource(R.string.bills_paid_count, equalSplitPaidCount, splitBillCount),
                                fontSize = 11.sp,
                                color = vc.textSecondary
                            )
                        }
                    }
                    OutlinedButton(
                        onClick = onNextSplitBill,
                        enabled = splitBillIndex < splitBillCount,
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text(stringResource(R.string.next_bill), color = vc.textPrimary, fontSize = 12.sp)
                    }
                }
            }
            Text(stringResource(R.string.payment), fontSize = 12.sp, color = vc.textSecondary)

            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PaymentMethodCard(
                    title = stringResource(R.string.cash),
                    subtitle = "Manual processing",
                    icon = Icons.Default.AttachMoney,
                    selected = checkoutState.method == PaymentMethod.CASH,
                    accent = Color(0xFF22C55E),
                    onClick = { onSelectMethod(PaymentMethod.CASH) },
                    modifier = Modifier.weight(1f)
                )
                PaymentMethodCard(
                    title = stringResource(R.string.card),
                    subtitle = "Credit & Debit",
                    icon = Icons.Default.CreditCard,
                    selected = checkoutState.method == PaymentMethod.CARD,
                    accent = Color(0xFF3B82F6),
                    onClick = { onSelectMethod(PaymentMethod.CARD) },
                    modifier = Modifier.weight(1f)
                )
                PaymentMethodCard(
                    title = "Terminal",
                    subtitle = "Terminal Required",
                    icon = Icons.Default.LocalAtm,
                    selected = checkoutState.method == PaymentMethod.ADYEN_TERMINAL,
                    accent = Color(0xFF8B5CF6),
                    onClick = { onSelectMethod(PaymentMethod.ADYEN_TERMINAL) },
                    modifier = Modifier.weight(1f)
                )
            }

            if (cart.pickupTimeMs != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PaymentMethodCard(
                        title = stringResource(R.string.pay_later),
                        subtitle = stringResource(R.string.pay_later_subtitle),
                        icon = Icons.Default.Schedule,
                        selected = checkoutState.method == PaymentMethod.PAY_LATER,
                        accent = Color(0xFFF59E0B),
                        onClick = { onSelectMethod(PaymentMethod.PAY_LATER) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text("ROUNDING", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0.0 to "None", 0.05 to "0.05", 0.10 to "0.10", 0.50 to "0.50", 1.0 to "1.00").forEach { (step, label) ->
                    FilterChip(
                        selected = checkoutState.roundingStep == step,
                        onClick = { onRoundingStep(step) },
                        label = { Text(label) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text("QUICK CASH", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                buildQuickCashAmounts(totals.roundedTotal, currencySymbol).forEach { amount ->
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(24.dp))
                            .clickable { onQuickCash(amount) },
                        color = Color.White,
                        shadowElevation = 1.dp
                    ) {
                        Text(
                            formatMoney(amount, currencySymbol),
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            if (checkoutState.showTipPanel) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("TIP", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    listOf(0.0, 5.0, 10.0, 15.0).forEach { pct ->
                        FilterChip(
                            selected = checkoutState.tipPercent == pct,
                            onClick = {
                                onTipPercent(pct)
                                onTipAmount(totals.preTipTotal * (pct / 100.0))
                            },
                            label = { Text(if (pct == 0.0) "None" else "${pct.toInt()}%") }
                        )
                    }
                }
            }

            if (checkoutState.showDiscountPanel) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("DISCOUNT", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    FilterChip(
                        selected = checkoutState.discountPercent == 0.0,
                        onClick = { onDiscountPercent(0.0) },
                        label = { Text("None") }
                    )
                    discountPresets.forEach { preset ->
                        FilterChip(
                            selected = checkoutState.discountPercent == preset.percent,
                            onClick = { onDiscountPercent(preset.percent) },
                            label = { Text("${preset.name} ${preset.percent.toInt()}%") }
                        )
                    }
                }
            }
        }

        Card(
            modifier = Modifier
                .width(360.dp)
                .fillMaxHeight()
                .padding(12.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = vc.panelDark),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                ) {
                    Text("ACTIVE ORDER", color = VectronColors.CashGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text("${cart.items.size} ${stringResource(R.string.quantity)}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = vc.textPrimary)
                    Spacer(modifier = Modifier.height(12.dp))
                    cart.items.forEach { item ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "${item.quantity}x ${item.productName}",
                                    fontSize = 14.sp
                                )
                                item.variantName?.let {
                                    Text(it, fontSize = 11.sp, color = Color.Gray)
                                }
                                if (item.lineDiscount > 0) {
                                    Text(
                                        "-${formatMoney(item.lineDiscount, currencySymbol)}",
                                        fontSize = 11.sp,
                                        color = Color(0xFFE67E22)
                                    )
                                }
                            }
                            Text(formatMoney(item.lineSubtotal, currencySymbol), fontSize = 14.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    SummaryLine("Subtotal", formatMoney(cart.subtotal, currencySymbol))
                    if (cart.itemDiscountTotal > 0) {
                        SummaryLine(
                            stringResource(R.string.item_discounts),
                            "-${formatMoney(cart.itemDiscountTotal, currencySymbol)}"
                        )
                    }
                    val taxShare = if (equalSplitCount > 1) cart.taxTotal / equalSplitCount else cart.taxTotal
                    SummaryLine(stringResource(R.string.tax), formatMoney(taxShare, currencySymbol))
                    if (totals.cartDiscount > 0) SummaryLine("Discount", "-${formatMoney(totals.cartDiscount, currencySymbol)}")
                    if (checkoutState.tipAmount > 0) SummaryLine("Tip", formatMoney(checkoutState.tipAmount, currencySymbol))
                    if (totals.roundingAdj != 0.0) SummaryLine("Rounding", formatMoney(totals.roundingAdj, currencySymbol))
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("TOTAL DUE", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(
                            formatMoney(totals.roundedTotal, currencySymbol),
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CheckoutActionIcon(
                            icon = Icons.Default.Sell,
                            selected = checkoutState.showDiscountPanel,
                            onClick = onToggleDiscountPanel,
                            modifier = Modifier.weight(1f)
                        )
                        CheckoutActionIcon(
                            icon = Icons.Default.Payments,
                            selected = checkoutState.showTipPanel,
                            onClick = onToggleTipPanel,
                            modifier = Modifier.weight(1f)
                        )
                        CheckoutActionIcon(
                            icon = Icons.AutoMirrored.Filled.CallSplit,
                            selected = false,
                            onClick = onSplitClick,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Button(
                        onClick = onComplete,
                        enabled = !isProcessing && cart.items.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                    ) {
                        Text(stringResource(R.string.checkout_complete), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun CheckoutCircleAction(
    icon: ImageVector,
    selected: Boolean = false,
    onClick: () -> Unit,
    accent: Color = VectronColors.CardBlue
) {
    val bg = if (selected) accent.copy(alpha = 0.15f) else Color.Transparent
    val tint = if (selected) accent else Color.Gray
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(bg)
            .border(1.dp, if (selected) Color(0xFF22C55E) else Color(0xFFE5E7EB), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun CheckoutActionIcon(
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .height(56.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) Color(0xFFEFF6FF) else Color(0xFFF8FAFC),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (selected) Color(0xFF3B82F6) else Color(0xFFE5E7EB)
        )
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Icon(icon, contentDescription = null, tint = if (selected) Color(0xFF2563EB) else Color(0xFF64748B))
        }
    }
}

@Composable
private fun PaymentMethodCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(132.dp)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) accent else Color(0xFFE5E7EB),
                shape = RoundedCornerShape(16.dp)
            )
            .background(Color.White, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        if (selected) {
            Surface(
                modifier = Modifier.align(Alignment.TopEnd),
                shape = RoundedCornerShape(8.dp),
                color = accent
            ) {
                Text(
                    "SELECTED",
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
        Column(modifier = Modifier.align(Alignment.CenterStart)) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(28.dp))
            Spacer(modifier = Modifier.height(10.dp))
            Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(subtitle, fontSize = 12.sp, color = Color.Gray)
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = Color.Gray)
        Text(value, fontSize = 13.sp)
    }
}

private data class CheckoutTotals(
    val subtotal: Double,
    val itemDiscountTotal: Double,
    val cartDiscount: Double,
    val preTipTotal: Double,
    val roundedTotal: Double,
    val roundingAdj: Double
)

@Composable
private fun rememberCheckoutTotals(
    cart: CartSummary,
    checkoutState: CheckoutState,
    equalSplitCount: Int = 1
): CheckoutTotals {
    val netSubtotal = cart.subtotal - cart.itemDiscountTotal
    val cartDiscount = if (checkoutState.discountPercent > 0) {
        netSubtotal * (checkoutState.discountPercent / 100.0)
    } else cart.discountValue
    val preTipTotal = (netSubtotal + cart.taxTotal - cartDiscount).coerceAtLeast(0.0)
    val shareTotal = if (equalSplitCount > 1) preTipTotal / equalSplitCount else preTipTotal
    val roundedTotal = applyCashRounding(shareTotal + checkoutState.tipAmount, checkoutState.roundingStep)
    val roundingAdj = roundedTotal - (shareTotal + checkoutState.tipAmount)
    return CheckoutTotals(netSubtotal, cart.itemDiscountTotal, cartDiscount, preTipTotal, roundedTotal, roundingAdj)
}

private fun buildQuickCashAmounts(total: Double, currencySymbol: String): List<Double> {
    val rounded5 = if (total <= 0) 0.0 else ceil(total / 0.05) * 0.05
    val rounded1 = if (total <= 0) 0.0 else ceil(total)
    return listOf(total, rounded5, rounded1, rounded1 + 10.0).distinct().filter { it > 0 }.take(4)
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
