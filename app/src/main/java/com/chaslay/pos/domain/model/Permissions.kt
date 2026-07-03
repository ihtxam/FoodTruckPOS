package com.chaslay.pos.domain.model

enum class PosPermission {
    USE_POS,
    PROCESS_PAYMENTS,
    APPLY_DISCOUNTS,
    OPEN_CASH_DRAWER,
    SEND_KITCHEN,
    MANAGE_TABLES,
    TAKEAWAY_ORDERS,
    DELIVERY_ORDERS,
    VIEW_ORDER_HISTORY,
    CANCEL_ORDERS,
    REFUND_ORDERS,
    VIEW_REPORTS,
    MANAGE_PRODUCTS,
    ACCESS_SETTINGS,
    MANAGE_USERS,
    MANAGE_ROLES,
    END_OF_DAY;

    companion object {
        fun all(): Set<PosPermission> = entries.toSet()

        fun encode(permissions: Set<PosPermission>): String =
            permissions.joinToString(",") { it.name }

        fun decode(raw: String?): Set<PosPermission> {
            if (raw.isNullOrBlank()) return emptySet()
            return raw.split(",")
                .mapNotNull { name ->
                    runCatching { valueOf(name.trim()) }.getOrNull()
                }
                .toSet()
        }
    }
}

data class UserAccess(
    val roleId: Long,
    val roleName: String,
    val permissions: Set<PosPermission>
) {
    fun has(permission: PosPermission): Boolean = permission in permissions

    fun canAccessSettings(): Boolean = has(PosPermission.ACCESS_SETTINGS)
    fun canAccessReports(): Boolean = has(PosPermission.VIEW_REPORTS)
    fun canManageProducts(): Boolean = has(PosPermission.MANAGE_PRODUCTS)
    fun canManageUsers(): Boolean = has(PosPermission.MANAGE_USERS)
    fun canManageRoles(): Boolean = has(PosPermission.MANAGE_ROLES)
    fun canProcessPayments(): Boolean = has(PosPermission.PROCESS_PAYMENTS)
    fun canApplyDiscounts(): Boolean = has(PosPermission.APPLY_DISCOUNTS)
    fun canCancelOrders(): Boolean = has(PosPermission.CANCEL_ORDERS)
    fun canRefundOrders(): Boolean = has(PosPermission.REFUND_ORDERS)
    fun canViewOrderHistory(): Boolean = has(PosPermission.VIEW_ORDER_HISTORY)
    fun canManageDelivery(): Boolean = has(PosPermission.DELIVERY_ORDERS)
    fun canManageTakeaway(): Boolean = has(PosPermission.TAKEAWAY_ORDERS)
    fun canManageTables(): Boolean = has(PosPermission.MANAGE_TABLES)

    companion object {
        val FULL_ACCESS = UserAccess(
            roleId = 1,
            roleName = "Admin",
            permissions = PosPermission.all()
        )
    }
}
