import crypto from "crypto";
import { getDb, schema } from "@/db";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { AuthService } from "./auth.service";
import { MerchantSettingsService } from "./merchant-settings.service";

export function normalizeChaslayDeviceId(deviceId: string): string {
  if (!deviceId) return "";
  const clean = deviceId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
  }
  return deviceId.trim().toUpperCase();
}

export function deriveShortDeviceId(raw: string): string {
  const clean = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (clean.length === 8) return normalizeChaslayDeviceId(clean);
  const hash = crypto.createHash("sha256").update(clean).digest();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += chars[hash[i]! % chars.length];
  }
  return `${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export function normalizeActivationCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateSyncApiKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

export class ChaslayCompatService {
  static async activateLicense(input: {
    deviceId: string;
    activationCode: string;
    appVersion?: string;
    deviceModel?: string;
    tenantSlug?: string | null;
  }) {
    const db = getDb();
    const normalizedDeviceId = normalizeChaslayDeviceId(input.deviceId);
    const licenseKey = normalizeActivationCode(input.activationCode);

    let merchant = input.tenantSlug
      ? await db.query.merchants.findFirst({ where: eq(schema.merchants.slug, input.tenantSlug) })
      : null;

    const license = await db.query.licenses.findFirst({
      where: merchant
        ? and(
            eq(schema.licenses.licenseKey, licenseKey),
            eq(schema.licenses.merchantId, merchant.id)
          )
        : eq(schema.licenses.licenseKey, licenseKey),
      with: { merchant: true, device: true },
    });

    if (!license || !license.merchant) {
      throw new Error("Invalid or already used activation code. Generate a fresh code in admin and try again.");
    }

    merchant = license.merchant;
    const now = new Date();
    if (license.expiresAt <= now || license.status !== "active") {
      throw new Error("License expired or inactive");
    }

    let device = license.device;
    if (!device) {
      const externalId = `POS-${merchant.id.substring(0, 6).toUpperCase()}-${normalizedDeviceId.replace(/-/g, "")}`;
      const inserted = await db
        .insert(schema.devices)
        .values({
          merchantId: merchant.id,
          deviceId: externalId,
          deviceName: input.deviceModel || `Chaslay ${normalizedDeviceId}`,
          deviceType: "tablet",
          osVersion: input.deviceModel,
          appVersion: input.appVersion,
          isActive: true,
        })
        .returning();
      device = inserted[0]!;
      await db
        .update(schema.licenses)
        .set({ deviceId: device.id, updatedAt: now })
        .where(eq(schema.licenses.id, license.id));
    } else {
      await db
        .update(schema.devices)
        .set({
          appVersion: input.appVersion,
          osVersion: input.deviceModel,
          lastSync: now,
          isActive: true,
        })
        .where(eq(schema.devices.id, device.id));
    }

    await db
      .update(schema.merchants)
      .set({ status: "active", updatedAt: now })
      .where(eq(schema.merchants.id, merchant.id));

    return {
      status: "ACTIVE",
      expiresAt: license.expiresAt.getTime(),
      customerName: merchant.name,
      planLabel: license.licenseType === "trial" ? "Trial license" : `${license.licenseType} license`,
      tenantSlug: merchant.slug,
    };
  }

  static async validateLicense(input: {
    deviceId: string;
    appVersion?: string;
    tenantSlug?: string | null;
  }) {
    const db = getDb();
    const normalized = normalizeChaslayDeviceId(input.deviceId);
    const short = deriveShortDeviceId(input.deviceId);

    let merchant = input.tenantSlug
      ? await db.query.merchants.findFirst({ where: eq(schema.merchants.slug, input.tenantSlug) })
      : null;

    const devices = await db.query.devices.findMany({
      where: merchant ? eq(schema.devices.merchantId, merchant.id) : undefined,
      with: { licenses: true, merchant: true },
    });

    const device = devices.find((d) => {
      const ext = d.deviceId.toUpperCase();
      return (
        ext.includes(normalized.replace(/-/g, "")) ||
        ext.endsWith(normalized.replace(/-/g, "")) ||
        deriveShortDeviceId(d.deviceId) === normalized ||
        deriveShortDeviceId(d.deviceId) === short
      );
    });

    if (!device) {
      throw new Error("Device not licensed");
    }

    merchant = device.merchant;
    const license = device.licenses?.find((l) => l.status === "active");
    if (!license || license.expiresAt <= new Date()) {
      throw new Error("License expired");
    }

    await db
      .update(schema.devices)
      .set({ appVersion: input.appVersion, lastSync: new Date() })
      .where(eq(schema.devices.id, device.id));

    return {
      status: "ACTIVE",
      expiresAt: license.expiresAt.getTime(),
      customerName: merchant?.name,
      planLabel: license.licenseType,
    };
  }

  static async posLogin(email: string, password: string, tenantSlug?: string | null) {
    const db = getDb();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    // Match by email only (case-insensitive). A stale device tenantSlug must not
    // block a valid merchant login — slug is updated from the returned user.
    const merchants = await db
      .select()
      .from(schema.merchants)
      .where(sql`lower(${schema.merchants.email}) = ${normalizedEmail}`)
      .limit(1);
    const merchant = merchants[0];

    if (!merchant) {
      throw new Error("Invalid credentials");
    }

    const valid = await AuthService.comparePassword(password, merchant.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    if (merchant.status !== "active" && merchant.status !== "trial") {
      throw new Error(`Account is ${merchant.status}`);
    }

    void tenantSlug; // accepted for API compat; not used to reject login

    return {
      user: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        role: "MERCHANT",
        tenantSlug: merchant.slug,
      },
    };
  }

  static async syncBootstrap(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });

    const products = await db.query.products.findMany({
      where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.isActive, true)),
    });

    return {
      serverTime: Date.now(),
      tenant: {
        id: merchant.id,
        slug: merchant.slug,
        name: merchant.name,
        currency_symbol: "CHF",
      },
      categories: categories.map((c) => this.mapCategory(c)),
      products: products.map((p) => this.mapProduct(p)),
      paymentConfig: await this.getPaymentConfigPayload(merchantId),
    };
  }

  static async getPaymentConfig(merchantId: string) {
    return {
      serverTime: Date.now(),
      ...(await this.getPaymentConfigPayload(merchantId)),
    };
  }

  private static async getPaymentConfigPayload(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, merchantId),
    });
    const active = terminals.filter((t) => t.status === "active");
    const defaultTerminal = active[0] || terminals[0];
    const terminalReady =
      !!merchant.adyenApiKey &&
      !!merchant.adyenMerchantAccount &&
      active.length > 0;

    return {
      adyen: {
        merchant_account: merchant.adyenMerchantAccount || null,
        api_key: merchant.adyenApiKey || null,
        client_id: merchant.adyenClientId || null,
      },
      default_terminal_id: defaultTerminal?.terminalId || null,
      terminals: terminals.map((t) => ({
        id: t.id,
        terminal_id: t.terminalId,
        terminal_name: t.terminalName,
        serial_number: t.serialNumber,
        status: t.status,
      })),
      terminal_ready: terminalReady,
      methods: {
        express: merchant.webposExpressEnabled !== false,
        cash: merchant.webposCashEnabled !== false,
        card: merchant.webposCardEnabled !== false,
        terminal: merchant.webposTerminalEnabled !== false && terminalReady,
      },
      features: {
        courses_enabled: !!merchant.coursesEnabled,
        floor_plan_enabled: !!merchant.floorPlanEnabled,
        pax_ordering_enabled: !!merchant.paxOrderingEnabled,
      },
    };
  }

  static async pushTerminalsFromDevice(
    merchantId: string,
    input: {
      terminals?: Array<{
        terminalId?: string;
        terminalName?: string;
        serialNumber?: string;
        status?: string;
      }>;
      defaultTerminalId?: string;
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
      adyenTerminalEnabled?: boolean;
      deviceLabel?: string;
    }
  ) {
    const db = getDb();
    const now = new Date();

    const adyenPatch: {
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
    } = {};
    if (input.adyenMerchantAccount?.trim()) {
      adyenPatch.adyenMerchantAccount = input.adyenMerchantAccount.trim();
    }
    if (input.adyenApiKey?.trim()) {
      adyenPatch.adyenApiKey = input.adyenApiKey.trim();
    }
    if (input.adyenClientId?.trim()) {
      adyenPatch.adyenClientId = input.adyenClientId.trim();
    }
    if (Object.keys(adyenPatch).length > 0) {
      await MerchantSettingsService.updateMerchantSettings(merchantId, adyenPatch);
    }

    const rows = input.terminals?.length
      ? input.terminals
      : input.defaultTerminalId?.trim()
        ? [{ terminalId: input.defaultTerminalId.trim() }]
        : [];

    let upserted = 0;
    for (const row of rows) {
      const terminalId = String(row.terminalId || "").trim();
      if (!terminalId) continue;

      const terminalName =
        String(row.terminalName || input.deviceLabel || terminalId).trim() || terminalId;
      const serialNumber = String(row.serialNumber || terminalId).trim() || null;
      const status =
        input.adyenTerminalEnabled === false
          ? "inactive"
          : String(row.status || "active").trim() || "active";

      const existing = await db.query.paymentTerminals.findFirst({
        where: eq(schema.paymentTerminals.terminalId, terminalId),
      });

      if (existing) {
        if (existing.merchantId !== merchantId) {
          throw new Error(`Terminal ${terminalId} belongs to another merchant`);
        }
        await db
          .update(schema.paymentTerminals)
          .set({
            terminalName: existing.terminalName?.trim() ? existing.terminalName : terminalName,
            serialNumber: serialNumber || existing.serialNumber,
            status,
            lastHeartbeat: now,
          })
          .where(eq(schema.paymentTerminals.id, existing.id));
      } else {
        await db.insert(schema.paymentTerminals).values({
          merchantId,
          terminalId,
          terminalName,
          serialNumber,
          status,
          lastHeartbeat: now,
        });
      }
      upserted += 1;
    }

    return { ok: true, upserted, serverTime: Date.now() };
  }

  static async syncMenuChanges(merchantId: string, sinceMs: number) {
    const db = getDb();
    const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(0);

    const categories = await db.query.categories.findMany({
      where: and(eq(schema.categories.merchantId, merchantId), gt(schema.categories.updatedAt, sinceDate)),
    });

    const products = await db.query.products.findMany({
      where: and(eq(schema.products.merchantId, merchantId), gt(schema.products.updatedAt, sinceDate)),
    });

    return {
      serverTime: Date.now(),
      categories: categories.map((c) => this.mapCategory(c, true)),
      products: products.map((p) => this.mapProduct(p, true)),
    };
  }

  static async incomingOrders(merchantId: string, sinceMs: number) {
    const db = getDb();
    const sinceDate =
      sinceMs > 0 ? new Date(sinceMs) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.orderType, "web_shop"),
        inArray(schema.orders.status, [
          "pending",
          "pending_approval",
          "accepted",
          "preparing",
          "ready",
        ]),
        gt(schema.orders.createdAt, sinceDate)
      ),
      with: { items: true },
      limit: 200,
    });

    return {
      serverTime: Date.now(),
      orders: orders.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        source: "ONLINE",
        status: o.status?.toUpperCase(),
        service_type: (o.fulfillmentChannel || "takeaway").toUpperCase(),
        fulfillment_type: o.fulfillmentChannel === "delivery" ? "DELIVERY" : "PICKUP",
        customer_name: o.customerName,
        customer_phone: o.customerPhone,
        delivery_address: o.shippingAddress,
        pickup_time_ms: o.scheduledFor ? o.scheduledFor.getTime() : null,
        subtotal: parseFloat(String(o.subtotal)),
        tax_total: parseFloat(String(o.taxAmount)),
        total: parseFloat(String(o.total)),
        notes: o.notes,
        payload: {
          items: (o.items || []).map((i) => ({
            productName: i.productName,
            quantity: Number(i.quantity),
            unitPrice: parseFloat(String(i.unitPrice)),
            lineTotal: parseFloat(String(i.totalPrice)),
          })),
        },
        created_at: o.createdAt?.toISOString(),
      })),
    };
  }

  static async ackOrder(merchantId: string, orderId: string) {
    const db = getDb();
    await db
      .update(schema.orders)
      .set({ status: "accepted" })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)));
    return { ok: true };
  }

  static mapCategory(c: typeof schema.categories.$inferSelect, includeDeleted = false) {
    return {
      id: c.clientId || c.id,
      name: c.name,
      sort_order: c.sortOrder ?? 0,
      color_hex: c.color || null,
      online_visible: true,
      kiosk_visible: true,
      updated_at: c.updatedAt?.toISOString(),
      ...(includeDeleted && false ? { deleted_at: c.updatedAt?.toISOString() } : {}),
    };
  }

  static mapProduct(p: typeof schema.products.$inferSelect, includeDeleted = false) {
    return {
      id: p.clientId || p.id,
      category_id: p.categoryId,
      name: p.name,
      description: p.description,
      price: parseFloat(String(p.price)),
      tax_rate: parseFloat(String(p.isTaxable ? 8.1 : 0)),
      sku: p.sku,
      image_url: p.imageUrl,
      sort_order: p.sortOrder ?? 0,
      in_stock: (p.stock ?? 0) > 0,
      online_visible: p.isActive,
      kiosk_visible: p.isActive,
      updated_at: p.updatedAt?.toISOString(),
      ...(includeDeleted && !p.isActive ? { deleted_at: p.updatedAt?.toISOString() } : {}),
    };
  }

  static receiptPublicUrl(ref: string): string {
    const base =
      process.env.PUBLIC_RECEIPT_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      "https://pay.chaslay.com";
    return `${base.replace(/\/$/, "")}/receipt/${encodeURIComponent(ref)}`;
  }
}
