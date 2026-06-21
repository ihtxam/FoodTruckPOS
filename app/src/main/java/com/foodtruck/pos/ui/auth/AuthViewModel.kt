package com.foodtruck.pos.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.data.repository.AuthRepository
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
            val user = authRepository.loginWithPin(pin)
            if (user != null) {
                sessionManager.saveSession(user.id, user.name, user.role.name)
                _uiState.update { it.copy(isLoggedIn = true, errorMessage = null) }
            } else {
                _uiState.update { it.copy(errorMessage = "Invalid PIN") }
            }
        }
    }

    fun loginWithEmail(email: String, password: String) {
        viewModelScope.launch {
            val user = authRepository.loginWithEmail(email.trim(), password)
            if (user != null) {
                sessionManager.saveSession(user.id, user.name, user.role.name)
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
}
