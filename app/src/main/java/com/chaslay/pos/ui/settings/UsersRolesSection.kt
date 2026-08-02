package com.chaslay.pos.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PosPermission
import com.chaslay.pos.ui.theme.vectronColors

private val AccentTeal = Color(0xFF00897B)

@Composable
fun UsersRolesSection(
    canManageRoles: Boolean,
    viewModel: UsersRolesViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()

    LaunchedEffect(state.message) {
        state.message?.let {
            kotlinx.coroutines.delay(2500)
            viewModel.clearMessage()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(
            stringResource(R.string.users_accounts),
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = colors.textPrimary
        )
        Text(
            stringResource(R.string.users_accounts_help),
            fontSize = 13.sp,
            color = colors.textSecondary
        )
        state.message?.let {
            Text(it, color = AccentTeal, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = viewModel::openNewUser,
                colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.add_user))
            }
            if (canManageRoles) {
                OutlinedButton(onClick = viewModel::openNewRole) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.add_role))
                }
            }
        }

        Text(
            stringResource(R.string.users_list),
            fontWeight = FontWeight.SemiBold,
            color = colors.textPrimary,
            fontSize = 15.sp
        )
        if (state.users.isEmpty()) {
            Text(
                stringResource(R.string.no_users_yet),
                color = colors.textSecondary,
                fontSize = 13.sp
            )
        }
        state.users.forEach { row ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = colors.panelLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(AccentTeal.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = AccentTeal,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            row.user.name,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.textPrimary,
                            fontSize = 15.sp
                        )
                        Text(
                            buildString {
                                append(row.roleName)
                                if (!row.user.isActive) append(" · inactive")
                            },
                            fontSize = 12.sp,
                            color = if (row.user.isActive) colors.textSecondary else Color(0xFFE57373)
                        )
                        row.user.email?.takeIf { it.isNotBlank() }?.let {
                            Text(it, fontSize = 11.sp, color = colors.textSecondary)
                        }
                    }
                    IconButton(onClick = { viewModel.openEditUser(row.user) }) {
                        Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.edit), tint = AccentTeal)
                    }
                }
            }
        }

        if (canManageRoles) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                stringResource(R.string.roles_list),
                fontWeight = FontWeight.SemiBold,
                color = colors.textPrimary,
                fontSize = 15.sp
            )
            state.roles.forEach { role ->
                val perms = PosPermission.decode(role.permissions)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.panelLight)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF5C6BC0).copy(alpha = 0.18f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Security,
                                contentDescription = null,
                                tint = Color(0xFF5C6BC0),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                role.name,
                                fontWeight = FontWeight.SemiBold,
                                color = colors.textPrimary,
                                fontSize = 15.sp
                            )
                            Text(
                                if (perms.isEmpty()) "No permissions"
                                else "${perms.size} permission(s)",
                                fontSize = 12.sp,
                                color = colors.textSecondary
                            )
                            Text(
                                perms.take(4).joinToString(", ") { it.name.replace('_', ' ') } +
                                    if (perms.size > 4) "…" else "",
                                fontSize = 11.sp,
                                color = colors.textSecondary,
                                maxLines = 2
                            )
                        }
                        IconButton(onClick = { viewModel.openEditRole(role) }) {
                            Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.edit), tint = AccentTeal)
                        }
                        if (!role.isSystem) {
                            IconButton(onClick = { viewModel.deleteRole(role.id) }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.delete),
                                    tint = Color(0xFFE57373)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.showUserDialog) {
        AlertDialog(
            onDismissRequest = viewModel::closeUserDialog,
            title = {
                Text(if (state.editingUserId == 0L) stringResource(R.string.add_user) else stringResource(R.string.edit_user))
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = state.formName,
                        onValueChange = viewModel::updateFormName,
                        label = { Text(stringResource(R.string.user_name)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.formEmail,
                        onValueChange = viewModel::updateFormEmail,
                        label = { Text(stringResource(R.string.email_optional)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(stringResource(R.string.assign_role), fontSize = 12.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        state.roles.forEach { role ->
                            FilterChip(
                                selected = state.formRoleId == role.id,
                                onClick = { viewModel.updateFormRoleId(role.id) },
                                label = { Text(role.name) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AccentTeal,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                    OutlinedTextField(
                        value = state.formPin,
                        onValueChange = viewModel::updateFormPin,
                        label = { Text(stringResource(R.string.pos_pin)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.formPassword,
                        onValueChange = viewModel::updateFormPassword,
                        label = { Text(stringResource(R.string.password_reset_new)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(checked = state.formActive, onCheckedChange = viewModel::updateFormActive)
                        Text(stringResource(R.string.user_active))
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::saveUser,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) { Text(stringResource(R.string.save)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeUserDialog) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    if (state.showRoleDialog && canManageRoles) {
        AlertDialog(
            onDismissRequest = viewModel::closeRoleDialog,
            title = {
                Text(if (state.editingRoleId == 0L) stringResource(R.string.add_role) else stringResource(R.string.edit_role))
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    OutlinedTextField(
                        value = state.formRoleName,
                        onValueChange = viewModel::updateFormRoleName,
                        label = { Text(stringResource(R.string.role_name)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(stringResource(R.string.permissions), fontWeight = FontWeight.SemiBold)
                    PosPermission.entries.forEach { permission ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = permission in state.formPermissions,
                                onCheckedChange = { viewModel.togglePermission(permission) }
                            )
                            Text(permission.name.replace('_', ' '), fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::saveRole,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) { Text(stringResource(R.string.save)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeRoleDialog) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}
