import { Router, Request, Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MerchantSettingsService, type FulfillmentChannel } from "@/services/merchant-settings.service";
import { isChannelOpenNow, isWithinChannelHours, pointInPolygon, type StoreHours } from "@/lib/geo";
import { roundMoney2, roundTo005, roundingAdjustment } from "@/lib/money";
import { ShopCustomerService } from "@/services/shop-customer.service";
import { AdyenService } from "@/services/adyen.service";
import { AuthService } from "@/services/auth.service";
import { v4 as uuidv4 } from "uuid";

const router = Router();

async function resolveMerchant(slugOrHost: string) {
  return MerchantSettingsService.resolveByShopHost(slugOrHost);
}

function channelEnabled(merchant: typeof schema.merchants.$inferSelect, channel: FulfillmentChannel) {
  if (channel === "delivery") return merchant.deliveryEnabled;
  if (channel === "dine_in") return merchant.dineInEnabled;
  return merchant.pickupEnabled;
}

function mapChannelKey(channel: FulfillmentChannel): "takeaway" | "dine_in" | "delivery" {
  return channel === "dine_in" ? "dine_in" : channel === "delivery" ? "delivery" : "takeaway";
}

async function findMatchingZone(merchantId: string, lng?: number, lat?: number, zip?: string) {
  const db = getDb();
  const zones = await db.query.deliveryZones.findMany({
    where: and(eq(schema.deliveryZones.merchantId, merchantId), eq(schema.deliveryZones.isActive, true)),
    orderBy: [asc(schema.deliveryZones.sortOrder)],
  });

  if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
    const hit = zones.find((z) => pointInPolygon(lng, lat, (z.polygon || []) as Array<[number, number]>));
    if (hit) return hit;
  }

  if (zip) {
    const normalized = String(zip).trim().toLowerCase();
    const hit = zones.find((z) =>
      (z.zipCodes || []).some((c) => String(c).trim().toLowerCase() === normalized)
    );
    if (hit) return hit;
  }

  return null;
}

/**
 * GET /api/shop/tls-ask?domain=
 */
router.get("/tls-ask", async (req: Request, res: Response) => {
  try {
    const domain = String(req.query.domain || "").toLowerCase();
    if (!domain) return res.status(400).end();
    const merchant = await resolveMerchant(domain);
    if (merchant?.shopEnabled && merchant.subdomain) {
      return res.status(200).end();
    }
    return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
});

/**
 * GET /api/shop/:slug
 */
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }

    const hours = (merchant.storeHours || {}) as StoreHours;
    const channels = {
      takeaway: {
        enabled: merchant.pickupEnabled,
        ...isChannelOpenNow(hours, "takeaway"),
        etaMinutes: merchant.pickupEtaMinutes ?? 25,
      },
      dine_in: {
        enabled: merchant.dineInEnabled,
        ...isChannelOpenNow(hours, "dine_in"),
        etaMinutes: merchant.pickupEtaMinutes ?? 25,
      },
      delivery: {
        enabled: merchant.deliveryEnabled,
        ...isChannelOpenNow(hours, "delivery"),
        etaMinutes: merchant.deliveryEtaMinutes ?? 45,
      },
    };

    res.json({
      success: true,
      data: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        subdomain: merchant.subdomain,
        address: merchant.address,
        city: merchant.city,
        phone: merchant.phone,
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        shopLogoUrl: merchant.shopLogoUrl,
        shopBannerUrl: merchant.shopBannerUrl,
        taxTakeawayRate: merchant.taxTakeawayRate,
        taxDineInRate: merchant.taxDineInRate,
        taxDeliveryRate: merchant.taxDeliveryRate,
        vatRate: merchant.vatRate,
        storeHours: hours,
        channels,
        payment: {
          cash: true,
          card: true,
          cardReady: !!(merchant.adyenMerchantAccount && merchant.adyenApiKey && merchant.adyenClientId),
          currency: "CHF",
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load shop" });
  }
});

/**
 * GET /api/shop/:slug/menu
 */
router.get("/:slug/menu", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }

    const db = getDb();
    const [categories, products] = await Promise.all([
      db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchant.id),
        orderBy: [asc(schema.categories.sortOrder)],
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchant.id), eq(schema.products.isActive, true)),
      }),
    ]);

    const menu = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: products
        .filter((p) => p.categoryId === cat.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price.toString()),
          description: p.description,
          image: p.imageUrl,
        })),
    }));

    const uncategorized = products.filter((p) => !p.categoryId);
    if (uncategorized.length) {
      menu.push({
        id: "uncategorized",
        name: "Other",
        items: uncategorized.map((p) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price.toString()),
          description: p.description,
          image: p.imageUrl,
        })),
      });
    }

    res.json({ success: true, data: menu.filter((c) => c.items.length > 0) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load menu" });
  }
});

/**
 * GET /api/shop/:slug/delivery-zones
 */
router.get("/:slug/delivery-zones", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    const db = getDb();
    const zones = await db.query.deliveryZones.findMany({
      where: and(eq(schema.deliveryZones.merchantId, merchant.id), eq(schema.deliveryZones.isActive, true)),
      orderBy: [asc(schema.deliveryZones.sortOrder)],
    });
    res.json({
      success: true,
      data: zones.map((z) => ({
        id: z.id,
        name: z.name,
        polygon: z.polygon,
        minOrderAmount: z.minOrderAmount,
        deliveryFee: z.deliveryFee,
        estimatedMinutes: z.estimatedMinutes,
        color: z.color,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load zones" });
  }
});

/**
 * POST /api/shop/:slug/geocode
 * Body: { query }
 */
router.post("/:slug/geocode", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found" });
    }
    const query = String(req.body.query || "").trim();
    if (!query) return res.status(400).json({ error: "query required" });

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ManuPOS-Shop/1.0 (https://manupos.webprintmedia.swiss)",
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Geocoding unavailable" });
    }
    const data = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!data?.[0]) {
      return res.json({ success: true, found: false });
    }
    res.json({
      success: true,
      found: true,
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      displayName: data[0].display_name,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Geocode failed" });
  }
});

/**
 * POST /api/shop/:slug/check-delivery
 * Body: { lat, lng, zipCode?, subtotal? }
 */
router.post("/:slug/check-delivery", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled || !merchant.deliveryEnabled) {
      return res.status(404).json({ error: "Delivery not available" });
    }

    const hours = isChannelOpenNow((merchant.storeHours || {}) as StoreHours, "delivery");
    const lat = req.body.lat != null ? Number(req.body.lat) : undefined;
    const lng = req.body.lng != null ? Number(req.body.lng) : undefined;
    const zipCode = req.body.zipCode ? String(req.body.zipCode) : undefined;
    const subtotal = Number(req.body.subtotal || 0);

    const zone = await findMatchingZone(merchant.id, lng, lat, zipCode);
    if (!zone) {
      return res.json({
        success: true,
        deliverable: false,
        open: hours.open,
        todayLabel: hours.todayLabel,
        error: "Address is outside delivery zones",
      });
    }

    const minOrder = parseFloat(zone.minOrderAmount?.toString() || "0");
    const fee = parseFloat(zone.deliveryFee?.toString() || "0");
    const meetsMin = subtotal >= minOrder;

    res.json({
      success: true,
      deliverable: true,
      open: hours.open,
      todayLabel: hours.todayLabel,
      zone: {
        id: zone.id,
        name: zone.name,
        minOrderAmount: minOrder,
        deliveryFee: fee,
        estimatedMinutes: zone.estimatedMinutes,
      },
      meetsMinOrder: meetsMin,
      message: meetsMin
        ? undefined
        : `Minimum order for this zone is CHF ${minOrder.toFixed(2)}`,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Check failed" });
  }
});

function optionalCustomer(req: Request): { customerId?: string } {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return {};
    const payload = AuthService.verifyToken(authHeader.slice(7));
    if (payload.role === "customer" && payload.customerId) {
      return { customerId: payload.customerId };
    }
  } catch {
    /* guest */
  }
  return {};
}

/**
 * POST /api/shop/:slug/auth/register
 */
router.post("/:slug/auth/register", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const result = await ShopCustomerService.register(merchant.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Register failed" });
  }
});

/**
 * POST /api/shop/:slug/auth/login
 */
router.post("/:slug/auth/login", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { email, password } = req.body;
    const result = await ShopCustomerService.login(merchant.id, email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

/**
 * GET /api/shop/:slug/auth/me
 */
router.get("/:slug/auth/me", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const customer = await ShopCustomerService.getProfile(customerId, merchant.id);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
});

/**
 * PUT /api/shop/:slug/auth/me
 */
router.put("/:slug/auth/me", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const customer = await ShopCustomerService.updateProfile(customerId, merchant.id, req.body);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

/**
 * GET /api/shop/:slug/payment-options
 */
router.get("/:slug/payment-options", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const cardReady = !!(merchant.adyenMerchantAccount && merchant.adyenApiKey && merchant.adyenClientId);
    res.json({
      success: true,
      options: {
        cash: true,
        card: true,
        cardReady,
        currency: "CHF",
        clientKey: cardReady ? merchant.adyenClientId : null,
        environment: (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/shop/:slug/orders — checkout create
 */
router.post("/:slug/orders", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }

    const {
      items,
      customerEmail,
      customerPhone,
      customerName,
      notes,
      shippingAddress,
      city,
      fulfillmentChannel = "takeaway",
      lat,
      lng,
      zipCode,
      paymentMethod = "cash",
      tipAmount = 0,
      scheduledFor,
      guestCheckout = true,
    } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
      customerEmail?: string;
      customerPhone?: string;
      customerName?: string;
      notes?: string;
      shippingAddress?: string | Record<string, string>;
      city?: string;
      fulfillmentChannel?: FulfillmentChannel;
      lat?: number;
      lng?: number;
      zipCode?: string;
      paymentMethod?: "cash" | "card";
      tipAmount?: number;
      scheduledFor?: string | null;
      guestCheckout?: boolean;
    };

    if (!items?.length) {
      return res.status(400).json({ error: "Order items are required" });
    }
    if (!customerName?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const payMethod = paymentMethod === "card" ? "card" : "cash";
    const channel: FulfillmentChannel =
      fulfillmentChannel === "dine_in" || fulfillmentChannel === "takeaway" || fulfillmentChannel === "delivery"
        ? fulfillmentChannel
        : "takeaway";

    if (!channelEnabled(merchant, channel)) {
      return res.status(400).json({ error: "This order type is not available" });
    }

    // ASAP orders must be within open hours; scheduled orders must fall inside opening hours
    const isScheduled = !!scheduledFor;
    const channelKey = mapChannelKey(channel);
    const hours = (merchant.storeHours || {}) as StoreHours;
    if (!isScheduled) {
      const openState = isChannelOpenNow(hours, channelKey);
      if (!openState.open) {
        return res.status(400).json({
          error: `Store is closed for ${channel.replace("_", " ")} (${openState.todayLabel}). Please schedule for later.`,
        });
      }
    } else {
      const when = new Date(scheduledFor as string);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: "Invalid scheduled time" });
      }
      if (when.getTime() < Date.now() - 60_000) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
      // Allow up to 3 days ahead
      if (when.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "Scheduled time is too far in the future" });
      }
      if (!isWithinChannelHours(hours, channelKey, when)) {
        return res.status(400).json({
          error: "Selected time is outside opening hours. Choose another slot.",
        });
      }
    }

    if (channel === "delivery") {
      const addr =
        typeof shippingAddress === "string"
          ? shippingAddress
          : shippingAddress
            ? JSON.stringify(shippingAddress)
            : "";
      if (!addr.trim()) {
        return res.status(400).json({ error: "Delivery address is required" });
      }
    }

    const taxRate = MerchantSettingsService.channelTaxRate(merchant, channel);
    const db = getDb();
    const authCustomer = optionalCustomer(req);

    let subtotal = 0;
    let taxAmount = 0;
    const lineItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      taxAmount: number;
    }> = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.id, item.productId), eq(schema.products.merchantId, merchant.id)),
      });
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      const unitPrice = roundMoney2(parseFloat(product.price.toString()));
      const totalPrice = roundMoney2(unitPrice * qty);
      const lineTax = product.isTaxable ? roundMoney2((totalPrice * taxRate) / 100) : 0;
      subtotal += totalPrice;
      taxAmount += lineTax;
      lineItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice,
        totalPrice,
        taxAmount: lineTax,
      });
    }

    if (!lineItems.length) {
      return res.status(400).json({ error: "No valid items" });
    }

    let deliveryFee = 0;
    let deliveryZoneId: string | undefined;
    if (channel === "delivery") {
      const zone = await findMatchingZone(
        merchant.id,
        lng != null ? Number(lng) : undefined,
        lat != null ? Number(lat) : undefined,
        zipCode
      );
      if (!zone) {
        return res.status(400).json({ error: "Address is outside delivery zones" });
      }
      const minOrder = parseFloat(zone.minOrderAmount?.toString() || "0");
      if (subtotal < minOrder) {
        return res.status(400).json({
          error: `Minimum order for this zone is CHF ${minOrder.toFixed(2)}`,
        });
      }
      deliveryFee = parseFloat(zone.deliveryFee?.toString() || "0");
      deliveryZoneId = zone.id;
    }

    let customerId = authCustomer.customerId;
    const emailNorm = customerEmail?.trim().toLowerCase();
    if (!customerId && emailNorm) {
      let customer = await db.query.customers.findFirst({
        where: and(eq(schema.customers.merchantId, merchant.id), eq(schema.customers.email, emailNorm)),
      });
      if (!customer) {
        const [created] = await db
          .insert(schema.customers)
          .values({
            merchantId: merchant.id,
            email: emailNorm,
            phone: customerPhone,
            firstName: customerName?.split(" ")[0],
            lastName: customerName?.split(" ").slice(1).join(" ") || undefined,
            defaultAddress: typeof shippingAddress === "string" ? shippingAddress : undefined,
            defaultZip: zipCode,
            defaultCity: city,
          })
          .returning();
        customer = created;
      } else if (guestCheckout) {
        await db
          .update(schema.customers)
          .set({
            phone: customerPhone || customer.phone,
            firstName: customerName?.split(" ")[0] || customer.firstName,
            lastName: customerName?.split(" ").slice(1).join(" ") || customer.lastName,
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.id, customer.id));
      }
      customerId = customer.id;
    }

    const tip = roundTo005(Math.max(0, Number(tipAmount) || 0));
    const feeTax = roundMoney2((deliveryFee * taxRate) / 100);
    taxAmount = roundMoney2(taxAmount + feeTax);
    subtotal = roundMoney2(subtotal);
    deliveryFee = roundMoney2(deliveryFee);
    const orderNumber = `WEB-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const rawTotal = subtotal + deliveryFee + tip + taxAmount;
    const roundAdj = roundingAdjustment(rawTotal);
    const total = roundTo005(rawTotal);
    const notesWithRounding =
      roundAdj !== 0
        ? `${notes ? `${notes}\n` : ""}[Rounding ${roundAdj > 0 ? "+" : ""}${roundAdj.toFixed(2)}]`
        : notes;
    const addressText =
      typeof shippingAddress === "string"
        ? [shippingAddress, zipCode, city].filter(Boolean).join(", ")
        : shippingAddress
          ? JSON.stringify(shippingAddress)
          : channel === "takeaway" || channel === "dine_in"
            ? `Pickup: ${merchant.address || merchant.name}${merchant.city ? `, ${merchant.city}` : ""}`
            : null;

    const paymentStatus = payMethod === "card" ? "awaiting_payment" : "cash";

    const [order] = await db
      .insert(schema.orders)
      .values({
        merchantId: merchant.id,
        orderNumber,
        customerId,
        orderType: "web_shop",
        fulfillmentChannel: channel,
        status: "pending_approval",
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: "0",
        deliveryFee: deliveryFee.toFixed(2),
        tipAmount: tip.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: payMethod,
        paymentStatus,
        notes: notesWithRounding || null,
        shippingAddress: addressText,
        deliveryZoneId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: emailNorm || null,
      })
      .returning();

    for (const line of lineItems) {
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toFixed(2),
        totalPrice: line.totalPrice.toFixed(2),
        taxAmount: line.taxAmount.toFixed(2),
      });
    }

    let paymentSession: unknown = null;
    if (payMethod === "card") {
      try {
        const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
        const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
        const session = await AdyenService.initializePaymentSession(
          merchant.id,
          order.id,
          parseFloat(order.total.toString()),
          "CHF",
          returnUrl
        );
        paymentSession = {
          id: session.id,
          sessionData: session.sessionData,
          clientKey: merchant.adyenClientId,
          environment:
            (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
        };
      } catch (e) {
        // Card selected but Adyen not ready — keep order awaiting_payment; client can retry or switch
        paymentSession = {
          error: e instanceof Error ? e.message : "Adyen not configured",
          demoConfirmAvailable: true,
        };
      }
    }

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentChannel: order.fulfillmentChannel,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tipAmount: order.tipAmount,
        taxAmount: order.taxAmount,
        total: order.total,
        scheduledFor: order.scheduledFor,
        shippingAddress: order.shippingAddress,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        notes: order.notes,
      },
      paymentSession,
    });
  } catch (error) {
    console.error("Shop order error:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

/**
 * GET /api/shop/:slug/orders/:orderId — confirmation / tracking
 */
router.get("/:slug/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
      with: { items: true },
    });
    if (!order || order.orderType !== "web_shop") {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentChannel: order.fulfillmentChannel,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tipAmount: order.tipAmount,
        taxAmount: order.taxAmount,
        total: order.total,
        scheduledFor: order.scheduledFor,
        shippingAddress: order.shippingAddress,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        notes: order.notes,
        createdAt: order.createdAt,
        items: order.items,
        store: {
          name: merchant.name,
          address: merchant.address,
          city: merchant.city,
          phone: merchant.phone,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load order" });
  }
});

/**
 * POST /api/shop/:slug/orders/:orderId/payment-session
 */
router.post("/:slug/orders/:orderId/payment-session", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentStatus === "completed") {
      return res.json({ success: true, alreadyPaid: true });
    }

    const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
    const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
    const session = await AdyenService.initializePaymentSession(
      merchant.id,
      order.id,
      parseFloat(order.total.toString()),
      "CHF",
      returnUrl
    );
    res.json({
      success: true,
      paymentSession: {
        id: session.id,
        sessionData: session.sessionData,
        clientKey: merchant.adyenClientId,
        environment:
          (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
      },
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Payment session failed",
      demoConfirmAvailable: true,
    });
  }
});

/**
 * POST /api/shop/:slug/orders/:orderId/confirm-payment
 * Marks card order paid after Adyen success (or demo confirm when Adyen unavailable).
 */
router.post("/:slug/orders/:orderId/confirm-payment", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const [updated] = await db
      .update(schema.orders)
      .set({
        paymentStatus: "completed",
        paymentMethod: "card",
        adyenReference: req.body.pspReference || req.body.adyenReference || order.adyenReference,
        // Keep kitchen lifecycle — paid card orders still need staff accept
        status:
          order.status === "awaiting_payment" || order.status === "pending"
            ? "pending_approval"
            : order.status,
      })
      .where(eq(schema.orders.id, order.id))
      .returning();

    try {
      await AdyenService.recordPaymentTransaction(
        merchant.id,
        order.id,
        parseFloat(order.total.toString()),
        "card",
        String(req.body.pspReference || `DEMO-${order.orderNumber}`),
        "completed"
      );
    } catch {
      /* optional */
    }

    res.json({ success: true, order: updated });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
  }
});

export default router;
