package com.foodtruck.pos

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.data.repository.LicenseRepository
import com.foodtruck.pos.domain.model.LicenseGateState
import com.foodtruck.pos.domain.model.PosThemeMode
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.sync.SyncService
import com.foodtruck.pos.ui.license.ActivationScreen
import com.foodtruck.pos.ui.navigation.FoodTruckNavHost
import com.foodtruck.pos.ui.theme.FoodTruckPosTheme
import com.foodtruck.pos.ui.theme.ProvideVectronTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var sessionManager: SessionManager
    @Inject lateinit var syncService: SyncService
    @Inject lateinit var licenseRepository: LicenseRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        lifecycleScope.launch {
            runCatching { licenseRepository.ensureInitialized() }
            runCatching { syncService.syncAll(force = false) }
        }

        setContent {
            val userRoleString by sessionManager.currentUserRole.collectAsStateWithLifecycle(initialValue = null)
            val themeMode by sessionManager.posThemeMode.collectAsStateWithLifecycle(initialValue = PosThemeMode.LIGHT)
            val licenseState by licenseRepository.uiState.collectAsStateWithLifecycle(
                initialValue = com.foodtruck.pos.domain.model.LicenseUiState()
            )
            val userRole = userRoleString?.let { runCatching { UserRole.valueOf(it) }.getOrNull() }
            val darkTheme = themeMode == PosThemeMode.DARK

            FoodTruckPosTheme(darkTheme = darkTheme) {
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
                            if (userRole == null) {
                                com.foodtruck.pos.ui.auth.LoginScreen(
                                    onLoggedIn = { /* reactive via session flow */ }
                                )
                            } else {
                                FoodTruckNavHost(
                                    userRole = userRole,
                                    onRoleResolved = {}
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
