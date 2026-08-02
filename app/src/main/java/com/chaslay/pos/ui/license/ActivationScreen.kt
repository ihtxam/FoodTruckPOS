package com.chaslay.pos.ui.license

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.LicenseGateState

@Composable
fun LicenseSettingsSection(
    viewModel: LicenseViewModel = hiltViewModel()
) {
    val license by viewModel.licenseState.collectAsStateWithLifecycle()
    val form by viewModel.formState.collectAsStateWithLifecycle()
    val dateFmt = remember { java.text.SimpleDateFormat("dd.MM.yyyy", java.util.Locale.getDefault()) }

    Text(
        stringResource(R.string.license_settings_title),
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp
    )
    Spacer(modifier = Modifier.height(8.dp))

    val bannerBg = when (license.gateState) {
        LicenseGateState.TRIAL -> Color(0xFFFFF3E0)
        LicenseGateState.ALLOWED -> Color(0xFFE8F5E9)
        else -> Color(0xFFFFEBEE)
    }
    val bannerFg = when (license.gateState) {
        LicenseGateState.TRIAL -> Color(0xFFE65100)
        LicenseGateState.ALLOWED -> Color(0xFF2E7D32)
        else -> Color(0xFFC62828)
    }
    val statusText = when (license.gateState) {
        LicenseGateState.TRIAL -> stringResource(R.string.license_status_trial, license.trialDaysRemaining)
        LicenseGateState.ALLOWED -> {
            val expiry = license.snapshot.expiresAt.takeIf { it > 0L }?.let { dateFmt.format(java.util.Date(it)) } ?: "-"
            stringResource(R.string.license_status_active, expiry)
        }
        LicenseGateState.EXPIRED, LicenseGateState.NEEDS_ACTIVATION -> stringResource(R.string.license_status_expired)
        LicenseGateState.LOADING -> "..."
    }
    Text(
        text = statusText,
        modifier = Modifier
            .fillMaxWidth()
            .background(bannerBg, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        color = bannerFg,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = stringResource(R.string.license_activate_early_body),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Spacer(modifier = Modifier.height(12.dp))
    LicenseActivationForm(
        activationCode = form.activationCode,
        deviceId = form.liveDeviceId.ifBlank { license.snapshot.deviceId },
        isActivating = form.isActivating,
        errorMessage = form.errorMessage,
        onCodeChange = viewModel::updateActivationCode,
        onActivate = viewModel::activate
    )
}

@Composable
private fun LicenseActivationForm(
    activationCode: String,
    deviceId: String,
    isActivating: Boolean,
    errorMessage: String?,
    onCodeChange: (String) -> Unit,
    onActivate: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var copiedDeviceId by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = activationCode,
            onValueChange = onCodeChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.license_activation_code)) },
            singleLine = true,
            enabled = !isActivating
        )
        Text(
            text = stringResource(R.string.license_device_id_label),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = deviceId.ifBlank { "..." },
                modifier = Modifier.weight(1f),
                fontFamily = FontFamily.Monospace,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            OutlinedButton(
                onClick = {
                    if (deviceId.isBlank()) return@OutlinedButton
                    copyToClipboard(context, deviceId)
                    copiedDeviceId = true
                },
                enabled = deviceId.isNotBlank() && !isActivating
            ) {
                Text(
                    if (copiedDeviceId) stringResource(R.string.license_copied)
                    else stringResource(R.string.license_copy_device_id)
                )
            }
        }
        Text(
            text = stringResource(R.string.license_device_id_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        errorMessage?.let { error ->
            Text(text = error, color = MaterialTheme.colorScheme.error)
        }
        Button(
            onClick = onActivate,
            modifier = Modifier.fillMaxWidth(),
            enabled = activationCode.isNotBlank() && !isActivating
        ) {
            if (isActivating) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text(stringResource(R.string.license_activate_button))
            }
        }
    }
}

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
        LicenseActivationForm(
            activationCode = form.activationCode,
            deviceId = form.liveDeviceId.ifBlank { license.snapshot.deviceId },
            isActivating = form.isActivating,
            errorMessage = form.errorMessage,
            onCodeChange = viewModel::updateActivationCode,
            onActivate = viewModel::activate
        )
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("device_id", text))
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
