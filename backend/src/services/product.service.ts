import { getDb, schema } from "@/db";
import { eq, and, like, desc, asc, or, max, sql, lt } from "drizzle-orm";

export class ProductService {
  /**
   * Create product
   */
  static async createProduct(
    merchantId: string,
    name: string,
    price: number,
    categoryId?: string,
    sku?: string,
    barcode?: string,
    cost?: number,
    stock?: number,
    isTaxable: boolean = true,
    description?: string,
    imageUrl?: string,
    extras?: {
      productType?: string;
      isOpenPrice?: boolean;
      soldByWeight?: boolean;
      weightUnit?: string;
      bulkPricing?: Array<{ minQty: number; price: number }>;
      extras?: Array<{ id: string; name: string; price: number }>;
      comboItems?: Array<{ productId: string; quantity: number; name?: string }>;
      allowExtras?: boolean;
      clientId?: string;
      specifications?: Array<{
        id: string;
        name: string;
        price: number;
        saleStatus?: "in_stock" | "out_of_stock";
        isDefault?: boolean;
        sortOrder?: number;
      }>;
      buttonColor?: string;
    }
  ) {
    const db = getDb();

    try {
      const [{ nextSort }] = await db
        .select({
          nextSort: sql<number>`coalesce(${max(schema.products.sortOrder)}, -1) + 1`,
        })
        .from(schema.products)
        .where(eq(schema.products.merchantId, merchantId));

      const product = await db
        .insert(schema.products)
        .values({
          merchantId,
          name,
          price: price.toString(),
          categoryId,
          sku,
          barcode,
          cost: cost?.toString(),
          stock: stock || 0,
          isTaxable,
          description,
          imageUrl,
          productType: extras?.productType || "standard",
          isOpenPrice: !!extras?.isOpenPrice,
          soldByWeight: !!extras?.soldByWeight,
          weightUnit: extras?.weightUnit || "kg",
          bulkPricing: extras?.bulkPricing || [],
          extras: extras?.extras || [],
          comboItems: extras?.comboItems || [],
          specifications: extras?.specifications || [],
          buttonColor: extras?.buttonColor || null,
          allowExtras: !!extras?.allowExtras,
          sortOrder: Number(nextSort) || 0,
          clientId: extras?.clientId,
        })
        .returning();

      return product[0];
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  /**
   * Get all products for merchant
   */
  static async getProducts(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    categoryId?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.products.merchantId, merchantId)];

      if (categoryId) {
        whereConditions.push(eq(schema.products.categoryId, categoryId));
      }

      if (search) {
        whereConditions.push(
          or(
            like(schema.products.name, `%${search}%`),
            like(schema.products.sku, `%${search}%`),
            like(schema.products.barcode, `%${search}%`)
          )
        );
      }

      const products = await db.query.products.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          category: true,
        },
        limit,
        offset,
        orderBy: [asc(schema.products.sortOrder), desc(schema.products.createdAt)],
      });

      return products;
    } catch (error) {
      console.error("Error getting products:", error);
      throw error;
    }
  }

  /**
   * Persist display order for products (ordered id list).
   */
  static async reorderProducts(merchantId: string, orderedIds: string[]) {
    const db = getDb();
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new Error("orderedIds is required");
    }

    const existing = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: { id: true },
    });
    const owned = new Set(existing.map((p) => p.id));
    for (const id of orderedIds) {
      if (!owned.has(id)) {
        throw new Error("Invalid product id in reorder list");
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(schema.products)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(schema.products.id, orderedIds[i]),
              eq(schema.products.merchantId, merchantId)
            )
          );
      }
    });

    return this.getProducts(merchantId, 1, Math.max(orderedIds.length, 200));
  }

  /**
   * Get product by ID
   */
  static async getProductById(merchantId: string, productId: string) {
    const db = getDb();

    try {
      const product = await db.query.products.findFirst({
        where: and(
          eq(schema.products.id, productId),
          eq(schema.products.merchantId, merchantId)
        ),
        with: {
          category: true,
        },
      });

      if (!product) {
        throw new Error("Product not found");
      }

      return product;
    } catch (error) {
      console.error("Error getting product:", error);
      throw error;
    }
  }

  /**
   * Get product by barcode
   */
  static async getProductByBarcode(merchantId: string, barcode: string) {
    const db = getDb();

    try {
      const product = await db.query.products.findFirst({
        where: and(
          eq(schema.products.merchantId, merchantId),
          eq(schema.products.barcode, barcode)
        ),
      });

      return product;
    } catch (error) {
      console.error("Error getting product by barcode:", error);
      throw error;
    }
  }

  /**
   * Update product
   */
  static async updateProduct(
    merchantId: string,
    productId: string,
    updates: Partial<typeof schema.products.$inferInsert>
  ) {
    const db = getDb();

    try {
      const product = await db
        .update(schema.products)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.products.id, productId),
            eq(schema.products.merchantId, merchantId)
          )
        )
        .returning();

      if (product.length === 0) {
        throw new Error("Product not found");
      }

      return product[0];
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  /**
   * Delete product
   */
  static async deleteProduct(merchantId: string, productId: string) {
    const db = getDb();

    try {
      const result = await db
        .delete(schema.products)
        .where(
          and(
            eq(schema.products.id, productId),
            eq(schema.products.merchantId, merchantId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error("Product not found");
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  /**
   * Update stock
   */
  static async updateStock(merchantId: string, productId: string, quantity: number) {
    const db = getDb();

    try {
      const product = await db
        .update(schema.products)
        .set({ stock: quantity })
        .where(
          and(
            eq(schema.products.id, productId),
            eq(schema.products.merchantId, merchantId)
          )
        )
        .returning();

      if (product.length === 0) {
        throw new Error("Product not found");
      }

      return product[0];
    } catch (error) {
      console.error("Error updating stock:", error);
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  static async getLowStockProducts(merchantId: string) {
    const db = getDb();

    try {
      const products = await db.query.products.findMany({
        where: and(
          eq(schema.products.merchantId, merchantId),
          lt(schema.products.stock, schema.products.lowStockThreshold)
        ),
        orderBy: asc(schema.products.stock),
      });

      return products;
    } catch (error) {
      console.error("Error getting low stock products:", error);
      throw error;
    }
  }

  /**
   * Get product statistics
   */
  static async getProductStatistics(merchantId: string) {
    const db = getDb();

    try {
      const products = await db.query.products.findMany({
        where: eq(schema.products.merchantId, merchantId),
      });

      const totalProducts = products.length;
      const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
      const lowStockCount = products.filter((p) => p.stock < (p.lowStockThreshold || 5)).length;
      const totalInventoryValue = products.reduce(
        (sum, p) => sum + parseFloat(p.cost?.toString() || "0") * p.stock,
        0
      );

      return {
        totalProducts,
        totalStock,
        lowStockCount,
        totalInventoryValue,
      };
    } catch (error) {
      console.error("Error getting product statistics:", error);
      throw error;
    }
  }
}
