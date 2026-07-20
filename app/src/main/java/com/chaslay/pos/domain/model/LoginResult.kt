package com.chaslay.pos.domain.model

import com.chaslay.pos.data.repository.AuthRepository

sealed class LoginResult {
    data class Success(
        val session: AuthRepository.AuthSession,
        val needsPinSetup: Boolean
    ) : LoginResult()

    data class Failure(val message: String) : LoginResult()
}
