package com.chaslay.pos.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.AuthRepository
import com.chaslay.pos.domain.model.LoginResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoggedIn: Boolean = false,
    val errorMessage: String? = null,
    val pinSetupUserName: String? = null,
    val pinSetupStep: PinSetupStep = PinSetupStep.ENTER,
    val pinSetupLength: Int = 0
)

enum class PinSetupStep { ENTER, CONFIRM }

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private var pendingSession: AuthRepository.AuthSession? = null
    private var pinSetupBuffer: String = ""
    private var pinSetupFirst: String = ""

    fun loginWithPin(pin: String) {
        viewModelScope.launch {
            val session = authRepository.loginWithPin(pin)
            if (session != null) {
                finishLogin(session)
            } else {
                _uiState.update { it.copy(errorMessage = "Invalid PIN") }
            }
        }
    }

    fun loginWithEmail(email: String, password: String) {
        viewModelScope.launch {
            when (val result = authRepository.loginWithEmail(email.trim(), password)) {
                is LoginResult.Success -> {
                    if (result.needsPinSetup) {
                        pendingSession = result.session
                        resetPinSetupBuffers()
                        _uiState.update {
                            it.copy(
                                errorMessage = null,
                                pinSetupUserName = result.session.user.name,
                                pinSetupStep = PinSetupStep.ENTER,
                                pinSetupLength = 0
                            )
                        }
                    } else {
                        finishLogin(result.session)
                    }
                }
                is LoginResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.message) }
                }
            }
        }
    }

    fun onPinSetupDigit(digit: String) {
        if (_uiState.value.pinSetupUserName == null || pinSetupBuffer.length >= 4) return
        pinSetupBuffer += digit
        _uiState.update { it.copy(pinSetupLength = pinSetupBuffer.length, errorMessage = null) }
        if (pinSetupBuffer.length < 4) return

        when (_uiState.value.pinSetupStep) {
            PinSetupStep.ENTER -> {
                pinSetupFirst = pinSetupBuffer
                pinSetupBuffer = ""
                _uiState.update {
                    it.copy(pinSetupStep = PinSetupStep.CONFIRM, pinSetupLength = 0)
                }
            }
            PinSetupStep.CONFIRM -> {
                if (pinSetupBuffer != pinSetupFirst) {
                    pinSetupFirst = ""
                    pinSetupBuffer = ""
                    _uiState.update {
                        it.copy(
                            errorMessage = "PINs do not match. Try again.",
                            pinSetupStep = PinSetupStep.ENTER,
                            pinSetupLength = 0
                        )
                    }
                } else {
                    savePinAndLogin(pinSetupBuffer)
                }
            }
        }
    }

    fun onPinSetupBackspace() {
        if (pinSetupBuffer.isNotEmpty()) {
            pinSetupBuffer = pinSetupBuffer.dropLast(1)
            _uiState.update { it.copy(pinSetupLength = pinSetupBuffer.length, errorMessage = null) }
        }
    }

    fun onPinSetupClear() {
        resetPinSetupBuffers()
        _uiState.update {
            it.copy(
                errorMessage = null,
                pinSetupStep = PinSetupStep.ENTER,
                pinSetupLength = 0
            )
        }
    }

    fun cancelPinSetup() {
        pendingSession = null
        resetPinSetupBuffers()
        _uiState.update {
            it.copy(
                pinSetupUserName = null,
                pinSetupStep = PinSetupStep.ENTER,
                pinSetupLength = 0,
                errorMessage = null
            )
        }
    }

    private fun savePinAndLogin(pin: String) {
        val session = pendingSession ?: return
        viewModelScope.launch {
            authRepository.resetUserPin(session.user.id, pin)
            pendingSession = null
            resetPinSetupBuffers()
            finishLogin(session)
        }
    }

    private fun resetPinSetupBuffers() {
        pinSetupBuffer = ""
        pinSetupFirst = ""
    }

    private suspend fun finishLogin(session: AuthRepository.AuthSession) {
        val access = authRepository.toUserAccess(session)
        sessionManager.saveSession(session.user.id, session.user.name, access)
        _uiState.update { AuthUiState(isLoggedIn = true) }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.clearSession()
            pendingSession = null
            resetPinSetupBuffers()
            _uiState.update { AuthUiState() }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
