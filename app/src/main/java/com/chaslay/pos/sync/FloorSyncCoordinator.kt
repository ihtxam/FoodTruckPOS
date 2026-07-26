package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.domain.model.FloorDeviceRole
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@Singleton
class FloorSyncCoordinator @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val floorSyncRepository: FloorSyncRepository,
    private val floorLanServer: FloorLanServer
) {
    private var appScope: CoroutineScope? = null
    private var settingsJob: Job? = null
    private var pollJob: Job? = null

    fun start(scope: CoroutineScope) {
        if (settingsJob?.isActive == true) return
        appScope = scope
        settingsJob = scope.launch {
            settingsRepository.observeSettings().collect { settings ->
                runCatching { configure(settings) }
                    .onFailure { Log.w(TAG, "Floor sync configure failed", it) }
            }
        }
    }

    fun stop() {
        settingsJob?.cancel()
        settingsJob = null
        stopPolling()
        floorLanServer.stop()
        appScope = null
    }

    private suspend fun configure(settings: BusinessSettingsEntity) {
        stopPolling()
        if (settings.floorSyncEnabled) {
            floorSyncRepository.registerDevice(settings)
        }
        val role = FloorDeviceRole.fromApi(settings.floorDeviceRole)
        if (settings.floorSyncEnabled && role == FloorDeviceRole.MAIN_POS) {
            floorLanServer.start()
            startPolling()
        } else {
            floorLanServer.stop()
        }
    }

    private fun startPolling() {
        val scope = appScope ?: return
        pollJob = scope.launch {
            while (isActive) {
                val settings = settingsRepository.getSettings()
                if (!settings.floorSyncEnabled ||
                    FloorDeviceRole.fromApi(settings.floorDeviceRole) != FloorDeviceRole.MAIN_POS
                ) {
                    break
                }
                runCatching {
                    floorSyncRepository.processPendingPrintJobs(settings)
                    floorSyncRepository.pullCloudOrders(settings)
                }.onFailure { Log.w(TAG, "Floor sync poll failed", it) }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    companion object {
        private const val TAG = "FloorSyncCoordinator"
        private const val POLL_INTERVAL_MS = 8_000L
    }
}
