package com.chaslay.pos.ui.admin

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
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.dashboard.DashboardScreen
import com.chaslay.pos.ui.menu.MenuHubScreen
import com.chaslay.pos.ui.reports.ReportsScreen
import com.chaslay.pos.ui.settings.SettingsScreen
import com.chaslay.pos.ui.theme.ChaslayBrand

private enum class AdminTabId {
    DASHBOARD,
    PRODUCTS,
    REPORTS,
    SETTINGS
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminHubScreen(
    userAccess: UserAccess,
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabIds = remember(userAccess) {
        buildList {
            if (userAccess.canAccessReports()) add(AdminTabId.DASHBOARD)
            if (userAccess.canManageProducts()) add(AdminTabId.PRODUCTS)
            if (userAccess.canAccessReports()) add(AdminTabId.REPORTS)
            if (userAccess.canAccessSettings()) add(AdminTabId.SETTINGS)
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
        containerColor = ChaslayBrand.White,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.admin_hub), color = ChaslayBrand.White) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ChaslayBrand.Black,
                    navigationIconContentColor = ChaslayBrand.White,
                    titleContentColor = ChaslayBrand.White
                ),
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
                .background(ChaslayBrand.White)
        ) {
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = ChaslayBrand.Black,
                contentColor = ChaslayBrand.White
            ) {
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
                    AdminTabId.SETTINGS -> SettingsScreen(userAccess = userAccess)
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
