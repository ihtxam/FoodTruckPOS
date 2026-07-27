import { and, asc, eq, gt, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Shop fidelity formula (defaults):
 * - Earn: floor(paidFoodSubtotalCHF × earnPointsPerChf) — default 1 pt / CHF
 * - Cash redeem: floor(points / redeemPointsPerChf) CHF — default 100 pts = CHF 1
 * - Free product: product.loyaltyRewardPoints = N → spend N pts, line price 0
 * - Expiry: each earn lot expires in loyaltyPointsExpiryDays (default 30), FIFO burn
 *
 * Tip & delivery do not earn. Points discount / free rewards reduce earnable base.
 */

export type LoyaltyProgramSettings = {
  enabled: boolean;
  earnPointsPerChf: number;
  redeemPointsPerChf: number;
  expiryDays: number;
};

export type LoyaltyRewardProduct = {
  id: string;
  name: string;
  image?: string | null;
  price: number;
  loyaltyRewardPoints: number;
  unlocked: boolean;
};

export class ShopLoyaltyService {
  static programFromMerchant(merchant: {
    loyaltyEnabled?: boolean | null;
    loyaltyEarnPointsPerChf?: string | number | null;
    loyaltyRedeemPointsPerChf?: number | null;
    loyaltyPointsExpiryDays?: number | null;
  }): LoyaltyProgramSettings {
    const earn = Number(merchant.loyaltyEarnPointsPerChf ?? 1);
    const redeem = Number(merchant.loyaltyRedeemPointsPerChf ?? 100);
    const expiry = Number(merchant.loyaltyPointsExpiryDays ?? 30);
    return {
      enabled: !!merchant.loyaltyEnabled,
      earnPointsPerChf: Number.isFinite(earn) && earn > 0 ? earn : 1,
      redeemPointsPerChf: Number.isFinite(redeem) && redeem >= 1 ? Math.floor(redeem) : 100,
      expiryDays: Number.isFinite(expiry) && expiry >= 1 ? Math.floor(expiry) : 30,
    };
  }

  static async getProgram(merchantId: string): Promise<LoyaltyProgramSettings> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");
    return this.programFromMerchant(merchant);
  }

  static async updateProgram(
    merchantId: string,
    updates: {
      enabled?: boolean;
      earnPointsPerChf?: number;
      redeemPointsPerChf?: number;
      expiryDays?: number;
    }
  ) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.enabled !== undefined) patch.loyaltyEnabled = !!updates.enabled;
    if (updates.earnPointsPerChf !== undefined) {
      const n = Number(updates.earnPointsPerChf);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        throw new Error("earnPointsPerChf must be between 0 exclusive and 1000");
      }
      patch.loyaltyEarnPointsPerChf = n.toFixed(3);
    }
    if (updates.redeemPointsPerChf !== undefined) {
      const n = Math.floor(Number(updates.redeemPointsPerChf));
      if (!Number.isFinite(n) || n < 1 || n > 100000) {
        throw new Error("redeemPointsPerChf must be between 1 and 100000");
      }
      patch.loyaltyRedeemPointsPerChf = n;
    }
    if (updates.expiryDays !== undefined) {
      const n = Math.floor(Number(updates.expiryDays));
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        throw new Error("expiryDays must be between 1 and 3650");
      }
      patch.loyaltyPointsExpiryDays = n;
    }
    const [merchant] = await db
      .update(schema.merchants)
      .set(patch)
      .where(eq(schema.merchants.id, merchantId))
      .returning();
    return this.programFromMerchant(merchant);
  }

  /** Expire lots past expiresAt and sync customers.loyaltyPoints cache. */
  static async expireAndSync(merchantId: string, customerId: string) {
    const db = getDb();
    const now = new Date();
    const expired = await db.query.loyaltyPointLots.findMany({
      where: and(
        eq(schema.loyaltyPointLots.merchantId, merchantId),
        eq(schema.loyaltyPointLots.customerId, customerId),
        gt(schema.loyaltyPointLots.pointsRemaining, 0),
        lte(schema.loyaltyPointLots.expiresAt, now)
      ),
    });

    for (const lot of expired) {
      if (lot.pointsRemaining <= 0) continue;
      await db
        .update(schema.loyaltyPointLots)
        .set({ pointsRemaining: 0 })
        .where(eq(schema.loyaltyPointLots.id, lot.id));
      await db.insert(schema.loyaltyPointEvents).values({
        merchantId,
        customerId,
        orderId: lot.orderId,
        eventType: "expire",
        points: -lot.pointsRemaining,
        meta: { lotId: lot.id, expiredAt: now.toISOString() },
      });
    }

    return this.syncBalanceCache(merchantId, customerId);
  }

  static async syncBalanceCache(merchantId: string, customerId: string) {
    const db = getDb();
    const now = new Date();
    const lots = await db.query.loyaltyPointLots.findMany({
      where: and(
        eq(schema.loyaltyPointLots.merchantId, merchantId),
        eq(schema.loyaltyPointLots.customerId, customerId),
        gt(schema.loyaltyPointLots.pointsRemaining, 0),
        gt(schema.loyaltyPointLots.expiresAt, now)
      ),
    });
    const balance = lots.reduce((s, l) => s + (l.pointsRemaining || 0), 0);
    await db
      .update(schema.customers)
      .set({ loyaltyPoints: balance, updatedAt: new Date() })
      .where(and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)));
    return balance;
  }

  static async getBalance(merchantId: string, customerId: string) {
    return this.expireAndSync(merchantId, customerId);
  }

  static computeEarnPoints(paidFoodSubtotalChf: number, earnPointsPerChf: number) {
    const base = Math.max(0, Number(paidFoodSubtotalChf) || 0);
    return Math.floor(base * earnPointsPerChf);
  }

  static computeCashDiscount(points: number, redeemPointsPerChf: number) {
    const pts = Math.max(0, Math.floor(points));
    const rate = Math.max(1, Math.floor(redeemPointsPerChf));
    const discountChf = Math.floor(pts / rate);
    const pointsUsed = discountChf * rate;
    return { discountChf, pointsUsed };
  }

  /** Max points redeemable as cash against a payable CHF base (food, fees, tax — not tip). */
  static maxRedeemablePoints(payableChf: number, balance: number, redeemPointsPerChf: number) {
    const rate = Math.max(1, Math.floor(redeemPointsPerChf));
    const maxByPayable = Math.floor(Math.max(0, payableChf)) * rate;
    const maxByBalance = Math.floor(balance / rate) * rate;
    return Math.min(maxByPayable, maxByBalance);
  }

  static async earnPoints(opts: {
    merchantId: string;
    customerId: string;
    orderId?: string;
    points: number;
    expiryDays: number;
    source?: string;
  }) {
    const points = Math.floor(opts.points);
    if (points <= 0) return { balance: await this.getBalance(opts.merchantId, opts.customerId), points: 0 };

    const db = getDb();
    await this.expireAndSync(opts.merchantId, opts.customerId);
    const earnedAt = new Date();
    const expiresAt = new Date(earnedAt.getTime() + opts.expiryDays * 24 * 60 * 60 * 1000);

    await db.insert(schema.loyaltyPointLots).values({
      merchantId: opts.merchantId,
      customerId: opts.customerId,
      orderId: opts.orderId || null,
      pointsGranted: points,
      pointsRemaining: points,
      earnedAt,
      expiresAt,
      source: opts.source || "earn",
    });
    await db.insert(schema.loyaltyPointEvents).values({
      merchantId: opts.merchantId,
      customerId: opts.customerId,
      orderId: opts.orderId || null,
      eventType: "earn",
      points,
      meta: { expiresAt: expiresAt.toISOString() },
    });

    const balance = await this.syncBalanceCache(opts.merchantId, opts.customerId);
    return { balance, points, expiresAt };
  }

  /** Burn points FIFO from oldest lots. */
  static async redeemPoints(opts: {
    merchantId: string;
    customerId: string;
    points: number;
    orderId?: string;
    productId?: string;
    eventType: "redeem_cash" | "redeem_product";
    meta?: Record<string, unknown>;
  }) {
    const need = Math.floor(opts.points);
    if (need <= 0) return { balance: await this.getBalance(opts.merchantId, opts.customerId) };

    const db = getDb();
    const balance = await this.expireAndSync(opts.merchantId, opts.customerId);
    if (balance < need) throw new Error("Insufficient loyalty points");

    const now = new Date();
    const lots = await db.query.loyaltyPointLots.findMany({
      where: and(
        eq(schema.loyaltyPointLots.merchantId, opts.merchantId),
        eq(schema.loyaltyPointLots.customerId, opts.customerId),
        gt(schema.loyaltyPointLots.pointsRemaining, 0),
        gt(schema.loyaltyPointLots.expiresAt, now)
      ),
      orderBy: [asc(schema.loyaltyPointLots.expiresAt), asc(schema.loyaltyPointLots.earnedAt)],
    });

    let remaining = need;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.pointsRemaining, remaining);
      await db
        .update(schema.loyaltyPointLots)
        .set({ pointsRemaining: lot.pointsRemaining - take })
        .where(eq(schema.loyaltyPointLots.id, lot.id));
      remaining -= take;
    }
    if (remaining > 0) throw new Error("Insufficient loyalty points");

    await db.insert(schema.loyaltyPointEvents).values({
      merchantId: opts.merchantId,
      customerId: opts.customerId,
      orderId: opts.orderId || null,
      productId: opts.productId || null,
      eventType: opts.eventType,
      points: -need,
      meta: opts.meta || {},
    });

    const next = await this.syncBalanceCache(opts.merchantId, opts.customerId);
    return { balance: next, points: need };
  }

  static async listRewardProducts(merchantId: string, balance: number): Promise<LoyaltyRewardProduct[]> {
    const db = getDb();
    const products = await db.query.products.findMany({
      where: and(
        eq(schema.products.merchantId, merchantId),
        eq(schema.products.isActive, true),
        isNotNull(schema.products.loyaltyRewardPoints),
        gt(schema.products.loyaltyRewardPoints, 0)
      ),
      orderBy: [asc(schema.products.loyaltyRewardPoints), asc(schema.products.name)],
    });

    return products.map((p) => {
      const cost = Number(p.loyaltyRewardPoints) || 0;
      return {
        id: p.id,
        name: p.name,
        image: p.imageUrl,
        price: parseFloat(p.price.toString()),
        loyaltyRewardPoints: cost,
        unlocked: balance >= cost,
      };
    });
  }

  static async getCustomerLoyaltySummary(merchantId: string, customerId: string) {
    const program = await this.getProgram(merchantId);
    // Always sync/show balance on account — earn/redeem still gated by program.enabled
    const balance = await this.getBalance(merchantId, customerId);
    const rewards = program.enabled ? await this.listRewardProducts(merchantId, balance) : [];
    const unlocked = rewards.filter((r) => r.unlocked);
    const next = rewards.find((r) => !r.unlocked) || null;
    const nextCost = next?.loyaltyRewardPoints ?? null;
    const progress =
      nextCost && nextCost > 0 ? Math.min(1, balance / nextCost) : unlocked.length ? 1 : 0;

    const db = getDb();
    const now = new Date();
    const lots = await db.query.loyaltyPointLots.findMany({
      where: and(
        eq(schema.loyaltyPointLots.merchantId, merchantId),
        eq(schema.loyaltyPointLots.customerId, customerId),
        gt(schema.loyaltyPointLots.pointsRemaining, 0),
        gt(schema.loyaltyPointLots.expiresAt, now)
      ),
      orderBy: [asc(schema.loyaltyPointLots.expiresAt)],
      limit: 5,
    });

    const expiringSoon = lots[0]
      ? {
          points: lots[0].pointsRemaining,
          expiresAt: lots[0].expiresAt,
        }
      : null;

    return {
      program,
      balance,
      rewards,
      unlockedRewards: unlocked,
      nextReward: next,
      progress,
      progressPercent: Math.round(progress * 100),
      expiringSoon,
      formula: {
        earn: `${program.earnPointsPerChf} pt per CHF spent (food subtotal)`,
        redeem: `${program.redeemPointsPerChf} pts = CHF 1.00 discount`,
        expiry: `${program.expiryDays} days (oldest first)`,
      },
    };
  }

  /** Public program + rewards (no customer) for menu bar when logged out. */
  static async getPublicLoyalty(merchantId: string) {
    const program = await this.getProgram(merchantId);
    const rewards = program.enabled ? await this.listRewardProducts(merchantId, 0) : [];
    return { program, rewards };
  }
}
