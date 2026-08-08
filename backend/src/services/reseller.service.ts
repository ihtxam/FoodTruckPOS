import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";
import { EditionService } from "@/services/edition.service";
import { MerchantService } from "@/services/merchant.service";

function serializeReseller(row: typeof schema.resellers.$inferSelect, merchantCount = 0) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    branding: row.branding,
    createdBySuperadminId: row.createdBySuperadminId,
    merchantCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ResellerService {
  static async ensureChaslayAgency(createdBySuperadminId?: string | null) {
    const db = getDb();
    const email = (process.env.SEED_RESELLER_EMAIL || "agency@chaslay.com").toLowerCase();
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, email),
    });
    if (existing) return serializeReseller(existing);

    const password = process.env.SEED_RESELLER_PASSWORD || "ChaslayAgency123!";
    const name = process.env.SEED_RESELLER_NAME || "Chaslay";
    const passwordHash = await AuthService.hashPassword(password);
    const [row] = await db
      .insert(schema.resellers)
      .values({
        name,
        email,
        passwordHash,
        status: "active",
        createdBySuperadminId: createdBySuperadminId || null,
      })
      .returning();

    // Attach legacy merchants without reseller to this agency + Full edition
    const fullId = await EditionService.getLegacyFullEditionId();
    if (row) {
      await db
        .update(schema.merchants)
        .set({ resellerId: row.id, updatedAt: new Date() })
        .where(isNull(schema.merchants.resellerId));
      if (fullId) {
        await db
          .update(schema.merchants)
          .set({ editionId: fullId, updatedAt: new Date() })
          .where(and(eq(schema.merchants.resellerId, row.id), isNull(schema.merchants.editionId)));
      }
    }

    return serializeReseller(row!);
  }

  static async list(opts?: { search?: string; status?: string }) {
    await this.ensureChaslayAgency();
    const db = getDb();
    const clauses = [];
    if (opts?.status) clauses.push(eq(schema.resellers.status, opts.status));
    if (opts?.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      clauses.push(or(ilike(schema.resellers.name, q), ilike(schema.resellers.email, q))!);
    }
    const rows = await db
      .select()
      .from(schema.resellers)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(schema.resellers.createdAt));

    const counts = await db
      .select({
        resellerId: schema.merchants.resellerId,
        c: count(),
      })
      .from(schema.merchants)
      .groupBy(schema.merchants.resellerId);
    const map = new Map(counts.map((r) => [r.resellerId, Number(r.c)]));
    return rows.map((r) => serializeReseller(r, map.get(r.id) || 0));
  }

  static async getById(id: string) {
    const db = getDb();
    const row = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, id),
    });
    if (!row) return null;
    const [{ c }] = await db
      .select({ c: count() })
      .from(schema.merchants)
      .where(eq(schema.merchants.resellerId, id));
    return serializeReseller(row, Number(c || 0));
  }

  static async create(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    createdBySuperadminId?: string;
  }) {
    const db = getDb();
    const email = String(input.email || "").trim().toLowerCase();
    if (!email || !input.name?.trim()) throw new Error("Name and email are required");
    if (!input.password || input.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, email),
    });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await AuthService.hashPassword(input.password);
    const [row] = await db
      .insert(schema.resellers)
      .values({
        name: input.name.trim(),
        email,
        passwordHash,
        phone: input.phone?.trim() || null,
        status: "active",
        createdBySuperadminId: input.createdBySuperadminId || null,
      })
      .returning();
    return serializeReseller(row!);
  }

  static async update(
    id: string,
    input: { name?: string; phone?: string; status?: string; password?: string }
  ) {
    const db = getDb();
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, id),
    });
    if (!existing) throw new Error("Reseller not found");

    const patch: Partial<typeof schema.resellers.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
    if (input.status !== undefined) {
      patch.status = ["active", "suspended"].includes(input.status) ? input.status : existing.status;
    }
    if (input.password) {
      if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
      patch.passwordHash = await AuthService.hashPassword(input.password);
    }
    const [row] = await db
      .update(schema.resellers)
      .set(patch)
      .where(eq(schema.resellers.id, id))
      .returning();
    return this.getById(row!.id);
  }

  static async login(email: string, password: string) {
    const db = getDb();
    const row = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, String(email || "").trim().toLowerCase()),
    });
    if (!row || row.status !== "active") throw new Error("Invalid credentials");
    const ok = await AuthService.comparePassword(password, row.passwordHash);
    if (!ok) throw new Error("Invalid credentials");

    const token = AuthService.generateToken({
      id: row.id,
      email: row.email,
      role: "reseller",
      name: row.name,
      resellerId: row.id,
    });
    return {
      token,
      reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" as const },
    };
  }

  static async impersonateToken(resellerId: string, impersonatedBy: string) {
    const row = await this.getById(resellerId);
    if (!row) throw new Error("Reseller not found");
    if (row.status !== "active") throw new Error("Reseller is suspended");
    const token = AuthService.generateToken({
      id: row.id,
      email: row.email,
      role: "reseller",
      name: row.name,
      resellerId: row.id,
      impersonatedBy,
    });
    return {
      token,
      reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" as const },
    };
  }

  static async listMerchants(resellerId: string, opts?: { search?: string; status?: string }) {
    const db = getDb();
    const clauses = [eq(schema.merchants.resellerId, resellerId)];
    if (opts?.status) clauses.push(eq(schema.merchants.status, opts.status));
    if (opts?.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      clauses.push(
        or(
          ilike(schema.merchants.name, q),
          ilike(schema.merchants.email, q),
          ilike(schema.merchants.slug, q)
        )!
      );
    }
    const rows = await db
      .select({
        id: schema.merchants.id,
        name: schema.merchants.name,
        email: schema.merchants.email,
        status: schema.merchants.status,
        slug: schema.merchants.slug,
        editionId: schema.merchants.editionId,
        subscriptionPlan: schema.merchants.subscriptionPlan,
        shopEnabled: schema.merchants.shopEnabled,
        createdAt: schema.merchants.createdAt,
      })
      .from(schema.merchants)
      .where(and(...clauses))
      .orderBy(desc(schema.merchants.createdAt));
    return rows;
  }

  static async createMerchantForReseller(
    resellerId: string,
    input: {
      email: string;
      password?: string;
      businessName: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      editionId: string;
      businessCategory?: "retail" | "restaurant";
      shopEnabled?: boolean;
      deviceSeats?: number;
      licenseType?: "trial" | "yearly" | "custom";
      customDays?: number;
      sendInvite?: boolean;
    }
  ) {
    const reseller = await this.getById(resellerId);
    if (!reseller || reseller.status !== "active") throw new Error("Reseller not available");

    const edition = await EditionService.getById(input.editionId);
    if (!edition || !edition.isActive) throw new Error("Invalid edition");
    const allowedOwner =
      (edition.ownerType === "platform" && !edition.ownerId) ||
      (edition.ownerType === "reseller" && edition.ownerId === resellerId);
    if (!allowedOwner) throw new Error("Edition not available for this reseller");

    const created = await MerchantService.createMerchant(
      input.email,
      input.password,
      input.businessName,
      undefined,
      input.phone,
      input.address,
      input.city,
      input.country,
      {
        shopEnabled: input.shopEnabled,
        deviceSeats: input.deviceSeats,
        licenseType: input.licenseType,
        customDays: input.customDays,
        sendInvite: input.sendInvite,
        editionId: input.editionId,
        resellerId,
        businessCategory: input.businessCategory,
      }
    );
    return created;
  }

  static async assertOwnsMerchant(resellerId: string, merchantId: string) {
    const db = getDb();
    const m = await db.query.merchants.findFirst({
      where: and(eq(schema.merchants.id, merchantId), eq(schema.merchants.resellerId, resellerId)),
      columns: { id: true, status: true },
    });
    if (!m) throw new Error("Merchant not found");
    return m;
  }
}
