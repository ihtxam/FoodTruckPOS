package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PosLoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class PosLoginResponse(
    @SerializedName("user") val user: PosLoginUserDto
)

data class PosLoginUserDto(
    @SerializedName("id") val id: Long,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String,
    @SerializedName("tenantSlug") val tenantSlug: String?
)
