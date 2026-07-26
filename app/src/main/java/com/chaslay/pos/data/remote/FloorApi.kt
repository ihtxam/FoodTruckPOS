package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.FloorAckRequest
import com.chaslay.pos.data.remote.dto.FloorAckResponse
import com.chaslay.pos.data.remote.dto.FloorOrderUpsertRequest
import com.chaslay.pos.data.remote.dto.FloorOrdersResponse
import com.chaslay.pos.data.remote.dto.FloorPendingPrintJobsResponse
import com.chaslay.pos.data.remote.dto.FloorPrintJobRequest
import com.chaslay.pos.data.remote.dto.FloorPrintJobResponse
import com.chaslay.pos.data.remote.dto.FloorMainPosResponse
import com.chaslay.pos.data.remote.dto.FloorRegisterRequest
import com.chaslay.pos.data.remote.dto.FloorRegisterResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface FloorApi {
    @POST("v1/floor/register")
    suspend fun register(@Body body: FloorRegisterRequest): FloorRegisterResponse

    @GET("v1/floor/main-pos")
    suspend fun getMainPos(): FloorMainPosResponse

    @GET("v1/floor/orders")
    suspend fun orders(@Query("since") since: Long): FloorOrdersResponse

    @PUT("v1/floor/orders/{localOrderId}")
    suspend fun upsertOrder(
        @Path("localOrderId") localOrderId: String,
        @Body body: FloorOrderUpsertRequest
    ): FloorRegisterResponse

    @POST("v1/floor/print-jobs")
    suspend fun createPrintJob(@Body body: FloorPrintJobRequest): FloorPrintJobResponse

    @GET("v1/floor/print-jobs/pending")
    suspend fun pendingPrintJobs(@Query("limit") limit: Int = 20): FloorPendingPrintJobsResponse

    @POST("v1/floor/print-jobs/{id}/ack")
    suspend fun ackPrintJob(
        @Path("id") id: String,
        @Body body: FloorAckRequest = FloorAckRequest()
    ): FloorAckResponse
}
