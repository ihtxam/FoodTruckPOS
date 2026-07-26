import { getDb, schema } from "@/db";
import { eq, and, like, desc } from "drizzle-orm";

export class CustomerService {
  /**
   * Create customer
   */
  static async createCustomer(
    merchantId: string,
    email?: string,
    phone?: string,
    firstName?: string,
    lastName?: string
  ) {
    const db = getDb();

    try {
      const customer = await db
        .insert(schema.customers)
        .values({
          merchantId,
          email,
          phone,
          firstName,
          lastName,
          loyaltyPoints: 0,
          totalSpent: "0",
        })
        .returning();

      return customer[0];
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
    }
  }

  /**
   * Get all customers for merchant
   */
  static async getCustomers(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    search?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.customers.merchantId, merchantId)];

      if (search) {
        whereConditions.push(
          or(
            like(schema.customers.email, `%${search}%`),
            like(schema.customers.phone, `%${search}%`),
            like(schema.customers.firstName, `%${search}%`),
            like(schema.customers.lastName, `%${search}%`)
          )
        );
      }

      const customers = await db.query.customers.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        limit,
        offset,
        orderBy: desc(schema.customers.createdAt),
      });

      return customers;
    } catch (error) {
      console.error("Error getting customers:", error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      return customer;
    } catch (error) {
      console.error("Error getting customer:", error);
      throw error;
    }
  }

  /**
   * Get customer by email
   */
  static async getCustomerByEmail(merchantId: string, email: string) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.merchantId, merchantId),
          eq(schema.customers.email, email)
        ),
      });

      return customer;
    } catch (error) {
      console.error("Error getting customer by email:", error);
      throw error;
    }
  }

  /**
   * Update customer
   */
  static async updateCustomer(
    merchantId: string,
    customerId: string,
    updates: Partial<typeof schema.customers.$inferInsert>
  ) {
    const db = getDb();

    try {
      const customer = await db
        .update(schema.customers)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.customers.id, customerId),
            eq(schema.customers.merchantId, merchantId)
          )
        )
        .returning();

      if (customer.length === 0) {
        throw new Error("Customer not found");
      }

      return customer[0];
    } catch (error) {
      console.error("Error updating customer:", error);
      throw error;
    }
  }

  /**
   * Delete customer
   */
  static async deleteCustomer(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const result = await db
        .delete(schema.customers)
        .where(
          and(
            eq(schema.customers.id, customerId),
            eq(schema.customers.merchantId, merchantId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error("Customer not found");
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  }

  /**
   * Add loyalty points
   */
  static async addLoyaltyPoints(merchantId: string, customerId: string, points: number) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      const updatedCustomer = await db
        .update(schema.customers)
        .set({
          loyaltyPoints: customer.loyaltyPoints + points,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      return updatedCustomer[0];
    } catch (error) {
      console.error("Error adding loyalty points:", error);
      throw error;
    }
  }

  /**
   * Redeem loyalty points
   */
  static async redeemLoyaltyPoints(merchantId: string, customerId: string, points: number) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.loyaltyPoints < points) {
        throw new Error("Insufficient loyalty points");
      }

      const updatedCustomer = await db
        .update(schema.customers)
        .set({
          loyaltyPoints: customer.loyaltyPoints - points,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      return updatedCustomer[0];
    } catch (error) {
      console.error("Error redeeming loyalty points:", error);
      throw error;
    }
  }

  /**
   * Get customer purchase history
   */
  static async getCustomerPurchaseHistory(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.customerId, customerId)
        ),
        with: {
          items: {
            with: {
              product: true,
            },
          },
        },
        orderBy: desc(schema.orders.createdAt),
      });

      const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
      const orderCount = orders.length;

      return {
        customer: await this.getCustomerById(merchantId, customerId),
        orders,
        statistics: {
          totalSpent,
          orderCount,
          averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
        },
      };
    } catch (error) {
      console.error("Error getting purchase history:", error);
      throw error;
    }
  }

  /**
   * Get top customers by spending
   */
  static async getTopCustomers(merchantId: string, limit: number = 10) {
    const db = getDb();

    try {
      const customers = await db.query.customers.findMany({
        where: eq(schema.customers.merchantId, merchantId),
        orderBy: desc(schema.customers.totalSpent),
        limit,
      });

      return customers;
    } catch (error) {
      console.error("Error getting top customers:", error);
      throw error;
    }
  }

  /**
   * Get customer statistics
   */
  static async getCustomerStatistics(merchantId: string) {
    const db = getDb();

    try {
      const customers = await db.query.customers.findMany({
        where: eq(schema.customers.merchantId, merchantId),
      });

      const totalCustomers = customers.length;
      const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
      const totalSpent = customers.reduce((sum, c) => sum + parseFloat(c.totalSpent.toString()), 0);

      return {
        totalCustomers,
        totalLoyaltyPoints,
        totalSpent,
        averageCustomerValue: totalCustomers > 0 ? totalSpent / totalCustomers : 0,
      };
    } catch (error) {
      console.error("Error getting customer statistics:", error);
      throw error;
    }
  }
}

// Import missing functions
import { or } from "drizzle-orm";
