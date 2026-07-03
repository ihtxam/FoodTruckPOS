package com.chaslay.pos.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.entity.RoleEntity
import com.chaslay.pos.data.local.entity.UserEntity
import com.chaslay.pos.data.repository.AuthRepository
import com.chaslay.pos.domain.model.PosPermission
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UserRow(
    val user: UserEntity,
    val roleName: String
)

data class UsersRolesUiState(
    val users: List<UserRow> = emptyList(),
    val roles: List<RoleEntity> = emptyList(),
    val showUserDialog: Boolean = false,
    val showRoleDialog: Boolean = false,
    val editingUserId: Long = 0L,
    val editingRoleId: Long = 0L,
    val formName: String = "",
    val formEmail: String = "",
    val formRoleId: Long = 1L,
    val formPin: String = "",
    val formPassword: String = "",
    val formActive: Boolean = true,
    val formRoleName: String = "",
    val formPermissions: Set<PosPermission> = emptySet(),
    val message: String? = null
)

@HiltViewModel
class UsersRolesViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(UsersRolesUiState())
    val uiState: StateFlow<UsersRolesUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val roles = authRepository.getAllRoles()
            val users = authRepository.getAllUsersWithRoles().map { (user, role) ->
                UserRow(user, role?.name ?: "?")
            }
            _uiState.update {
                it.copy(
                    users = users,
                    roles = roles,
                    formRoleId = roles.firstOrNull()?.id ?: 1L
                )
            }
        }
    }

    fun openNewUser() {
        val defaultRole = _uiState.value.roles.firstOrNull()?.id ?: 1L
        _uiState.update {
            it.copy(
                showUserDialog = true,
                editingUserId = 0L,
                formName = "",
                formEmail = "",
                formRoleId = defaultRole,
                formPin = "",
                formPassword = "",
                formActive = true
            )
        }
    }

    fun openEditUser(user: UserEntity) {
        _uiState.update {
            it.copy(
                showUserDialog = true,
                editingUserId = user.id,
                formName = user.name,
                formEmail = user.email.orEmpty(),
                formRoleId = user.roleId,
                formPin = "",
                formPassword = "",
                formActive = user.isActive
            )
        }
    }

    fun closeUserDialog() = _uiState.update { it.copy(showUserDialog = false) }

    fun updateFormName(v: String) = _uiState.update { it.copy(formName = v) }
    fun updateFormEmail(v: String) = _uiState.update { it.copy(formEmail = v) }
    fun updateFormRoleId(v: Long) = _uiState.update { it.copy(formRoleId = v) }
    fun updateFormPin(v: String) = _uiState.update { it.copy(formPin = v) }
    fun updateFormPassword(v: String) = _uiState.update { it.copy(formPassword = v) }
    fun updateFormActive(v: Boolean) = _uiState.update { it.copy(formActive = v) }

    fun saveUser() {
        viewModelScope.launch {
            val state = _uiState.value
            if (state.formName.isBlank()) {
                _uiState.update { it.copy(message = "Enter a name") }
                return@launch
            }
            if (state.editingUserId == 0L && state.formPin.isBlank() && state.formPassword.isBlank()) {
                _uiState.update { it.copy(message = "Set a PIN or password") }
                return@launch
            }
            authRepository.saveUser(
                id = state.editingUserId,
                name = state.formName,
                email = state.formEmail,
                roleId = state.formRoleId,
                pin = state.formPin.takeIf { it.isNotBlank() },
                password = state.formPassword.takeIf { it.isNotBlank() },
                isActive = state.formActive
            )
            _uiState.update { it.copy(showUserDialog = false, message = "User saved") }
            refresh()
        }
    }

    fun resetPin(userId: Long, newPin: String) {
        viewModelScope.launch {
            if (newPin.length < 4) {
                _uiState.update { it.copy(message = "PIN must be at least 4 digits") }
                return@launch
            }
            authRepository.resetUserPin(userId, newPin)
            _uiState.update { it.copy(message = "PIN updated") }
        }
    }

    fun resetPassword(userId: Long, newPassword: String) {
        viewModelScope.launch {
            if (newPassword.length < 6) {
                _uiState.update { it.copy(message = "Password must be at least 6 characters") }
                return@launch
            }
            authRepository.resetUserPassword(userId, newPassword)
            _uiState.update { it.copy(message = "Password updated") }
        }
    }

    fun openNewRole() {
        _uiState.update {
            it.copy(
                showRoleDialog = true,
                editingRoleId = 0L,
                formRoleName = "",
                formPermissions = setOf(PosPermission.USE_POS)
            )
        }
    }

    fun openEditRole(role: RoleEntity) {
        _uiState.update {
            it.copy(
                showRoleDialog = true,
                editingRoleId = role.id,
                formRoleName = role.name,
                formPermissions = PosPermission.decode(role.permissions)
            )
        }
    }

    fun closeRoleDialog() = _uiState.update { it.copy(showRoleDialog = false) }

    fun updateFormRoleName(v: String) = _uiState.update { it.copy(formRoleName = v) }

    fun togglePermission(permission: PosPermission) {
        _uiState.update { state ->
            val next = state.formPermissions.toMutableSet()
            if (permission in next) next.remove(permission) else next.add(permission)
            state.copy(formPermissions = next)
        }
    }

    fun saveRole() {
        viewModelScope.launch {
            val state = _uiState.value
            if (state.formRoleName.isBlank()) {
                _uiState.update { it.copy(message = "Enter a role name") }
                return@launch
            }
            if (state.formPermissions.isEmpty()) {
                _uiState.update { it.copy(message = "Select at least one permission") }
                return@launch
            }
            val existing = state.roles.find { it.id == state.editingRoleId }
            authRepository.saveRole(
                id = state.editingRoleId,
                name = state.formRoleName,
                permissions = state.formPermissions,
                isSystem = existing?.isSystem ?: false
            )
            _uiState.update { it.copy(showRoleDialog = false, message = "Role saved") }
            refresh()
        }
    }

    fun deleteRole(roleId: Long) {
        viewModelScope.launch {
            authRepository.deleteRole(roleId)
                .onSuccess { _uiState.update { it.copy(message = "Role deleted") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message ?: "Cannot delete role") } }
            refresh()
        }
    }

    fun clearMessage() = _uiState.update { it.copy(message = null) }
}
