package com.foodtruck.pos.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.data.repository.TransactionRepository
import com.foodtruck.pos.domain.model.DailySalesReport
import com.foodtruck.pos.domain.model.EndOfDayReport
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.ProductSalesReport
import com.foodtruck.pos.domain.model.ServiceType
import com.foodtruck.pos.domain.model.UserPerformanceReport
import com.foodtruck.pos.printer.BluetoothPrinterService
import com.foodtruck.pos.domain.model.roundMoney
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class ReportRange { TODAY, YESTERDAY, LAST_WEEK, LAST_MONTH }

data class SalesReportSnapshot(
    val grossSales: Double = 0.0,
    val netSales: Double = 0.0,
    val averageTicket: Double = 0.0,
    val orderCount: Int = 0,
    val cancelledCount: Int = 0,
    val cancelledTotal: Double = 0.0,
    val totalTips: Double = 0.0,
    val cashTotal: Double = 0.0,
    val cardTotal: Double = 0.0,
    val taxTotal: Double = 0.0,
    val dineInVatRate: Double = 8.1,
    val takeawayVatRate: Double = 2.6,
    val dineInTotal: Double = 0.0,
    val dineInCount: Int = 0,
    val takeawayTotal: Double = 0.0,
    val takeawayCount: Int = 0
)

data class ReportsUiState(
    val dailyReport: DailySalesReport = DailySalesReport(0, 0.0, 0.0, 0.0, 0.0),
    val salesReport: SalesReportSnapshot = SalesReportSnapshot(),
    val selectedRange: ReportRange = ReportRange.TODAY,
    val endOfDayReport: EndOfDayReport = EndOfDayReport(
        salesCount = 0,
        revenue = 0.0,
        taxTotal = 0.0,
        cashTotal = 0.0,
        cardTotal = 0.0,
        tapToPayTotal = 0.0,
        adyenTotal = 0.0,
        dineInTotal = 0.0,
        dineInCount = 0,
        takeawayTotal = 0.0,
        takeawayCount = 0
    ),
    val topProducts: List<ProductSalesReport> = emptyList(),
    val userPerformance: List<UserPerformanceReport> = emptyList(),
    val message: String? = null
)

@HiltViewModel
class ReportsViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val settingsRepository: SettingsRepository,
    private val printerService: BluetoothPrinterService
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
            val range = _uiState.value.selectedRange
            val (start, end) = rangeBounds(range)
            val settings = settingsRepository.getSettings()
            val transactions = transactionRepository.getTransactionsBetween(start, end)
            val completed = transactions.filter { it.paymentStatus == PaymentStatus.COMPLETED }
            val cancelled = transactions.filter { it.paymentStatus == PaymentStatus.CANCELLED }
            // Tips are not taxable and not part of sales: gross excludes tips (matches end-of-day brut).
            fun brutOf(tx: com.foodtruck.pos.data.local.entity.TransactionEntity) =
                (tx.total - tx.tipAmount).coerceAtLeast(0.0)
            val grossSales = roundMoney(completed.sumOf { brutOf(it) })
            val cancelledTotal = roundMoney(cancelled.sumOf { brutOf(it) })
            val taxTotal = roundMoney(completed.sumOf { it.taxTotal })
            val salesReport = SalesReportSnapshot(
                grossSales = grossSales,
                netSales = roundMoney(grossSales - taxTotal),
                averageTicket = if (completed.isEmpty()) 0.0 else roundMoney(grossSales / completed.size),
                orderCount = completed.size,
                cancelledCount = cancelled.size,
                cancelledTotal = cancelledTotal,
                totalTips = roundMoney(completed.sumOf { it.tipAmount }),
                cashTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf { it.total }),
                cardTotal = roundMoney(completed.filter { it.paymentMethod != PaymentMethod.CASH }.sumOf { it.total }),
                taxTotal = taxTotal,
                dineInVatRate = settings.dineInVatRate,
                takeawayVatRate = settings.takeawayVatRate,
                dineInTotal = roundMoney(completed.filter { it.serviceType == ServiceType.DINE_IN }.sumOf { brutOf(it) }),
                dineInCount = completed.count { it.serviceType == ServiceType.DINE_IN },
                takeawayTotal = roundMoney(completed.filter { it.serviceType == ServiceType.TAKEAWAY }.sumOf { brutOf(it) }),
                takeawayCount = completed.count { it.serviceType == ServiceType.TAKEAWAY }
            )
            _uiState.value = ReportsUiState(
                dailyReport = transactionRepository.getDailyReport(),
                salesReport = salesReport,
                selectedRange = range,
                endOfDayReport = transactionRepository.getEndOfDayReport(start, end),
                topProducts = transactionRepository.getTopProducts(),
                userPerformance = transactionRepository.getUserPerformance()
            )
        }
    }

    private fun rangeBounds(range: ReportRange): Pair<Long, Long> {
        val startCal = java.util.Calendar.getInstance()
        val endCal = java.util.Calendar.getInstance()
        when (range) {
            ReportRange.TODAY -> Unit
            ReportRange.YESTERDAY -> {
                startCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
                endCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            }
            ReportRange.LAST_WEEK -> startCal.add(java.util.Calendar.DAY_OF_YEAR, -7)
            ReportRange.LAST_MONTH -> startCal.add(java.util.Calendar.MONTH, -1)
        }
        return dayStart(startCal) to dayEnd(endCal)
    }

    private fun dayStart(calendar: java.util.Calendar): Long {
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 0)
        calendar.set(java.util.Calendar.MINUTE, 0)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)
        return calendar.timeInMillis
    }

    private fun dayEnd(calendar: java.util.Calendar): Long {
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 23)
        calendar.set(java.util.Calendar.MINUTE, 59)
        calendar.set(java.util.Calendar.SECOND, 59)
        calendar.set(java.util.Calendar.MILLISECOND, 999)
        return calendar.timeInMillis
    }

    fun selectRange(range: ReportRange) {
        _uiState.update { it.copy(selectedRange = range) }
        refresh()
    }

    fun printEndOfDayReport() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val report = _uiState.value.endOfDayReport
            val printError = reportPrintGuard(settings)
            if (printError != null) {
                _uiState.update { it.copy(message = printError) }
                return@launch
            }
            withContext(Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report)
            }.onSuccess { _uiState.update { it.copy(message = "End of day report printed") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message) } }
        }
    }

    fun printSalesReport() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val printError = reportPrintGuard(settings)
            if (printError != null) {
                _uiState.update { it.copy(message = printError) }
                return@launch
            }
            val report = _uiState.value.endOfDayReport
            withContext(Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report)
            }.onSuccess { _uiState.update { it.copy(message = "Sales report printed") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message) } }
        }
    }

    private suspend fun reportPrintGuard(settings: com.foodtruck.pos.data.local.entity.BusinessSettingsEntity): String? {
        if (!settings.printerPrintReports) return "Enable report printing in Settings"
        return null
    }
}
