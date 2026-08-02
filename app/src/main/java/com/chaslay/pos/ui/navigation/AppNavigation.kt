package com.chaslay.pos.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.admin.AdminHubScreen
import com.chaslay.pos.ui.auth.AuthViewModel
import com.chaslay.pos.ui.auth.LoginScreen
import com.chaslay.pos.ui.demo.DemoModeBanner
import com.chaslay.pos.ui.demo.DemoModeViewModel
import com.chaslay.pos.ui.ongoing.OngoingOrdersScreen
import com.chaslay.pos.ui.orderhistory.OrderHistoryScreen
import com.chaslay.pos.ui.pos.PosScreen
import com.chaslay.pos.ui.waiter.WaiterPosScreen

sealed class AppRoute(val route: String) {
    data object Login : AppRoute("login")
    data object Pos : AppRoute("pos")
    data object Admin : AppRoute("admin")
    data object OrderHistory : AppRoute("order_history")
    data object OngoingOrders : AppRoute("ongoing_orders")
}

@Composable
fun ChaslayNavHost(
    userAccess: UserAccess?,
    authViewModel: AuthViewModel = hiltViewModel(),
    demoModeViewModel: DemoModeViewModel = hiltViewModel()
) {
    val navController = rememberNavController()
    val isDemoMode by demoModeViewModel.isDemoMode.collectAsStateWithLifecycle()
    val demoUiState by demoModeViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(demoUiState.snackbarMessageRes) {
        demoUiState.snackbarMessageRes?.let { resId ->
            snackbarHostState.showSnackbar(message = context.getString(resId))
            demoModeViewModel.clearSnackbar()
        }
    }

    if (userAccess == null) {
        LoginScreen(onLoggedIn = {})
        return
    }

    if (demoUiState.showGoLiveConfirm) {
        AlertDialog(
            onDismissRequest = demoModeViewModel::dismissGoLiveConfirm,
            title = { Text(stringResource(R.string.demo_go_live_confirm_title)) },
            text = { Text(stringResource(R.string.demo_go_live_confirm_body)) },
            confirmButton = {
                TextButton(onClick = demoModeViewModel::confirmGoLive) {
                    Text(stringResource(R.string.demo_go_live_button))
                }
            },
            dismissButton = {
                TextButton(onClick = demoModeViewModel::dismissGoLiveConfirm) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    // Apply system insets once here. Scaffold contentWindowInsets are cleared so we don't get
    // a double status-bar gap under the demo banner — but we MUST keep navigationBarsPadding
    // or the POS keypad / Save buttons sit under the Android nav bar and look "hidden".
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        if (isDemoMode) {
            DemoModeBanner(
                onGoLiveClick = demoModeViewModel::requestGoLive,
                isPurging = demoUiState.isPurging
            )
        }

        Scaffold(
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { padding ->
            NavHost(
                navController = navController,
                startDestination = AppRoute.Pos.route,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                composable(AppRoute.Pos.route) {
                    if (userAccess.isWaiterProfile()) {
                        WaiterPosScreen(
                            userAccess = userAccess,
                            onLogout = { authViewModel.logout() }
                        )
                    } else {
                        PosScreen(
                            userAccess = userAccess,
                            onNavigate = { route ->
                                navController.navigate(route) {
                                    launchSingleTop = true
                                }
                            },
                            onBackToPos = {
                                navController.popBackStack(AppRoute.Pos.route, inclusive = false)
                            },
                            onLogout = { authViewModel.logout() }
                        )
                    }
                }
                composable(AppRoute.OrderHistory.route) {
                    if (userAccess.canViewOrderHistory()) {
                        OrderHistoryScreen(onBack = { navController.popBackStack() })
                    }
                }
                composable(AppRoute.OngoingOrders.route) {
                    OngoingOrdersScreen(onBack = { navController.popBackStack() })
                }
                if (userAccess.canAccessSettings() || userAccess.canManageProducts() || userAccess.canAccessReports()) {
                    composable(AppRoute.Admin.route) {
                        AdminHubScreen(
                            userAccess = userAccess,
                            onBack = { navController.popBackStack() }
                        )
                    }
                }
            }
        }
    }
}
