package com.chaslay.pos.ui.pos

import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.receipt.ReceiptQrGenerator
import java.util.Locale

@Composable
fun OrderCompleteDialog(
    transaction: TransactionEntity,
    currencySymbol: String,
    splitPaymentIndex: Int? = null,
    splitPaymentTotal: Int? = null,
    successMessage: String? = null,
    receiptPublicUrl: String? = null,
    orderCompleteNotice: String? = null,
    onPrintReceipt: () -> Unit,
    onShareEmail: () -> Unit = {},
    onDone: () -> Unit
) {
    val digitalUrl = receiptPublicUrl?.takeIf { it.isNotBlank() }
        ?: transaction.receiptUrl?.takeIf { it.isNotBlank() }
    val qrGenerator = remember { ReceiptQrGenerator() }
    val qrBitmap = remember(digitalUrl) {
        digitalUrl?.let { qrGenerator.generateQrBitmap(it, 256) }
    }

    Dialog(
        onDismissRequest = onDone,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.58f)
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
                if (splitPaymentIndex != null && splitPaymentTotal != null) {
                    Text(
                        "Payment $splitPaymentIndex of $splitPaymentTotal",
                        fontSize = 16.sp,
                        color = Color(0xFF16A085),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
                Text(
                    successMessage ?: stringResource(R.string.payment_success),
                    fontSize = 14.sp,
                    color = Color(0xFF22C55E),
                    modifier = Modifier.padding(top = 4.dp),
                    textAlign = TextAlign.Center
                )

                orderCompleteNotice?.let { notice ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = if (notice.contains("printed", ignoreCase = true) || notice.contains("sent", ignoreCase = true)) {
                            Color(0xFFECFDF5)
                        } else {
                            Color(0xFFFEF2F2)
                        }
                    ) {
                        Text(
                            notice,
                            modifier = Modifier.padding(12.dp),
                            fontSize = 13.sp,
                            color = if (notice.contains("printed", ignoreCase = true) || notice.contains("sent", ignoreCase = true)) {
                                Color(0xFF166534)
                            } else {
                                Color(0xFFB91C1C)
                            },
                            textAlign = TextAlign.Center
                        )
                    }
                }

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

                if (digitalUrl != null) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFF8FAFC)
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    stringResource(R.string.scan_digital_receipt),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    textAlign = TextAlign.Center
                                )
                                qrBitmap?.let { bitmap ->
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Image(
                                        bitmap = bitmap.asImageBitmap(),
                                        contentDescription = stringResource(R.string.digital_receipt),
                                        modifier = Modifier.size(140.dp)
                                    )
                                }
                            }
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                OutlinedButton(
                                    onClick = onPrintReceipt,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(stringResource(R.string.print_receipt), fontSize = 13.sp)
                                }
                                OutlinedButton(
                                    onClick = onShareEmail,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(stringResource(R.string.email_receipt), fontSize = 13.sp)
                                }
                            }
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedButton(
                        onClick = onPrintReceipt,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Print, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(stringResource(R.string.print_receipt))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
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

@Composable
fun ReceiptEmailDialog(
    isSending: Boolean,
    errorMessage: String? = null,
    onDismiss: () -> Unit,
    onSend: (email: String) -> Unit
) {
    var email by remember { mutableStateOf("") }

    Dialog(onDismissRequest = { if (!isSending) onDismiss() }) {
        Card(shape = RoundedCornerShape(20.dp)) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    stringResource(R.string.email_receipt_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    stringResource(R.string.email_receipt_hint),
                    fontSize = 13.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.trim() },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.customer_email)) },
                    singleLine = true,
                    enabled = !isSending,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Email
                    )
                )
                errorMessage?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = Color(0xFFB91C1C), fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSending) {
                        Text(stringResource(R.string.cancel))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSend(email) },
                        enabled = !isSending && email.contains("@") && email.contains(".")
                    ) {
                        Text(if (isSending) stringResource(R.string.sending) else stringResource(R.string.send))
                    }
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
    PaymentMethod.PAY_LATER -> "Pay Later"
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
