package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PosLoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class PosLoginResponse(
    @SerializedName("user") val user: PosLoginUserDto,
    @SerializedName("syncApiKey") val syncApiKey: String? = null,
    @SerializedName("merchantId") val merchantId: String? = null,
    /** JWT for merchant dashboard WebView (same as panel login). */
    @SerializedName("dashboardToken") val dashboardToken: String? = null,
    @SerializedName("dashboardUser") val dashboardUser: PosDashboardUserDto? = null,
    @SerializedName("dashboardUrl") val dashboardUrl: String? = null
)

data class PosLoginUserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String,
    @SerializedName("tenantSlug") val tenantSlug: String?
)

data class PosDashboardUserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String,
    @SerializedName("merchantId") val merchantId: String? = null,
    @SerializedName("isOwner") val isOwner: Boolean? = true
)
