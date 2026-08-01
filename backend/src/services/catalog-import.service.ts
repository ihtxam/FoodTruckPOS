import * as XLSX from "xlsx";
import { getDb, schema } from "@/db";
import { repairCatalogText } from "@/lib/text-encoding";
import { eq, and } from "drizzle-orm";

export interface ImportRowError {
  sheet: string;
  row: number;
  message: string;
}

export class CatalogImportService {
  /**
   * One-click Excel import for categories + products.
   * Expected sheets (case-insensitive): Categories, Products
   * Categories columns: name, description?, color?, sortOrder?
   * Products columns: name, price, category (name), sku?, barcode?, stock?, cost?,
   *   taxable?, description?, productType?, isOpenPrice?, soldByWeight?, weightUnit?,
   *   bulkPricing? (JSON or "10:2.5;20:2.0"), extras? (JSON or "Extra Cheese:1.5|Bacon:2")
   */
  static async importWorkbook(merchantId: string, buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const errors: ImportRowError[] = [];
    let categoriesCreated = 0;
    let productsCreated = 0;
    let productsUpdated = 0;

    const db = getDb();
    const categoryNameToId = new Map<string, string>();

    // Prefill existing categories
    const existingCategories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });
    for (const cat of existingCategories) {
      categoryNameToId.set(cat.name.trim().toLowerCase(), cat.id);
    }

    const categoriesSheet =
      workbook.Sheets["Categories"] ||
      workbook.Sheets["categories"] ||
      workbook.Sheets["CATEGORIES"];

    if (categoriesSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(categoriesSheet, {
        defval: "",
      });
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = repairCatalogText(String(row.name || row.Name || "").trim());
        if (!name) {
          errors.push({ sheet: "Categories", row: i + 2, message: "Missing category name" });
          continue;
        }
        const key = name.toLowerCase();
        if (categoryNameToId.has(key)) continue;

        try {
          const [created] = await db
            .insert(schema.categories)
            .values({
              merchantId,
              name,
              description: String(row.description || row.Description || "") || null,
              color: String(row.color || row.Color || "") || null,
              sortOrder: Number(row.sortOrder || row.SortOrder || i) || 0,
            })
            .returning();
          categoryNameToId.set(key, created.id);
          categoriesCreated++;
        } catch (error) {
          errors.push({
            sheet: "Categories",
            row: i + 2,
            message: error instanceof Error ? error.message : "Failed to create category",
          });
        }
      }
    }

    const productsSheet =
      workbook.Sheets["Products"] || workbook.Sheets["products"] || workbook.Sheets["PRODUCTS"];

    if (!productsSheet) {
      return {
        success: errors.length === 0,
        categoriesCreated,
        productsCreated,
        productsUpdated,
        errors: errors.concat([
          { sheet: "Products", row: 0, message: "Missing Products sheet in workbook" },
        ]),
      };
    }

    const productRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(productsSheet, {
      defval: "",
    });

    for (let i = 0; i < productRows.length; i++) {
      const row = productRows[i];
      const name = repairCatalogText(String(row.name || row.Name || "").trim());
      const priceRaw = row.price ?? row.Price;
      if (!name) {
        errors.push({ sheet: "Products", row: i + 2, message: "Missing product name" });
        continue;
      }
      const price = Number(priceRaw);
      if (Number.isNaN(price)) {
        errors.push({ sheet: "Products", row: i + 2, message: "Invalid price" });
        continue;
      }

      const categoryName = String(row.category || row.Category || "").trim();
      let categoryId: string | undefined;
      if (categoryName) {
        const key = categoryName.toLowerCase();
        categoryId = categoryNameToId.get(key);
        if (!categoryId) {
          const [created] = await db
            .insert(schema.categories)
            .values({ merchantId, name: categoryName, sortOrder: 0 })
            .returning();
          categoryId = created.id;
          categoryNameToId.set(key, categoryId);
          categoriesCreated++;
        }
      }

      const sku = String(row.sku || row.SKU || "").trim() || null;
      const barcode = String(row.barcode || row.Barcode || "").trim() || null;
      const isOpenPrice = parseBool(row.isOpenPrice ?? row.OpenPrice ?? row.open_price);
      const soldByWeight = parseBool(row.soldByWeight ?? row.SoldByWeight ?? row.weighed);
      const productType =
        String(row.productType || row.ProductType || "").trim() ||
        (soldByWeight ? "weighed" : isOpenPrice ? "open_price" : "standard");

      const values = {
        merchantId,
        name,
        price: price.toString(),
        categoryId,
        sku,
        barcode,
        cost: row.cost != null && row.cost !== "" ? String(row.cost) : null,
        stock: Number(row.stock ?? row.Stock ?? 0) || 0,
        isTaxable: parseBool(row.taxable ?? row.Taxable ?? true, true),
        description: String(row.description || row.Description || "") || null,
        productType,
        isOpenPrice,
        soldByWeight,
        weightUnit: String(row.weightUnit || row.WeightUnit || "kg") || "kg",
        bulkPricing: parseBulkPricing(row.bulkPricing ?? row.BulkPricing),
        extras: parseExtras(row.extras ?? row.Extras),
        allowExtras: parseBool(row.allowExtras ?? row.AllowExtras),
        updatedAt: new Date(),
      };

      try {
        // Upsert by barcode or sku when present, else always insert
        let existing = null as Awaited<ReturnType<typeof db.query.products.findFirst>>;
        if (barcode) {
          existing = await db.query.products.findFirst({
            where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.barcode, barcode)),
          });
        } else if (sku) {
          existing = await db.query.products.findFirst({
            where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.sku, sku)),
          });
        }

        if (existing) {
          await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
          productsUpdated++;
        } else {
          await db.insert(schema.products).values(values);
          productsCreated++;
        }
      } catch (error) {
        errors.push({
          sheet: "Products",
          row: i + 2,
          message: error instanceof Error ? error.message : "Failed to import product",
        });
      }
    }

    return {
      success: errors.length === 0,
      categoriesCreated,
      productsCreated,
      productsUpdated,
      errors,
    };
  }

  static buildTemplateBuffer(): Buffer {
    const categories = [
      { name: "Food", description: "Fresh food", color: "#F97316", sortOrder: 0 },
      { name: "Beverages", description: "Drinks", color: "#3B82F6", sortOrder: 1 },
    ];
    const products = [
      {
        name: "Burger",
        price: 8.9,
        category: "Food",
        sku: "BRG-1",
        barcode: "5901234123457",
        stock: 50,
        taxable: true,
        productType: "standard",
        isOpenPrice: false,
        soldByWeight: false,
        weightUnit: "kg",
        bulkPricing: "10:7.5;20:7",
        extras: "Extra Cheese:1.5|Bacon:2",
        allowExtras: true,
        description: "Classic burger",
      },
      {
        name: "Apples",
        price: 3.5,
        category: "Food",
        sku: "APL-KG",
        barcode: "",
        stock: 100,
        taxable: true,
        productType: "weighed",
        isOpenPrice: false,
        soldByWeight: true,
        weightUnit: "kg",
        bulkPricing: "",
        extras: "",
        allowExtras: false,
        description: "Sold by weight (A-Class CX6)",
      },
      {
        name: "Custom amount",
        price: 0,
        category: "Food",
        sku: "OPEN-1",
        barcode: "",
        stock: 9999,
        taxable: true,
        productType: "open_price",
        isOpenPrice: true,
        soldByWeight: false,
        weightUnit: "kg",
        bulkPricing: "",
        extras: "",
        allowExtras: false,
        description: "Cashier enters price",
      },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories), "Categories");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}

function parseBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(s);
}

function parseBulkPricing(value: unknown): Array<{ minQty: number; price: number }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ minQty: number; price: number }>;
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    if (raw.startsWith("[")) return JSON.parse(raw);
  } catch {
    // fall through
  }
  // format: 10:2.5;20:2.0
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [minQty, price] = part.split(":").map((x) => Number(x.trim()));
      return { minQty, price };
    })
    .filter((t) => !Number.isNaN(t.minQty) && !Number.isNaN(t.price));
}

function parseExtras(value: unknown): Array<{ id: string; name: string; price: number }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ id: string; name: string; price: number }>;
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    if (raw.startsWith("[")) return JSON.parse(raw);
  } catch {
    // fall through
  }
  // format: Extra Cheese:1.5|Bacon:2
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [name, priceRaw] = part.split(":");
      return {
        id: `extra-${index + 1}`,
        name: (name || "").trim(),
        price: Number(priceRaw || 0) || 0,
      };
    })
    .filter((e) => e.name);
}
