import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { getDb, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export interface JWTPayload {
  id: string;
  email: string;
  role: "superadmin" | "merchant" | "customer" | "staff";
  merchantId?: string;
  customerId?: string;
  staffId?: string;
  name?: string;
  roleName?: string;
  permissions?: string[];
  /** Set when a superadmin opens a merchant panel */
  impersonatedBy?: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 10;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
  private static readonly JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRY as SignOptions["expiresIn"],
    });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Register a new merchant
   */
  static async registerMerchant(
    email: string,
    password: string,
    name: string,
    businessName: string
  ) {
    const db = getDb();

    try {
      // Check if merchant already exists
      const existing = await db.query.merchants.findFirst({
        where: eq(schema.merchants.email, email),
      });

      if (existing) {
        throw new Error("Merchant already exists");
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create merchant
      const merchant = await db
        .insert(schema.merchants)
        .values({
          email,
          passwordHash,
          name: businessName,
          status: "active",
          subscriptionPlan: "free",
        })
        .returning();

      return {
        id: merchant[0].id,
        email: merchant[0].email,
        name: merchant[0].name,
      };
    } catch (error) {
      console.error("Error registering merchant:", error);
      throw error;
    }
  }

  /**
   * Login merchant owner or staff with panel access
   */
  static async loginMerchant(email: string, password: string) {
    try {
      return await this.loginMerchantOwner(email, password);
    } catch (ownerError) {
      try {
        return await this.loginMerchantStaff(email, password);
      } catch {
        throw ownerError;
      }
    }
  }

  static async loginMerchantOwner(email: string, password: string) {
    const db = getDb();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const merchants = await db
      .select()
      .from(schema.merchants)
      .where(sql`lower(${schema.merchants.email}) = ${normalizedEmail}`)
      .limit(1);
    const merchant = merchants[0];

    if (!merchant) {
      throw new Error("Invalid email or password");
    }

    const isValid = await this.comparePassword(password, merchant.passwordHash);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    if (merchant.status !== "active" && merchant.status !== "trial") {
      throw new Error(`Merchant account is ${merchant.status}`);
    }

    const token = this.generateToken({
      id: merchant.id,
      email: merchant.email,
      role: "merchant",
      merchantId: merchant.id,
      name: merchant.name,
    });

    return {
      token,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        status: merchant.status,
      },
      isOwner: true,
    };
  }

  static async loginMerchantStaff(email: string, password: string) {
    const { StaffService } = await import("@/services/staff.service");
    const { staff, role, permissions } = await StaffService.loginStaff(email, password);

    const token = this.generateToken({
      id: staff.id,
      email: staff.email || email,
      role: "staff",
      merchantId: staff.merchantId,
      staffId: staff.id,
      name: staff.name,
      roleName: role?.name,
      permissions,
    });

    return {
      token,
      merchant: {
        id: staff.merchantId,
        email: staff.email || email,
        name: staff.name,
        status: "active",
        staffId: staff.id,
        roleName: role?.name,
        permissions,
      },
      isOwner: false,
    };
  }

  /**
   * Register superadmin
   */
  static async registerSuperadmin(email: string, password: string, name: string) {
    const db = getDb();

    try {
      // Check if superadmin already exists
      const existing = await db.query.superadmins.findFirst({
        where: eq(schema.superadmins.email, email),
      });

      if (existing) {
        throw new Error("Superadmin already exists");
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create superadmin
      const superadmin = await db
        .insert(schema.superadmins)
        .values({
          email,
          passwordHash,
          name,
          role: "superadmin",
          isActive: true,
        })
        .returning();

      return {
        id: superadmin[0].id,
        email: superadmin[0].email,
        name: superadmin[0].name,
      };
    } catch (error) {
      console.error("Error registering superadmin:", error);
      throw error;
    }
  }

  /**
   * Login superadmin
   */
  static async loginSuperadmin(email: string, password: string) {
    const db = getDb();

    try {
      // Find superadmin
      const superadmin = await db.query.superadmins.findFirst({
        where: eq(schema.superadmins.email, email),
      });

      if (!superadmin) {
        throw new Error("Invalid email or password");
      }

      // Verify password
      const isValid = await this.comparePassword(password, superadmin.passwordHash);
      if (!isValid) {
        throw new Error("Invalid email or password");
      }

      // Check if superadmin is active
      if (!superadmin.isActive) {
        throw new Error("Superadmin account is inactive");
      }

      // Generate token
      const token = this.generateToken({
        id: superadmin.id,
        email: superadmin.email,
        role: "superadmin",
      });

      return {
        token,
        superadmin: {
          id: superadmin.id,
          email: superadmin.email,
          name: superadmin.name,
        },
      };
    } catch (error) {
      console.error("Error logging in superadmin:", error);
      throw error;
    }
  }

  /**
   * Issue a merchant JWT so a superadmin can open that merchant's panel.
   */
  static async impersonateMerchant(superadminId: string, merchantId: string) {
    const db = getDb();

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    if (!merchant) {
      throw new Error("Merchant not found");
    }

    if (merchant.status === "suspended" || merchant.status === "expired") {
      throw new Error(`Cannot open panel: merchant is ${merchant.status}`);
    }

    const token = this.generateToken({
      id: merchant.id,
      email: merchant.email,
      role: "merchant",
      merchantId: merchant.id,
      name: merchant.name,
      impersonatedBy: superadminId,
    });

    return {
      token,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        status: merchant.status,
      },
      impersonatedBy: superadminId,
    };
  }

  /**
   * Verify merchant email (for password reset, etc.)
   */
  static async getMerchantById(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      return {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        status: merchant.status,
      };
    } catch (error) {
      console.error("Error getting merchant:", error);
      throw error;
    }
  }

  /**
   * Update merchant password
   */
  static async updateMerchantPassword(merchantId: string, newPassword: string) {
    const db = getDb();

    try {
      const passwordHash = await this.hashPassword(newPassword);

      await db
        .update(schema.merchants)
        .set({ passwordHash })
        .where(eq(schema.merchants.id, merchantId));

      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  }
}
