package com.foodtruck.pos

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.sync.SyncService
import com.foodtruck.pos.ui.navigation.FoodTruckNavHost
import com.foodtruck.pos.ui.theme.FoodTruckPosTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var sessionManager: SessionManager
    @Inject lateinit var syncService: SyncService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        CoroutineScope(Dispatchers.IO).launch {
            syncService.syncPendingTransactions()
        }

        setContent {
            val userRoleString by sessionManager.currentUserRole.collectAsStateWithLifecycle(initialValue = null)
            val userRole = userRoleString?.let { runCatching { UserRole.valueOf(it) }.getOrNull() }

            FoodTruckPosTheme {
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
