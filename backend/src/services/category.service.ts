import { getDb, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";

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
      const category = await db
        .insert(schema.categories)
        .values({
          merchantId,
          name,
          description,
          color,
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
        orderBy: desc(schema.categories.createdAt),
      });

      return categories;
    } catch (error) {
      console.error("Error getting categories:", error);
      throw error;
    }
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
