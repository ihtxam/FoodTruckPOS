import { Router, Request, Response } from "express";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MerchantSettingsService, type FulfillmentChannel } from "@/services/merchant-settings.service";
import {
  getDisplayHoursNow,
  isChannelOpenNow,
  isWithinChannelHours,
  pointInPolygon,
  type StoreHours,
} from "@/lib/geo";
import { roundMoney2, roundTo005, roundingAdjustment } from "@/lib/money";
import { ShopCustomerService } from "@/services/shop-customer.service";
import { ShopLoyaltyService } from "@/services/shop-loyalty.service";
import { AdyenService } from "@/services/adyen.service";
import { AuthService } from "@/services/auth.service";
import { ModifierService } from "@/services/modifier.service";
import { normalizeComboSlots } from "@/lib/combo";
import { v4 as uuidv4 } from "uuid";

const router = Router();

type ShopExtraSelection = { id: string; name?: string; price?: number };
type ShopComboSelectionInput = {
  slotId: string;
  productId: string;
  selectedExtras?: ShopExtraSelection[];
};

function serializeShopModifierGroup(g: any) {
  const pricingType = g.pricingType || "fixed";
  return {
    id: g.id,
    title: g.title,
    pricingType,
    selectionType: g.selectionType || "optional",
    minSelectable: Number(g.minSelectable) || 0,
    maxSelectable: Number(g.maxSelectable) || 1,
    allowMultipleSameItem: !!g.allowMultipleSameItem,
    options: (g.options || [])
      .filter((o: any) => (o.saleStatus || "in_stock") !== "out_of_stock")
      .map((o: any) => ({
        id: o.id,
        name: o.name,
        price: pricingType === "free" ? 0 : parseFloat(o.price?.toString() || "0"),
        isDefault: !!o.isDefault,
      })),
  };
}

function mapShopProduct(
  p: typeof schema.products.$inferSelect,
  modifierGroups: ReturnType<typeof serializeShopModifierGroup>[],
  catalogById?: Map<string, typeof schema.products.$inferSelect>,
  groupsByProduct?: Map<string, ReturnType<typeof serializeShopModifierGroup>[]>
) {
  const extras = Array.isArray(p.extras) ? p.extras : [];
  const isCombo = p.productType === "combo";
  const slots = isCombo ? normalizeComboSlots(p.comboItems) : [];

  const comboSlots = slots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    minPick: slot.minPick,
    maxPick: slot.maxPick,
    options: slot.options
      .map((opt) => {
        const child = catalogById?.get(opt.productId);
        if (!child || child.isActive === false) return null;
        const childGroups = groupsByProduct?.get(child.id) || [];
        const childExtras = Array.isArray(child.extras) ? child.extras : [];
        return {
          productId: child.id,
          name: child.name,
          image: child.imageUrl,
          description: child.description,
          extraPrice: roundMoney2(opt.extraPrice),
          allowExtras: !!child.allowExtras || childGroups.length > 0 || childExtras.length > 0,
          extras: childExtras.map((e) => ({
            id: e.id,
            name: e.name,
            price: Number(e.price) || 0,
          })),
          modifierGroups: childGroups,
        };
      })
      .filter(Boolean),
  })).filter((s) => s.options.length > 0);

  const rewardPts = p.loyaltyRewardPoints != null ? Number(p.loyaltyRewardPoints) : null;
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price.toString()),
    description: p.description,
    image: p.imageUrl,
    productType: p.productType || "standard",
    allowExtras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
    extras: extras.map((e) => ({
      id: e.id,
      name: e.name,
      price: Number(e.price) || 0,
    })),
    modifierGroups,
    comboSlots: isCombo ? comboSlots : [],
    loyaltyRewardPoints:
      rewardPts != null && Number.isFinite(rewardPts) && rewardPts >= 1 ? Math.floor(rewardPts) : null,
  };
}

async function earnLoyaltyForOrder(
  merchant: typeof schema.merchants.$inferSelect,
  order: typeof schema.orders.$inferSelect
) {
  if (!order.customerId) return order;
  if ((order.pointsEarned || 0) > 0) return order;
  const program = ShopLoyaltyService.programFromMerchant(merchant);
  if (!program.enabled) return order;

  const subtotal = parseFloat(order.subtotal?.toString() || "0");
  const pointsDiscount = parseFloat(order.pointsDiscount?.toString() || "0");
  const paidFood = Math.max(0, subtotal - pointsDiscount);
  const points = ShopLoyaltyService.computeEarnPoints(paidFood, program.earnPointsPerChf);
  if (points <= 0) {
    const db = getDb();
    const [updated] = await db
      .update(schema.orders)
      .set({ pointsEarned: 0 })
      .where(eq(schema.orders.id, order.id))
      .returning();
    return updated || order;
  }

  await ShopLoyaltyService.earnPoints({
    merchantId: merchant.id,
    customerId: order.customerId,
    orderId: order.id,
    points,
    expiryDays: program.expiryDays,
    source: "earn",
  });

  const db = getDb();
  const [updated] = await db
    .update(schema.orders)
    .set({ pointsEarned: points })
    .where(eq(schema.orders.id, order.id))
    .returning();
  return updated || { ...order, pointsEarned: points };
}

async function resolveShopComboSelections(
  merchantId: string,
  comboProduct: typeof schema.products.$inferSelect,
  requested: ShopComboSelectionInput[] | undefined
): Promise<{
  selections: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras: Array<{ id: string; name: string; price: number }>;
  }>;
  surcharge: number;
  error?: string;
}> {
  const slots = normalizeComboSlots(comboProduct.comboItems);
  if (!slots.length) {
    return { selections: [], surcharge: 0 };
  }

  const picks = Array.isArray(requested) ? requested : [];
  const picksBySlot = new Map<string, ShopComboSelectionInput[]>();
  for (const pick of picks) {
    if (!pick?.slotId || !pick?.productId) continue;
    const list = picksBySlot.get(pick.slotId) || [];
    list.push(pick);
    picksBySlot.set(pick.slotId, list);
  }

  const db = getDb();
  const selections: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras: Array<{ id: string; name: string; price: number }>;
  }> = [];
  let surcharge = 0;

  for (const slot of slots) {
    const slotPicks = picksBySlot.get(slot.id) || [];
    if (slotPicks.length < slot.minPick) {
      return {
        selections: [],
        surcharge: 0,
        error: `Please choose ${slot.minPick === 1 ? "an option" : `${slot.minPick} options`} for "${slot.name}"`,
      };
    }
    if (slotPicks.length > slot.maxPick) {
      return {
        selections: [],
        surcharge: 0,
        error: `Too many options selected for "${slot.name}"`,
      };
    }

    const optionById = new Map(slot.options.map((o) => [o.productId, o]));
    for (const pick of slotPicks) {
      const opt = optionById.get(pick.productId);
      if (!opt) {
        return {
          selections: [],
          surcharge: 0,
          error: `Invalid choice for "${slot.name}"`,
        };
      }
      const child = await db.query.products.findFirst({
        where: and(eq(schema.products.id, pick.productId), eq(schema.products.merchantId, merchantId)),
      });
      if (!child || !child.isActive) {
        return {
          selections: [],
          surcharge: 0,
          error: `Product unavailable in "${slot.name}"`,
        };
      }
      const extrasResolved = await resolveShopLineExtras(merchantId, child, pick.selectedExtras);
      if (extrasResolved.error) {
        return { selections: [], surcharge: 0, error: extrasResolved.error };
      }
      const extraPrice = roundMoney2(opt.extraPrice);
      const extrasTotal = roundMoney2(extrasResolved.extras.reduce((s, e) => s + e.price, 0));
      surcharge = roundMoney2(surcharge + extraPrice + extrasTotal);
      selections.push({
        slotId: slot.id,
        slotName: slot.name,
        productId: child.id,
        productName: child.name,
        extraPrice,
        selectedExtras: extrasResolved.extras,
      });
    }
  }

  return { selections, surcharge };
}

async function loadModifierGroupsByProduct(merchantId: string, productIds: string[]) {
  const byProduct = new Map<string, ReturnType<typeof serializeShopModifierGroup>[]>();
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
    list.push(serializeShopModifierGroup(g));
    byProduct.set(link.productId, list);
  }
  return byProduct;
}

/** Resolve and price selected extras from DB (never trust client prices). */
async function resolveShopLineExtras(
  merchantId: string,
  product: typeof schema.products.$inferSelect,
  requested: ShopExtraSelection[] | undefined
): Promise<{ extras: Array<{ id: string; name: string; price: number }>; error?: string }> {
  const groups = await ModifierService.getGroupsForProduct(merchantId, product.id);
  const optionById = new Map<
    string,
    { id: string; name: string; price: number; groupId: string; groupTitle: string }
  >();

  for (const g of groups) {
    for (const o of g.options) {
      if (o.saleStatus === "out_of_stock") continue;
      optionById.set(o.id, {
        id: o.id,
        name: o.name,
        price: g.pricingType === "free" ? 0 : Number(o.price) || 0,
        groupId: g.id,
        groupTitle: g.title,
      });
    }
  }

  // Legacy flat extras (no groups)
  if (!groups.length && Array.isArray(product.extras)) {
    for (const e of product.extras) {
      if (!e?.id) continue;
      optionById.set(e.id, {
        id: e.id,
        name: e.name,
        price: Number(e.price) || 0,
        groupId: "__legacy__",
        groupTitle: "Extras",
      });
    }
  }

  const reqIds = (requested || []).map((r) => r.id).filter(Boolean);
  const extras: Array<{ id: string; name: string; price: number }> = [];
  const countsByGroup = new Map<string, number>();

  for (const id of reqIds) {
    const opt = optionById.get(id);
    if (!opt) {
      return { extras: [], error: `Invalid extra selected for ${product.name}` };
    }
    extras.push({ id: opt.id, name: opt.name, price: roundMoney2(opt.price) });
    countsByGroup.set(opt.groupId, (countsByGroup.get(opt.groupId) || 0) + 1);
  }

  for (const g of groups) {
    const count = countsByGroup.get(g.id) || 0;
    const min =
      g.selectionType === "required"
        ? Math.max(1, Number(g.minSelectable) || 1)
        : Math.max(0, Number(g.minSelectable) || 0);
    const max = Math.max(min, Number(g.maxSelectable) || 1);
    if (count < min) {
      return {
        extras: [],
        error: `Please choose ${min === 1 ? "an option" : `${min} options`} for "${g.title}" on ${product.name}`,
      };
    }
    if (count > max) {
      return {
        extras: [],
        error: `Too many options selected for "${g.title}" on ${product.name}`,
      };
    }
  }

  return { extras };
}

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
    const displayHours = getDisplayHoursNow(hours, "takeaway");

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
        /** Homepage banner hours (display channel or takeaway fallback) */
        displayHours,
        channels,
        payment: {
          cash: true,
          card: true,
          cardReady: !!(merchant.adyenMerchantAccount && merchant.adyenApiKey && merchant.adyenClientId),
          currency: "CHF",
        },
        loyalty: ShopLoyaltyService.programFromMerchant(merchant),
        /** Merchant panel language — used as shop default when customer has no preference */
        language: merchant.panelLanguage || "en",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load shop" });
  }
});

/**
 * GET /api/shop/:slug/loyalty — public program + rewards; full summary when customer Bearer present
 */
router.get("/:slug/loyalty", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (customerId) {
      const summary = await ShopLoyaltyService.getCustomerLoyaltySummary(merchant.id, customerId);
      return res.json({ success: true, ...summary });
    }
    const pub = await ShopLoyaltyService.getPublicLoyalty(merchant.id);
    res.json({ success: true, ...pub });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load loyalty" });
  }
});

/**
 * GET /api/shop/:slug/my-orders — authenticated customer web_shop order history
 */
router.get("/:slug/my-orders", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });

    const db = getDb();
    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchant.id),
        eq(schema.orders.customerId, customerId),
        eq(schema.orders.orderType, "web_shop")
      ),
      with: { items: true },
      orderBy: [desc(schema.orders.createdAt)],
      limit: 50,
    });

    res.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        fulfillmentChannel: o.fulfillmentChannel,
        subtotal: o.subtotal,
        taxAmount: o.taxAmount,
        deliveryFee: o.deliveryFee,
        tipAmount: o.tipAmount,
        pointsDiscount: o.pointsDiscount,
        pointsEarned: o.pointsEarned,
        pointsRedeemed: o.pointsRedeemed,
        total: o.total,
        createdAt: o.createdAt,
        items: (o.items || []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          selectedExtras: it.selectedExtras,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load orders" });
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
        orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
      }),
    ]);

    const groupsByProduct = await loadModifierGroupsByProduct(
      merchant.id,
      products.map((p) => p.id)
    );
    const catalogById = new Map(products.map((p) => [p.id, p]));

    const toItem = (p: (typeof products)[number]) =>
      mapShopProduct(p, groupsByProduct.get(p.id) || [], catalogById, groupsByProduct);

    const menu = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: products.filter((p) => p.categoryId === cat.id).map(toItem),
    }));

    const uncategorized = products.filter((p) => !p.categoryId);
    if (uncategorized.length) {
      menu.push({
        id: "uncategorized",
        name: "Other",
        items: uncategorized.map(toItem),
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
        cardFeeFixed: Number(merchant.onlineCardFeeFixed || 0) || 0,
        cardFeePercent: Number(merchant.onlineCardFeePercent || 0) || 0,
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
      pointsToRedeem = 0,
    } = req.body as {
      items: Array<{
        productId: string;
        quantity: number;
        selectedExtras?: ShopExtraSelection[];
        comboSelections?: ShopComboSelectionInput[];
        loyaltyReward?: boolean;
      }>;
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
      pointsToRedeem?: number;
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
    const loyaltyProgram = ShopLoyaltyService.programFromMerchant(merchant);

    let subtotal = 0;
    let taxAmount = 0;
    let rewardPointsNeeded = 0;
    const rewardLines: Array<{ productId: string; points: number; quantity: number }> = [];
    const lineItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      taxAmount: number;
      loyaltyReward: boolean;
      rewardPointsCost: number;
      selectedExtras: Array<{ id: string; name: string; price: number }>;
      comboSelections: Array<{
        slotId: string;
        slotName: string;
        productId: string;
        productName: string;
        extraPrice: number;
        selectedExtras?: Array<{ id: string; name: string; price: number }>;
      }>;
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

      const wantsReward = !!item.loyaltyReward;
      if (wantsReward) {
        if (!loyaltyProgram.enabled) {
          return res.status(400).json({ error: "Loyalty program is not enabled" });
        }
        if (!authCustomer.customerId) {
          return res.status(401).json({ error: "Login required to redeem free rewards" });
        }
        const cost = Number(product.loyaltyRewardPoints) || 0;
        if (cost < 1) {
          return res.status(400).json({ error: `${product.name} is not available as a free reward` });
        }
        const lineCost = cost * qty;
        rewardPointsNeeded += lineCost;
        rewardLines.push({ productId: product.id, points: lineCost, quantity: qty });

        const flatExtras: Array<{ id: string; name: string; price: number }> = [
          { id: "loyalty_reward", name: `Free reward (${cost} pts)`, price: 0 },
        ];
        lineItems.push({
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: 0,
          totalPrice: 0,
          taxAmount: 0,
          loyaltyReward: true,
          rewardPointsCost: cost,
          selectedExtras: flatExtras,
          comboSelections: [],
        });
        continue;
      }

      let comboSelections: (typeof lineItems)[number]["comboSelections"] = [];
      let comboSurcharge = 0;
      if (product.productType === "combo") {
        const comboResolved = await resolveShopComboSelections(
          merchant.id,
          product,
          item.comboSelections
        );
        if (comboResolved.error) {
          return res.status(400).json({ error: comboResolved.error });
        }
        comboSelections = comboResolved.selections;
        comboSurcharge = comboResolved.surcharge;
      }

      const resolved = await resolveShopLineExtras(merchant.id, product, item.selectedExtras);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }

      const extrasTotal = roundMoney2(resolved.extras.reduce((s, e) => s + e.price, 0));
      const unitPrice = roundMoney2(
        parseFloat(product.price.toString()) + extrasTotal + comboSurcharge
      );
      const totalPrice = roundMoney2(unitPrice * qty);
      const lineTax = product.isTaxable ? roundMoney2((totalPrice * taxRate) / 100) : 0;
      subtotal += totalPrice;
      taxAmount += lineTax;

      // Flatten combo picks into selectedExtras for receipts/POS that only read extras
      const flatExtras = [
        ...resolved.extras,
        ...comboSelections.flatMap((sel) => [
          {
            id: `combo:${sel.slotId}:${sel.productId}`,
            name: `${sel.slotName}: ${sel.productName}`,
            price: sel.extraPrice,
          },
          ...(sel.selectedExtras || []).map((e) => ({
            id: e.id,
            name: `${sel.productName} · ${e.name}`,
            price: e.price,
          })),
        ]),
      ];

      lineItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice,
        totalPrice,
        taxAmount: lineTax,
        loyaltyReward: false,
        rewardPointsCost: 0,
        selectedExtras: flatExtras,
        comboSelections,
      });
    }

    if (!lineItems.length) {
      return res.status(400).json({ error: "No valid items" });
    }

    let pointsDiscount = 0;
    let cashPointsUsed = 0;
    const requestedCashPoints = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
    if (requestedCashPoints > 0 || rewardPointsNeeded > 0) {
      if (!loyaltyProgram.enabled) {
        return res.status(400).json({ error: "Loyalty program is not enabled" });
      }
      if (!authCustomer.customerId) {
        return res.status(401).json({ error: "Login required to redeem points" });
      }
      const balance = await ShopLoyaltyService.getBalance(merchant.id, authCustomer.customerId);
      if (balance < rewardPointsNeeded) {
        return res.status(400).json({ error: "Insufficient loyalty points for free rewards" });
      }
      const balanceAfterRewards = balance - rewardPointsNeeded;
      if (requestedCashPoints > 0) {
        const maxPts = ShopLoyaltyService.maxRedeemablePoints(
          subtotal,
          balanceAfterRewards,
          loyaltyProgram.redeemPointsPerChf
        );
        const usePts = Math.min(requestedCashPoints, maxPts);
        const { discountChf, pointsUsed } = ShopLoyaltyService.computeCashDiscount(
          usePts,
          loyaltyProgram.redeemPointsPerChf
        );
        pointsDiscount = discountChf;
        cashPointsUsed = pointsUsed;
      }
    }
    const totalPointsRedeemed = rewardPointsNeeded + cashPointsUsed;

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
    pointsDiscount = roundMoney2(pointsDiscount);
    const orderNumber = `WEB-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const preCardTotal = Math.max(0, subtotal - pointsDiscount) + deliveryFee + tip + taxAmount;
    const cardFeeFixed = Number(merchant.onlineCardFeeFixed || 0) || 0;
    const cardFeePercent = Number(merchant.onlineCardFeePercent || 0) || 0;
    const cardFee =
      payMethod === "card"
        ? roundTo005(Math.max(0, cardFeeFixed + (preCardTotal * cardFeePercent) / 100))
        : 0;
    const rawTotal = preCardTotal + cardFee;
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

    // Prefer logged-in customer for loyalty redemptions
    if ((totalPointsRedeemed > 0 || requestedCashPoints > 0) && authCustomer.customerId) {
      customerId = authCustomer.customerId;
    }

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
        discountAmount: pointsDiscount.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        tipAmount: tip.toFixed(2),
        cardFee: cardFee.toFixed(2),
        pointsDiscount: pointsDiscount.toFixed(2),
        pointsEarned: 0,
        pointsRedeemed: totalPointsRedeemed,
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
        selectedExtras: line.selectedExtras,
        comboSelections: line.comboSelections,
      });
    }

    // Redeem after insert so events carry orderId; roll back order on failure
    if (totalPointsRedeemed > 0 && customerId) {
      let burnedSoFar = 0;
      try {
        for (const rl of rewardLines) {
          await ShopLoyaltyService.redeemPoints({
            merchantId: merchant.id,
            customerId,
            points: rl.points,
            orderId: order.id,
            productId: rl.productId,
            eventType: "redeem_product",
            meta: { quantity: rl.quantity },
          });
          burnedSoFar += rl.points;
        }
        if (cashPointsUsed > 0) {
          await ShopLoyaltyService.redeemPoints({
            merchantId: merchant.id,
            customerId,
            points: cashPointsUsed,
            orderId: order.id,
            eventType: "redeem_cash",
            meta: { discountChf: pointsDiscount },
          });
          burnedSoFar += cashPointsUsed;
        }
      } catch (redeemErr) {
        if (burnedSoFar > 0) {
          try {
            await ShopLoyaltyService.earnPoints({
              merchantId: merchant.id,
              customerId,
              points: burnedSoFar,
              expiryDays: loyaltyProgram.expiryDays,
              source: "adjustment",
              orderId: order.id,
            });
          } catch {
            /* best-effort restore */
          }
        }
        await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
        await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
        throw redeemErr;
      }
    }

    let finalOrder = order;
    // Earn immediately on cash; card earns on confirm-payment
    if (payMethod === "cash" && customerId && loyaltyProgram.enabled) {
      finalOrder = (await earnLoyaltyForOrder(merchant, order)) as typeof order;
    }

    let paymentSession: unknown = null;
    if (payMethod === "card") {
      try {
        const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
        const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
        const session = await AdyenService.initializePaymentSession(
          merchant.id,
          order.id,
          parseFloat(finalOrder.total.toString()),
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
        id: finalOrder.id,
        orderNumber: finalOrder.orderNumber,
        status: finalOrder.status,
        fulfillmentChannel: finalOrder.fulfillmentChannel,
        paymentMethod: finalOrder.paymentMethod,
        paymentStatus: finalOrder.paymentStatus,
        subtotal: finalOrder.subtotal,
        deliveryFee: finalOrder.deliveryFee,
        tipAmount: finalOrder.tipAmount,
        cardFee: finalOrder.cardFee,
        taxAmount: finalOrder.taxAmount,
        pointsDiscount: finalOrder.pointsDiscount,
        pointsEarned: finalOrder.pointsEarned,
        pointsRedeemed: finalOrder.pointsRedeemed,
        total: finalOrder.total,
        scheduledFor: finalOrder.scheduledFor,
        shippingAddress: finalOrder.shippingAddress,
        customerName: finalOrder.customerName,
        customerPhone: finalOrder.customerPhone,
        customerEmail: finalOrder.customerEmail,
        notes: finalOrder.notes,
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
        cardFee: order.cardFee,
        taxAmount: order.taxAmount,
        pointsDiscount: order.pointsDiscount,
        pointsEarned: order.pointsEarned,
        pointsRedeemed: order.pointsRedeemed,
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

    let finalOrder = updated;
    try {
      finalOrder = (await earnLoyaltyForOrder(merchant, updated)) as typeof updated;
    } catch (earnErr) {
      console.error("Loyalty earn on confirm-payment failed:", earnErr);
    }

    res.json({ success: true, order: finalOrder });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
  }
});

export default router;
