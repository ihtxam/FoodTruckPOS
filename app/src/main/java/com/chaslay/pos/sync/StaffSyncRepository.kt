package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.local.dao.RoleDao
import com.chaslay.pos.data.local.dao.UserDao
import com.chaslay.pos.data.local.entity.RoleEntity
import com.chaslay.pos.data.local.entity.UserEntity
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.domain.model.PosPermission
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StaffSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val roleDao: RoleDao,
    private val userDao: UserDao
) {
    suspend fun syncStaff(): StaffSyncResult {
        return try {
            val payload = syncApi.staff()
            val remoteRoles = payload.roles
            val remoteStaff = payload.staff

            val roleIdByRemote = mutableMapOf<String, Long>()
            for (remote in remoteRoles) {
                val perms = PosPermission.encode(
                    remote.permissions.mapNotNull { name ->
                        runCatching { PosPermission.valueOf(name) }.getOrNull()
                    }.toSet()
                )
                val existing = roleDao.getAll().find { it.name.equals(remote.name, ignoreCase = true) }
                val roleId = if (existing != null) {
                    roleDao.update(existing.copy(permissions = perms, isSystem = remote.isSystem))
                    existing.id
                } else {
                    roleDao.insert(RoleEntity(name = remote.name, permissions = perms, isSystem = remote.isSystem))
                }
                roleIdByRemote[remote.id] = roleId
            }

            var upserted = 0
            for (member in remoteStaff) {
                if (!member.isActive) continue
                val roleId = roleIdByRemote[member.roleId] ?: continue
                val syncEmail = "sync:${member.id}"
                val existing = userDao.getByEmail(syncEmail)
                val user = UserEntity(
                    id = existing?.id ?: 0L,
                    name = member.name,
                    email = syncEmail,
                    pinHash = member.pinHash,
                    passwordHash = null,
                    roleId = roleId,
                    isActive = true,
                    biometricEnabled = false,
                    createdAt = existing?.createdAt ?: System.currentTimeMillis()
                )
                if (existing == null) {
                    userDao.insert(user)
                } else {
                    userDao.update(user.copy(id = existing.id))
                }
                upserted++
            }
            StaffSyncResult(upserted = upserted, roleCount = remoteRoles.size)
        } catch (e: Exception) {
            Log.w(TAG, "Staff sync failed", e)
            StaffSyncResult(error = e.message)
        }
    }

    companion object {
        private const val TAG = "StaffSync"
    }
}

data class StaffSyncResult(
    val upserted: Int = 0,
    val roleCount: Int = 0,
    val error: String? = null
)
