package com.foodtruck.pos.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.data.repository.TransactionRepository
import com.foodtruck.pos.domain.model.DailySalesReport
import com.foodtruck.pos.domain.model.ProductSalesReport
import com.foodtruck.pos.domain.model.UserPerformanceReport
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReportsUiState(
    val dailyReport: DailySalesReport = DailySalesReport(0, 0.0, 0.0, 0.0, 0.0),
    val topProducts: List<ProductSalesReport> = emptyList(),
    val userPerformance: List<UserPerformanceReport> = emptyList()
)

@HiltViewModel
class ReportsViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    val currencySymbol: StateFlow<String> = settingsRepository.observeSettings()
        .map { it.currencySymbol }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "CHF")

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = ReportsUiState(
                dailyReport = transactionRepository.getDailyReport(),
                topProducts = transactionRepository.getTopProducts(),
                userPerformance = transactionRepository.getUserPerformance()
            )
        }
    }
}
