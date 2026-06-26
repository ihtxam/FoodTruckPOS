package com.foodtruck.pos.ui.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.foodtruck.pos.R
import com.foodtruck.pos.domain.model.UserRole
import com.foodtruck.pos.ui.dashboard.DashboardScreen
import com.foodtruck.pos.ui.menu.MenuHubScreen
import com.foodtruck.pos.ui.reports.ReportsScreen
import com.foodtruck.pos.ui.settings.SettingsScreen

private enum class AdminTabId {
    DASHBOARD,
    PRODUCTS,
    REPORTS,
    SETTINGS
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminHubScreen(
    userRole: UserRole,
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabIds = remember(userRole) {
        buildList {
            if (userRole.canAccessReports()) add(AdminTabId.DASHBOARD)
            if (userRole.canManageProducts()) add(AdminTabId.PRODUCTS)
            if (userRole.canAccessReports()) add(AdminTabId.REPORTS)
            if (userRole.canAccessSettings()) add(AdminTabId.SETTINGS)
        }
    }

    if (tabIds.isEmpty()) {
        onBack()
        return
    }
    if (selectedTab >= tabIds.size) selectedTab = 0

    fun openTab(id: AdminTabId) {
        selectedTab = tabIds.indexOf(id).takeIf { it >= 0 } ?: selectedTab
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.admin_hub)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back_to_pos)
                        )
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            ScrollableTabRow(selectedTabIndex = selectedTab) {
                tabIds.forEachIndexed { index, tabId ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                stringResource(
                                    when (tabId) {
                                        AdminTabId.SETTINGS -> R.string.nav_settings
                                        AdminTabId.PRODUCTS -> R.string.nav_products
                                        AdminTabId.DASHBOARD -> R.string.nav_dashboard
                                        AdminTabId.REPORTS -> R.string.nav_reports
                                    }
                                )
                            )
                        }
                    )
                }
            }
            Column(modifier = Modifier.fillMaxSize()) {
                when (tabIds[selectedTab]) {
                    AdminTabId.SETTINGS -> SettingsScreen()
                    AdminTabId.PRODUCTS -> MenuHubScreen()
                    AdminTabId.DASHBOARD -> DashboardScreen(
                        onBackToPos = onBack,
                        onOpenReports = { openTab(AdminTabId.REPORTS) },
                        onOpenSettings = { openTab(AdminTabId.SETTINGS) }
                    )
                    AdminTabId.REPORTS -> ReportsScreen()
                }
            }
        }
    }
}
