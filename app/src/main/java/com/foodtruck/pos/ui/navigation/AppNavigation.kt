package com.foodtruck.pos.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.ui.admin.AdminHubScreen
import com.foodtruck.pos.ui.auth.AuthViewModel
import com.foodtruck.pos.ui.auth.LoginScreen
import com.foodtruck.pos.ui.ongoing.OngoingOrdersScreen
import com.foodtruck.pos.ui.orderhistory.OrderHistoryScreen
import com.foodtruck.pos.ui.pos.PosScreen

sealed class AppRoute(val route: String) {
    data object Login : AppRoute("login")
    data object Pos : AppRoute("pos")
    data object Admin : AppRoute("admin")
    data object OrderHistory : AppRoute("order_history")
    data object OngoingOrders : AppRoute("ongoing_orders")
}

@Composable
fun FoodTruckNavHost(
    userRole: UserRole?,
    onRoleResolved: (UserRole) -> Unit,
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val navController = rememberNavController()

    if (userRole == null) {
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
                    userRole = userRole,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            launchSingleTop = true
                        }
                    },
                    onBackToPos = {
                        navController.popBackStack(AppRoute.Pos.route, inclusive = false)
                    }
                )
            }
            composable(AppRoute.OrderHistory.route) {
                OrderHistoryScreen(onBack = { navController.popBackStack() })
            }
            composable(AppRoute.OngoingOrders.route) {
                OngoingOrdersScreen(onBack = { navController.popBackStack() })
            }
            if (userRole.canAccessSettings() || userRole.canManageProducts() || userRole.canAccessReports()) {
                composable(AppRoute.Admin.route) {
                    AdminHubScreen(
                        userRole = userRole,
                        onBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
