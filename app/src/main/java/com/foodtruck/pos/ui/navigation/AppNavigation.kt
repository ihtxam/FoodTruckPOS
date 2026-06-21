package com.foodtruck.pos.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.foodtruck.pos.R
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.ui.auth.AuthViewModel
import com.foodtruck.pos.ui.auth.LoginScreen
import com.foodtruck.pos.ui.dashboard.DashboardScreen
import com.foodtruck.pos.ui.pos.PosScreen
import com.foodtruck.pos.ui.reports.ReportsScreen
import com.foodtruck.pos.ui.settings.SettingsScreen

sealed class AppRoute(val route: String) {
    data object Login : AppRoute("login")
    data object Pos : AppRoute("pos")
    data object Dashboard : AppRoute("dashboard")
    data object Reports : AppRoute("reports")
    data object Settings : AppRoute("settings")
}

@Composable
fun FoodTruckNavHost(
    userRole: UserRole?,
    onRoleResolved: (UserRole) -> Unit,
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val navController = rememberNavController()

    if (userRole == null) {
        LoginScreen(onLoggedIn = {
            // Role is loaded via session in MainActivity
        })
        return
    }

    val destinations = buildList {
        add(AppRoute.Pos)
        if (userRole.canAccessReports()) {
            add(AppRoute.Dashboard)
            add(AppRoute.Reports)
        }
        if (userRole.canAccessSettings()) add(AppRoute.Settings)
    }

    Scaffold(
        bottomBar = {
            if (destinations.size > 1) {
                NavigationBar {
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentDestination = navBackStackEntry?.destination
                    destinations.forEach { destination ->
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = when (destination) {
                                        AppRoute.Pos -> Icons.Default.PointOfSale
                                        AppRoute.Dashboard -> Icons.Default.Dashboard
                                        AppRoute.Reports -> Icons.Default.Analytics
                                        AppRoute.Settings -> Icons.Default.Settings
                                        else -> Icons.Default.PointOfSale
                                    },
                                    contentDescription = null
                                )
                            },
                            label = {
                                Text(
                                    when (destination) {
                                        AppRoute.Pos -> stringResource(R.string.nav_pos)
                                        AppRoute.Dashboard -> stringResource(R.string.nav_dashboard)
                                        AppRoute.Reports -> stringResource(R.string.nav_reports)
                                        AppRoute.Settings -> stringResource(R.string.nav_settings)
                                        else -> ""
                                    }
                                )
                            },
                            selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = AppRoute.Pos.route,
            modifier = Modifier.padding(padding)
        ) {
            composable(AppRoute.Pos.route) { PosScreen() }
            if (userRole.canAccessReports()) {
                composable(AppRoute.Dashboard.route) { DashboardScreen() }
                composable(AppRoute.Reports.route) { ReportsScreen() }
            }
            if (userRole.canAccessSettings()) {
                composable(AppRoute.Settings.route) { SettingsScreen() }
            }
        }
    }
}
