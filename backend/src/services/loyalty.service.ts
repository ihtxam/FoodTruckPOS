import { getDb, schema } from "@/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export class LoyaltyService {
  /**
   * Create loyalty card
   */
  static async createLoyaltyCard(
    merchantId: string,
    cardType: "loyalty" | "gift_card",
    customerId?: string,
    initialBalance?: number,
    rfidCardNumber?: string
  ) {
    const db = getDb();

    try {
      // Prefer scanned RFID UID from card reader; otherwise generate one
      const cardNumber =
        (rfidCardNumber && String(rfidCardNumber).trim()) ||
        `RFID-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

      const card = await db
        .insert(schema.loyaltyCards)
        .values({
          merchantId,
          customerId,
          cardType,
          cardNumber,
          balance: initialBalance?.toString() || "0",
          pointsBalance: 0,
          status: "active",
          issuedAt: new Date(),
          expiresAt:
            cardType === "gift_card"
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : null,
        })
        .returning();

      return card[0];
    } catch (error) {
      console.error("Error creating loyalty card:", error);
      throw error;
    }
  }

  /**
   * Get loyalty card by RFID code
   */
  static async getCardByRFID(merchantId: string, rfidCode: string) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.merchantId, merchantId),
          eq(schema.loyaltyCards.cardNumber, rfidCode)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      return card;
    } catch (error) {
      console.error("Error getting card by RFID:", error);
      throw error;
    }
  }

  /**
   * Get loyalty card by card number
   */
  static async getCardByNumber(merchantId: string, cardNumber: string) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.merchantId, merchantId),
          eq(schema.loyaltyCards.cardNumber, cardNumber)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      return card;
    } catch (error) {
      console.error("Error getting card by number:", error);
      throw error;
    }
  }

  /**
   * Get all loyalty cards for merchant
   */
  static async getLoyaltyCards(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    cardType?: string,
    status?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.loyaltyCards.merchantId, merchantId)];

      if (cardType) {
        whereConditions.push(eq(schema.loyaltyCards.cardType, cardType));
      }

      if (status) {
        whereConditions.push(eq(schema.loyaltyCards.status, status));
      }

      const cards = await db.query.loyaltyCards.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          customer: true,
        },
        limit,
        offset,
        orderBy: desc(schema.loyaltyCards.issuedAt),
      });

      return cards;
    } catch (error) {
      console.error("Error getting loyalty cards:", error);
      throw error;
    }
  }

  /**
   * Add balance to card
   */
  static async addBalance(merchantId: string, cardId: string, amount: number) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.id, cardId),
          eq(schema.loyaltyCards.merchantId, merchantId)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      const currentBalance = parseFloat(card.balance.toString());
      const newBalance = currentBalance + amount;

      const updatedCard = await db
        .update(schema.loyaltyCards)
        .set({
          balance: newBalance.toString(),
        })
        .where(eq(schema.loyaltyCards.id, cardId))
        .returning();

      // Record transaction
      await db.insert(schema.loyaltyTransactions).values({
        cardId,
        merchantId,
        transactionType: "add_balance",
        amount: amount.toString(),
        balanceAfter: newBalance.toString(),
        description: `Added ${amount} to card balance`,
      });

      return updatedCard[0];
    } catch (error) {
      console.error("Error adding balance:", error);
      throw error;
    }
  }

  /**
   * Redeem balance from card
   */
  static async redeemBalance(
    merchantId: string,
    cardId: string,
    amount: number,
    orderId?: string
  ) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.id, cardId),
          eq(schema.loyaltyCards.merchantId, merchantId)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      const currentBalance = parseFloat(card.balance.toString());

      if (currentBalance < amount) {
        throw new Error("Insufficient balance");
      }

      const newBalance = currentBalance - amount;

      const updatedCard = await db
        .update(schema.loyaltyCards)
        .set({
          balance: newBalance.toString(),
        })
        .where(eq(schema.loyaltyCards.id, cardId))
        .returning();

      // Record transaction
      await db.insert(schema.loyaltyTransactions).values({
        cardId,
        merchantId,
        orderId,
        transactionType: "redeem",
        amount: amount.toString(),
        balanceAfter: newBalance.toString(),
        description: `Redeemed ${amount} from card`,
      });

      return updatedCard[0];
    } catch (error) {
      console.error("Error redeeming balance:", error);
      throw error;
    }
  }

  /**
   * Add loyalty points
   */
  static async addPoints(merchantId: string, cardId: string, points: number) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.id, cardId),
          eq(schema.loyaltyCards.merchantId, merchantId)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      const currentPoints = parseFloat(card.pointsBalance.toString());
      const newPoints = currentPoints + points;

      const updatedCard = await db
        .update(schema.loyaltyCards)
        .set({
          pointsBalance: newPoints.toString(),
        })
        .where(eq(schema.loyaltyCards.id, cardId))
        .returning();

      // Record transaction
      await db.insert(schema.loyaltyTransactions).values({
        cardId,
        merchantId,
        transactionType: "add_points",
        amount: points.toString(),
        balanceAfter: newPoints.toString(),
        description: `Added ${points} loyalty points`,
      });

      return updatedCard[0];
    } catch (error) {
      console.error("Error adding points:", error);
      throw error;
    }
  }

  /**
   * Redeem loyalty points
   */
  static async redeemPoints(
    merchantId: string,
    cardId: string,
    points: number,
    orderId?: string
  ) {
    const db = getDb();

    try {
      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(schema.loyaltyCards.id, cardId),
          eq(schema.loyaltyCards.merchantId, merchantId)
        ),
      });

      if (!card) {
        throw new Error("Card not found");
      }

      const currentPoints = parseFloat(card.pointsBalance.toString());

      if (currentPoints < points) {
        throw new Error("Insufficient points");
      }

      const newPoints = currentPoints - points;

      const updatedCard = await db
        .update(schema.loyaltyCards)
        .set({
          pointsBalance: newPoints.toString(),
        })
        .where(eq(schema.loyaltyCards.id, cardId))
        .returning();

      // Record transaction
      await db.insert(schema.loyaltyTransactions).values({
        cardId,
        merchantId,
        orderId,
        transactionType: "redeem_points",
        amount: points.toString(),
        balanceAfter: newPoints.toString(),
        description: `Redeemed ${points} loyalty points`,
      });

      return updatedCard[0];
    } catch (error) {
      console.error("Error redeeming points:", error);
      throw error;
    }
  }

  /**
   * Get card transaction history
   */
  static async getCardTransactions(
    merchantId: string,
    cardId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;

      const transactions = await db.query.loyaltyTransactions.findMany({
        where: and(
          eq(schema.loyaltyTransactions.cardId, cardId),
          eq(schema.loyaltyTransactions.merchantId, merchantId)
        ),
        limit,
        offset,
        orderBy: desc(schema.loyaltyTransactions.createdAt),
      });

      return transactions;
    } catch (error) {
      console.error("Error getting card transactions:", error);
      throw error;
    }
  }

  /**
   * Suspend card
   */
  static async suspendCard(merchantId: string, cardId: string, reason?: string) {
    const db = getDb();

    try {
      const card = await db
        .update(schema.loyaltyCards)
        .set({
          status: "suspended",
          suspendedReason: reason,
        })
        .where(
          and(
            eq(schema.loyaltyCards.id, cardId),
            eq(schema.loyaltyCards.merchantId, merchantId)
          )
        )
        .returning();

      if (card.length === 0) {
        throw new Error("Card not found");
      }

      return card[0];
    } catch (error) {
      console.error("Error suspending card:", error);
      throw error;
    }
  }

  /**
   * Reactivate card
   */
  static async reactivateCard(merchantId: string, cardId: string) {
    const db = getDb();

    try {
      const card = await db
        .update(schema.loyaltyCards)
        .set({
          status: "active",
          suspendedReason: null,
        })
        .where(
          and(
            eq(schema.loyaltyCards.id, cardId),
            eq(schema.loyaltyCards.merchantId, merchantId)
          )
        )
        .returning();

      if (card.length === 0) {
        throw new Error("Card not found");
      }

      return card[0];
    } catch (error) {
      console.error("Error reactivating card:", error);
      throw error;
    }
  }

  /**
   * Get loyalty statistics
   */
  static async getLoyaltyStatistics(merchantId: string) {
    const db = getDb();

    try {
      const cards = await db.query.loyaltyCards.findMany({
        where: eq(schema.loyaltyCards.merchantId, merchantId),
      });

      const totalCards = cards.length;
      const activeCards = cards.filter((c) => c.status === "active").length;
      const totalBalance = cards.reduce((sum, c) => sum + parseFloat(c.balance.toString()), 0);
      const totalPoints = cards.reduce((sum, c) => sum + parseFloat(c.pointsBalance.toString()), 0);

      const giftCards = cards.filter((c) => c.cardType === "gift_card").length;
      const loyaltyCards = cards.filter((c) => c.cardType === "loyalty").length;

      return {
        totalCards,
        activeCards,
        giftCards,
        loyaltyCards,
        totalBalance,
        totalPoints,
        averageBalance: totalCards > 0 ? totalBalance / totalCards : 0,
      };
    } catch (error) {
      console.error("Error getting loyalty statistics:", error);
      throw error;
    }
  }

  /**
   * Get expiring gift cards
   */
  static async getExpiringGiftCards(merchantId: string, daysThreshold: number = 30) {
    const db = getDb();

    try {
      const expirationDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);

      const cards = await db.query.loyaltyCards.findMany({
        where: and(
          eq(schema.loyaltyCards.merchantId, merchantId),
          eq(schema.loyaltyCards.cardType, "gift_card"),
          lte(schema.loyaltyCards.expiresAt, expirationDate)
        ),
        orderBy: asc(schema.loyaltyCards.expiresAt),
      });

      return cards;
    } catch (error) {
      console.error("Error getting expiring gift cards:", error);
      throw error;
    }
  }

  /**
   * Get loyalty program analytics
   */
  static async getLoyaltyAnalytics(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      let whereConditions: any[] = [eq(schema.loyaltyTransactions.merchantId, merchantId)];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.loyaltyTransactions.createdAt, startDate));
        whereConditions.push(lte(schema.loyaltyTransactions.createdAt, endDate));
      }

      const transactions = await db.query.loyaltyTransactions.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      });

      const totalTransactions = transactions.length;
      const totalRedeemed = transactions
        .filter((t) => t.transactionType === "redeem" || t.transactionType === "redeem_points")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const totalAdded = transactions
        .filter((t) => t.transactionType === "add_balance" || t.transactionType === "add_points")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const byType = transactions.reduce(
        (acc, t) => {
          acc[t.transactionType] = (acc[t.transactionType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalTransactions,
        totalAdded,
        totalRedeemed,
        netValue: totalAdded - totalRedeemed,
        byType,
      };
    } catch (error) {
      console.error("Error getting loyalty analytics:", error);
      throw error;
    }
  }
}

// Import missing functions
import { asc } from "drizzle-orm";
