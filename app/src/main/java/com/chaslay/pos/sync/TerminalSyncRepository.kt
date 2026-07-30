package com.chaslay.pos.sync

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.PaymentConfigResponse
import com.chaslay.pos.data.remote.dto.PushTerminalItemDto
import com.chaslay.pos.data.remote.dto.PushTerminalsRequest
import com.chaslay.pos.data.repository.SettingsRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class TerminalSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val settingsRepository: SettingsRepository
) {
    suspend fun syncTerminals(): TerminalSyncResult = withContext(Dispatchers.IO) {
        if (BuildConfig.SYNC_API_KEY.isBlank()) {
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
        if (BuildConfig.SYNC_API_KEY.isBlank()) {
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
        if (merged != current) {
            settingsRepository.saveSettings(merged)
            return true
        }
        return false
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
                        terminalName = "POS · $terminalId",
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
            merged = merged.copy(
                adyenTerminalId = defaultTerminalId,
                adyenTerminalEnabled = true,
                terminalEnabled = true
            )
        }

        val hasActiveTerminal = config.terminals.any { it.status == "active" || it.status.isNullOrBlank() }
        if (hasActiveTerminal && merged.adyenTerminalId.isBlank() && config.terminals.isNotEmpty()) {
            val first = config.terminals.firstOrNull { it.status == "active" || it.status.isNullOrBlank() }
                ?: config.terminals.first()
            merged = merged.copy(
                adyenTerminalId = first.terminal_id,
                adyenTerminalEnabled = true,
                terminalEnabled = true
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
