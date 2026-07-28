import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type OfferRules, type OfferType } from "@/db";
import { roundMoney2 } from "@/lib/money";
import { MERCHANT_TZ } from "@/lib/geo";

export type CartLineForOffer = {
  productId: string;
  categoryId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  loyaltyReward?: boolean;
};

export type AppliedOffer = {
  offerId: string;
  name: string;
  badgeLabel: string | null;
  discount: number;
  offerType: string;
};

function zurichParts(at: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: MERCHANT_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const wd = String(parts.weekday || "").toLowerCase().slice(0, 3);
  const map: Record<string, string> = {
    sun: "sun",
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
  };
  return {
    day: map[wd] || "mon",
    hm: `${parts.hour}:${parts.minute}`,
  };
}

function parseHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  // Accept HH:mm or HH:mm:ss (browsers' <input type="time"> may include seconds)
  const m = String(hm).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 24 || min > 59) return null;
  return (h === 24 ? 0 : h) * 60 + min;
}

function inTimeWindow(hm: string, start?: string | null, end?: string | null) {
  const cur = parseHm(hm);
  if (cur == null) return true;
  const s = parseHm(start);
  const e = parseHm(end);
  if (s == null && e == null) return true;
  if (s != null && e != null) {
    if (e >= s) return cur >= s && cur < e;
    return cur >= s || cur < e; // overnight
  }
  if (s != null) return cur >= s;
  if (e != null) return cur < e;
  return true;
}

function defaultBadge(type: string, rules: OfferRules): string {
  if (rules.percentOff) return `${rules.percentOff}% off`;
  if (rules.fixedOff) return `CHF ${Number(rules.fixedOff).toFixed(0)} off`;
  if (type === "bogo") {
    const buy = rules.buyQty || 1;
    const get = rules.getQty || 1;
    if (buy === 1 && get === 1) return "1+1";
    if (buy === 2 && get === 1) return "2+1";
    return `${buy}+${get}`;
  }
  if (type === "pay_n_get_m") {
    const pay = rules.payQty || 3;
    const recv = rules.receiveQty || pay + 1;
    return `${pay}+${recv - pay}`;
  }
  if (type === "package_deal") {
    const buy = rules.buyQty || 2;
    const get = rules.getQty || 1;
    const price = Number(rules.packagePrice) || 0;
    if (price > 0) return `${buy}+${get} · CHF ${price.toFixed(0)}`;
    return `${buy}+${get}`;
  }
  return "Offer";
}

export class OffersService {
  static async list(merchantId: string) {
    const db = getDb();
    return db.query.offers.findMany({
      where: eq(schema.offers.merchantId, merchantId),
      orderBy: [asc(schema.offers.sortOrder), desc(schema.offers.priority), desc(schema.offers.createdAt)],
    });
  }

  static async get(merchantId: string, offerId: string) {
    const db = getDb();
    const row = await db.query.offers.findFirst({
      where: and(eq(schema.offers.id, offerId), eq(schema.offers.merchantId, merchantId)),
    });
    if (!row) throw new Error("Offer not found");
    return row;
  }

  static async ensureOffersCategory(merchantId: string) {
    const db = getDb();
    const existing = await db.query.categories.findFirst({
      where: and(eq(schema.categories.merchantId, merchantId), eq(schema.categories.isOffersCategory, true)),
    });
    if (existing) return existing;
    const [created] = await db
      .insert(schema.categories)
      .values({
        merchantId,
        name: "Offers",
        description: "Current promotions and special deals",
        color: "#b45309",
        isOffersCategory: true,
        sortOrder: -100,
      })
      .returning();
    return created;
  }

  static async create(
    merchantId: string,
    input: {
      name: string;
      description?: string | null;
      offerType: OfferType | string;
      rules?: OfferRules;
      channels?: string[];
      categoryIds?: string[];
      productIds?: string[];
      scheduleMode?: string;
      daysOfWeek?: string[];
      timeStart?: string | null;
      timeEnd?: string | null;
      validFrom?: string | null;
      validTo?: string | null;
      isActive?: boolean;
      featured?: boolean;
      badgeLabel?: string | null;
      priority?: number;
      stackable?: boolean;
    }
  ) {
    const db = getDb();
    const offerType = String(input.offerType || "percent_category") as OfferType;
    const rules = (input.rules || {}) as OfferRules;
    if (input.featured !== false) {
      await this.ensureOffersCategory(merchantId);
    }
    const [row] = await db
      .insert(schema.offers)
      .values({
        merchantId,
        name: String(input.name || "").trim().slice(0, 255) || "Offer",
        description: input.description?.trim() || null,
        offerType,
        rules,
        channels: Array.isArray(input.channels) ? input.channels : [],
        categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds : [],
        productIds: Array.isArray(input.productIds) ? input.productIds : [],
        scheduleMode: input.scheduleMode === "days" ? "days" : "always",
        daysOfWeek: Array.isArray(input.daysOfWeek) ? input.daysOfWeek : [],
        timeStart: input.timeStart || null,
        timeEnd: input.timeEnd || null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        isActive: input.isActive !== false,
        featured: input.featured !== false,
        badgeLabel: input.badgeLabel?.trim() || defaultBadge(offerType, rules),
        priority: Math.floor(Number(input.priority) || 0),
        stackable: !!input.stackable,
      })
      .returning();
    return row;
  }

  static async update(merchantId: string, offerId: string, updates: Record<string, unknown>) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const allow = [
      "name",
      "description",
      "offerType",
      "rules",
      "channels",
      "categoryIds",
      "productIds",
      "scheduleMode",
      "daysOfWeek",
      "timeStart",
      "timeEnd",
      "isActive",
      "featured",
      "badgeLabel",
      "priority",
      "stackable",
      "sortOrder",
    ] as const;
    for (const key of allow) {
      if (updates[key] !== undefined) patch[key] = updates[key];
    }
    if (updates.validFrom !== undefined) {
      patch.validFrom = updates.validFrom ? new Date(String(updates.validFrom)) : null;
    }
    if (updates.validTo !== undefined) {
      patch.validTo = updates.validTo ? new Date(String(updates.validTo)) : null;
    }
    if (patch.featured) await this.ensureOffersCategory(merchantId);
    const rows = await db
      .update(schema.offers)
      .set(patch)
      .where(and(eq(schema.offers.id, offerId), eq(schema.offers.merchantId, merchantId)))
      .returning();
    if (!rows.length) throw new Error("Offer not found");
    return rows[0];
  }

  static async remove(merchantId: string, offerId: string) {
    const db = getDb();
    const rows = await db
      .delete(schema.offers)
      .where(and(eq(schema.offers.id, offerId), eq(schema.offers.merchantId, merchantId)))
      .returning();
    if (!rows.length) throw new Error("Offer not found");
    return { success: true };
  }

  static isOfferActiveAt(
    offer: typeof schema.offers.$inferSelect,
    at: Date,
    channel?: string
  ): boolean {
    if (!offer.isActive) return false;
    if (offer.validFrom && at < offer.validFrom) return false;
    if (offer.validTo && at > offer.validTo) return false;
    const channels = (offer.channels || []) as string[];
    if (channel && channels.length && !channels.includes(channel)) return false;
    const { day, hm } = zurichParts(at);
    if (offer.scheduleMode === "days") {
      const days = (offer.daysOfWeek || []) as string[];
      if (days.length && !days.includes(day)) return false;
    }
    if (!inTimeWindow(hm, offer.timeStart, offer.timeEnd)) return false;
    return true;
  }

  static async listActivePublic(merchantId: string, at = new Date(), channel?: string) {
    const all = await this.list(merchantId);
    return all.filter((o) => this.isOfferActiveAt(o, at, channel));
  }

  static matchesProduct(
    offer: typeof schema.offers.$inferSelect,
    line: CartLineForOffer
  ): boolean {
    if (line.loyaltyReward) return false;
    const pids = (offer.productIds || []) as string[];
    const cids = (offer.categoryIds || []) as string[];
    if (pids.length) return pids.includes(line.productId);
    if (cids.length) return !!line.categoryId && cids.includes(line.categoryId);
    return true;
  }

  static computeOfferDiscount(
    offer: typeof schema.offers.$inferSelect,
    lines: CartLineForOffer[]
  ): number {
    const rules = (offer.rules || {}) as OfferRules;
    const minOrder = Number(rules.minOrderAmount) || 0;
    const foodTotal = roundMoney2(
      lines.filter((l) => !l.loyaltyReward).reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    );
    if (minOrder > 0 && foodTotal < minOrder) return 0;

    const type = offer.offerType;
    const eligible = lines.filter((l) => this.matchesProduct(offer, l));

    if (type === "percent_order") {
      const pct = Math.min(100, Math.max(0, Number(rules.percentOff) || 0));
      return roundMoney2((foodTotal * pct) / 100);
    }

    if (type === "fixed_off") {
      const amt = Math.max(0, Number(rules.fixedOff) || 0);
      return roundMoney2(Math.min(amt, foodTotal));
    }

    if (type === "percent_category") {
      const pct = Math.min(100, Math.max(0, Number(rules.percentOff) || 0));
      const base = eligible.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      return roundMoney2((base * pct) / 100);
    }

    if (type === "bogo") {
      const buy = Math.max(1, Math.floor(Number(rules.buyQty) || 1));
      const get = Math.max(1, Math.floor(Number(rules.getQty) || 1));
      const getPct = Math.min(100, Math.max(0, Number(rules.getDiscountPercent) ?? 100));
      // Expand to unit prices sorted ascending (cheapest free)
      const units: number[] = [];
      for (const l of eligible) {
        for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
      }
      units.sort((a, b) => a - b);
      const group = buy + get;
      const freeSlots = Math.floor(units.length / group) * get;
      let discount = 0;
      for (let i = 0; i < freeSlots; i++) {
        discount += (units[i] * getPct) / 100;
      }
      return roundMoney2(discount);
    }

    if (type === "pay_n_get_m") {
      const pay = Math.max(1, Math.floor(Number(rules.payQty) || 3));
      const recv = Math.max(pay + 1, Math.floor(Number(rules.receiveQty) || pay + 1));
      const freePerSet = recv - pay;
      const units: number[] = [];
      for (const l of eligible) {
        for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
      }
      units.sort((a, b) => a - b);
      const sets = Math.floor(units.length / recv);
      let discount = 0;
      for (let s = 0; s < sets; s++) {
        for (let f = 0; f < freePerSet; f++) {
          discount += units[s * recv + f] || 0;
        }
      }
      return roundMoney2(discount);
    }

    if (type === "combo_deal") {
      const needed = (rules.comboProductIds || []) as string[];
      if (!needed.length) return 0;
      const counts = new Map<string, number>();
      for (const l of lines) {
        if (l.loyaltyReward) continue;
        counts.set(l.productId, (counts.get(l.productId) || 0) + l.quantity);
      }
      let combos = Infinity;
      for (const id of needed) {
        combos = Math.min(combos, counts.get(id) || 0);
      }
      if (!Number.isFinite(combos) || combos <= 0) return 0;
      // Price of one combo set = sum of one unit of each product (cheapest unit if multiples)
      let setPrice = 0;
      for (const id of needed) {
        const prices = lines
          .filter((l) => l.productId === id && !l.loyaltyReward)
          .map((l) => l.unitPrice);
        setPrice += Math.min(...prices);
      }
      const pct = Number(rules.comboPercentOff) || 0;
      const fixed = Number(rules.comboFixedOff) || 0;
      const per = pct > 0 ? (setPrice * pct) / 100 : fixed;
      return roundMoney2(per * combos);
    }

    if (type === "package_deal") {
      return this.computePackageDealDiscount(rules, lines);
    }

    return 0;
  }

  /**
   * Choose buyQty from buyProductIds + getQty from getProductIds for packagePrice.
   * Forms as many sets as possible; each set discounts (sum of unit prices − packagePrice).
   */
  static computePackageDealDiscount(rules: OfferRules, lines: CartLineForOffer[]): number {
    const buyQty = Math.max(1, Math.floor(Number(rules.buyQty) || 2));
    const getQty = Math.max(0, Math.floor(Number(rules.getQty) || 1));
    const packagePrice = Math.max(0, Number(rules.packagePrice) || 0);
    const buyIds = new Set(
      ((rules.buyProductIds || []) as string[]).map(String).filter(Boolean)
    );
    const getIds = new Set(
      ((rules.getProductIds || []) as string[]).map(String).filter(Boolean)
    );
    // Fallback: use offer productIds / category-eligible lines as the buy pool
    const useAllEligible = buyIds.size === 0;

    type Unit = { productId: string; price: number; key: string };
    const units: Unit[] = [];
    let idx = 0;
    for (const l of lines) {
      if (l.loyaltyReward) continue;
      for (let i = 0; i < l.quantity; i++) {
        units.push({
          productId: l.productId,
          price: l.unitPrice,
          key: `${l.productId}:${idx++}`,
        });
      }
    }

    const available = new Set(units.map((u) => u.key));
    let discount = 0;

    const takeBest = (pool: Unit[], n: number): Unit[] => {
      const candidates = pool
        .filter((u) => available.has(u.key))
        .sort((a, b) => b.price - a.price);
      const picked = candidates.slice(0, n);
      for (const u of picked) available.delete(u.key);
      return picked;
    };

    while (true) {
      const buyPool = units.filter(
        (u) =>
          available.has(u.key) && (useAllEligible || buyIds.has(u.productId))
      );
      if (buyPool.length < buyQty) break;

      const bought = takeBest(buyPool, buyQty);
      if (bought.length < buyQty) break;

      let free: Unit[] = [];
      if (getQty > 0) {
        const freePool = units.filter(
          (u) =>
            available.has(u.key) &&
            (getIds.size ? getIds.has(u.productId) : buyIds.has(u.productId) || useAllEligible)
        );
        if (freePool.length < getQty) {
          // Put bought back and stop
          for (const u of bought) available.add(u.key);
          break;
        }
        free = takeBest(freePool, getQty);
        if (free.length < getQty) {
          for (const u of bought) available.add(u.key);
          for (const u of free) available.add(u.key);
          break;
        }
      }

      const setSum = [...bought, ...free].reduce((s, u) => s + u.price, 0);
      if (packagePrice > 0) {
        discount += Math.max(0, setSum - packagePrice);
      } else {
        // No package price → free items are 100% off
        discount += free.reduce((s, u) => s + u.price, 0);
      }
    }

    return roundMoney2(discount);
  }

  /**
   * Pick best non-stackable offer, or sum stackable ones (cap at food total).
   */
  static evaluateCart(
    offers: Array<typeof schema.offers.$inferSelect>,
    lines: CartLineForOffer[],
    at: Date,
    channel: string
  ): { discount: number; applied: AppliedOffer[] } {
    const active = offers
      .filter((o) => this.isOfferActiveAt(o, at, channel))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const foodTotal = roundMoney2(
      lines.filter((l) => !l.loyaltyReward).reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    );

    const stackableApplied: AppliedOffer[] = [];
    let stackSum = 0;
    let bestSingle: AppliedOffer | null = null;

    for (const offer of active) {
      const discount = this.computeOfferDiscount(offer, lines);
      if (discount <= 0) continue;
      const applied: AppliedOffer = {
        offerId: offer.id,
        name: offer.name,
        badgeLabel: offer.badgeLabel,
        discount,
        offerType: offer.offerType,
      };
      if (offer.stackable) {
        stackableApplied.push(applied);
        stackSum += discount;
      } else if (!bestSingle || discount > bestSingle.discount) {
        bestSingle = applied;
      }
    }

    if (stackableApplied.length && (!bestSingle || stackSum >= bestSingle.discount)) {
      const discount = roundMoney2(Math.min(stackSum, foodTotal));
      return { discount, applied: stackableApplied };
    }
    if (bestSingle) {
      return {
        discount: roundMoney2(Math.min(bestSingle.discount, foodTotal)),
        applied: [bestSingle],
      };
    }
    return { discount: 0, applied: [] };
  }

  /** Seed a few sensible demo offers for merchants. */
  static async seedDemoOffers(merchantId: string, categoryIds: string[] = []) {
    const existing = await this.list(merchantId);
    if (existing.length) return existing;

    const demos = [
      {
        name: "Happy hour 20% — Food",
        description: "20% off the Food category, weekdays 13:00–17:00 (off-peak).",
        offerType: "percent_category" as const,
        rules: { percentOff: 20 },
        categoryIds: categoryIds.slice(0, 1),
        scheduleMode: "days",
        daysOfWeek: ["mon", "tue", "wed", "thu", "fri"],
        timeStart: "13:00",
        timeEnd: "17:00",
        badgeLabel: "20% off",
        priority: 10,
      },
      {
        name: "Buy 1 get 1 free",
        description: "Buy one eligible item, get the second free (cheapest).",
        offerType: "bogo" as const,
        rules: { buyQty: 1, getQty: 1, getDiscountPercent: 100 },
        badgeLabel: "1+1",
        priority: 20,
      },
      {
        name: "Buy 2 get 1 free",
        description: "Buy two, get one free.",
        offerType: "bogo" as const,
        rules: { buyQty: 2, getQty: 1, getDiscountPercent: 100 },
        badgeLabel: "2+1",
        priority: 15,
      },
      {
        name: "Dine-in 3+1",
        description: "Pay for 3, 4th free — dine-in only.",
        offerType: "pay_n_get_m" as const,
        rules: { payQty: 3, receiveQty: 4 },
        channels: ["dine_in"],
        badgeLabel: "3+1",
        priority: 25,
      },
      {
        name: "Weekend 15% off order",
        description: "15% off your whole order on Saturday & Sunday.",
        offerType: "percent_order" as const,
        rules: { percentOff: 15, minOrderAmount: 20 },
        scheduleMode: "days",
        daysOfWeek: ["sat", "sun"],
        badgeLabel: "15% off",
        priority: 5,
      },
    ];

    const created = [];
    for (const d of demos) {
      created.push(await this.create(merchantId, d));
    }
    return created;
  }
}
