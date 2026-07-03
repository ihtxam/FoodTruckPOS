package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.ReceiptEmailRequest
import com.chaslay.pos.data.remote.dto.ReceiptEmailResponse
import com.chaslay.pos.data.remote.dto.ReceiptPublishRequest
import com.chaslay.pos.data.remote.dto.ReceiptPublishResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

interface ReceiptApi {
    @POST("v1/receipts")
    suspend fun publishReceipt(@Body body: ReceiptPublishRequest): ReceiptPublishResponse

    @POST("v1/receipts/{id}/email")
    suspend fun emailReceipt(
        @Path("id") receiptId: String,
        @Body body: ReceiptEmailRequest
    ): ReceiptEmailResponse
}
