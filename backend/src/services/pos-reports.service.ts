import { getDb, schema } from "@/db";
import { and, eq, gte, lte, desc } from "drizzle-orm";

export type ReportPreset =
  | "today"
  | "yesterday"
  | "last_week"
  | "last_month"
  | "last_3_months"
  | "custom";

function zurichDayBounds(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00+02:00`);
  const end = new Date(`${ymd}T23:59:59.999+02:00`);
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
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
      const parts = Object.fromEntries(
        fmt.formatToParts(guess).map((p) => [p.type, p.value])
      );
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
    return { start, end };
  }
}

function ymdInZurich(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYmd(ymd: string, delta: number): string {
  const { start } = zurichDayBounds(ymd);
  const next = new Date(start.getTime() + delta * 24 * 3600_000);
  return ymdInZurich(next);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function channelLabel(ch: string): string {
  switch (ch) {
    case "dine_in":
      return "Dine-in";
    case "delivery":
      return "Delivery";
    default:
      return "Takeaway";
  }
}

export function resolveReportRange(
  preset: ReportPreset,
  from?: string,
  to?: string
): { start: Date; end: Date; label: string; from: string; to: string } {
  const today = ymdInZurich();
  if (preset === "custom") {
    const f = (from || today).slice(0, 10);
    const t = (to || f).slice(0, 10);
    const a = zurichDayBounds(f);
    const b = zurichDayBounds(t);
    return { start: a.start, end: b.end, label: `${f} to ${t}`, from: f, to: t };
  }
  if (preset === "yesterday") {
    const y = addDaysYmd(today, -1);
    const b = zurichDayBounds(y);
    return { start: b.start, end: b.end, label: y, from: y, to: y };
  }
  if (preset === "last_week") {
    const f = addDaysYmd(today, -6);
    const a = zurichDayBounds(f);
    const b = zurichDayBounds(today);
    return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
  }
  if (preset === "last_month") {
    const f = addDaysYmd(today, -29);
    const a = zurichDayBounds(f);
    const b = zurichDayBounds(today);
    return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
  }
  if (preset === "last_3_months") {
    const f = addDaysYmd(today, -89);
    const a = zurichDayBounds(f);
    const b = zurichDayBounds(today);
    return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
  }
  const b = zurichDayBounds(today);
  return { start: b.start, end: b.end, label: today, from: today, to: today };
}

export class PosReportsService {
  static async getEndOfDayReport(
    merchantId: string,
    opts: { preset?: ReportPreset; from?: string; to?: string; channel?: string }
  ) {
    const db = getDb();
    const range = resolveReportRange(opts.preset || "today", opts.from, opts.to);

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    const money = (n: unknown) => Number(n) || 0;
    const rateTakeaway =
      money(merchant?.taxTakeawayRate) || money(merchant?.vatRate) || 2.6;
    const rateDineIn = money(merchant?.taxDineInRate) || money(merchant?.vatRate) || 8.1;
    const rateDelivery =
      money(merchant?.taxDeliveryRate) || money(merchant?.taxTakeawayRate) || money(merchant?.vatRate) || 2.6;

    const conditions = [
      eq(schema.orders.merchantId, merchantId),
      gte(schema.orders.createdAt, range.start),
      lte(schema.orders.createdAt, range.end),
    ];
    if (opts.channel && ["takeaway", "dine_in", "delivery"].includes(opts.channel)) {
      conditions.push(eq(schema.orders.fulfillmentChannel, opts.channel));
    }

    const rows = await db.query.orders.findMany({
      where: and(...conditions),
      with: { items: true },
      orderBy: [desc(schema.orders.createdAt)],
    });

    const completed = rows.filter((o) =>
      ["completed", "partially_refunded"].includes(String(o.status))
    );
    const cancelled = rows.filter((o) => o.status === "cancelled");
    const refunded = rows.filter(
      (o) =>
        o.status === "refunded" ||
        o.status === "partially_refunded" ||
        Number(o.refundAmount || 0) > 0
    );

    /** Taxable gross (excl. tips). Tips are not taxable. */
    const brutOf = (o: (typeof completed)[0]) =>
      Math.max(0, money(o.total) - money(o.tipAmount));

    let revenue = 0;
    let taxTotal = 0;
    let subtotal = 0;
    let discountTotal = 0;
    let tipsTotal = 0;
    let refundTotal = 0;
    let cancelledTotal = 0;
    let covers = 0;
    const payments: Record<string, { count: number; total: number }> = {};
    const channels: Record<string, { count: number; total: number }> = {};
    const products = new Map<string, { name: string; qty: number; total: number }>();
    const staffMap = new Map<string, { name: string; count: number; total: number }>();
    const vatByChannel: Record<string, { brut: number; tva: number }> = {};

    for (const o of completed) {
      const tip = money(o.tipAmount);
      const brut = brutOf(o);
      const tax = money(o.taxAmount);
      revenue += brut;
      taxTotal += tax;
      subtotal += money(o.subtotal);
      discountTotal += money(o.discountAmount) + money(o.pointsDiscount);
      tipsTotal += tip;
      refundTotal += money(o.refundAmount);
      if (o.guestCount) covers += Number(o.guestCount) || 0;

      // Payment buckets: money received (incl. tips)
      const pm = String(o.paymentMethod || "other");
      payments[pm] = payments[pm] || { count: 0, total: 0 };
      payments[pm].count += 1;
      payments[pm].total += money(o.total);

      const ch = String(o.fulfillmentChannel || "takeaway");
      channels[ch] = channels[ch] || { count: 0, total: 0 };
      channels[ch].count += 1;
      channels[ch].total += brut;

      vatByChannel[ch] = vatByChannel[ch] || { brut: 0, tva: 0 };
      vatByChannel[ch]!.brut += brut;
      vatByChannel[ch]!.tva += tax;

      const staff = (o.staffName || "Unknown").trim() || "Unknown";
      const st = staffMap.get(staff) || { name: staff, count: 0, total: 0 };
      st.count += 1;
      st.total += brut;
      staffMap.set(staff, st);

      for (const item of o.items || []) {
        const key = item.productId || item.productName || "open";
        const name = item.productName || "Item";
        const cur = products.get(key) || { name, qty: 0, total: 0 };
        cur.qty += money(item.quantity);
        cur.total += money(item.totalPrice);
        products.set(key, cur);
      }
    }

    for (const o of cancelled) {
      cancelledTotal += money(o.total);
    }
    for (const o of refunded) {
      if (!completed.includes(o)) refundTotal += money(o.refundAmount || o.total);
    }

    const rateFor = (ch: string) => {
      if (ch === "dine_in") return rateDineIn;
      if (ch === "delivery") return rateDelivery;
      return rateTakeaway;
    };

    const vatRows = Object.entries(vatByChannel)
      .map(([ch, v]) => {
        const brut = round2(v.brut);
        const tva = round2(v.tva);
        const rate = rateFor(ch);
        return {
          label: `${channelLabel(ch)} ${rate.toFixed(1)}%`,
          channel: ch,
          rate,
          net: round2(brut - tva),
          tva,
          brut,
        };
      })
      .sort((a, b) => b.brut - a.brut);

    const netTotal = round2(revenue - taxTotal);
    const grandTotal = round2(revenue + tipsTotal);

    const productsSold = [...products.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 100)
      .map((p) => ({
        name: p.name,
        quantity: Math.round(p.qty * 1000) / 1000,
        total: round2(p.total),
      }));

    const userPerformance = [...staffMap.values()]
      .sort((a, b) => b.total - a.total)
      .map((u) => ({
        name: u.name,
        salesCount: u.count,
        total: round2(u.total),
      }));

    const orderTypeRows = Object.entries(channels).map(([channel, v]) => ({
      channel,
      label: channelLabel(channel),
      count: v.count,
      percent: completed.length
        ? round2((v.count / completed.length) * 100)
        : 0,
      total: round2(v.total),
    }));

    // Closed shifts overlapping the report period (for opening float / fond de base on EOD).
    const closedShifts = await db.query.posShifts.findMany({
      where: and(
        eq(schema.posShifts.merchantId, merchantId),
        eq(schema.posShifts.status, "closed"),
        gte(schema.posShifts.closedAt, range.start),
        lte(schema.posShifts.closedAt, range.end)
      ),
      orderBy: [desc(schema.posShifts.closedAt)],
    });

    const shiftCash = closedShifts.map((s) => ({
      openingFloat: round2(money(s.openingCash)),
      cashSales: round2(money(s.cashSales)),
      expectedCash: round2(money(s.expectedCash)),
      closingCashCounted:
        s.closingCashCounted != null ? round2(money(s.closingCashCounted)) : null,
      variance: s.variance != null ? round2(money(s.variance)) : null,
      staffName: s.staffName || null,
      openedAt: s.openedAt?.toISOString?.() ?? null,
      closedAt: s.closedAt?.toISOString?.() ?? null,
    }));

    return {
      range: {
        preset: opts.preset || "today",
        from: range.from,
        to: range.to,
        label: range.label,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      salesCount: completed.length,
      cancelledCount: cancelled.length,
      refundCount: refunded.length,
      /** Taxable revenue (tips excluded) */
      revenue: round2(revenue),
      subtotal: round2(subtotal),
      taxTotal: round2(taxTotal),
      netTotal,
      brutTotal: round2(revenue),
      discountTotal: round2(discountTotal),
      tipsTotal: round2(tipsTotal),
      refundTotal: round2(refundTotal),
      cancelledTotal: round2(cancelledTotal),
      /** Taxable revenue + tips */
      grandTotal,
      coversServed: covers || null,
      vatRows,
      paymentRows: Object.entries(payments).map(([method, v]) => ({
        method,
        count: v.count,
        total: round2(v.total),
        percent: grandTotal > 0 ? round2((v.total / grandTotal) * 100) : 0,
      })),
      channelRows: Object.entries(channels).map(([channel, v]) => ({
        channel,
        count: v.count,
        total: round2(v.total),
      })),
      orderTypeRows,
      productsSold,
      userPerformance,
      cashTotal: round2(payments.cash?.total || 0),
      cardTotal: round2(payments.card?.total || 0),
      terminalTotal: round2(payments.terminal?.total || 0),
      /** Opening float (fond de base) + drawer reconciliation per closed shift */
      shiftCash,
      businessName: merchant?.name || "",
    };
  }
}
