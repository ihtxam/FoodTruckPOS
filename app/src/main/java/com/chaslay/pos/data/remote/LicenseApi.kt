package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.ActivateLicenseRequest
import com.chaslay.pos.data.remote.dto.ActivateLicenseResponse
import com.chaslay.pos.data.remote.dto.ValidateLicenseRequest
import com.chaslay.pos.data.remote.dto.ValidateLicenseResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface LicenseApi {
    @POST("v1/license/activate")
    suspend fun activate(@Body request: ActivateLicenseRequest): ActivateLicenseResponse

    @POST("v1/license/validate")
    suspend fun validate(@Body request: ValidateLicenseRequest): ValidateLicenseResponse
}
