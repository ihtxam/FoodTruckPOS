package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.DiscountPresetDao
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.DiscountPresetEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.PaymentConfigResponse
import com.chaslay.pos.data.remote.dto.PushTerminalItemDto
import com.chaslay.pos.data.remote.dto.PushTerminalsRequest
import com.chaslay.pos.data.remote.dto.SyncCheckoutDto
import com.chaslay.pos.data.repository.SettingsRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class TerminalSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val settingsRepository: SettingsRepository,
    private val discountPresetDao: DiscountPresetDao,
    private val syncApiKeyStore: SyncApiKeyStore
) {
    suspend fun syncTerminals(): TerminalSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext TerminalSyncResult(skipped = true)
        }
        val pulled = runCatching { pullFromServer() }.getOrElse {
            return@withContext TerminalSyncResult(error = it.message)
        }
        val pushed = runCatching { pushLocalToServer() }.getOrElse {
            return@withContext TerminalSyncResult(pulled = pulled, error = it.message)
        }
        TerminalSyncResult(pulled = pulled, pushed = pushed)
    }

    suspend fun pushLocalTerminalOnly(): TerminalSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext TerminalSyncResult(skipped = true)
        }
        val pushed = runCatching { pushLocalToServer() }.getOrElse {
            return@withContext TerminalSyncResult(error = it.message)
        }
        TerminalSyncResult(pushed = pushed)
    }

    private suspend fun pullFromServer(): Boolean {
        val config = syncApi.paymentConfig()
        val current = settingsRepository.getSettings()
        val merged = mergePaymentConfig(current, config)
        var changed = merged != current
        if (merged != current) {
            settingsRepository.saveSettings(merged)
        }
        config.checkout?.let { checkout ->
            if (mergeDiscountPresets(checkout)) changed = true
        }
        return changed
    }

    private suspend fun mergeDiscountPresets(checkout: SyncCheckoutDto): Boolean {
        val presets = checkout.discountPresets
            .filter { !it.name.isNullOrBlank() || it.percent > 0 }
            .take(20)
        if (presets.isEmpty()) return false
        discountPresetDao.deactivateAll()
        discountPresetDao.insertAll(
            presets.mapIndexed { index, p ->
                DiscountPresetEntity(
                    name = (p.name?.trim().orEmpty().ifBlank { "${p.percent.toInt()}%" }).take(40),
                    percent = p.percent.coerceIn(0.0, 100.0),
                    isActive = true,
                    sortOrder = index
                )
            }
        )
        return true
    }

    private suspend fun pushLocalToServer(): Boolean {
        val settings = settingsRepository.getSettings()
        val terminalId = settings.adyenTerminalId.trim()
        if (terminalId.isEmpty()) return false

        val hasAdyen =
            settings.adyenTerminalEnabled ||
                settings.adyenApiKey.isNotBlank() ||
                settings.adyenMerchantAccount.isNotBlank()

        if (!hasAdyen) return false

        val response = syncApi.pushTerminals(
            PushTerminalsRequest(
                terminals = listOf(
                    PushTerminalItemDto(
                        terminalId = terminalId,
                        terminalName = "POS  $terminalId",
                        serialNumber = terminalId,
                        status = if (settings.adyenTerminalEnabled) "active" else "inactive"
                    )
                ),
                defaultTerminalId = terminalId,
                adyenMerchantAccount = settings.adyenMerchantAccount.takeIf { it.isNotBlank() },
                adyenApiKey = settings.adyenApiKey.takeIf { it.isNotBlank() },
                adyenClientId = settings.adyenClientId.takeIf { it.isNotBlank() },
                adyenTerminalEnabled = settings.adyenTerminalEnabled,
                deviceLabel = "Android POS"
            )
        )
        return response.ok && response.upserted > 0
    }

    private fun mergePaymentConfig(
        settings: BusinessSettingsEntity,
        config: PaymentConfigResponse
    ): BusinessSettingsEntity {
        var merged = settings
        val adyen = config.adyen

        adyen?.merchant_account?.takeIf { it.isNotBlank() }?.let {
            merged = merged.copy(adyenMerchantAccount = it)
        }
        adyen?.api_key?.takeIf { it.isNotBlank() }?.let {
            merged = merged.copy(adyenApiKey = it)
        }
        adyen?.client_id?.takeIf { it.isNotBlank() }?.let {
            merged = merged.copy(adyenClientId = it)
        }

        val defaultTerminalId = config.default_terminal_id?.trim().orEmpty()
        if (defaultTerminalId.isNotEmpty() && merged.adyenTerminalId.isBlank()) {
            merged = merged.copy(adyenTerminalId = defaultTerminalId)
        }

        val hasActiveTerminal = config.terminals.any { it.status == "active" || it.status.isNullOrBlank() }
        if (hasActiveTerminal && merged.adyenTerminalId.isBlank() && config.terminals.isNotEmpty()) {
            val first = config.terminals.firstOrNull { it.status == "active" || it.status.isNullOrBlank() }
                ?: config.terminals.first()
            merged = merged.copy(adyenTerminalId = first.terminal_id)
        }

        config.methods?.let { methods ->
            merged = merged.copy(
                expressEnabled = methods.express,
                cashEnabled = methods.cash,
                cardEnabled = methods.card,
                terminalEnabled = methods.terminal,
                adyenTerminalEnabled = methods.terminal,
                paymentMethodsManagedByCloud = true
            )
        }

        config.features?.let { features ->
            merged = merged.copy(coursesEnabled = features.coursesEnabled)
        }

        config.checkout?.let { checkout ->
            val tipCsv = checkout.tipPresetsPercent
                .filter { it >= 0 }
                .take(8)
                .joinToString(",") { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() }
                .ifBlank { "0,5,10,15" }
            val densCsv = checkout.quickCashDenominations
                .filter { it > 0 }
                .take(12)
                .joinToString(",") { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() }
                .ifBlank { "10,20,50,100" }
            val step = checkout.roundingStep
            val roundingStep = if (step in listOf(0.0, 0.05, 0.1, 0.5, 1.0)) step else merged.roundingStep
            merged = merged.copy(
                tipsEnabled = checkout.tipsEnabled,
                allowCustomTip = checkout.allowCustomTip,
                tipPresetsPercentCsv = tipCsv,
                discountsEnabled = checkout.discountsEnabled,
                roundingStep = roundingStep,
                quickCashEnabled = checkout.quickCashEnabled,
                quickCashDenominationsCsv = densCsv,
                splitBillsEnabled = checkout.splitBillsEnabled,
                maxSplitParts = checkout.maxSplitParts.coerceIn(2, 20)
            )
        }

        return merged
    }
}

data class TerminalSyncResult(
    val pulled: Boolean = false,
    val pushed: Boolean = false,
    val skipped: Boolean = false,
    val error: String? = null
)
