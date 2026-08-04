import { getDb, schema } from "@/db";
import { and, eq, gte, lt, sql, desc } from "drizzle-orm";
import { MERCHANT_TZ } from "@/lib/geo";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Calendar YYYY-MM-DD in merchant timezone (Europe/Zurich). */
function ymdInMerchantTz(d = new Date(), timeZone = MERCHANT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Start/end of a Zurich calendar day. */
function zurichDayBounds(ymd: string): { start: Date; end: Date } {
  const fallbackStart = new Date(`${ymd}T00:00:00+02:00`);
  const fallbackEnd = new Date(`${ymd}T23:59:59.999+02:00`);
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: MERCHANT_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    let guess = new Date(`${ymd}T00:00:00Z`);
    for (let i = 0; i < 48; i++) {
      const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
      const got = `${parts.year}-${parts.month}-${parts.day}`;
      const hour = Number(parts.hour);
      if (got === ymd && hour === 0) break;
      if (got < ymd) guess = new Date(guess.getTime() + 3600_000);
      else if (got > ymd) guess = new Date(guess.getTime() - 3600_000);
      else guess = new Date(guess.getTime() - hour * 3600_000);
    }
    const startZ = guess;
    const endZ = new Date(startZ.getTime() + 24 * 3600_000 - 1);
    return { start: startZ, end: endZ };
  } catch {
    return { start: fallbackStart, end: fallbackEnd };
  }
}

const AUTO_CLOSE_NOTE = "Auto-closed at end of business day (23:59 Europe/Zurich)";

export class PosShiftService {
  static async getOpenShift(merchantId: string) {
    const db = getDb();
    return db.query.posShifts.findFirst({
      where: and(eq(schema.posShifts.merchantId, merchantId), eq(schema.posShifts.status, "open")),
      orderBy: [desc(schema.posShifts.openedAt)],
    });
  }

  /**
   * Close open shifts whose opening day is before today (merchant TZ).
   * Used by the hourly job and on next open / current-shift fetch.
   * Counted cash = expected (variance 0); notes mark auto-close.
   */
  static async autoCloseStaleShifts(merchantId?: string): Promise<number> {
    const db = getDb();
    const todayYmd = ymdInMerchantTz();
    const { start: todayStart } = zurichDayBounds(todayYmd);

    const openShifts = await db.query.posShifts.findMany({
      where: merchantId
        ? and(
            eq(schema.posShifts.merchantId, merchantId),
            eq(schema.posShifts.status, "open"),
            lt(schema.posShifts.openedAt, todayStart)
          )
        : and(eq(schema.posShifts.status, "open"), lt(schema.posShifts.openedAt, todayStart)),
    });

    let closed = 0;
    for (const open of openShifts) {
      try {
        const openedYmd = ymdInMerchantTz(open.openedAt);
        const { end: dayEnd } = zurichDayBounds(openedYmd);
        const live = await this.computeLiveTotals(open.merchantId, open.openedAt, dayEnd);
        const expectedCash = round2(num(open.openingCash) + live.cashSales);

        await db
          .update(schema.posShifts)
          .set({
            status: "closed",
            closedAt: dayEnd,
            closingCashCounted: expectedCash.toFixed(2),
            expectedCash: expectedCash.toFixed(2),
            cashSales: live.cashSales.toFixed(2),
            cardSales: live.cardSales.toFixed(2),
            terminalSales: live.terminalSales.toFixed(2),
            otherSales: live.otherSales.toFixed(2),
            orderCount: live.orderCount,
            variance: "0.00",
            notes: open.notes?.trim()
              ? `${open.notes.trim()}\n${AUTO_CLOSE_NOTE}`
              : AUTO_CLOSE_NOTE,
            updatedAt: new Date(),
          })
          .where(
            and(eq(schema.posShifts.id, open.id), eq(schema.posShifts.status, "open"))
          );
        closed += 1;
      } catch (err) {
        console.error(`[pos-shifts] auto-close failed for ${open.id}`, err);
      }
    }
    return closed;
  }

  static async getCurrent(merchantId: string) {
    await this.autoCloseStaleShifts(merchantId);
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
    input: { openingCash?: number | null; staffId?: string | null; staffName?: string | null }
  ) {
    await this.autoCloseStaleShifts(merchantId);
    const existing = await this.getOpenShift(merchantId);
    if (existing) {
      throw new Error("A shift is already open. Close it before starting a new one.");
    }
    // Opening float is optional — blank / null / NaN → 0
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

  /** Sum completed POS orders in [openedAt, until). */
  private static async computeLiveTotals(
    merchantId: string,
    openedAt: Date,
    until: Date = new Date()
  ) {
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
          lt(schema.orders.createdAt, until),
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
