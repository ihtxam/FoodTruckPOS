package com.foodtruck.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.foodtruck.pos.R
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.domain.model.PaymentMethod
import java.util.Locale

@Composable
fun OrderCompleteDialog(
    transaction: TransactionEntity,
    currencySymbol: String,
    onPrintReceipt: () -> Unit,
    onDone: () -> Unit
) {
    Dialog(
        onDismissRequest = onDone,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.55f)
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(Color(0xFF22C55E), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Order Complete", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(20.dp))

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFFF8FAFC)
                ) {
                    Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("TOTAL PAID", fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                        Text(
                            formatMoney(transaction.total, currencySymbol),
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                        transaction.changeDue?.takeIf { it > 0 }?.let { change ->
                            Text(
                                "Change: ${formatMoney(change, currencySymbol)}",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF16A085)
                            )
                        }
                        transaction.amountTendered?.takeIf { it > 0 }?.let { tender ->
                            Text(
                                "Tendered: ${formatMoney(tender, currencySymbol)}",
                                fontSize = 13.sp,
                                color = Color.Gray
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Receipt, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                                Column(modifier = Modifier.padding(start = 8.dp)) {
                                    Text("Order", fontSize = 11.sp, color = Color.Gray)
                                    Text("#${transaction.transactionNumber.takeLast(6).uppercase()}", fontWeight = FontWeight.SemiBold)
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                                Column(modifier = Modifier.padding(start = 8.dp)) {
                                    Text("Payment", fontSize = 11.sp, color = Color.Gray)
                                    Text(paymentLabel(transaction.paymentMethod), fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                OutlinedButton(
                    onClick = onPrintReceipt,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.Print, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.print_receipt))
                }
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = onDone,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
                ) {
                    Text("Done", fontWeight = FontWeight.Bold)
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
}

private fun paymentLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> "Cash"
    PaymentMethod.CARD -> "Card"
    PaymentMethod.TAP_TO_PAY -> "Tap-to-Pay"
    PaymentMethod.ADYEN_TERMINAL -> "Terminal"
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
