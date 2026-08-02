package com.chaslay.pos.ui.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.menu.MenuHubScreen
import com.chaslay.pos.ui.reports.ReportsScreen
import com.chaslay.pos.ui.settings.SettingsScreen
import com.chaslay.pos.ui.theme.vectronColors

private enum class AdminTabId {
    SETTINGS,
    PRODUCTS,
    REPORTS
}

private val AccentTeal = Color(0xFF00897B)

@Composable
fun AdminHubScreen(
    userAccess: UserAccess,
    onBack: () -> Unit
) {
    val colors = vectronColors()
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabIds = remember(userAccess) {
        buildList {
            if (userAccess.canAccessSettings()) add(AdminTabId.SETTINGS)
            if (userAccess.canManageProducts()) add(AdminTabId.PRODUCTS)
            if (userAccess.canAccessReports()) add(AdminTabId.REPORTS)
        }
    }

    if (tabIds.isEmpty()) {
        onBack()
        return
    }
    if (selectedTab >= tabIds.size) selectedTab = 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.header)
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back_to_pos),
                    tint = colors.textPrimary
                )
            }
            tabIds.forEachIndexed { index, tabId ->
                FilterChip(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    label = {
                        Text(
                            stringResource(
                                when (tabId) {
                                    AdminTabId.SETTINGS -> R.string.nav_settings
                                    AdminTabId.PRODUCTS -> R.string.nav_products
                                    AdminTabId.REPORTS -> R.string.nav_reports
                                }
                            ),
                            fontSize = 13.sp,
                            fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    shape = RoundedCornerShape(8.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White,
                        containerColor = colors.panelLight,
                        labelColor = colors.textPrimary
                    )
                )
            }
        }
        when (tabIds[selectedTab]) {
            AdminTabId.SETTINGS -> SettingsScreen(userAccess = userAccess)
            AdminTabId.PRODUCTS -> MenuHubScreen()
            AdminTabId.REPORTS -> ReportsScreen()
        }
    }
}
