package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.AckResponse
import com.chaslay.pos.data.remote.dto.IncomingOrdersResponse
import com.chaslay.pos.data.remote.dto.MenuBootstrapResponse
import com.chaslay.pos.data.remote.dto.MenuChangesResponse
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface SyncApi {
    @GET("v1/sync/bootstrap")
    suspend fun bootstrap(): MenuBootstrapResponse

    @GET("v1/sync/menu")
    suspend fun menuChanges(@Query("since") since: Long): MenuChangesResponse

    @GET("v1/orders/incoming")
    suspend fun incomingOrders(@Query("since") since: Long): IncomingOrdersResponse

    @POST("v1/orders/{id}/ack")
    suspend fun ackOrder(@Path("id") id: String): AckResponse
}
