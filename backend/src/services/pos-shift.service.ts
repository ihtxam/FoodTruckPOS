import { getDb, schema } from "@/db";
import { and, eq, gte, lt, sql, desc } from "drizzle-orm";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export class PosShiftService {
  static async getOpenShift(merchantId: string) {
    const db = getDb();
    return db.query.posShifts.findFirst({
      where: and(eq(schema.posShifts.merchantId, merchantId), eq(schema.posShifts.status, "open")),
      orderBy: [desc(schema.posShifts.openedAt)],
    });
  }

  static async getCurrent(merchantId: string) {
    const open = await this.getOpenShift(merchantId);
    if (!open) return { shift: null, live: null };
    const live = await this.computeLiveTotals(merchantId, open.openedAt);
    return {
      shift: this.serialize(open),
      live: {
        ...live,
        expectedCash: round2(num(open.openingCash) + live.cashSales),
      },
    };
  }

  static async startShift(
    merchantId: string,
    input: { openingCash: number; staffId?: string | null; staffName?: string | null }
  ) {
    const existing = await this.getOpenShift(merchantId);
    if (existing) {
      throw new Error("A shift is already open. Close it before starting a new one.");
    }
    const openingCash = round2(Math.max(0, Number(input.openingCash) || 0));
    const db = getDb();
    const [created] = await db
      .insert(schema.posShifts)
      .values({
        merchantId,
        staffId: input.staffId || null,
        staffName: input.staffName || null,
        status: "open",
        openingCash: openingCash.toFixed(2),
      })
      .returning();
    return this.serialize(created);
  }

  static async closeShift(
    merchantId: string,
    input: { closingCashCounted: number; notes?: string | null }
  ) {
    const open = await this.getOpenShift(merchantId);
    if (!open) throw new Error("No open shift to close.");

    const live = await this.computeLiveTotals(merchantId, open.openedAt);
    const expectedCash = round2(num(open.openingCash) + live.cashSales);
    const counted = round2(Math.max(0, Number(input.closingCashCounted) || 0));
    const variance = round2(counted - expectedCash);

    const db = getDb();
    const [updated] = await db
      .update(schema.posShifts)
      .set({
        status: "closed",
        closedAt: new Date(),
        closingCashCounted: counted.toFixed(2),
        expectedCash: expectedCash.toFixed(2),
        cashSales: live.cashSales.toFixed(2),
        cardSales: live.cardSales.toFixed(2),
        terminalSales: live.terminalSales.toFixed(2),
        otherSales: live.otherSales.toFixed(2),
        orderCount: live.orderCount,
        variance: variance.toFixed(2),
        notes: input.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.posShifts.id, open.id), eq(schema.posShifts.merchantId, merchantId)))
      .returning();

    return {
      shift: this.serialize(updated),
      balanced: Math.abs(variance) < 0.005,
      reportPeriod: {
        from: open.openedAt.toISOString(),
        to: (updated.closedAt || new Date()).toISOString(),
      },
    };
  }

  /** Sum completed POS orders since shift open. */
  private static async computeLiveTotals(merchantId: string, openedAt: Date) {
    const db = getDb();
    const rows = await db
      .select({
        paymentMethod: schema.orders.paymentMethod,
        total: schema.orders.total,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.merchantId, merchantId),
          gte(schema.orders.createdAt, openedAt),
          lt(schema.orders.createdAt, new Date()),
          sql`lower(coalesce(${schema.orders.status}, '')) not in ('cancelled', 'canceled', 'refunded')`
        )
      );

    let cashSales = 0;
    let cardSales = 0;
    let terminalSales = 0;
    let otherSales = 0;
    for (const row of rows) {
      const amount = num(row.total);
      const method = String(row.paymentMethod || "").toLowerCase();
      if (method === "cash") cashSales += amount;
      else if (method === "card") cardSales += amount;
      else if (method === "terminal") terminalSales += amount;
      else otherSales += amount;
    }
    return {
      cashSales: round2(cashSales),
      cardSales: round2(cardSales),
      terminalSales: round2(terminalSales),
      otherSales: round2(otherSales),
      orderCount: rows.length,
      totalSales: round2(cashSales + cardSales + terminalSales + otherSales),
    };
  }

  private static serialize(row: typeof schema.posShifts.$inferSelect) {
    return {
      id: row.id,
      merchantId: row.merchantId,
      staffId: row.staffId,
      staffName: row.staffName,
      status: row.status,
      openedAt: row.openedAt?.toISOString?.() ?? row.openedAt,
      closedAt: row.closedAt?.toISOString?.() ?? row.closedAt,
      openingCash: num(row.openingCash),
      closingCashCounted: row.closingCashCounted != null ? num(row.closingCashCounted) : null,
      expectedCash: row.expectedCash != null ? num(row.expectedCash) : null,
      cashSales: num(row.cashSales),
      cardSales: num(row.cardSales),
      terminalSales: num(row.terminalSales),
      otherSales: num(row.otherSales),
      orderCount: row.orderCount ?? 0,
      variance: row.variance != null ? num(row.variance) : null,
      notes: row.notes,
    };
  }
}
