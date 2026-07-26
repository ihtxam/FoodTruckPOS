import { getDb, schema } from "@/db";
import { eq, and, asc, desc, max, sql } from "drizzle-orm";

export class CategoryService {
  /**
   * Create category
   */
  static async createCategory(
    merchantId: string,
    name: string,
    description?: string,
    color?: string
  ) {
    const db = getDb();

    try {
      const [{ nextSort }] = await db
        .select({
          nextSort: sql<number>`coalesce(${max(schema.categories.sortOrder)}, -1) + 1`,
        })
        .from(schema.categories)
        .where(eq(schema.categories.merchantId, merchantId));

      const category = await db
        .insert(schema.categories)
        .values({
          merchantId,
          name,
          description,
          color,
          sortOrder: Number(nextSort) || 0,
        })
        .returning();

      return category[0];
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }

  /**
   * Get all categories for merchant
   */
  static async getCategories(merchantId: string) {
    const db = getDb();

    try {
      const categories = await db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchantId),
        orderBy: [asc(schema.categories.sortOrder), desc(schema.categories.createdAt)],
      });

      return categories;
    } catch (error) {
      console.error("Error getting categories:", error);
      throw error;
    }
  }

  /**
   * Persist display order for categories (ordered id list).
   */
  static async reorderCategories(merchantId: string, orderedIds: string[]) {
    const db = getDb();
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new Error("orderedIds is required");
    }

    const existing = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
      columns: { id: true },
    });
    const owned = new Set(existing.map((c) => c.id));
    for (const id of orderedIds) {
      if (!owned.has(id)) {
        throw new Error("Invalid category id in reorder list");
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(schema.categories)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(schema.categories.id, orderedIds[i]),
              eq(schema.categories.merchantId, merchantId)
            )
          );
      }
    });

    return this.getCategories(merchantId);
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(merchantId: string, categoryId: string) {
    const db = getDb();

    try {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.merchantId, merchantId)
        ),
      });

      if (!category) {
        throw new Error("Category not found");
      }

      return category;
    } catch (error) {
      console.error("Error getting category:", error);
      throw error;
    }
  }

  /**
   * Update category
   */
  static async updateCategory(
    merchantId: string,
    categoryId: string,
    updates: Partial<typeof schema.categories.$inferInsert>
  ) {
    const db = getDb();

    try {
      const category = await db
        .update(schema.categories)
        .set(updates)
        .where(
          and(
            eq(schema.categories.id, categoryId),
            eq(schema.categories.merchantId, merchantId)
          )
        )
        .returning();

      if (category.length === 0) {
        throw new Error("Category not found");
      }

      return category[0];
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  static async deleteCategory(merchantId: string, categoryId: string) {
    const db = getDb();

    try {
      // Check if category has products
      const products = await db.query.products.findMany({
        where: eq(schema.products.categoryId, categoryId),
      });

      if (products.length > 0) {
        throw new Error("Cannot delete category with products");
      }

      const result = await db
        .delete(schema.categories)
        .where(
          and(
            eq(schema.categories.id, categoryId),
            eq(schema.categories.merchantId, merchantId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error("Category not found");
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  }

  /**
   * Get category with products
   */
  static async getCategoryWithProducts(merchantId: string, categoryId: string) {
    const db = getDb();

    try {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.merchantId, merchantId)
        ),
      });

      if (!category) {
        throw new Error("Category not found");
      }

      const products = await db.query.products.findMany({
        where: eq(schema.products.categoryId, categoryId),
      });

      return {
        category,
        products,
        productCount: products.length,
      };
    } catch (error) {
      console.error("Error getting category with products:", error);
      throw error;
    }
  }
}
