package com.chaslay.pos.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.admin.AdminHubScreen
import com.chaslay.pos.ui.auth.AuthViewModel
import com.chaslay.pos.ui.auth.LoginScreen
import com.chaslay.pos.ui.ongoing.OngoingOrdersScreen
import com.chaslay.pos.ui.orderhistory.OrderHistoryScreen
import com.chaslay.pos.ui.pos.PosScreen

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
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val navController = rememberNavController()

    if (userAccess == null) {
        LoginScreen(onLoggedIn = {})
        return
    }

    Scaffold { padding ->
        NavHost(
            navController = navController,
            startDestination = AppRoute.Pos.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            composable(AppRoute.Pos.route) {
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
