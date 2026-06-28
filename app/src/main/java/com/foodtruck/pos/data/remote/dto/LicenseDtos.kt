package com.foodtruck.pos.data.remote.dto

data class ActivateLicenseRequest(
    val deviceId: String,
    val activationCode: String,
    val appVersion: String,
    val deviceModel: String? = null,
    val tenantSlug: String? = null
)

data class ActivateLicenseResponse(
    val status: String,
    val expiresAt: Long,
    val customerName: String? = null,
    val planLabel: String? = null
)

data class ValidateLicenseRequest(
    val deviceId: String,
    val appVersion: String,
    val tenantSlug: String? = null
)

data class ValidateLicenseResponse(
    val status: String,
    val expiresAt: Long,
    val customerName: String? = null,
    val planLabel: String? = null
)
