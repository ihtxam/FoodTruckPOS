package com.foodtruck.pos.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.data.repository.TransactionRepository
import com.foodtruck.pos.domain.model.DashboardStats
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    settingsRepository: SettingsRepository
) : ViewModel() {

    private val _stats = MutableStateFlow(DashboardStats(0.0, 0, 0.0, 0.0))
    val stats: StateFlow<DashboardStats> = _stats

    val currencySymbol: StateFlow<String> = settingsRepository.observeSettings()
        .map { it.currencySymbol }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "CHF")

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _stats.value = transactionRepository.getDashboardStats()
        }
    }
}
