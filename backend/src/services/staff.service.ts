import { getDb, schema } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { AuthService } from "@/services/auth.service";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_TEMPLATES,
  encodePermissions,
  parsePermissions,
  type Permission,
} from "@/lib/permissions";

export class StaffService {
  static async ensureDefaultRoles(merchantId: string) {
    const db = getDb();
    const existing = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    if (existing.length === 0) {
      await db.insert(schema.merchantRoles).values(
        DEFAULT_ROLE_TEMPLATES.map((t) => ({
          merchantId,
          name: t.name,
          permissions: encodePermissions(t.permissions),
          isSystem: t.isSystem,
          sortOrder: t.sortOrder,
        }))
      );
    }
    // Waiters must never see company-wide sales / EOD aggregates.
    await this.enforceWaiterReportRestrictions(merchantId);
    return db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
  }

  /** Strip VIEW_REPORTS / END_OF_DAY from system Waiter role (keep other custom perms). */
  static async enforceWaiterReportRestrictions(merchantId: string) {
    const db = getDb();
    const roles = await db.query.merchantRoles.findMany({
      where: and(eq(schema.merchantRoles.merchantId, merchantId), eq(schema.merchantRoles.isSystem, true)),
    });
    for (const role of roles) {
      if (!role.name.trim().toLowerCase().startsWith("waiter")) continue;
      const perms = parsePermissions(role.permissions);
      const next = perms.filter((p) => p !== "VIEW_REPORTS" && p !== "END_OF_DAY");
      if (next.length === perms.length) continue;
      await db
        .update(schema.merchantRoles)
        .set({ permissions: encodePermissions(next), updatedAt: new Date() })
        .where(eq(schema.merchantRoles.id, role.id));
    }
  }

  static async listRoles(merchantId: string) {
    await this.ensureDefaultRoles(merchantId);
    const db = getDb();
    return db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
      orderBy: asc(schema.merchantRoles.sortOrder),
    });
  }

  static async updateRole(
    merchantId: string,
    roleId: string,
    updates: { name?: string; permissions?: Permission[] }
  ) {
    const db = getDb();
    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Role not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim().slice(0, 100);
      if (!name) throw new Error("Role name is required");
      patch.name = name;
    }
    if (updates.permissions !== undefined) {
      patch.permissions = encodePermissions(updates.permissions);
    }

    const [row] = await db
      .update(schema.merchantRoles)
      .set(patch)
      .where(eq(schema.merchantRoles.id, roleId))
      .returning();
    return row;
  }

  static async createRole(merchantId: string, name: string, permissions: Permission[]) {
    const db = getDb();
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) throw new Error("Role name is required");

    const [row] = await db
      .insert(schema.merchantRoles)
      .values({
        merchantId,
        name: trimmed,
        permissions: encodePermissions(permissions),
        isSystem: false,
        sortOrder: 100,
      })
      .returning();
    return row;
  }

  static async deleteRole(merchantId: string, roleId: string) {
    const db = getDb();
    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Role not found");
    if (role.isSystem) throw new Error("System roles cannot be deleted");

    const inUse = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.roleId, roleId),
    });
    if (inUse) throw new Error("Role is assigned to staff members");

    await db.delete(schema.merchantRoles).where(eq(schema.merchantRoles.id, roleId));
  }

  static async listStaff(merchantId: string) {
    await this.ensureDefaultRoles(merchantId);
    const db = getDb();
    const staff = await db.query.merchantStaff.findMany({
      where: eq(schema.merchantStaff.merchantId, merchantId),
      orderBy: asc(schema.merchantStaff.name),
    });
    const roles = await this.listRoles(merchantId);
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    return staff.map((s) => {
      const role = roleMap.get(s.roleId);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        roleId: s.roleId,
        roleName: role?.name || "Unknown",
        permissions: parsePermissions(role?.permissions),
        canAccessPanel: s.canAccessPanel,
        isActive: s.isActive,
        pinSet: !!s.pinHash,
        passwordSet: !!s.passwordHash,
        createdAt: s.createdAt,
      };
    });
  }

  static async createStaff(
    merchantId: string,
    input: {
      name: string;
      roleId: string;
      pin?: string;
      email?: string;
      password?: string;
      canAccessPanel?: boolean;
    }
  ) {
    const db = getDb();
    const name = input.name.trim().slice(0, 255);
    if (!name) throw new Error("Name is required");

    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, input.roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Invalid role");

    const email = input.email?.trim().toLowerCase() || null;
    if (email) {
      const dup = await db.query.merchantStaff.findFirst({
        where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.email, email)),
      });
      if (dup) throw new Error("Email already used by another staff member");
    }

    const pin = input.pin?.trim();
    if (pin && (pin.length < 4 || pin.length > 8)) {
      throw new Error("PIN must be 4–8 digits");
    }

    const canAccessPanel = !!input.canAccessPanel;
    if (canAccessPanel && !email) {
      throw new Error("Email is required for panel access");
    }
    if (canAccessPanel && !input.password?.trim()) {
      throw new Error("Password is required for panel access");
    }

    const [row] = await db
      .insert(schema.merchantStaff)
      .values({
        merchantId,
        roleId: input.roleId,
        name,
        email,
        pinHash: pin ? await AuthService.hashPassword(pin) : null,
        passwordHash: input.password?.trim() ? await AuthService.hashPassword(input.password.trim()) : null,
        canAccessPanel,
        isActive: true,
      })
      .returning();

    return this.formatStaff(row, role);
  }

  static async updateStaff(
    merchantId: string,
    staffId: string,
    input: {
      name?: string;
      roleId?: string;
      pin?: string | null;
      email?: string | null;
      password?: string | null;
      canAccessPanel?: boolean;
      isActive?: boolean;
    }
  ) {
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(eq(schema.merchantStaff.id, staffId), eq(schema.merchantStaff.merchantId, merchantId)),
    });
    if (!staff) throw new Error("Staff member not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = input.name.trim().slice(0, 255);
      if (!name) throw new Error("Name is required");
      patch.name = name;
    }
    if (input.roleId !== undefined) {
      const role = await db.query.merchantRoles.findFirst({
        where: and(eq(schema.merchantRoles.id, input.roleId), eq(schema.merchantRoles.merchantId, merchantId)),
      });
      if (!role) throw new Error("Invalid role");
      patch.roleId = input.roleId;
    }
    if (input.email !== undefined) {
      const email = input.email?.trim().toLowerCase() || null;
      if (email) {
        const dup = await db.query.merchantStaff.findFirst({
          where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.email, email)),
        });
        if (dup && dup.id !== staffId) throw new Error("Email already used");
      }
      patch.email = email;
    }
    if (input.pin !== undefined) {
      if (input.pin === null || input.pin === "") {
        patch.pinHash = null;
      } else {
        const pin = String(input.pin).trim();
        if (pin.length < 4 || pin.length > 8) throw new Error("PIN must be 4–8 digits");
        patch.pinHash = await AuthService.hashPassword(pin);
      }
    }
    if (input.password !== undefined) {
      if (input.password === null || input.password === "") {
        patch.passwordHash = null;
      } else {
        patch.passwordHash = await AuthService.hashPassword(String(input.password).trim());
      }
    }
    if (input.canAccessPanel !== undefined) patch.canAccessPanel = !!input.canAccessPanel;
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;

    const [row] = await db
      .update(schema.merchantStaff)
      .set(patch)
      .where(eq(schema.merchantStaff.id, staffId))
      .returning();

    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, row.roleId),
    });
    return this.formatStaff(row, role!);
  }

  static async deleteStaff(merchantId: string, staffId: string) {
    const db = getDb();
    await db
      .delete(schema.merchantStaff)
      .where(and(eq(schema.merchantStaff.id, staffId), eq(schema.merchantStaff.merchantId, merchantId)));
  }

  static async verifyPin(merchantId: string, pin: string) {
    const db = getDb();
    const normalized = pin.trim();
    if (!normalized) throw new Error("PIN is required");

    const staffList = await db.query.merchantStaff.findMany({
      where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true)),
    });

    for (const staff of staffList) {
      if (!staff.pinHash) continue;
      const ok = await AuthService.comparePassword(normalized, staff.pinHash);
      if (!ok) continue;

      const role = await db.query.merchantRoles.findFirst({
        where: eq(schema.merchantRoles.id, staff.roleId),
      });
      const permissions = parsePermissions(role?.permissions);
      return {
        id: staff.id,
        name: staff.name,
        roleId: staff.roleId,
        roleName: role?.name || "Staff",
        permissions,
      };
    }

    throw new Error("Invalid PIN");
  }

  static async loginStaff(email: string, password: string) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(eq(schema.merchantStaff.email, normalized), eq(schema.merchantStaff.isActive, true)),
    });

    if (!staff || !staff.canAccessPanel || !staff.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const ok = await AuthService.comparePassword(password, staff.passwordHash);
    if (!ok) throw new Error("Invalid email or password");

    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, staff.roleId),
    });
    const permissions = parsePermissions(role?.permissions);
    if (!permissions.includes("ACCESS_PANEL")) {
      throw new Error("This account does not have panel access");
    }

    return {
      staff,
      role,
      permissions,
    };
  }

  static async getSyncPayload(merchantId: string) {
    await this.ensureDefaultRoles(merchantId);
    const roles = await this.listRoles(merchantId);
    const staff = await dbStaffForSync(merchantId);

    return {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: parsePermissions(r.permissions),
        isSystem: r.isSystem,
      })),
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        roleId: s.roleId,
        pinHash: s.pinHash,
        isActive: s.isActive,
      })),
    };
  }

  private static formatStaff(
    staff: typeof schema.merchantStaff.$inferSelect,
    role: typeof schema.merchantRoles.$inferSelect
  ) {
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      roleId: staff.roleId,
      roleName: role.name,
      permissions: parsePermissions(role.permissions),
      canAccessPanel: staff.canAccessPanel,
      isActive: staff.isActive,
      pinSet: !!staff.pinHash,
      passwordSet: !!staff.passwordHash,
    };
  }
}

async function dbStaffForSync(merchantId: string) {
  const db = getDb();
  return db.query.merchantStaff.findMany({
    where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true)),
  });
}

export { ALL_PERMISSIONS };
