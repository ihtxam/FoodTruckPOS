package com.chaslay.pos.ui.demo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.R
import com.chaslay.pos.data.local.LocalSalesPurgeService
import com.chaslay.pos.data.preferences.DemoModePreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DemoModeUiState(
    val showGoLiveConfirm: Boolean = false,
    val isPurging: Boolean = false,
    val snackbarMessageRes: Int? = null
)

@HiltViewModel
class DemoModeViewModel @Inject constructor(
    private val demoModePreferences: DemoModePreferences,
    private val localSalesPurgeService: LocalSalesPurgeService
) : ViewModel() {

    val isDemoMode: StateFlow<Boolean> = demoModePreferences.isDemoMode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DemoModePreferences.DEFAULT_DEMO_MODE)

    private val _uiState = MutableStateFlow(DemoModeUiState())
    val uiState: StateFlow<DemoModeUiState> = _uiState.asStateFlow()

    fun requestGoLive() {
        _uiState.update { it.copy(showGoLiveConfirm = true) }
    }

    fun dismissGoLiveConfirm() {
        _uiState.update { it.copy(showGoLiveConfirm = false) }
    }

    fun confirmGoLive() {
        if (_uiState.value.isPurging) return
        viewModelScope.launch {
            _uiState.update { it.copy(isPurging = true, showGoLiveConfirm = false) }
            runCatching {
                localSalesPurgeService.purgeAllSalesData()
                demoModePreferences.setDemoMode(false)
            }.onSuccess {
                _uiState.update {
                    it.copy(
                        isPurging = false,
                        snackbarMessageRes = R.string.demo_go_live_success
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isPurging = false,
                        snackbarMessageRes = R.string.demo_go_live_failed
                    )
                }
                error.printStackTrace()
            }
        }
    }

    fun clearSnackbar() {
        _uiState.update { it.copy(snackbarMessageRes = null) }
    }
}
