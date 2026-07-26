import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";

export class ShopCustomerService {
  static async register(
    merchantId: string,
    input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ) {
    const db = getDb();
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || input.password.length < 6) {
      throw new Error("Valid email and password (min 6 chars) are required");
    }

    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, email)),
    });

    if (existing?.passwordHash) {
      throw new Error("An account with this email already exists — please log in");
    }

    const passwordHash = await AuthService.hashPassword(input.password);

    if (existing) {
      const [updated] = await db
        .update(schema.customers)
        .set({
          passwordHash,
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName || existing.lastName,
          phone: input.phone || existing.phone,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, existing.id))
        .returning();
      return this.tokenFor(updated);
    }

    const [created] = await db
      .insert(schema.customers)
      .values({
        merchantId,
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      })
      .returning();

    return this.tokenFor(created);
  }

  static async login(merchantId: string, email: string, password: string) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, normalized)),
    });
    if (!customer?.passwordHash) {
      throw new Error("Invalid email or password");
    }
    const ok = await AuthService.comparePassword(password, customer.passwordHash);
    if (!ok) throw new Error("Invalid email or password");
    return this.tokenFor(customer);
  }

  static async getProfile(customerId: string, merchantId: string) {
    const db = getDb();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!customer) throw new Error("Customer not found");
    return this.publicCustomer(customer);
  }

  static async updateProfile(
    customerId: string,
    merchantId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      defaultAddress?: string;
      defaultZip?: string;
      defaultCity?: string;
    }
  ) {
    const db = getDb();
    const [updated] = await db
      .update(schema.customers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)))
      .returning();
    if (!updated) throw new Error("Customer not found");
    return this.publicCustomer(updated);
  }

  private static publicCustomer(c: typeof schema.customers.$inferSelect) {
    return {
      id: c.id,
      email: c.email,
      phone: c.phone,
      firstName: c.firstName,
      lastName: c.lastName,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
      defaultAddress: c.defaultAddress,
      defaultZip: c.defaultZip,
      defaultCity: c.defaultCity,
      hasAccount: !!c.passwordHash,
    };
  }

  private static tokenFor(customer: typeof schema.customers.$inferSelect) {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || "";
    const token = AuthService.generateToken({
      id: customer.id,
      email: customer.email || "",
      role: "customer",
      merchantId: customer.merchantId,
      customerId: customer.id,
      name,
    });
    return { token, customer: this.publicCustomer(customer) };
  }
}
