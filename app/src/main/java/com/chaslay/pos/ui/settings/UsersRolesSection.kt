package com.chaslay.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PosPermission

@Composable
fun UsersRolesSection(
    canManageRoles: Boolean,
    viewModel: UsersRolesViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.message) {
        state.message?.let {
            kotlinx.coroutines.delay(2500)
            viewModel.clearMessage()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.users_accounts), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(stringResource(R.string.users_accounts_help), fontSize = 12.sp)
        state.message?.let { Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.primary) }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = viewModel::openNewUser) { Text(stringResource(R.string.add_user)) }
            if (canManageRoles) {
                OutlinedButton(onClick = viewModel::openNewRole) { Text(stringResource(R.string.add_role)) }
            }
        }

        Text(stringResource(R.string.users_list), fontWeight = FontWeight.SemiBold)
        state.users.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(row.user.name, fontWeight = FontWeight.Medium)
                    Text("${row.roleName}${if (!row.user.isActive) " (inactive)" else ""}", fontSize = 12.sp)
                    row.user.email?.let { Text(it, fontSize = 11.sp) }
                }
                OutlinedButton(onClick = { viewModel.openEditUser(row.user) }) {
                    Text(stringResource(R.string.edit))
                }
            }
        }

        if (canManageRoles) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text(stringResource(R.string.roles_list), fontWeight = FontWeight.SemiBold)
            state.roles.forEach { role ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(role.name, fontWeight = FontWeight.Medium)
                        Text(
                            PosPermission.decode(role.permissions).joinToString(", ") { it.name },
                            fontSize = 10.sp,
                            maxLines = 2
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        OutlinedButton(onClick = { viewModel.openEditRole(role) }) {
                            Text(stringResource(R.string.edit))
                        }
                        if (!role.isSystem) {
                            TextButton(onClick = { viewModel.deleteRole(role.id) }) {
                                Text(stringResource(R.string.delete))
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
                                label = { Text(role.name) }
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
                Button(onClick = viewModel::saveUser) { Text(stringResource(R.string.save)) }
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
                Button(onClick = viewModel::saveRole) { Text(stringResource(R.string.save)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeRoleDialog) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}
