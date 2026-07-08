package com.chaslay.pos.ui.auth

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

private const val PIN_MAX_LENGTH = 4
private const val PIN_AUTO_LOGIN_LENGTH = 4
private val WIDE_LAYOUT_BREAKPOINT = 720.dp

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

    fun triggerBiometric() {
        val activity = context as? FragmentActivity ?: return
        val bm = BiometricManager.from(context)
        if (bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
        ) {
            BiometricPrompt(
                activity,
                ContextCompat.getMainExecutor(context),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        viewModel.loginWithPin("1234")
                    }
                }
            ).authenticate(
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle(context.getString(R.string.biometric_login))
                    .setNegativeButtonText(context.getString(R.string.cancel))
                    .build()
            )
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ChaslayBrand.Black)
    ) {
        val isWide = maxWidth >= WIDE_LAYOUT_BREAKPOINT

        if (isWide) {
            Row(modifier = Modifier.fillMaxSize()) {
                BrandHero(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(ChaslayBrand.Gray900)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 48.dp, vertical = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    AuthCardContent(
                        showEmail = showEmailLogin,
                        pin = pin,
                        email = email,
                        password = password,
                        errorMessage = state.errorMessage,
                        modifier = Modifier
                            .fillMaxWidth()
                            .widthIn(max = 520.dp),
                        onDigit = { d -> if (pin.length < PIN_MAX_LENGTH) pin += d },
                        onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
                        onClear = { pin = "" },
                        onSubmitPin = ::submitPin,
                        enterEnabled = pin.length >= PIN_AUTO_LOGIN_LENGTH,
                        onEmailChange = { email = it },
                        onPasswordChange = { password = it },
                        onEmailSubmit = { viewModel.loginWithEmail(email, password) },
                        onShowEmail = { showEmailLogin = true },
                        onShowPin = { showEmailLogin = false },
                        onBiometric = ::triggerBiometric
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                CompactHero()
                Spacer(modifier = Modifier.height(24.dp))
                AuthCardContent(
                    showEmail = showEmailLogin,
                    pin = pin,
                    email = email,
                    password = password,
                    errorMessage = state.errorMessage,
                    modifier = Modifier
                        .fillMaxWidth()
                        .widthIn(max = 420.dp),
                    onDigit = { d -> if (pin.length < PIN_MAX_LENGTH) pin += d },
                    onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
                    onClear = { pin = "" },
                    onSubmitPin = ::submitPin,
                    enterEnabled = pin.length >= PIN_AUTO_LOGIN_LENGTH,
                    onEmailChange = { email = it },
                    onPasswordChange = { password = it },
                    onEmailSubmit = { viewModel.loginWithEmail(email, password) },
                    onShowEmail = { showEmailLogin = true },
                    onShowPin = { showEmailLogin = false },
                    onBiometric = ::triggerBiometric
                )
            }
        }
    }
}

@Composable
private fun BrandHero(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.background(ChaslayBrand.Black),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(48.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.chaslay_logo),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier.height(160.dp),
                contentScale = ContentScale.Fit
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = stringResource(R.string.app_name),
                color = ChaslayBrand.White,
                fontWeight = FontWeight.Bold,
                fontSize = 40.sp,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = stringResource(R.string.login_enter_pin_to_continue),
                color = ChaslayBrand.Gray400,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 320.dp)
            )
        }
    }
}

@Composable
private fun CompactHero() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Image(
            painter = painterResource(R.drawable.chaslay_logo),
            contentDescription = stringResource(R.string.app_name),
            modifier = Modifier.height(96.dp),
            contentScale = ContentScale.Fit
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.app_name),
            color = ChaslayBrand.White,
            fontWeight = FontWeight.Bold,
            fontSize = 28.sp
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = stringResource(R.string.login_enter_pin_to_continue),
            color = ChaslayBrand.Gray400,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun AuthCardContent(
    showEmail: Boolean,
    pin: String,
    email: String,
    password: String,
    errorMessage: String?,
    enterEnabled: Boolean,
    modifier: Modifier = Modifier,
    onDigit: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onSubmitPin: () -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onEmailSubmit: () -> Unit,
    onShowEmail: () -> Unit,
    onShowPin: () -> Unit,
    onBiometric: () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(24.dp))
            .background(ChaslayBrand.Black)
            .border(1.dp, ChaslayBrand.Gray800, RoundedCornerShape(24.dp))
            .padding(horizontal = 28.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (!showEmail) {
            Text(
                text = stringResource(R.string.enter_pin),
                color = ChaslayBrand.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            PinDotsDisplay(pinLength = pin.length, maxLength = PIN_MAX_LENGTH)
            Spacer(modifier = Modifier.height(28.dp))
            PinLoginKeypad(
                onDigit = onDigit,
                onBackspace = onBackspace,
                onClear = onClear,
                onEnter = onSubmitPin,
                enterEnabled = enterEnabled
            )
            errorMessage?.let {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    fontSize = 14.sp
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                QuickAction(
                    label = stringResource(R.string.biometric_login),
                    onClick = onBiometric,
                    icon = { Icon(Icons.Filled.Fingerprint, contentDescription = null, tint = ChaslayBrand.White) }
                )
                QuickAction(
                    label = stringResource(R.string.email_login),
                    onClick = onShowEmail,
                    icon = { Icon(Icons.Filled.Email, contentDescription = null, tint = ChaslayBrand.White) }
                )
            }
        } else {
            Text(
                text = stringResource(R.string.email_login),
                color = ChaslayBrand.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            OutlinedTextField(
                value = email,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.email), color = ChaslayBrand.Gray400) },
                singleLine = true,
                colors = darkFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = onPasswordChange,
                label = { Text(stringResource(R.string.password), color = ChaslayBrand.Gray400) },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                colors = darkFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(20.dp))
            Button(
                onClick = onEmailSubmit,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ChaslayBrand.White,
                    contentColor = ChaslayBrand.Black
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text(
                    stringResource(R.string.login),
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
            errorMessage?.let {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 14.sp
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            TextButton(
                onClick = onShowPin,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    stringResource(R.string.pin_login),
                    color = ChaslayBrand.Gray200,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    TextButton(onClick = onClick) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            icon()
            Text(
                text = label,
                color = ChaslayBrand.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun darkFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = ChaslayBrand.White,
    unfocusedTextColor = ChaslayBrand.White,
    focusedBorderColor = ChaslayBrand.White,
    unfocusedBorderColor = ChaslayBrand.Gray600,
    cursorColor = ChaslayBrand.White,
    focusedContainerColor = Color.Transparent,
    unfocusedContainerColor = Color.Transparent
)
