import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { and, eq, inArray } from "drizzle-orm";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { ProductService } from "@/services/product.service";
import { CategoryService } from "@/services/category.service";
import { OrderService } from "@/services/order.service";
import { CustomerService } from "@/services/customer.service";
import { MerchantSettingsService } from "@/services/merchant-settings.service";
import { CatalogImportService } from "@/services/catalog-import.service";
import { ModifierService } from "@/services/modifier.service";
import { normalizeComboSlots } from "@/lib/combo";
import { roundMoney2 } from "@/lib/money";
import { geocodeQuery } from "@/lib/geocode";
import { isAllowedImageMime, saveMerchantImage } from "@/services/media-upload.service";
import { getDb, schema } from "@/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
  },
});

// Apply merchant middleware to all routes
router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/products/import/template
 * Download Excel template for one-click import
 */
router.get("/products/import/template", async (_req: Request, res: Response) => {
  try {
    const buffer = CatalogImportService.buildTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="manupos-catalog-template.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build template" });
  }
});

/**
 * POST /api/merchant/products/import
 * One-click Excel import for categories + products
 */
router.post("/products/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!req.file?.buffer) return res.status(400).json({ error: "Excel file is required (field: file)" });

    const result = await CatalogImportService.importWorkbook(merchantId, req.file.buffer);
    res.json({ success: result.success, ...result });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

/**
 * GET /api/merchant/products
 * Get all products
 */
router.get("/products", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const products = await ProductService.getProducts(merchantId, page, limit, search, categoryId);
    const pageList = products || [];

    // Resolve combo option products that may not be on the current page
    const optionIds = new Set<string>();
    for (const p of pageList as any[]) {
      if (p.productType !== "combo") continue;
      for (const slot of normalizeComboSlots(p.comboItems)) {
        for (const o of slot.options) optionIds.add(o.productId);
      }
    }
    const pageIds = new Set(pageList.map((p: { id: string }) => p.id));
    const missingIds = [...optionIds].filter((id) => !pageIds.has(id));
    let optionProducts: any[] = [];
    if (missingIds.length) {
      const db = getDb();
      optionProducts = await db.query.products.findMany({
        where: and(
          eq(schema.products.merchantId, merchantId),
          inArray(schema.products.id, missingIds)
        ),
      });
    }

    const catalogById = new Map<string, any>();
    for (const p of [...pageList, ...optionProducts]) catalogById.set(p.id, p);
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchantId,
      [...catalogById.keys()]
    );

    const withCatalog = pageList.map((p: any) => {
      const modifierGroups = groupsByProduct.get(p.id) || [];
      const extras = Array.isArray(p.extras) ? p.extras : [];
      const isCombo = p.productType === "combo";
      const comboSlots = isCombo
        ? normalizeComboSlots(p.comboItems)
            .map((slot) => ({
              id: slot.id,
              name: slot.name,
              minPick: slot.minPick,
              maxPick: slot.maxPick,
              options: slot.options
                .map((opt) => {
                  const child = catalogById.get(opt.productId);
                  if (!child || child.isActive === false) return null;
                  const childGroups = groupsByProduct.get(child.id) || [];
                  const childExtras = Array.isArray(child.extras) ? child.extras : [];
                  return {
                    productId: child.id,
                    name: child.name,
                    image: child.imageUrl,
                    description: child.description,
                    extraPrice: roundMoney2(opt.extraPrice),
                    allowExtras:
                      !!child.allowExtras || childGroups.length > 0 || childExtras.length > 0,
                    extras: childExtras.map((e: any) => ({
                      id: e.id,
                      name: e.name,
                      price: Number(e.price) || 0,
                    })),
                    modifierGroups: childGroups,
                  };
                })
                .filter(Boolean),
            }))
            .filter((s) => s.options.length > 0)
        : [];

      return {
        ...p,
        modifierGroups,
        allowExtras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
        comboSlots,
      };
    });

    res.json({
      success: true,
      products: withCatalog,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting products:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get products" });
  }
});

/**
 * PUT /api/merchant/products/reorder
 * Persist product list order
 */
router.put("/products/reorder", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderedIds } = req.body as { orderedIds?: string[] };

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const products = await ProductService.reorderProducts(merchantId, orderedIds || []);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error reordering products:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reorder products" });
  }
});

/**
 * GET /api/merchant/products/:productId
 * Get product details
 */
router.get("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const product = await ProductService.getProductById(merchantId, productId);
    const modifierGroups = await ModifierService.getGroupsForProduct(merchantId, productId);

    res.json({
      success: true,
      product: { ...product, modifierGroups },
    });
  } catch (error) {
    console.error("Error getting product:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Product not found" });
  }
});

/**
 * POST /api/merchant/products
 * Create product
 */
router.post("/products", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const {
      name,
      price,
      categoryId,
      sku,
      barcode,
      cost,
      stock,
      isTaxable,
      description,
      imageUrl,
      productType,
      isOpenPrice,
      soldByWeight,
      weightUnit,
      bulkPricing,
      extras,
      comboItems,
      allowExtras,
      clientId,
      specifications,
      buttonColor,
      loyaltyRewardPoints,
      modifierGroupIds,
    } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!name || price === undefined) {
      return res.status(400).json({ error: "Name and price are required" });
    }

    let normalizedLoyaltyReward: number | null | undefined = undefined;
    if (loyaltyRewardPoints === null || loyaltyRewardPoints === "" || loyaltyRewardPoints === undefined) {
      normalizedLoyaltyReward = loyaltyRewardPoints === undefined ? undefined : null;
    } else {
      const n = Math.floor(Number(loyaltyRewardPoints));
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ error: "loyaltyRewardPoints must be null or an integer ≥ 1" });
      }
      normalizedLoyaltyReward = n;
    }

    const { sanitizeComboSlotsInput } = await import("@/lib/combo");
    const normalizedComboItems =
      productType === "combo" || (Array.isArray(comboItems) && comboItems.length)
        ? sanitizeComboSlotsInput(comboItems)
        : comboItems || [];

    const product = await ProductService.createProduct(
      merchantId,
      name,
      price,
      categoryId,
      sku,
      barcode,
      cost,
      stock,
      isTaxable !== false,
      description,
      imageUrl,
      {
        productType: productType === "combo" || normalizedComboItems.length ? "combo" : productType,
        isOpenPrice,
        soldByWeight,
        weightUnit,
        bulkPricing,
        extras,
        comboItems: normalizedComboItems,
        allowExtras,
        clientId,
        specifications,
        buttonColor,
        loyaltyRewardPoints: normalizedLoyaltyReward === undefined ? null : normalizedLoyaltyReward,
      }
    );

    let modifierGroups: unknown[] = [];
    if (Array.isArray(modifierGroupIds) && modifierGroupIds.length) {
      modifierGroups = await ModifierService.setGroupsForProduct(
        merchantId,
        product.id,
        modifierGroupIds
      );
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: { ...product, modifierGroups },
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create product" });
  }
});

/**
 * PUT /api/merchant/products/:productId
 * Update product
 */
router.put("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;
    const { modifierGroupIds, ...updates } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    // Coerce numeric fields commonly sent as numbers from the dashboard
    if (updates.price !== undefined) updates.price = String(updates.price);
    if (updates.cost !== undefined && updates.cost !== null) updates.cost = String(updates.cost);

    if (updates.loyaltyRewardPoints !== undefined) {
      if (updates.loyaltyRewardPoints === null || updates.loyaltyRewardPoints === "") {
        updates.loyaltyRewardPoints = null;
      } else {
        const n = Math.floor(Number(updates.loyaltyRewardPoints));
        if (!Number.isFinite(n) || n < 1) {
          return res.status(400).json({ error: "loyaltyRewardPoints must be null or an integer ≥ 1" });
        }
        updates.loyaltyRewardPoints = n;
      }
    }

    if (updates.comboItems !== undefined || updates.productType === "combo") {
      const { sanitizeComboSlotsInput } = await import("@/lib/combo");
      updates.comboItems = sanitizeComboSlotsInput(updates.comboItems || []);
      if (updates.productType === "combo" || (updates.comboItems as unknown[]).length) {
        updates.productType = "combo";
      }
    }

    const product = await ProductService.updateProduct(merchantId, productId, updates);

    let modifierGroups = undefined;
    if (Array.isArray(modifierGroupIds)) {
      modifierGroups = await ModifierService.setGroupsForProduct(
        merchantId,
        productId,
        modifierGroupIds
      );
    } else {
      modifierGroups = await ModifierService.getGroupsForProduct(merchantId, productId);
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product: { ...product, modifierGroups },
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update product" });
  }
});

/**
 * DELETE /api/merchant/products/:productId
 * Delete product
 */
router.delete("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    await ProductService.deleteProduct(merchantId, productId);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete product" });
  }
});

/**
 * PUT /api/merchant/products/:productId/stock
 * Update product stock
 */
router.put("/products/:productId/stock", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (quantity === undefined) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    const product = await ProductService.updateStock(merchantId, productId, quantity);

    res.json({
      success: true,
      message: "Stock updated successfully",
      product,
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update stock" });
  }
});

/**
 * GET /api/merchant/products/low-stock
 * Get low stock products
 */
router.get("/products/low-stock", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const products = await ProductService.getLowStockProducts(merchantId);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error getting low stock products:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get products" });
  }
});

/**
 * GET /api/merchant/products/statistics
 * Get product statistics
 */
router.get("/products/statistics", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const stats = await ProductService.getProductStatistics(merchantId);

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error getting product statistics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
  }
});

// ============================================================================
// MODIFIER GROUPS (extras / add-ons)
// ============================================================================

/**
 * GET /api/merchant/modifiers
 */
router.get("/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const groups = await ModifierService.list(merchantId);
    res.json({ success: true, groups });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list modifiers" });
  }
});

/**
 * GET /api/merchant/modifiers/:groupId
 */
router.get("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.getById(merchantId, req.params.groupId);
    res.json({ success: true, group });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
  }
});

/**
 * POST /api/merchant/modifiers
 */
router.post("/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.create(merchantId, req.body);
    res.status(201).json({ success: true, group });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create group" });
  }
});

/**
 * PUT /api/merchant/modifiers/:groupId
 */
router.put("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.update(merchantId, req.params.groupId, req.body);
    res.json({ success: true, group });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update group" });
  }
});

/**
 * DELETE /api/merchant/modifiers/:groupId
 */
router.delete("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    await ModifierService.remove(merchantId, req.params.groupId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete group" });
  }
});

/**
 * PUT /api/merchant/products/:productId/modifiers
 * Set linked modifier groups for a product
 */
router.put("/products/:productId/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const groupIds = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
    const groups = await ModifierService.setGroupsForProduct(
      merchantId,
      req.params.productId,
      groupIds
    );
    res.json({ success: true, modifierGroups: groups });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to link modifiers" });
  }
});

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/categories
 * Get all categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const categories = await CategoryService.getCategories(merchantId);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get categories" });
  }
});

/**
 * PUT /api/merchant/categories/reorder
 * Persist category list order
 */
router.put("/categories/reorder", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderedIds } = req.body as { orderedIds?: string[] };

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const categories = await CategoryService.reorderCategories(merchantId, orderedIds || []);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reorder categories",
    });
  }
});

/**
 * POST /api/merchant/categories
 * Create category
 */
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { name, description, color } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const category = await CategoryService.createCategory(merchantId, name, description, color);

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create category" });
  }
});

/**
 * PUT /api/merchant/categories/:categoryId
 * Update category
 */
router.put("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { categoryId } = req.params;
    const updates = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const category = await CategoryService.updateCategory(merchantId, categoryId, updates);

    res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update category" });
  }
});

/**
 * DELETE /api/merchant/categories/:categoryId
 * Delete category
 */
router.delete("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { categoryId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    await CategoryService.deleteCategory(merchantId, categoryId);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete category" });
  }
});

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/orders
 * Get all orders
 */
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const orders = await OrderService.getOrders(merchantId, page, limit, status, startDate, endDate);

    res.json({
      success: true,
      orders,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get orders" });
  }
});

/**
 * GET /api/merchant/orders/:orderId
 * Get order details
 */
router.get("/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const order = await OrderService.getOrderById(merchantId, orderId);

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Order not found" });
  }
});

/**
 * POST /api/merchant/orders
 * Create order
 */
router.post("/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { items, customerId, orderType, paymentMethod, discountAmount, notes } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    const order = await OrderService.createOrder(
      merchantId,
      items,
      customerId,
      orderType || "pos",
      paymentMethod,
      discountAmount || 0,
      notes
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

/**
 * PUT /api/merchant/orders/:orderId/status
 * Update order status
 */
router.put("/orders/:orderId/status", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;
    const { status } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const order = await OrderService.updateOrderStatus(merchantId, orderId, status);

    res.json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
  }
});

/**
 * POST /api/merchant/orders/:orderId/action
 * Lifecycle action: accept | start_preparing | mark_ready | out_for_delivery |
 * collect_payment | complete | complete_and_collect | reject
 */
router.post("/orders/:orderId/action", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;
    const { action } = req.body as { action?: string };

    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!action) return res.status(400).json({ error: "Action is required" });

    const order = await OrderService.applyOrderAction(merchantId, orderId, action);
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Action failed" });
  }
});

/**
 * POST /api/merchant/orders/:orderId/cancel
 * Cancel order
 */
router.post("/orders/:orderId/cancel", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const order = await OrderService.cancelOrder(merchantId, orderId);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to cancel order" });
  }
});

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/customers
 * Get all customers
 */
router.get("/customers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const customers = await CustomerService.getCustomers(merchantId, page, limit, search);

    res.json({
      success: true,
      customers,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get customers" });
  }
});

/**
 * POST /api/merchant/customers
 * Create customer
 */
router.post("/customers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { email, phone, firstName, lastName } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const customer = await CustomerService.createCustomer(merchantId, email, phone, firstName, lastName);

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create customer" });
  }
});

/**
 * GET /api/merchant/customers/:customerId
 * Get customer details
 */
router.get("/customers/:customerId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { customerId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const customer = await CustomerService.getCustomerById(merchantId, customerId);

    res.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Error getting customer:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Customer not found" });
  }
});

/**
 * GET /api/merchant/settings
 * Get merchant settings
 */
router.get("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const settings = await MerchantSettingsService.getMerchantSettings(merchantId);

    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get settings" });
  }
});

/**
 * PUT /api/merchant/settings
 * Update merchant settings
 */
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const updates = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const merchant = await MerchantSettingsService.updateMerchantSettings(merchantId, updates);

    res.json({
      success: true,
      message: "Settings updated successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update settings" });
  }
});

/**
 * POST /api/merchant/geocode
 * Body: { query?: string } — defaults to merchant address + city + country
 */
router.post("/geocode", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    let query = String(req.body?.query || "").trim();
    if (!query) {
      const settings = await MerchantSettingsService.getMerchantSettings(merchantId);
      query = [settings.address, settings.city, settings.country || "Switzerland"]
        .map((p) => String(p || "").trim())
        .filter(Boolean)
        .join(", ");
    }
    if (!query) {
      return res.status(400).json({ error: "No address to geocode. Set business address first." });
    }

    const result = await geocodeQuery(query);
    if (!result.found) {
      return res.json({ success: true, found: false, query });
    }
    res.json({
      success: true,
      found: true,
      query,
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Geocode failed" });
  }
});

/**
 * POST /api/merchant/media
 * multipart field "file" — image upload (JPEG/PNG/WebP/GIF)
 */
router.post("/media", (req: Request, res: Response, next: NextFunction) => {
  imageUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!req.file) return res.status(400).json({ error: "No image file uploaded" });

    const saved = await saveMerchantImage({
      merchantId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    res.status(201).json({
      success: true,
      url: saved.url,
      mimeType: saved.mimeType,
      size: saved.size,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

/**
 * GET /api/merchant/vat-settings
 * Get VAT settings
 */
router.get("/vat-settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const vatSettings = await MerchantSettingsService.getVATSettings(merchantId);

    res.json({
      success: true,
      vatSettings,
    });
  } catch (error) {
    console.error("Error getting VAT settings:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get VAT settings" });
  }
});

/**
 * POST /api/merchant/vat-settings
 * Create VAT setting
 */
router.post("/vat-settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { country, vatRate, taxId, isDefault } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!country || vatRate === undefined) {
      return res.status(400).json({ error: "Country and VAT rate are required" });
    }

    const vatSetting = await MerchantSettingsService.createVATSetting(
      merchantId,
      country,
      vatRate,
      taxId,
      isDefault
    );

    res.status(201).json({
      success: true,
      message: "VAT setting created successfully",
      vatSetting,
    });
  } catch (error) {
    console.error("Error creating VAT setting:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create VAT setting" });
  }
});

export default router;
