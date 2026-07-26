import axios from "axios";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";

const ADYEN_API_BASE = process.env.ADYEN_API_BASE || "https://checkout-test.adyen.com/v71";
const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
const ADYEN_MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT;
const ADYEN_CLIENT_ID = process.env.ADYEN_CLIENT_ID;

export class AdyenService {
  /**
   * Resolve Adyen credentials: merchant settings (shared for shop + terminals) → env.
   * Legacy per-terminal credential overrides are still honored if present.
   */
  static async resolveCredentials(merchantId: string, terminalId?: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    let terminal:
      | {
          adyenMerchantAccount?: string | null;
          adyenApiKey?: string | null;
          adyenClientId?: string | null;
          terminalId?: string;
        }
      | undefined;

    if (terminalId) {
      terminal =
        (await db.query.paymentTerminals.findFirst({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            eq(schema.paymentTerminals.terminalId, terminalId)
          ),
        })) ||
        (await db.query.paymentTerminals.findFirst({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            eq(schema.paymentTerminals.id, terminalId)
          ),
        })) ||
        undefined;
    }

    const apiKey = terminal?.adyenApiKey || merchant?.adyenApiKey || ADYEN_API_KEY;
    const merchantAccount =
      terminal?.adyenMerchantAccount || merchant?.adyenMerchantAccount || ADYEN_MERCHANT_ACCOUNT;
    const clientId = terminal?.adyenClientId || merchant?.adyenClientId || ADYEN_CLIENT_ID;

    if (!apiKey || !merchantAccount) {
      throw new Error("Adyen credentials not configured for this merchant");
    }

    return {
      apiKey,
      merchantAccount,
      clientId,
      terminalId: terminal?.terminalId || terminalId,
    };
  }

  /**
   * Initialize payment session
   */
  static async initializePaymentSession(
    merchantId: string,
    orderId: string,
    amount: number,
    currency: string = "USD",
    returnUrl?: string
  ) {
    try {
      const creds = await this.resolveCredentials(merchantId);

      const response = await axios.post(
        `${ADYEN_API_BASE}/sessions`,
        {
          amount: {
            value: Math.round(amount * 100), // Convert to cents
            currency,
          },
          merchantAccount: creds.merchantAccount,
          reference: `${merchantId}-${orderId}`,
          returnUrl: returnUrl || `${process.env.APP_URL}/payment/return`,
          channel: "Web",
          countryCode: "CH",
          ...(creds.clientId ? { clientKey: creds.clientId } : {}),
        },
        {
          headers: {
            "x-api-key": creds.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error initializing payment session:", error);
      throw error;
    }
  }

  /**
   * Process payment with card details
   */
  static async processCardPayment(
    merchantId: string,
    orderId: string,
    amount: number,
    paymentMethod: {
      type: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      cvc: string;
      holderName: string;
    },
    currency: string = "USD"
  ) {
    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Adyen credentials not configured");
      }

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments`,
        {
          amount: {
            value: Math.round(amount * 100),
            currency,
          },
          paymentMethod,
          merchantAccount: ADYEN_MERCHANT_ACCOUNT,
          reference: `${merchantId}-${orderId}`,
          returnUrl: `${process.env.APP_URL}/payment/return`,
          channel: "Web",
        },
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error processing card payment:", error);
      throw error;
    }
  }

  /**
   * Process terminal payment
   */
  static async processTerminalPayment(
    merchantId: string,
    orderId: string,
    amount: number,
    terminalId: string,
    currency: string = "USD"
  ) {
    try {
      const creds = await this.resolveCredentials(merchantId, terminalId);

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments`,
        {
          amount: {
            value: Math.round(amount * 100),
            currency,
          },
          paymentMethod: {
            type: "scheme",
          },
          merchantAccount: creds.merchantAccount,
          reference: `${merchantId}-${orderId}`,
          deviceData: {
            terminalId: creds.terminalId || terminalId,
          },
          channel: "POS",
        },
        {
          headers: {
            "x-api-key": creds.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error processing terminal payment:", error);
      throw error;
    }
  }

  /**
   * Record payment transaction
   */
  static async recordPaymentTransaction(
    merchantId: string,
    orderId: string,
    amount: number,
    paymentMethod: string,
    adyenReference: string,
    status: "pending" | "completed" | "failed"
  ) {
    const db = getDb();

    try {
      const transaction = await db
        .insert(schema.paymentTransactions)
        .values({
          orderId,
          merchantId,
          amount: amount.toString(),
          paymentMethod,
          status,
          adyenReference,
          completedAt: new Date(),
        })
        .returning();

      return transaction[0];
    } catch (error) {
      console.error("Error recording payment transaction:", error);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(merchantId: string, reference: string) {
    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Adyen credentials not configured");
      }

      const response = await axios.get(
        `${ADYEN_API_BASE}/payments/${reference}`,
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error getting payment status:", error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    merchantId: string,
    transactionId: string,
    amount?: number
  ) {
    const db = getDb();

    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Adyen credentials not configured");
      }

      const transaction = await db.query.paymentTransactions.findFirst({
        where: and(
          eq(schema.paymentTransactions.id, transactionId),
          eq(schema.paymentTransactions.merchantId, merchantId)
        ),
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      const refundAmount = amount || parseFloat(transaction.amount.toString());

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments/${transaction.adyenReference}/refunds`,
        {
          amount: {
            value: Math.round(refundAmount * 100),
            currency: "USD",
          },
          merchantAccount: ADYEN_MERCHANT_ACCOUNT,
        },
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      // Record refund transaction
      await db.insert(schema.paymentTransactions).values({
        orderId: transaction.orderId,
        merchantId,
        amount: (-refundAmount).toString(),
        paymentMethod: "refund",
        status: "completed",
        adyenReference: response.data.reference,
        completedAt: new Date(),
      });

      return response.data;
    } catch (error) {
      console.error("Error refunding payment:", error);
      throw error;
    }
  }

  /**
   * Get merchant payment methods
   */
  static async getMerchantPaymentMethods(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      // Default payment methods
      const paymentMethods = [
        {
          type: "card",
          name: "Credit/Debit Card",
          enabled: true,
        },
        {
          type: "terminal",
          name: "Payment Terminal",
          enabled: true,
        },
        {
          type: "cash",
          name: "Cash",
          enabled: true,
        },
      ];

      return paymentMethods;
    } catch (error) {
      console.error("Error getting payment methods:", error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.paymentTransactions.merchantId, merchantId)];

      if (status) {
        whereConditions.push(eq(schema.paymentTransactions.status, status));
      }

      const transactions = await db.query.paymentTransactions.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        limit,
        offset,
        orderBy: [desc(schema.paymentTransactions.completedAt)],
      });

      return transactions;
    } catch (error) {
      console.error("Error getting transaction history:", error);
      throw error;
    }
  }

  /**
   * Get payment summary
   */
  static async getPaymentSummary(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      let whereConditions: any[] = [eq(schema.paymentTransactions.merchantId, merchantId)];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.paymentTransactions.completedAt, startDate));
        whereConditions.push(lte(schema.paymentTransactions.completedAt, endDate));
      }

      const transactions = await db.query.paymentTransactions.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      });

      const totalAmount = transactions.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      );

      const byStatus = transactions.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + parseFloat(t.amount.toString());
          return acc;
        },
        {} as Record<string, number>
      );

      const byMethod = transactions.reduce(
        (acc, t) => {
          acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + parseFloat(t.amount.toString());
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalAmount,
        transactionCount: transactions.length,
        byStatus,
        byMethod,
      };
    } catch (error) {
      console.error("Error getting payment summary:", error);
      throw error;
    }
  }
}

// Import missing functions
import { desc, gte, lte } from "drizzle-orm";
