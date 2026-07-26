package com.chaslay.pos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.LicenseRepository
import com.chaslay.pos.domain.model.LicenseGateState
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.sync.FloorSyncCoordinator
import com.chaslay.pos.sync.SyncService
import com.chaslay.pos.ui.license.ActivationScreen
import com.chaslay.pos.ui.navigation.ChaslayNavHost
import com.chaslay.pos.ui.theme.ChaslayPosTheme
import com.chaslay.pos.ui.theme.ProvideVectronTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var sessionManager: SessionManager
    @Inject lateinit var syncService: SyncService
    @Inject lateinit var licenseRepository: LicenseRepository
    @Inject lateinit var floorSyncCoordinator: FloorSyncCoordinator

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* alerts enabled when granted */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermissionIfNeeded()

        lifecycleScope.launch {
            runCatching { licenseRepository.ensureInitialized() }
            runCatching { syncService.syncAll(force = false) }
        }

        floorSyncCoordinator.start(lifecycleScope)

        setContent {
            val userAccess by sessionManager.currentUserAccess.collectAsStateWithLifecycle(initialValue = null)
            val themeMode by sessionManager.posThemeMode.collectAsStateWithLifecycle(initialValue = PosThemeMode.LIGHT)
            val licenseState by licenseRepository.uiState.collectAsStateWithLifecycle(
                initialValue = com.chaslay.pos.domain.model.LicenseUiState()
            )
            val darkTheme = themeMode == PosThemeMode.DARK

            ChaslayPosTheme(darkTheme = darkTheme) {
                ProvideVectronTheme(darkTheme = darkTheme) {
                    when (licenseState.gateState) {
                        LicenseGateState.LOADING -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                        LicenseGateState.NEEDS_ACTIVATION, LicenseGateState.EXPIRED -> {
                            ActivationScreen()
                        }
                        else -> {
                            if (userAccess == null) {
                                com.chaslay.pos.ui.auth.LoginScreen(
                                    onLoggedIn = { /* reactive via session flow */ }
                                )
                            } else {
                                ChaslayNavHost(
                                    userAccess = userAccess
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        floorSyncCoordinator.stop()
        super.onDestroy()
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
