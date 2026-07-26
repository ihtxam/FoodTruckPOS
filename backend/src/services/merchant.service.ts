import crypto from "crypto";
import { getDb, schema } from "@/db";
import { eq, and, like, desc, or, lt, gt } from "drizzle-orm";
import { AuthService } from "./auth.service";
import { generateSyncApiKey } from "./chaslay-compat.service";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cryptoRandomSecret() {
  return crypto.randomBytes(48).toString("hex");
}

export class MerchantService {
  /**
   * Get all merchants with pagination + device/license counts
   */
  static async getAllMerchants(page: number = 1, limit: number = 20, search?: string) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      const where = search
        ? or(
            like(schema.merchants.name, `%${search}%`),
            like(schema.merchants.email, `%${search}%`),
            like(schema.merchants.slug, `%${search}%`)
          )
        : undefined;

      const merchants = await db.query.merchants.findMany({
        where,
        limit,
        offset,
        orderBy: desc(schema.merchants.createdAt),
        with: {
          devices: true,
          licenses: true,
        },
      });

      return merchants.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        address: m.address,
        city: m.city,
        country: m.country,
        slug: m.slug,
        shopEnabled: m.shopEnabled,
        status: m.status,
        subscriptionPlan: m.subscriptionPlan,
        trialEndsAt: m.trialEndsAt,
        subscriptionEndsAt: m.subscriptionEndsAt,
        createdAt: m.createdAt,
        devices: m.devices?.length ?? 0,
        licenses: m.licenses?.length ?? 0,
        activeLicenses: m.licenses?.filter((l) => l.status === "active").length ?? 0,
      }));
    } catch (error) {
      console.error("Error getting merchants:", error);
      throw error;
    }
  }

  /**
   * Get merchant by ID
   */
  static async getMerchantById(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        with: {
          devices: true,
          licenses: true,
          orders: {
            limit: 10,
            orderBy: desc(schema.orders.createdAt),
          },
        },
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      return merchant;
    } catch (error) {
      console.error("Error getting merchant:", error);
      throw error;
    }
  }

  /**
   * Create merchant (by superadmin)
   */
  static async createMerchant(
    email: string,
    password: string | undefined,
    businessName: string,
    _contactName?: string,
    phone?: string,
    address?: string,
    city?: string,
    country?: string,
    options?: {
      slug?: string;
      shopEnabled?: boolean;
      subscriptionPlan?: string;
      status?: string;
      deviceSeats?: number;
      licenseType?: "trial" | "yearly" | "custom";
      customDays?: number;
      /** Send password-setup invite email after create (default true when no password) */
      sendInvite?: boolean;
    }
  ) {
    const db = getDb();

    try {
      const existing = await db.query.merchants.findFirst({
        where: eq(schema.merchants.email, email),
      });
      if (existing) {
        throw new Error("Email already registered");
      }

      const hasPassword = !!(password && password.trim().length >= 8);
      if (password && password.trim() && !hasPassword) {
        throw new Error("Password must be at least 8 characters");
      }

      // Random unusable hash when inviting merchant to set their own password
      const passwordHash = hasPassword
        ? await AuthService.hashPassword(password!.trim())
        : await AuthService.hashPassword(cryptoRandomSecret());
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      let slug = options?.slug ? slugify(options.slug) : slugify(businessName);
      if (slug) {
        const slugTaken = await db.query.merchants.findFirst({
          where: eq(schema.merchants.slug, slug),
        });
        if (slugTaken) {
          slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }
      }

      const merchant = await db
        .insert(schema.merchants)
        .values({
          email,
          passwordHash,
          passwordSetAt: hasPassword ? now : null,
          name: businessName,
          phone,
          address,
          city,
          country: country || "CH",
          slug: slug || null,
          shopEnabled: options?.shopEnabled ?? true,
          status: options?.status || "trial",
          subscriptionPlan: options?.subscriptionPlan || "starter",
          trialEndsAt,
          syncApiKey: generateSyncApiKey(),
        })
        .returning();

      const created = merchant[0];
      let issuedLicenses: Array<{ deviceId: string; deviceName: string; licenseKey: string; expiresAt: Date }> = [];

      const seats = Math.max(0, Math.min(20, options?.deviceSeats ?? 0));
      if (seats > 0) {
        const { LicenseAdminService } = await import("./license-admin.service");
        const issued = await LicenseAdminService.issueDeviceSeats(
          created.id,
          seats,
          options?.licenseType || "yearly",
          options?.customDays
        );
        issuedLicenses = issued;
      }

      // Default: send invite when no password was set; admin can also force sendInvite: true
      const sendInvite = options?.sendInvite ?? !hasPassword;
      let invite: Awaited<
        ReturnType<typeof import("./merchant-invite.service").MerchantInviteService.sendInviteEmail>
      > | null = null;

      if (sendInvite) {
        const { MerchantInviteService } = await import("./merchant-invite.service");
        invite = await MerchantInviteService.sendInviteEmail(created.id);
      }

      // Don't leak password hash to API clients
      const { passwordHash: _ph, inviteTokenHash: _ith, ...safe } = created as typeof created & {
        passwordHash: string;
        inviteTokenHash?: string | null;
      };

      return { ...safe, issuedLicenses, invite, passwordSet: hasPassword };
    } catch (error) {
      console.error("Error creating merchant:", error);
      throw error;
    }
  }

  /**
   * Update merchant details
   */
  static async updateMerchant(merchantId: string, updates: Partial<typeof schema.merchants.$inferInsert>) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error updating merchant:", error);
      throw error;
    }
  }

  /**
   * Suspend merchant account
   */
  static async suspendMerchant(merchantId: string, reason?: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error suspending merchant:", error);
      throw error;
    }
  }

  /**
   * Reactivate merchant account
   */
  static async reactivateMerchant(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error reactivating merchant:", error);
      throw error;
    }
  }

  /**
   * Delete merchant (soft delete)
   */
  static async deleteMerchant(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error deleting merchant:", error);
      throw error;
    }
  }

  /**
   * Get merchant analytics
   */
  static async getMerchantAnalytics(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      // Get order count and total revenue
      const orders = await db.query.orders.findMany({
        where: eq(schema.orders.merchantId, merchantId),
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      // Get device count
      const devices = await db.query.devices.findMany({
        where: eq(schema.devices.merchantId, merchantId),
      });

      // Get license info
      const licenses = await db.query.licenses.findMany({
        where: eq(schema.licenses.merchantId, merchantId),
      });

      const activeLicenses = licenses.filter((l) => l.status === "active").length;

      return {
        merchant: {
          id: merchant.id,
          name: merchant.name,
          email: merchant.email,
          status: merchant.status,
          subscriptionPlan: merchant.subscriptionPlan,
          createdAt: merchant.createdAt,
        },
        analytics: {
          totalOrders,
          totalRevenue,
          deviceCount: devices.length,
          activeLicenses,
          trialEndsAt: merchant.trialEndsAt,
          subscriptionEndsAt: merchant.subscriptionEndsAt,
        },
      };
    } catch (error) {
      console.error("Error getting merchant analytics:", error);
      throw error;
    }
  }

  /**
   * Upgrade merchant subscription
   */
  static async upgradeMerchantSubscription(
    merchantId: string,
    plan: "starter" | "professional" | "enterprise"
  ) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          subscriptionPlan: plan,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      throw error;
    }
  }

  /**
   * Get merchants by status
   */
  static async getMerchantsByStatus(status: string) {
    const db = getDb();

    try {
      const merchants = await db.query.merchants.findMany({
        where: eq(schema.merchants.status, status),
        orderBy: desc(schema.merchants.createdAt),
      });

      return merchants;
    } catch (error) {
      console.error("Error getting merchants by status:", error);
      throw error;
    }
  }

  /**
   * Get merchants with expiring licenses
   */
  static async getMerchantsWithExpiringLicenses(daysThreshold: number = 35) {
    const db = getDb();

    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

      const licenses = await db.query.licenses.findMany({
        where: and(
          eq(schema.licenses.status, "active"),
          lt(schema.licenses.expiresAt, thresholdDate),
          gt(schema.licenses.expiresAt, now)
        ),
        with: {
          merchant: true,
        },
      });

      return licenses.map((l) => ({
        merchant: l.merchant,
        expiresAt: l.expiresAt,
        daysRemaining: Math.ceil((l.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));
    } catch (error) {
      console.error("Error getting merchants with expiring licenses:", error);
      throw error;
    }
  }
}
