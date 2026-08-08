import { repairCatalogText } from "@/lib/text-encoding";
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
  comboSelections?: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
  }>;
  isOpenPrice?: boolean;
  seatNumber?: number | null;
}

export interface SyncSalePayload {
  clientId: string;
  deviceId?: string;
  orderNumber?: string;
  paymentMethod: string;
  paymentStatus?: string;
  /** Order lifecycle status; defaults completed for paid sales, accepted for pay-later */
  status?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
  staffName?: string | null;
  total: number;
  notes?: string;
  fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
  completedAt?: string | number;
  /** ISO / epoch — pickup or delivery time (null/omit = ASAP) */
  scheduledFor?: string | number | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
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
  /** Shared id for split-bill sibling orders */
  masterOrderId?: string | null;
  /** 1-based split check number */
  splitCheckNumber?: number | null;
  items: SyncSaleItem[];
}

function asUuidOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return null;
  }
  return s;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.cause?.code === "23505" ||
    /duplicate key|unique constraint/i.test(String(e?.message || err || ""))
  );
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
    const { ReservationService } = await import("@/services/reservation.service");
    const reservations = merchant?.reservationsEnabled
      ? await ReservationService.listForSync(merchantId)
      : [];

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
      reservations,
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
            reservationsEnabled: merchant.reservationsEnabled,
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
            name: repairCatalogText(cat.name),
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
            name: repairCatalogText(cat.name),
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
        name: repairCatalogText(product.name),
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

      const baseOrderNumber = String(sale.orderNumber || `POS-${sale.clientId}`).slice(0, 40);
      const subtotal = roundMoney2(Number(sale.subtotal) || 0);
      const taxAmount = roundMoney2(Number(sale.taxAmount) || 0);
      const discountAmount = roundMoney2(Number(sale.discountAmount) || 0);
      const tipAmount = roundMoney2(Math.max(0, Number(sale.tipAmount) || 0));
      const roundingAmount = roundMoney2(Number(sale.roundingAmount) || 0);
      // Prefer client total (already rounded on POS); otherwise compute
      const total = roundTo005(
        sale.total != null
          ? Number(sale.total)
          : subtotal + taxAmount - discountAmount + tipAmount + roundingAmount
      );
      const payStatus = sale.paymentStatus || "completed";
      const payLater =
        payStatus === "awaiting_payment" ||
        sale.paymentMethod === "pay_later" ||
        sale.paymentMethod === "pay-later";
      let scheduledFor: Date | null = null;
      if (sale.scheduledFor != null && sale.scheduledFor !== "") {
        const d = new Date(sale.scheduledFor);
        if (!Number.isNaN(d.getTime())) scheduledFor = d;
      }
      const status =
        sale.status ||
        (payLater ? (scheduledFor ? "accepted" : "preparing") : "completed");
      const completedAt = payLater
        ? null
        : sale.completedAt
          ? new Date(sale.completedAt)
          : new Date();
      if (completedAt && Number.isNaN(completedAt.getTime())) {
        throw new Error("Invalid completedAt on sale");
      }

      const orderValuesBase = {
        merchantId,
        orderType: "pos" as const,
        fulfillmentChannel: sale.fulfillmentChannel || "takeaway",
        status,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        tipAmount: tipAmount.toFixed(2),
        roundingAmount: roundingAmount.toFixed(2),
        amountTendered:
          sale.amountTendered != null && Number.isFinite(Number(sale.amountTendered))
            ? roundMoney2(Number(sale.amountTendered)).toFixed(2)
            : null,
        changeDue:
          sale.changeDue != null && Number.isFinite(Number(sale.changeDue))
            ? roundMoney2(Number(sale.changeDue)).toFixed(2)
            : null,
        staffName: sale.staffName ? String(sale.staffName).trim().slice(0, 255) : null,
        total: total.toFixed(2),
        paymentMethod: sale.paymentMethod,
        paymentStatus: payStatus,
        notes: sale.notes || null,
        scheduledFor,
        customerId: asUuidOrNull(sale.customerId),
        customerName: sale.customerName || null,
        customerPhone: sale.customerPhone || null,
        customerEmail: sale.customerEmail || null,
        shippingAddress: sale.shippingAddress || null,
        tableId: asUuidOrNull(sale.tableId),
        tableLabel: sale.tableLabel || null,
        guestCount:
          sale.guestCount != null && Number.isFinite(Number(sale.guestCount))
            ? Number(sale.guestCount)
            : null,
        billSplits: sale.billSplits || [],
        masterOrderId: sale.masterOrderId ? String(sale.masterOrderId).trim().slice(0, 64) : null,
        splitCheckNumber:
          sale.splitCheckNumber != null && Number.isFinite(Number(sale.splitCheckNumber))
            ? Number(sale.splitCheckNumber)
            : null,
        clientId: sale.clientId,
        deviceId: sale.deviceId || null,
        syncedAt: new Date(),
        completedAt,
      };

      let order: { id: string } | undefined;
      let orderNumber = baseOrderNumber;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const [row] = await db
            .insert(schema.orders)
            .values({ ...orderValuesBase, orderNumber })
            .returning();
          order = row;
          break;
        } catch (err) {
          if (isUniqueViolation(err) && attempt < 5) {
            orderNumber = `${baseOrderNumber}-${Math.random().toString(36).slice(2, 6)}`.slice(
              0,
              50
            );
            continue;
          }
          const cause = (err as { cause?: unknown })?.cause;
          const detail =
            (cause as { message?: string })?.message ||
            (err as Error)?.message ||
            String(err);
          throw new Error(`Failed to insert sale order: ${detail}`);
        }
      }
      if (!order) throw new Error("Failed to insert sale order");

      for (const item of sale.items) {
        let productId = asUuidOrNull(item.productId);
        let catalogName: string | null = null;
        if (!productId && item.productClientId) {
          const linked = await db.query.products.findFirst({
            where: and(
              eq(schema.products.merchantId, merchantId),
              eq(schema.products.clientId, item.productClientId)
            ),
          });
          productId = linked?.id ?? null;
          catalogName = linked?.name ?? null;
        } else if (productId && !(item.productName && String(item.productName).trim())) {
          const linked = await db.query.products.findFirst({
            where: eq(schema.products.id, productId),
          });
          catalogName = linked?.name ?? null;
        }

        const resolvedName = (
          (item.productName && String(item.productName).trim()) ||
          catalogName ||
          "Item"
        ).slice(0, 255);

        await db.insert(schema.orderItems).values({
          orderId: order.id,
          productId,
          productName: resolvedName,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          taxAmount: (item.taxAmount || 0).toString(),
          weightKg: item.weightKg != null ? item.weightKg.toString() : null,
          selectedExtras: item.selectedExtras || [],
          comboSelections: item.comboSelections || [],
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
