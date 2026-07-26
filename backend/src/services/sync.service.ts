import { getDb, schema } from "@/db";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { FloorPlanService } from "@/services/floor-plan.service";
import { roundMoney2, roundTo005 } from "@/lib/money";

export interface SyncSaleItem {
  productClientId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount?: number;
  weightKg?: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
  isOpenPrice?: boolean;
  seatNumber?: number | null;
}

export interface SyncSalePayload {
  clientId: string;
  deviceId?: string;
  orderNumber?: string;
  paymentMethod: string;
  paymentStatus?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  notes?: string;
  fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
  completedAt?: string | number;
  tableId?: string | null;
  tableLabel?: string | null;
  guestCount?: number | null;
  billSplits?: Array<{
    id: string;
    label: string;
    seatNumber?: number | null;
    amount: number;
    paymentMethod?: string;
    paymentStatus: string;
    paidAt?: string | null;
  }>;
  items: SyncSaleItem[];
}

export class SyncService {
  /**
   * Pull catalog changes for offline POS devices.
   */
  static async pullCatalog(merchantId: string, since?: Date) {
    const db = getDb();
    const sinceDate = since || new Date(0);

    const [categories, products, terminals, readers, merchant, onlineOrders] = await Promise.all([
      db.query.categories.findMany({
        where: and(eq(schema.categories.merchantId, merchantId), gt(schema.categories.updatedAt, sinceDate)),
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchantId), gt(schema.products.updatedAt, sinceDate)),
      }),
      db.query.paymentTerminals.findMany({
        where: eq(schema.paymentTerminals.merchantId, merchantId),
      }),
      db.query.rfidReaders.findMany({
        where: eq(schema.rfidReaders.merchantId, merchantId),
      }),
      db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      }),
      // Online shop orders for POS ongoing board (new + kitchen + ready/delivery)
      db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.orderType, "web_shop"),
          inArray(schema.orders.status, [
            "pending",
            "pending_approval",
            "accepted",
            "preparing",
            "ready",
            "out_for_delivery",
          ])
        ),
        with: { items: true, customer: true },
        limit: 100,
        orderBy: [desc(schema.orders.createdAt)],
      }),
    ]);

    const diningTables = await FloorPlanService.listTablesForSync(merchantId);

    return {
      serverTime: new Date().toISOString(),
      categories,
      products,
      terminals: terminals.map((t) => ({
        id: t.id,
        terminalId: t.terminalId,
        terminalName: t.terminalName,
        serialNumber: t.serialNumber,
        status: t.status,
        adyenMerchantAccount: t.adyenMerchantAccount,
        adyenClientId: t.adyenClientId,
      })),
      rfidReaders: readers,
      onlineOrders,
      diningTables,
      merchantSettings: merchant
        ? {
            taxTakeawayRate: merchant.taxTakeawayRate,
            taxDineInRate: merchant.taxDineInRate,
            taxDeliveryRate: merchant.taxDeliveryRate,
            vatRate: merchant.vatRate,
            slug: merchant.slug,
            subdomain: merchant.subdomain,
            shopEnabled: merchant.shopEnabled,
            floorPlanEnabled: merchant.floorPlanEnabled,
            paxOrderingEnabled: merchant.paxOrderingEnabled,
            adyenMerchantAccount: merchant.adyenMerchantAccount,
            adyenClientId: merchant.adyenClientId,
            panelLanguage: merchant.panelLanguage,
          }
        : null,
    };
  }

  /**
   * Upsert categories/products created offline on the device.
   */
  static async pushCatalog(
    merchantId: string,
    payload: {
      categories?: Array<{
        clientId: string;
        name: string;
        description?: string;
        sortOrder?: number;
        color?: string;
      }>;
      products?: Array<{
        clientId: string;
        name: string;
        price: number;
        categoryClientId?: string;
        categoryId?: string;
        sku?: string;
        barcode?: string;
        stock?: number;
        isTaxable?: boolean;
        description?: string;
        productType?: string;
        isOpenPrice?: boolean;
        soldByWeight?: boolean;
        weightUnit?: string;
        bulkPricing?: Array<{ minQty: number; price: number }>;
        extras?: Array<{ id: string; name: string; price: number }>;
        comboItems?: Array<{
          id?: string;
          name?: string;
          minPick?: number;
          maxPick?: number;
          options?: Array<{ productId: string; extraPrice?: number }>;
          productId?: string;
          quantity?: number;
        }>;
        allowExtras?: boolean;
        sortOrder?: number;
      }>;
    }
  ) {
    const db = getDb();
    const categoryMap = new Map<string, string>();
    const productMap = new Map<string, string>();

    for (const cat of payload.categories || []) {
      const existing = await db.query.categories.findFirst({
        where: and(
          eq(schema.categories.merchantId, merchantId),
          eq(schema.categories.clientId, cat.clientId)
        ),
      });
      if (existing) {
        await db
          .update(schema.categories)
          .set({
            name: cat.name,
            description: cat.description,
            sortOrder: cat.sortOrder || 0,
            color: cat.color,
            updatedAt: new Date(),
          })
          .where(eq(schema.categories.id, existing.id));
        categoryMap.set(cat.clientId, existing.id);
      } else {
        const [created] = await db
          .insert(schema.categories)
          .values({
            merchantId,
            clientId: cat.clientId,
            name: cat.name,
            description: cat.description,
            sortOrder: cat.sortOrder || 0,
            color: cat.color,
          })
          .returning();
        categoryMap.set(cat.clientId, created.id);
      }
    }

    for (const product of payload.products || []) {
      let categoryId = product.categoryId;
      if (!categoryId && product.categoryClientId) {
        categoryId = categoryMap.get(product.categoryClientId);
        if (!categoryId) {
          const linked = await db.query.categories.findFirst({
            where: and(
              eq(schema.categories.merchantId, merchantId),
              eq(schema.categories.clientId, product.categoryClientId)
            ),
          });
          categoryId = linked?.id;
        }
      }

      const existing = await db.query.products.findFirst({
        where: and(
          eq(schema.products.merchantId, merchantId),
          eq(schema.products.clientId, product.clientId)
        ),
      });

      const values = {
        merchantId,
        clientId: product.clientId,
        name: product.name,
        price: product.price.toString(),
        categoryId,
        sku: product.sku,
        barcode: product.barcode,
        stock: product.stock ?? 0,
        isTaxable: product.isTaxable !== false,
        description: product.description,
        productType: product.productType || "standard",
        isOpenPrice: !!product.isOpenPrice,
        soldByWeight: !!product.soldByWeight,
        weightUnit: product.weightUnit || "kg",
        bulkPricing: product.bulkPricing || [],
        extras: product.extras || [],
        comboItems: product.comboItems || [],
        allowExtras: !!product.allowExtras,
        sortOrder: product.sortOrder ?? 0,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
        productMap.set(product.clientId, existing.id);
      } else {
        const [created] = await db.insert(schema.products).values(values).returning();
        productMap.set(product.clientId, created.id);
      }
    }

    return { categoryMap: Object.fromEntries(categoryMap), productMap: Object.fromEntries(productMap) };
  }

  /**
   * Idempotent push of offline sales/orders.
   */
  static async pushSales(merchantId: string, sales: SyncSalePayload[]) {
    const db = getDb();
    const results: Array<{ clientId: string; orderId: string; created: boolean }> = [];

    for (const sale of sales) {
      const existing = await db.query.orders.findFirst({
        where: and(eq(schema.orders.merchantId, merchantId), eq(schema.orders.clientId, sale.clientId)),
      });
      if (existing) {
        results.push({ clientId: sale.clientId, orderId: existing.id, created: false });
        continue;
      }

      const orderNumber = sale.orderNumber || `POS-${sale.clientId}`;
      const subtotal = roundMoney2(Number(sale.subtotal) || 0);
      const taxAmount = roundMoney2(Number(sale.taxAmount) || 0);
      const discountAmount = roundMoney2(Number(sale.discountAmount) || 0);
      // Prefer client total (already 0.05-rounded on POS); otherwise round ourselves
      const total = roundTo005(
        sale.total != null ? Number(sale.total) : subtotal + taxAmount - discountAmount
      );
      const [order] = await db
        .insert(schema.orders)
        .values({
          merchantId,
          orderNumber,
          orderType: "pos",
          fulfillmentChannel: sale.fulfillmentChannel || "takeaway",
          status: "completed",
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus || "completed",
          notes: sale.notes,
          tableId: sale.tableId || null,
          tableLabel: sale.tableLabel || null,
          guestCount: sale.guestCount != null ? Number(sale.guestCount) : null,
          billSplits: sale.billSplits || [],
          clientId: sale.clientId,
          deviceId: sale.deviceId,
          syncedAt: new Date(),
          completedAt: sale.completedAt ? new Date(sale.completedAt) : new Date(),
        })
        .returning();

      for (const item of sale.items) {
        let productId = item.productId;
        if (!productId && item.productClientId) {
          const linked = await db.query.products.findFirst({
            where: and(
              eq(schema.products.merchantId, merchantId),
              eq(schema.products.clientId, item.productClientId)
            ),
          });
          productId = linked?.id;
        }

        await db.insert(schema.orderItems).values({
          orderId: order.id,
          productId,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          taxAmount: (item.taxAmount || 0).toString(),
          weightKg: item.weightKg != null ? item.weightKg.toString() : null,
          selectedExtras: item.selectedExtras || [],
          isOpenPrice: !!item.isOpenPrice,
          seatNumber: item.seatNumber != null ? Number(item.seatNumber) : null,
        });
      }

      if (sale.tableId) {
        try {
          await FloorPlanService.setTableStatus(merchantId, sale.tableId, "available", null);
        } catch {
          // Table may have been deleted from designer; ignore
        }
      }

      results.push({ clientId: sale.clientId, orderId: order.id, created: true });
    }

    return { results };
  }
}
