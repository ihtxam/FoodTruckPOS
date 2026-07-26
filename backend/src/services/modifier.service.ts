import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type PricingType = "free" | "fixed" | "toppings_by_size";
export type SelectionType = "optional" | "required";
export type SaleStatus = "in_stock" | "out_of_stock";

export type ModifierOptionInput = {
  id?: string;
  name: string;
  price?: number;
  saleStatus?: SaleStatus;
  isDefault?: boolean;
  sortOrder?: number;
};

export type ModifierGroupInput = {
  title: string;
  pricingType?: PricingType;
  selectionType?: SelectionType;
  minSelectable?: number;
  maxSelectable?: number;
  defaultCollapsed?: boolean;
  allowMultipleSameItem?: boolean;
  sortOrder?: number;
  options?: ModifierOptionInput[];
  productIds?: string[];
};

function normalizePricing(type?: string): PricingType {
  if (type === "free" || type === "toppings_by_size") return type;
  return "fixed";
}

function normalizeSelection(type?: string): SelectionType {
  return type === "required" ? "required" : "optional";
}

function publicOption(o: typeof schema.modifierOptions.$inferSelect) {
  return {
    id: o.id,
    name: o.name,
    price: parseFloat(o.price?.toString() || "0"),
    saleStatus: (o.saleStatus as SaleStatus) || "in_stock",
    isDefault: !!o.isDefault,
    sortOrder: o.sortOrder ?? 0,
  };
}

export class ModifierService {
  static async list(merchantId: string) {
    const db = getDb();
    const groups = await db.query.modifierGroups.findMany({
      where: eq(schema.modifierGroups.merchantId, merchantId),
      with: {
        options: { orderBy: [asc(schema.modifierOptions.sortOrder)] },
        productLinks: {
          with: {
            product: {
              with: { category: true },
            },
          },
          orderBy: [asc(schema.productModifierGroups.sortOrder)],
        },
      },
      orderBy: [asc(schema.modifierGroups.sortOrder), asc(schema.modifierGroups.title)],
    });

    return groups.map((g) => this.serializeGroup(g));
  }

  static async getById(merchantId: string, groupId: string) {
    const db = getDb();
    const group = await db.query.modifierGroups.findFirst({
      where: and(eq(schema.modifierGroups.id, groupId), eq(schema.modifierGroups.merchantId, merchantId)),
      with: {
        options: { orderBy: [asc(schema.modifierOptions.sortOrder)] },
        productLinks: {
          with: {
            product: { with: { category: true } },
          },
          orderBy: [asc(schema.productModifierGroups.sortOrder)],
        },
      },
    });
    if (!group) throw new Error("Modifier group not found");
    return this.serializeGroup(group);
  }

  static async create(merchantId: string, input: ModifierGroupInput) {
    const db = getDb();
    const title = input.title?.trim();
    if (!title) throw new Error("Title is required");

    const pricingType = normalizePricing(input.pricingType);
    const selectionType = normalizeSelection(input.selectionType);
    const minSelectable =
      selectionType === "required"
        ? Math.max(1, Number(input.minSelectable) || 1)
        : Math.max(0, Number(input.minSelectable) || 0);
    const maxSelectable = Math.max(minSelectable, Number(input.maxSelectable) || 1);

    const [group] = await db
      .insert(schema.modifierGroups)
      .values({
        merchantId,
        title,
        pricingType,
        selectionType,
        minSelectable,
        maxSelectable,
        defaultCollapsed: !!input.defaultCollapsed,
        allowMultipleSameItem: !!input.allowMultipleSameItem,
        sortOrder: Number(input.sortOrder) || 0,
      })
      .returning();

    await this.replaceOptions(group.id, input.options || [], pricingType);
    if (input.productIds?.length) {
      await this.setProductLinks(merchantId, group.id, input.productIds);
    }

    return this.getById(merchantId, group.id);
  }

  static async update(merchantId: string, groupId: string, input: ModifierGroupInput) {
    const db = getDb();
    const existing = await db.query.modifierGroups.findFirst({
      where: and(eq(schema.modifierGroups.id, groupId), eq(schema.modifierGroups.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Modifier group not found");

    const title = input.title?.trim() || existing.title;
    const pricingType = normalizePricing(input.pricingType ?? existing.pricingType);
    const selectionType = normalizeSelection(input.selectionType ?? existing.selectionType);
    const minSelectable =
      selectionType === "required"
        ? Math.max(1, Number(input.minSelectable ?? existing.minSelectable) || 1)
        : Math.max(0, Number(input.minSelectable ?? existing.minSelectable) || 0);
    const maxSelectable = Math.max(
      minSelectable,
      Number(input.maxSelectable ?? existing.maxSelectable) || 1
    );

    await db
      .update(schema.modifierGroups)
      .set({
        title,
        pricingType,
        selectionType,
        minSelectable,
        maxSelectable,
        defaultCollapsed:
          input.defaultCollapsed !== undefined ? !!input.defaultCollapsed : existing.defaultCollapsed,
        allowMultipleSameItem:
          input.allowMultipleSameItem !== undefined
            ? !!input.allowMultipleSameItem
            : existing.allowMultipleSameItem,
        sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) || 0 : existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(schema.modifierGroups.id, groupId));

    if (input.options) {
      await this.replaceOptions(groupId, input.options, pricingType);
    }
    if (input.productIds) {
      await this.setProductLinks(merchantId, groupId, input.productIds);
    }

    // Keep legacy product.extras in sync for POS
    await this.syncLinkedProductsExtras(merchantId, groupId);

    return this.getById(merchantId, groupId);
  }

  static async remove(merchantId: string, groupId: string) {
    const db = getDb();
    const existing = await db.query.modifierGroups.findFirst({
      where: and(eq(schema.modifierGroups.id, groupId), eq(schema.modifierGroups.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Modifier group not found");

    const links = await db.query.productModifierGroups.findMany({
      where: eq(schema.productModifierGroups.groupId, groupId),
    });
    const productIds = links.map((l) => l.productId);

    await db.delete(schema.modifierGroups).where(eq(schema.modifierGroups.id, groupId));

    for (const productId of productIds) {
      await this.refreshProductExtras(merchantId, productId);
    }
    return { success: true };
  }

  static async setProductLinks(merchantId: string, groupId: string, productIds: string[]) {
    const db = getDb();
    const uniqueIds = [...new Set(productIds.filter(Boolean))];

    if (uniqueIds.length) {
      const owned = await db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchantId), inArray(schema.products.id, uniqueIds)),
        columns: { id: true },
      });
      const ownedSet = new Set(owned.map((p) => p.id));
      for (const id of uniqueIds) {
        if (!ownedSet.has(id)) throw new Error(`Product not found: ${id}`);
      }
    }

    const previous = await db.query.productModifierGroups.findMany({
      where: eq(schema.productModifierGroups.groupId, groupId),
    });
    const previousIds = previous.map((p) => p.productId);

    await db.delete(schema.productModifierGroups).where(eq(schema.productModifierGroups.groupId, groupId));

    if (uniqueIds.length) {
      await db.insert(schema.productModifierGroups).values(
        uniqueIds.map((productId, idx) => ({
          productId,
          groupId,
          sortOrder: idx,
        }))
      );
    }

    const touched = new Set([...previousIds, ...uniqueIds]);
    for (const productId of touched) {
      await this.refreshProductExtras(merchantId, productId);
    }
  }

  /** Link/unlink groups from a product (product editor side). */
  static async setGroupsForProduct(merchantId: string, productId: string, groupIds: string[]) {
    const db = getDb();
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)),
    });
    if (!product) throw new Error("Product not found");

    const uniqueIds = [...new Set(groupIds.filter(Boolean))];
    if (uniqueIds.length) {
      const owned = await db.query.modifierGroups.findMany({
        where: and(
          eq(schema.modifierGroups.merchantId, merchantId),
          inArray(schema.modifierGroups.id, uniqueIds)
        ),
        columns: { id: true },
      });
      if (owned.length !== uniqueIds.length) throw new Error("One or more modifier groups not found");
    }

    await db
      .delete(schema.productModifierGroups)
      .where(eq(schema.productModifierGroups.productId, productId));

    if (uniqueIds.length) {
      await db.insert(schema.productModifierGroups).values(
        uniqueIds.map((groupId, idx) => ({
          productId,
          groupId,
          sortOrder: idx,
        }))
      );
    }

    await this.refreshProductExtras(merchantId, productId);
    return this.getGroupsForProduct(merchantId, productId);
  }

  static async getGroupsForProduct(merchantId: string, productId: string) {
    const map = await this.getGroupsForProducts(merchantId, [productId]);
    return map.get(productId) || [];
  }

  /** Batch-load modifier groups for many products (WebPOS / catalog). */
  static async getGroupsForProducts(merchantId: string, productIds: string[]) {
    const byProduct = new Map<string, any[]>();
    if (!productIds.length) return byProduct;

    const db = getDb();
    const links = await db.query.productModifierGroups.findMany({
      where: inArray(schema.productModifierGroups.productId, productIds),
      with: {
        group: {
          with: {
            options: { orderBy: [asc(schema.modifierOptions.sortOrder)] },
          },
        },
      },
      orderBy: [asc(schema.productModifierGroups.sortOrder)],
    });

    for (const link of links) {
      const g = link.group as any;
      if (!g || g.merchantId !== merchantId || g.isActive === false) continue;
      const list = byProduct.get(link.productId) || [];
      list.push(this.serializeGroup(g));
      byProduct.set(link.productId, list);
    }
    return byProduct;
  }

  private static async replaceOptions(
    groupId: string,
    options: ModifierOptionInput[],
    pricingType: PricingType
  ) {
    const db = getDb();
    await db.delete(schema.modifierOptions).where(eq(schema.modifierOptions.groupId, groupId));

    const rows = options
      .map((o, idx) => ({
        groupId,
        name: (o.name || "").trim(),
        price: pricingType === "free" ? "0" : String(Number(o.price) || 0),
        saleStatus: o.saleStatus === "out_of_stock" ? "out_of_stock" : "in_stock",
        isDefault: !!o.isDefault,
        sortOrder: o.sortOrder !== undefined ? Number(o.sortOrder) : idx,
      }))
      .filter((o) => o.name);

    if (rows.length) {
      await db.insert(schema.modifierOptions).values(rows);
    }
  }

  private static async syncLinkedProductsExtras(merchantId: string, groupId: string) {
    const db = getDb();
    const links = await db.query.productModifierGroups.findMany({
      where: eq(schema.productModifierGroups.groupId, groupId),
    });
    for (const link of links) {
      await this.refreshProductExtras(merchantId, link.productId);
    }
  }

  /** Flatten linked in-stock options into product.extras for POS/shop compatibility. */
  static async refreshProductExtras(merchantId: string, productId: string) {
    const db = getDb();
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)),
    });
    if (!product) return;

    const groups = await this.getGroupsForProduct(merchantId, productId);
    const flat = groups.flatMap((g) =>
      g.options
        .filter((o) => o.saleStatus === "in_stock")
        .map((o) => ({
          id: o.id,
          name: g.pricingType === "free" ? o.name : o.name,
          price: g.pricingType === "free" ? 0 : o.price,
          groupId: g.id,
          groupTitle: g.title,
        }))
    );

    // Keep any legacy extras that are not from groups (no groupId) — but we store only group-derived
    await db
      .update(schema.products)
      .set({
        extras: flat.map(({ id, name, price }) => ({ id, name, price })),
        allowExtras: flat.length > 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, productId));
  }

  private static serializeGroup(g: any) {
    const options = (g.options || []).map(publicOption);
    const products = (g.productLinks || [])
      .map((link: any) => {
        const p = link.product;
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          categoryId: p.categoryId,
          categoryName: p.category?.name || null,
          price: p.price,
        };
      })
      .filter(Boolean);

    return {
      id: g.id,
      title: g.title,
      pricingType: g.pricingType as PricingType,
      selectionType: g.selectionType as SelectionType,
      minSelectable: g.minSelectable,
      maxSelectable: g.maxSelectable,
      defaultCollapsed: !!g.defaultCollapsed,
      allowMultipleSameItem: !!g.allowMultipleSameItem,
      sortOrder: g.sortOrder ?? 0,
      isActive: g.isActive !== false,
      options,
      products,
      productIds: products.map((p: any) => p.id),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
}
