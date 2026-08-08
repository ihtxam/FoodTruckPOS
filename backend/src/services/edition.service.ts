import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  ALL_EDITION_FEATURES,
  normalizeEditionFeatures,
  retailDefaultsFromFeatures,
  type EditionFeatureKey,
} from "@/lib/edition-features";

export type EditionRow = typeof schema.editions.$inferSelect;

function serialize(row: EditionRow) {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    name: row.name,
    note: row.note,
    businessCategory: row.businessCategory,
    features: normalizeEditionFeatures(row.features),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class EditionService {
  static async ensureDefaults() {
    const db = getDb();
    const existing = await db
      .select({ id: schema.editions.id })
      .from(schema.editions)
      .where(and(eq(schema.editions.ownerType, "platform"), eq(schema.editions.name, "Full / Legacy")))
      .limit(1);
    if (existing.length) return;

    const restaurantFeatures = ALL_EDITION_FEATURES.filter((k) => k !== "pos_retail");
    const retailFeatures = ALL_EDITION_FEATURES.filter(
      (k) => !["pos_tables", "pos_courses", "pos_kitchen", "reservations"].includes(k)
    );

    await db.insert(schema.editions).values([
      {
        ownerType: "platform",
        ownerId: null,
        name: "Full / Legacy",
        note: "All features (default for existing merchants)",
        businessCategory: "both",
        features: [...ALL_EDITION_FEATURES],
        isActive: true,
      },
      {
        ownerType: "platform",
        ownerId: null,
        name: "Restaurant Pro",
        note: "Tables, kitchen, courses, channels",
        businessCategory: "restaurant",
        features: restaurantFeatures,
        isActive: true,
      },
      {
        ownerType: "platform",
        ownerId: null,
        name: "Retail Basic",
        note: "Direct sales, barcode-friendly, no tables/kitchen",
        businessCategory: "retail",
        features: retailFeatures,
        isActive: true,
      },
    ]);
  }

  static async list(opts?: {
    ownerType?: "platform" | "reseller";
    ownerId?: string | null;
    includeInactive?: boolean;
    /** Platform templates + this reseller's editions */
    forResellerId?: string;
  }) {
    await this.ensureDefaults();
    const db = getDb();
    const clauses = [];
    if (opts?.forResellerId) {
      clauses.push(
        or(
          and(eq(schema.editions.ownerType, "platform"), isNull(schema.editions.ownerId)),
          and(eq(schema.editions.ownerType, "reseller"), eq(schema.editions.ownerId, opts.forResellerId))
        )!
      );
    } else if (opts?.ownerType) {
      clauses.push(eq(schema.editions.ownerType, opts.ownerType));
      if (opts.ownerType === "platform") {
        clauses.push(isNull(schema.editions.ownerId));
      } else if (opts.ownerId) {
        clauses.push(eq(schema.editions.ownerId, opts.ownerId));
      }
    }
    if (!opts?.includeInactive) {
      clauses.push(eq(schema.editions.isActive, true));
    }
    const rows = await db
      .select()
      .from(schema.editions)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(schema.editions.createdAt));
    return rows.map(serialize);
  }

  static async getById(id: string) {
    const db = getDb();
    const row = await db.query.editions.findFirst({
      where: eq(schema.editions.id, id),
    });
    return row ? serialize(row) : null;
  }

  static async create(input: {
    name: string;
    note?: string | null;
    businessCategory?: string;
    features?: unknown;
    ownerType?: "platform" | "reseller";
    ownerId?: string | null;
    isActive?: boolean;
  }) {
    const db = getDb();
    const ownerType = input.ownerType || "platform";
    const features = normalizeEditionFeatures(input.features ?? ALL_EDITION_FEATURES);
    const [row] = await db
      .insert(schema.editions)
      .values({
        name: String(input.name || "").trim(),
        note: input.note?.trim() || null,
        businessCategory: ["retail", "restaurant", "both"].includes(String(input.businessCategory))
          ? String(input.businessCategory)
          : "both",
        features,
        ownerType,
        ownerId: ownerType === "reseller" ? input.ownerId || null : null,
        isActive: input.isActive !== false,
      })
      .returning();
    if (!row) throw new Error("Failed to create edition");
    return serialize(row);
  }

  static async update(
    id: string,
    input: {
      name?: string;
      note?: string | null;
      businessCategory?: string;
      features?: unknown;
      isActive?: boolean;
    },
    opts?: { requireOwnerType?: "platform" | "reseller"; requireOwnerId?: string }
  ) {
    const db = getDb();
    const existing = await db.query.editions.findFirst({
      where: eq(schema.editions.id, id),
    });
    if (!existing) throw new Error("Edition not found");
    if (opts?.requireOwnerType && existing.ownerType !== opts.requireOwnerType) {
      throw new Error("Edition not found");
    }
    if (opts?.requireOwnerId && existing.ownerId !== opts.requireOwnerId) {
      throw new Error("Edition not found");
    }

    const patch: Partial<typeof schema.editions.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = String(input.name).trim();
    if (input.note !== undefined) patch.note = input.note?.trim() || null;
    if (input.businessCategory !== undefined) {
      patch.businessCategory = ["retail", "restaurant", "both"].includes(String(input.businessCategory))
        ? String(input.businessCategory)
        : existing.businessCategory;
    }
    if (input.features !== undefined) patch.features = normalizeEditionFeatures(input.features);
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;

    const [row] = await db
      .update(schema.editions)
      .set(patch)
      .where(eq(schema.editions.id, id))
      .returning();
    return serialize(row!);
  }

  static async softDelete(
    id: string,
    opts?: { requireOwnerType?: "platform" | "reseller"; requireOwnerId?: string }
  ) {
    return this.update(id, { isActive: false }, opts);
  }

  static async cloneForReseller(sourceId: string, resellerId: string, name?: string) {
    const src = await this.getById(sourceId);
    if (!src) throw new Error("Source edition not found");
    return this.create({
      name: name?.trim() || `${src.name} (copy)`,
      note: src.note,
      businessCategory: src.businessCategory,
      features: src.features,
      ownerType: "reseller",
      ownerId: resellerId,
    });
  }

  /** Features for a merchant; null means legacy full access */
  static async getMerchantFeatures(merchantId: string): Promise<EditionFeatureKey[] | null> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { editionId: true },
    });
    if (!merchant?.editionId) return null;
    const edition = await this.getById(merchant.editionId);
    if (!edition || !edition.isActive) return null;
    return edition.features;
  }

  static async applyEditionDefaultsToMerchant(merchantId: string, editionId: string) {
    const edition = await this.getById(editionId);
    if (!edition) return;
    const defaults = retailDefaultsFromFeatures(edition.features);
    const db = getDb();
    const checkout = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { posCheckoutSettings: true },
    });
    const prev =
      checkout?.posCheckoutSettings && typeof checkout.posCheckoutSettings === "object"
        ? { ...(checkout.posCheckoutSettings as Record<string, unknown>) }
        : {};
    prev.posMode = defaults.posMode;
    if (defaults.posMode === "retail") {
      prev.retailTakeawayEnabled = edition.features.includes("channel_takeaway");
      prev.retailDeliveryEnabled = edition.features.includes("channel_delivery");
    }
    await db
      .update(schema.merchants)
      .set({
        editionId,
        floorPlanEnabled: defaults.floorPlanEnabled,
        coursesEnabled: defaults.coursesEnabled,
        reservationsEnabled: defaults.reservationsEnabled,
        shopEnabled: defaults.shopEnabled,
        pickupEnabled: defaults.pickupEnabled,
        deliveryEnabled: defaults.deliveryEnabled,
        loyaltyEnabled: defaults.loyaltyEnabled,
        webposGiftCardEnabled: defaults.webposGiftCardEnabled,
        posCheckoutSettings: prev,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));
  }

  static async getLegacyFullEditionId(): Promise<string | null> {
    await this.ensureDefaults();
    const db = getDb();
    const row = await db.query.editions.findFirst({
      where: and(eq(schema.editions.ownerType, "platform"), eq(schema.editions.name, "Full / Legacy")),
    });
    return row?.id ?? null;
  }
}
