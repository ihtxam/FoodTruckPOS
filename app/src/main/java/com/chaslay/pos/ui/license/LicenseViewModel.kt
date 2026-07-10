package com.chaslay.pos.ui.license

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.repository.LicenseRepository
import com.chaslay.pos.domain.model.LicenseUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class LicenseViewModel @Inject constructor(
    private val licenseRepository: LicenseRepository
) : ViewModel() {

    val licenseState: StateFlow<LicenseUiState> = licenseRepository.uiState
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), LicenseUiState())

    private val _formState = MutableStateFlow(LicenseUiState())
    val formState: StateFlow<LicenseUiState> = _formState.asStateFlow()

    init {
        viewModelScope.launch {
            licenseRepository.ensureInitialized()
        }
        viewModelScope.launch {
            licenseRepository.uiState.collect { state ->
                _formState.update { it.copy(
                    gateState = state.gateState,
                    snapshot = state.snapshot,
                    trialDaysRemaining = state.trialDaysRemaining,
                    daysUntilExpiry = state.daysUntilExpiry,
                    showRenewalWarning = state.showRenewalWarning
                ) }
            }
        }
    }

    fun updateActivationCode(code: String) {
        _formState.update { it.copy(activationCode = code, errorMessage = null) }
    }

    fun activate() {
        val code = _formState.value.activationCode
        viewModelScope.launch {
            _formState.update { it.copy(isActivating = true, errorMessage = null) }
            licenseRepository.activate(code)
                .onSuccess {
                    _formState.update { it.copy(isActivating = false, activationCode = "", errorMessage = null) }
                }
                .onFailure { e ->
                    _formState.update {
                        it.copy(
                            isActivating = false,
                            errorMessage = e.message ?: "Activation failed. Check internet and code."
                        )
                    }
                }
        }
    }

    fun clearError() {
        _formState.update { it.copy(errorMessage = null) }
    }
}
