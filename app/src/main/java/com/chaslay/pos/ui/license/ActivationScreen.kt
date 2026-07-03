package com.chaslay.pos.ui.license

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.LicenseGateState

@Composable
fun ActivationScreen(
    viewModel: LicenseViewModel = hiltViewModel()
) {
    val license by viewModel.licenseState.collectAsStateWithLifecycle()
    val form by viewModel.formState.collectAsStateWithLifecycle()

    if (license.gateState == LicenseGateState.LOADING) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator()
        }
        return
    }

    val expired = license.gateState == LicenseGateState.EXPIRED
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = if (expired) stringResource(R.string.license_expired_title) else stringResource(R.string.license_activate_title),
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = if (expired) stringResource(R.string.license_expired_body) else stringResource(R.string.license_activate_body),
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = form.activationCode,
            onValueChange = viewModel::updateActivationCode,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.license_activation_code)) },
            singleLine = true,
            enabled = !form.isActivating
        )
        Text(
            text = stringResource(R.string.license_device_id, license.snapshot.deviceId.ifBlank { "…" }),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = stringResource(R.string.license_device_id_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        form.errorMessage?.let { error ->
            Text(text = error, color = MaterialTheme.colorScheme.error)
        }
        Button(
            onClick = viewModel::activate,
            modifier = Modifier.fillMaxWidth(),
            enabled = form.activationCode.isNotBlank() && !form.isActivating
        ) {
            if (form.isActivating) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text(stringResource(R.string.license_activate_button))
            }
        }
    }
}

@Composable
fun LicenseRenewalBanner(
    licenseState: com.chaslay.pos.domain.model.LicenseUiState,
    modifier: Modifier = Modifier
) {
    when {
        licenseState.gateState == LicenseGateState.TRIAL -> {
            LicenseBanner(
                text = stringResource(R.string.license_trial_banner, licenseState.trialDaysRemaining),
                modifier = modifier,
                accent = MaterialTheme.colorScheme.primaryContainer
            )
        }
        licenseState.showRenewalWarning && licenseState.daysUntilExpiry != null -> {
            LicenseBanner(
                text = stringResource(R.string.license_renewal_banner, licenseState.daysUntilExpiry!!),
                modifier = modifier,
                accent = MaterialTheme.colorScheme.errorContainer
            )
        }
    }
}

@Composable
private fun LicenseBanner(
    text: String,
    modifier: Modifier = Modifier,
    accent: androidx.compose.ui.graphics.Color
) {
    Text(
        text = text,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        color = MaterialTheme.colorScheme.onSurface,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium
    )
}
