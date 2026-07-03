package com.chaslay.pos.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoggedIn: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun loginWithPin(pin: String) {
        viewModelScope.launch {
            val session = authRepository.loginWithPin(pin)
            if (session != null) {
                val access = authRepository.toUserAccess(session)
                sessionManager.saveSession(session.user.id, session.user.name, access)
                _uiState.update { it.copy(isLoggedIn = true, errorMessage = null) }
            } else {
                _uiState.update { it.copy(errorMessage = "Invalid PIN") }
            }
        }
    }

    fun loginWithEmail(email: String, password: String) {
        viewModelScope.launch {
            val session = authRepository.loginWithEmail(email.trim(), password)
            if (session != null) {
                val access = authRepository.toUserAccess(session)
                sessionManager.saveSession(session.user.id, session.user.name, access)
                _uiState.update { it.copy(isLoggedIn = true, errorMessage = null) }
            } else {
                _uiState.update { it.copy(errorMessage = "Invalid credentials") }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.clearSession()
            _uiState.update { AuthUiState() }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
