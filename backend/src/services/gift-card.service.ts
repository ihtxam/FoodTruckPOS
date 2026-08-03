import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  normalizeGiftCardSettings,
  validateGiftAmount,
  type GiftCardSettings,
} from "@/lib/gift-card-settings";
import { CustomerService } from "@/services/customer.service";

function money(n: number | string | null | undefined): number {
  const v = Number(n || 0);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function assertActive(card: { status: string; expiresAt?: Date | null }) {
  if (card.status === "suspended") throw new Error("Card is suspended");
  if (card.status === "expired") throw new Error("Card is expired");
  if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
    throw new Error("Card is expired");
  }
  if (card.status !== "active") throw new Error("Card is not active");
}

export class GiftCardService {
  static async getSettings(merchantId: string): Promise<GiftCardSettings> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");
    return normalizeGiftCardSettings(merchant.giftCardSettings);
  }

  static async updateSettings(
    merchantId: string,
    patch: Partial<GiftCardSettings>
  ): Promise<GiftCardSettings> {
    const db = getDb();
    const current = await this.getSettings(merchantId);
    const next = normalizeGiftCardSettings({ ...current, ...patch });
    await db
      .update(schema.merchants)
      .set({ giftCardSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async listCards(
    merchantId: string,
    opts: { page?: number; limit?: number; status?: string; q?: string } = {}
  ) {
    const db = getDb();
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.giftCards.merchantId, merchantId)];
    if (opts.status) {
      conditions.push(eq(schema.giftCards.status, opts.status));
    }

    const cards = await db.query.giftCards.findMany({
      where: and(...conditions),
      with: { customer: true },
      orderBy: desc(schema.giftCards.issuedAt),
      limit,
      offset,
    });

    const q = (opts.q || "").trim().toLowerCase();
    const filtered = q
      ? cards.filter((c) => {
          const hay = [
            c.cardNumber,
            c.ecardCode,
            c.holderName,
            c.holderEmail,
            c.holderPhone,
            c.customer?.firstName,
            c.customer?.lastName,
            c.customer?.email,
            c.customer?.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : cards;

    return { cards: filtered, page, limit };
  }

  static async getById(merchantId: string, cardId: string) {
    const db = getDb();
    const card = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.id, cardId),
        eq(schema.giftCards.merchantId, merchantId)
      ),
      with: { customer: true },
    });
    if (!card) throw new Error("Card not found");
    return card;
  }

  static async lookup(
    merchantId: string,
    code: string,
    mediaType?: "physical" | "e_card"
  ) {
    const db = getDb();
    const trimmed = String(code || "").trim();
    if (!trimmed) throw new Error("Card number is required");

    let card = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.merchantId, merchantId),
        eq(schema.giftCards.cardNumber, trimmed)
      ),
      with: { customer: true },
    });

    if (!card && (!mediaType || mediaType === "e_card")) {
      card = await db.query.giftCards.findFirst({
        where: and(
          eq(schema.giftCards.merchantId, merchantId),
          eq(schema.giftCards.ecardCode, trimmed)
        ),
        with: { customer: true },
      });
    }

    if (!card) throw new Error("Card not found");
    return card;
  }

  static async createCard(
    merchantId: string,
    input: {
      cardNumber?: string;
      cardMediaType?: "physical" | "e_card";
      initialBalance?: number;
      membershipEnabled?: boolean;
      holderName?: string;
      holderEmail?: string;
      holderPhone?: string;
      ecardEmail?: string;
      customerId?: string;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    const mediaType = input.cardMediaType === "e_card" ? "e_card" : "physical";

    let cardNumber = String(input.cardNumber || "").trim();
    let ecardCode: string | null = null;

    if (mediaType === "physical") {
      if (!cardNumber) throw new Error("RFID card number is required");
    } else {
      // Phase-2 stub: generate e-card code; email delivery not implemented
      ecardCode = `EC-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      if (!cardNumber) cardNumber = ecardCode;
    }

    const existing = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.merchantId, merchantId),
        eq(schema.giftCards.cardNumber, cardNumber)
      ),
    });
    if (existing) throw new Error("A card with this number already exists");

    let initial = 0;
    if (input.initialBalance != null && Number(input.initialBalance) > 0) {
      const check = validateGiftAmount(Number(input.initialBalance), settings);
      if (!check.ok) throw new Error(check.error);
      initial = check.amount;
    }

    const membershipEnabled = !!input.membershipEnabled || !!input.customerId;
    const rows = await db
      .insert(schema.giftCards)
      .values({
        merchantId,
        cardNumber,
        cardMediaType: mediaType,
        balance: initial.toFixed(2),
        status: "active",
        membershipEnabled,
        pointsBalance: 0,
        customerId: input.customerId || null,
        holderName: input.holderName?.trim() || null,
        holderEmail: input.holderEmail?.trim() || null,
        holderPhone: input.holderPhone?.trim() || null,
        ecardEmail: input.ecardEmail?.trim() || null,
        ecardCode,
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const card = rows[0]!;
    if (initial > 0) {
      await db.insert(schema.giftCardTransactions).values({
        merchantId,
        cardId: card.id,
        transactionType: "sell",
        amount: initial.toFixed(2),
        balanceAfter: initial.toFixed(2),
        description: "Initial load on card create",
      });
    }
    if (membershipEnabled) {
      await db.insert(schema.giftCardTransactions).values({
        merchantId,
        cardId: card.id,
        transactionType: "membership_issue",
        description: "Membership linked on create",
      });
    }
    return card;
  }

  static async credit(
    merchantId: string,
    opts: {
      cardId?: string;
      cardNumber?: string;
      cardMediaType?: "physical" | "e_card";
      amount: number;
      type: "sell" | "reload";
      orderId?: string;
      createIfMissing?: boolean;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are disabled");
    if (opts.type === "reload" && !settings.reloadEnabled) {
      throw new Error("Card reload is disabled");
    }

    const check = validateGiftAmount(opts.amount, settings);
    if (!check.ok) throw new Error(check.error);
    const amount = check.amount;

    let card =
      opts.cardId != null
        ? await this.getById(merchantId, opts.cardId)
        : null;

    if (!card && opts.cardNumber) {
      try {
        card = await this.lookup(merchantId, opts.cardNumber, opts.cardMediaType);
      } catch {
        card = null;
      }
    }

    if (!card) {
      if (opts.type === "sell" && opts.createIfMissing !== false && opts.cardNumber) {
        card = await this.createCard(merchantId, {
          cardNumber: opts.cardNumber,
          cardMediaType: opts.cardMediaType || "physical",
          initialBalance: 0,
        });
      } else {
        throw new Error("Card not found");
      }
    }

    assertActive(card);

    const newBalance = money(card.balance) + amount;
    if (newBalance > settings.maxAmount) {
      throw new Error(
        `Balance cannot exceed CHF ${settings.maxAmount.toFixed(2)}`
      );
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, card.id),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: card.id,
      transactionType: opts.type,
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      orderId: opts.orderId || null,
      description:
        opts.type === "sell"
          ? `Sold / loaded CHF ${amount.toFixed(2)}`
          : `Reloaded CHF ${amount.toFixed(2)}`,
    });

    return updated[0]!;
  }

  /**
   * Redeem stored value. Partial redeem allowed when allowPartial=true
   * (returns amountRedeemed which may be less than requested).
   */
  static async redeem(
    merchantId: string,
    opts: {
      cardId?: string;
      cardNumber?: string;
      ecardCode?: string;
      amount: number;
      orderId?: string;
      allowPartial?: boolean;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are disabled");

    const requested = money(opts.amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new Error("Valid amount is required");
    }

    let card: Awaited<ReturnType<typeof this.getById>>;
    if (opts.cardId) {
      card = await this.getById(merchantId, opts.cardId);
    } else {
      const code = opts.cardNumber || opts.ecardCode;
      if (!code) throw new Error("Card number is required");
      card = await this.lookup(merchantId, code);
    }

    assertActive(card);

    const balance = money(card.balance);
    if (balance <= 0) throw new Error("Card has no balance");

    let amount = requested;
    if (balance < requested) {
      if (!opts.allowPartial) throw new Error("Insufficient balance");
      amount = balance;
    }

    const newBalance = money(balance - amount);
    const updated = await db
      .update(schema.giftCards)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, card.id),
          eq(schema.giftCards.merchantId, merchantId),
          sql`${schema.giftCards.balance}::numeric >= ${amount}`
        )
      )
      .returning();

    if (!updated[0]) throw new Error("Insufficient balance");

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: card.id,
      transactionType: "redeem",
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      orderId: opts.orderId || null,
      description: `Redeemed CHF ${amount.toFixed(2)}`,
    });

    return {
      card: updated[0],
      amountRedeemed: amount,
      amountRequested: requested,
      remainingBalance: newBalance,
      shortfall: money(Math.max(0, requested - amount)),
    };
  }

  static async attachMembership(
    merchantId: string,
    cardId: string,
    input: {
      name?: string;
      email?: string;
      phone?: string;
      customerId?: string;
    }
  ) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    assertActive(card);

    let customerId = input.customerId || card.customerId || null;
    const name = String(input.name || card.holderName || "").trim();
    const email = String(input.email || card.holderEmail || "").trim();
    const phone = String(input.phone || card.holderPhone || "").trim();

    if (!customerId) {
      if (!name && !email && !phone) {
        throw new Error("Name, email, or phone is required for membership");
      }
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0] || "Member";
      const last = parts.slice(1).join(" ") || "";
      const customer = await CustomerService.createCustomer(
        merchantId,
        email || undefined,
        phone || undefined,
        first,
        last
      );
      customerId = customer.id;
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        membershipEnabled: true,
        customerId,
        holderName: name || null,
        holderEmail: email || null,
        holderPhone: phone || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: "membership_issue",
      description: `Membership attached${name ? `: ${name}` : ""}`,
    });

    return updated[0]!;
  }

  static async addPoints(merchantId: string, cardId: string, points: number, orderId?: string) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    if (!card.membershipEnabled || !card.customerId) {
      throw new Error("Card has no membership");
    }
    assertActive(card);
    const pts = Math.floor(Number(points));
    if (!Number.isFinite(pts) || pts <= 0) throw new Error("Valid points required");

    const newPoints = (card.pointsBalance || 0) + pts;
    const updated = await db
      .update(schema.giftCards)
      .set({ pointsBalance: newPoints, updatedAt: new Date() })
      .where(eq(schema.giftCards.id, cardId))
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: "points_earn",
      points: pts,
      pointsAfter: newPoints,
      orderId: orderId || null,
      description: `Earned ${pts} points`,
    });
    return updated[0]!;
  }

  static async suspend(merchantId: string, cardId: string, reason?: string) {
    const db = getDb();
    const rows = await db
      .update(schema.giftCards)
      .set({
        status: "suspended",
        suspendedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();
    if (!rows[0]) throw new Error("Card not found");
    return rows[0];
  }

  static async reactivate(merchantId: string, cardId: string) {
    const db = getDb();
    const rows = await db
      .update(schema.giftCards)
      .set({
        status: "active",
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();
    if (!rows[0]) throw new Error("Card not found");
    return rows[0];
  }

  static async getTransactions(
    merchantId: string,
    cardId: string,
    page = 1,
    limit = 30
  ) {
    const db = getDb();
    await this.getById(merchantId, cardId);
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    return db.query.giftCardTransactions.findMany({
      where: and(
        eq(schema.giftCardTransactions.merchantId, merchantId),
        eq(schema.giftCardTransactions.cardId, cardId)
      ),
      orderBy: desc(schema.giftCardTransactions.createdAt),
      limit,
      offset,
    });
  }
}
