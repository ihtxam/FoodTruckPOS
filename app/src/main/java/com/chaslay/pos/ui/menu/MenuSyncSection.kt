package com.chaslay.pos.ui.menu

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.ui.settings.SettingsViewModel
import com.chaslay.pos.ui.theme.vectronColors

@Composable
fun MenuSyncSection(
    settingsViewModel: SettingsViewModel = hiltViewModel()
) {
    val state by settingsViewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            stringResource(R.string.menu_sync_title),
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = colors.textPrimary
        )
        Text(
            stringResource(R.string.menu_sync_help),
            fontSize = 13.sp,
            color = colors.textSecondary
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = state.syncBusinessInfo,
                onCheckedChange = settingsViewModel::updateSyncBusinessInfo
            )
            Text(
                stringResource(R.string.menu_sync_business_info),
                color = colors.textPrimary,
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Button(
                onClick = settingsViewModel::pullOnlineMenuReplace,
                enabled = !state.isMenuSyncing,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B))
            ) {
                Text(
                    if (state.isMenuSyncing) stringResource(R.string.menu_syncing)
                    else stringResource(R.string.menu_sync_replace)
                )
            }
            OutlinedButton(
                onClick = settingsViewModel::pullOnlineMenuMerge,
                enabled = !state.isMenuSyncing,
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.menu_sync_merge))
            }
        }
        OutlinedButton(
            onClick = settingsViewModel::pushMenuToPanel,
            enabled = !state.isMenuSyncing,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.menu_sync_push))
        }

        state.message?.let {
            Spacer(modifier = Modifier.height(4.dp))
            Text(it, color = Color(0xFF00897B), fontSize = 13.sp)
        }
    }
}
