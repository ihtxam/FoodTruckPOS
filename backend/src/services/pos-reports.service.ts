import { getDb, schema } from "@/db";
import { and, eq, gte, lte, desc } from "drizzle-orm";

export type ReportPreset = "today" | "yesterday" | "last_week" | "last_month" | "custom";

function zurichDayBounds(ymd: string): { start: Date; end: Date } {
  // Treat YYYY-MM-DD as Europe/Zurich calendar day via UTC offset approximation (+02/+01).
  // Use noon UTC parse then local day - more reliable: construct with explicit timezone via Temporal if available.
  const start = new Date(`${ymd}T00:00:00+02:00`);
  const end = new Date(`${ymd}T23:59:59.999+02:00`);
  // Correct for CET (winter): if offset wrong by 1h it's still within report window for practical POS use.
  // Prefer Intl to get Zurich offset for that date:
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
    // Find UTC instant that is 00:00 Zurich on ymd
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
    return { start: a.start, end: b.end, label: `${f} ? ${t}`, from: f, to: t };
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
    return { start: a.start, end: b.end, label: `${f} ? ${today}`, from: f, to: today };
  }
  if (preset === "last_month") {
    const f = addDaysYmd(today, -29);
    const a = zurichDayBounds(f);
    const b = zurichDayBounds(today);
    return { start: a.start, end: b.end, label: `${f} ? ${today}`, from: f, to: today };
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

    const money = (n: unknown) => Number(n) || 0;
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

    for (const o of completed) {
      const total = money(o.total);
      revenue += total;
      taxTotal += money(o.taxAmount);
      subtotal += money(o.subtotal);
      discountTotal += money(o.discountAmount) + money(o.pointsDiscount);
      tipsTotal += money(o.tipAmount);
      refundTotal += money(o.refundAmount);
      if (o.guestCount) covers += Number(o.guestCount) || 0;

      const pm = String(o.paymentMethod || "other");
      payments[pm] = payments[pm] || { count: 0, total: 0 };
      payments[pm].count += 1;
      payments[pm].total += total;

      const ch = String(o.fulfillmentChannel || "takeaway");
      channels[ch] = channels[ch] || { count: 0, total: 0 };
      channels[ch].count += 1;
      channels[ch].total += total;

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

    const productsSold = [...products.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 100)
      .map((p) => ({
        name: p.name,
        quantity: Math.round(p.qty * 1000) / 1000,
        total: Math.round(p.total * 100) / 100,
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
      revenue: Math.round(revenue * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      tipsTotal: Math.round(tipsTotal * 100) / 100,
      refundTotal: Math.round(refundTotal * 100) / 100,
      cancelledTotal: Math.round(cancelledTotal * 100) / 100,
      grandTotal: Math.round((revenue - refundTotal) * 100) / 100,
      coversServed: covers || null,
      paymentRows: Object.entries(payments).map(([method, v]) => ({
        method,
        count: v.count,
        total: Math.round(v.total * 100) / 100,
      })),
      channelRows: Object.entries(channels).map(([channel, v]) => ({
        channel,
        count: v.count,
        total: Math.round(v.total * 100) / 100,
      })),
      productsSold,
      cashTotal: Math.round((payments.cash?.total || 0) * 100) / 100,
      cardTotal: Math.round((payments.card?.total || 0) * 100) / 100,
      terminalTotal: Math.round((payments.terminal?.total || 0) * 100) / 100,
    };
  }
}
