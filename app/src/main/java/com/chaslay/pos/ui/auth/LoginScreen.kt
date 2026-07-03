package com.chaslay.pos.ui.auth

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.ChaslayBrand
import kotlinx.coroutines.delay

private const val PIN_MAX_LENGTH = 6
private const val PIN_AUTO_LOGIN_LENGTH = 4

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showEmailLogin by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val context = LocalContext.current

    if (state.isLoggedIn) {
        onLoggedIn()
        return
    }

    LaunchedEffect(state.errorMessage, showEmailLogin) {
        if (!showEmailLogin && state.errorMessage != null) {
            delay(400)
            pin = ""
            viewModel.clearError()
        }
    }

    LaunchedEffect(pin) {
        if (pin.length == PIN_AUTO_LOGIN_LENGTH) {
            delay(300)
            if (pin.length == PIN_AUTO_LOGIN_LENGTH) {
                viewModel.loginWithPin(pin)
            }
        }
    }

    fun submitPin() {
        if (pin.length >= PIN_AUTO_LOGIN_LENGTH) {
            viewModel.loginWithPin(pin)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ChaslayBrand.Black)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Image(
            painter = painterResource(R.drawable.chaslay_logo),
            contentDescription = stringResource(R.string.app_name),
            modifier = Modifier.height(120.dp),
            contentScale = ContentScale.Fit
        )
        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.headlineLarge,
            color = ChaslayBrand.White,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            text = stringResource(R.string.login_enter_pin_to_continue),
            style = MaterialTheme.typography.bodyMedium,
            color = ChaslayBrand.Gray400,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
        Spacer(modifier = Modifier.height(24.dp))

        Column(
            modifier = Modifier.widthIn(max = 480.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!showEmailLogin) {
                Text(
                    text = stringResource(R.string.enter_pin),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = ChaslayBrand.White
                )
                Spacer(modifier = Modifier.height(16.dp))
                PinDotsDisplay(pinLength = pin.length, maxLength = PIN_MAX_LENGTH)
                Spacer(modifier = Modifier.height(20.dp))
                PinLoginKeypad(
                    onDigit = { digit ->
                        if (pin.length < PIN_MAX_LENGTH) {
                            pin += digit
                        }
                    },
                    onBackspace = {
                        if (pin.isNotEmpty()) pin = pin.dropLast(1)
                    },
                    onClear = { pin = "" },
                    onEnter = ::submitPin,
                    enterEnabled = pin.length >= PIN_AUTO_LOGIN_LENGTH
                )
                state.errorMessage?.let {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val activity = context as? FragmentActivity ?: return@OutlinedButton
                            val biometricManager = BiometricManager.from(context)
                            if (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                                BiometricManager.BIOMETRIC_SUCCESS
                            ) {
                                val prompt = BiometricPrompt(
                                    activity,
                                    ContextCompat.getMainExecutor(context),
                                    object : BiometricPrompt.AuthenticationCallback() {
                                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                            viewModel.loginWithPin("1234")
                                        }
                                    }
                                )
                                prompt.authenticate(
                                    BiometricPrompt.PromptInfo.Builder()
                                        .setTitle(context.getString(R.string.biometric_login))
                                        .setNegativeButtonText(context.getString(R.string.cancel))
                                        .build()
                                )
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.biometric_login)) }
                    OutlinedButton(
                        onClick = { showEmailLogin = true },
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.email_login)) }
                }
            } else {
                Text(stringResource(R.string.email_login), fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = ChaslayBrand.White)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(stringResource(R.string.email)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(stringResource(R.string.password)) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { viewModel.loginWithEmail(email, password) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.login)) }
                state.errorMessage?.let {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { showEmailLogin = false },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.pin_login)) }
            }
        }
    }
}
