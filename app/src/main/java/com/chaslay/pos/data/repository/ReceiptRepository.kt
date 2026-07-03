package com.chaslay.pos.data.repository

import android.util.Log
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.remote.ReceiptApi
import com.chaslay.pos.data.remote.dto.ReceiptEmailRequest
import com.chaslay.pos.data.remote.dto.ReceiptItemDto
import com.chaslay.pos.data.remote.dto.ReceiptPublishRequest
import com.chaslay.pos.domain.model.CartSummary
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReceiptRepository @Inject constructor(
    private val receiptApi: ReceiptApi
) {
    fun buildPublicUrl(transactionId: String, settings: BusinessSettingsEntity): String {
        val base = settings.receiptBaseUrl.trim().trimEnd('/')
        return when {
            base.contains("chaslay.com", ignoreCase = true) -> "$base/$transactionId"
            else -> "${BuildConfig.LICENSE_API_BASE_URL.trimEnd('/')}/v1/receipts/$transactionId"
        }
    }

    suspend fun publishReceipt(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity
    ): String {
        val fallbackUrl = transaction.receiptUrl ?: buildPublicUrl(transaction.id, settings)
        val itemDiscountTotal = items.sumOf { it.lineDiscountPerUnit * it.quantity }
        return runCatching {
            val response = receiptApi.publishReceipt(
                buildPublishRequest(transaction, items, settings, itemDiscountTotal)
            )
            response.url?.takeIf { it.isNotBlank() } ?: fallbackUrl
        }.getOrElse { error ->
            Log.w(TAG, "Receipt publish failed, using fallback URL", error)
            fallbackUrl
        }
    }

    suspend fun publishPendingReceipt(
        transactionId: String,
        cart: CartSummary,
        total: Double,
        currency: String,
        settings: BusinessSettingsEntity
    ): String {
        val fallbackUrl = buildPublicUrl(transactionId, settings)
        val txNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() } ?: transactionId.takeLast(8)
        return runCatching {
            val response = receiptApi.publishReceipt(
                ReceiptPublishRequest(
                    id = transactionId,
                    transactionNumber = txNumber,
                    total = total,
                    currency = currency,
                    paymentMethod = "PENDING",
                    businessName = settings.businessName,
                    createdAt = System.currentTimeMillis(),
                    subtotal = cart.subtotal,
                    taxTotal = cart.taxTotal,
                    itemDiscountTotal = cart.itemDiscountTotal,
                    items = cart.items.map { item ->
                        ReceiptItemDto(
                            productName = item.productName,
                            variantName = item.variantName,
                            quantity = item.quantity,
                            lineTotal = item.lineTotal,
                            lineSubtotal = item.lineSubtotal,
                            lineDiscount = item.lineDiscount,
                            unitPrice = item.unitPrice
                        )
                    }
                )
            )
            response.url?.takeIf { it.isNotBlank() } ?: fallbackUrl
        }.getOrElse { error ->
            Log.w(TAG, "Pending receipt publish failed, using fallback URL", error)
            fallbackUrl
        }
    }

    suspend fun sendReceiptEmail(
        receiptId: String,
        email: String,
        customerName: String? = null
    ): Result<String> = runCatching {
        val response = receiptApi.emailReceipt(
            receiptId = receiptId,
            body = ReceiptEmailRequest(email = email.trim(), customerName = customerName?.trim())
        )
        if (response.success) {
            response.message ?: "Receipt sent to $email"
        } else {
            error(response.message ?: "Could not send receipt email")
        }
    }

    private fun buildPublishRequest(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity,
        itemDiscountTotal: Double
    ) = ReceiptPublishRequest(
        id = transaction.id,
        transactionNumber = transaction.transactionNumber,
        total = transaction.total,
        currency = transaction.currencyCode,
        paymentMethod = transaction.paymentMethod.name,
        cardReference = transaction.cardReference,
        businessName = settings.businessName,
        createdAt = transaction.createdAt,
        subtotal = transaction.subtotal,
        taxTotal = transaction.taxTotal,
        discountAmount = transaction.discountAmount,
        itemDiscountTotal = itemDiscountTotal,
        items = items.map { item ->
            ReceiptItemDto(
                productName = item.productName,
                variantName = item.variantName,
                quantity = item.quantity,
                lineTotal = item.lineTotal,
                lineSubtotal = item.lineSubtotal,
                lineDiscount = item.lineDiscountPerUnit * item.quantity,
                unitPrice = item.unitPrice
            )
        }
    )

    companion object {
        private const val TAG = "ReceiptRepository"
    }
}
