package com.foodtruck.pos.data.remote

import com.foodtruck.pos.data.remote.dto.ActivateLicenseRequest
import com.foodtruck.pos.data.remote.dto.ActivateLicenseResponse
import com.foodtruck.pos.data.remote.dto.ValidateLicenseRequest
import com.foodtruck.pos.data.remote.dto.ValidateLicenseResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface LicenseApi {
    @POST("v1/license/activate")
    suspend fun activate(@Body request: ActivateLicenseRequest): ActivateLicenseResponse

    @POST("v1/license/validate")
    suspend fun validate(@Body request: ValidateLicenseRequest): ValidateLicenseResponse
}
