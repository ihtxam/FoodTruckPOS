package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.PosLoginRequest
import com.chaslay.pos.data.remote.dto.PosLoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface PosAuthApi {
    @POST("v1/pos/auth/login")
    suspend fun login(@Body request: PosLoginRequest): Response<PosLoginResponse>
}
