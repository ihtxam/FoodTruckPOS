import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema, type ReservationSettings, type ReservationStatus } from "@/db";
import {
  MERCHANT_TZ,
  type ChannelHours,
  type DayKey,
  type HoursSlot,
  type StoreHours,
  parseHm,
} from "@/lib/geo";
import { EmailService } from "@/services/email.service";
import { FloorPlanService } from "@/services/floor-plan.service";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULT_RESERVATION_SETTINGS: Required<
  Omit<ReservationSettings, "maxCoversPerSlot" | "policiesText">
> & {
  maxCoversPerSlot: number | null;
  policiesText: string | null;
} = {
  dineInHoursMode: "same_as_takeaway",
  slotIntervalMinutes: 30,
  seatingDurationMinutes: 90,
  bufferMinutes: 15,
  minPartySize: 1,
  maxPartySize: 12,
  minHoursBefore: 2,
  maxDaysAhead: 30,
  autoAccept: false,
  sendConfirmationEmail: true,
  sendStatusEmails: true,
  maxCoversPerSlot: null,
  policiesText: null,
};

const ACTIVE_STATUSES: ReservationStatus[] = ["pending", "confirmed", "seated"];

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function normalizeReservationSettings(
  raw: ReservationSettings | null | undefined
): typeof DEFAULT_RESERVATION_SETTINGS {
  const s = raw || {};
  return {
    dineInHoursMode: s.dineInHoursMode === "custom" ? "custom" : "same_as_takeaway",
    slotIntervalMinutes: [15, 30, 45, 60].includes(Number(s.slotIntervalMinutes))
      ? Number(s.slotIntervalMinutes)
      : DEFAULT_RESERVATION_SETTINGS.slotIntervalMinutes,
    seatingDurationMinutes: clampInt(s.seatingDurationMinutes, 30, 360, 90),
    bufferMinutes: clampInt(s.bufferMinutes, 0, 120, 15),
    minPartySize: clampInt(s.minPartySize, 1, 50, 1),
    maxPartySize: clampInt(s.maxPartySize, 1, 100, 12),
    minHoursBefore: clampInt(s.minHoursBefore, 0, 72, 2),
    maxDaysAhead: clampInt(s.maxDaysAhead, 1, 180, 30),
    autoAccept: s.autoAccept !== false && s.autoAccept !== undefined ? !!s.autoAccept : !!s.autoAccept,
    sendConfirmationEmail: s.sendConfirmationEmail !== false,
    sendStatusEmails: s.sendStatusEmails !== false,
    maxCoversPerSlot:
      s.maxCoversPerSlot == null || Number(s.maxCoversPerSlot) <= 0
        ? null
        : clampInt(s.maxCoversPerSlot, 1, 500, 40),
    policiesText: s.policiesText?.trim() || null,
  };
}

/** Fix autoAccept default: when undefined, false (manual confirmation). */
export function resolveSettings(raw: ReservationSettings | null | undefined) {
  const n = normalizeReservationSettings(raw);
  if (raw?.autoAccept === undefined) n.autoAccept = false;
  return n;
}

function copyWeek(src: ChannelHours | undefined): ChannelHours {
  const out: ChannelHours = {};
  for (const d of DAY_KEYS) {
    const slots = src?.[d];
    if (slots?.length) out[d] = slots.map((s) => ({ open: s.open, close: s.close }));
  }
  return out;
}

export function resolveDineInHours(
  storeHours: StoreHours | null | undefined,
  settings: ReturnType<typeof resolveSettings>
): ChannelHours {
  if (settings.dineInHoursMode === "same_as_takeaway") {
    return copyWeek(storeHours?.takeaway || storeHours?.dine_in);
  }
  const custom = storeHours?.dine_in;
  if (custom && Object.keys(custom).length) return copyWeek(custom);
  return copyWeek(storeHours?.takeaway);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function zurichParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MERCHANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
  };
}

/** Build a Date for a Zurich wall-clock YYYY-MM-DD + HH:mm */
export function zurichLocalToDate(dateStr: string, hm: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  // Approximate via iterative offset (Zurich DST-safe enough for booking)
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  for (let i = 0; i < 3; i++) {
    const p = zurichParts(guess);
    const want = Date.UTC(y, mo - 1, d, hh, mm);
    const got = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute);
    guess.setTime(guess.getTime() + (want - got));
  }
  return guess;
}

function formatZurichDate(at: Date): string {
  const p = zurichParts(at);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

function formatZurichHm(at: Date): string {
  const p = zurichParts(at);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function dayKeyForYmd(ymd: string): DayKey {
  const noon = zurichLocalToDate(ymd, "12:00");
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return DAY_KEYS[map[short] ?? 0];
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function makeCode() {
  return `RES-${Date.now().toString(36).toUpperCase().slice(-6)}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

async function getMerchant(merchantId: string) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });
  if (!merchant) throw new Error("Merchant not found");
  return merchant;
}

export class ReservationService {
  static getSettingsForMerchant(merchant: {
    reservationsEnabled?: boolean | null;
    reservationSettings?: ReservationSettings | null;
    storeHours?: StoreHours | null;
    dineInEnabled?: boolean | null;
    name?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  }) {
    const settings = resolveSettings(merchant.reservationSettings);
    const hours = resolveDineInHours(merchant.storeHours as StoreHours, settings);
    return {
      enabled: !!merchant.reservationsEnabled,
      dineInEnabled: merchant.dineInEnabled !== false,
      settings,
      hours,
      shopName: merchant.name || "Restaurant",
      address: [merchant.address, merchant.city].filter(Boolean).join(", "),
      phone: merchant.phone || null,
      email: merchant.email || null,
    };
  }

  static async getConfig(merchantId: string) {
    const merchant = await getMerchant(merchantId);
    return this.getSettingsForMerchant(merchant);
  }

  static async updateSettings(
    merchantId: string,
    input: {
      enabled?: boolean;
      settings?: Partial<ReservationSettings>;
      /** Optional: write custom dine_in hours when mode is custom */
      dineInHours?: ChannelHours;
      storeHoursPatch?: boolean;
    }
  ) {
    const db = getDb();
    const merchant = await getMerchant(merchantId);
    const current = resolveSettings(merchant.reservationSettings);
    const nextSettings = resolveSettings({
      ...current,
      ...(input.settings || {}),
    });

    const storeHours = {
      ...((merchant.storeHours || {}) as StoreHours),
    } as StoreHours;

    if (input.dineInHours && nextSettings.dineInHoursMode === "custom") {
      storeHours.dine_in = copyWeek(input.dineInHours);
    } else if (nextSettings.dineInHoursMode === "same_as_takeaway") {
      // Keep dine_in in sync with takeaway for POS/display consistency
      storeHours.dine_in = copyWeek(storeHours.takeaway);
    }

    const [updated] = await db
      .update(schema.merchants)
      .set({
        reservationsEnabled: input.enabled !== undefined ? !!input.enabled : merchant.reservationsEnabled,
        reservationSettings: nextSettings,
        storeHours,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId))
      .returning();

    return this.getSettingsForMerchant(updated);
  }

  static async totalTableCapacity(merchantId: string) {
    const tables = await FloorPlanService.listTablesForSync(merchantId);
    return tables.reduce((s, t) => s + Math.max(0, Number(t.capacity) || 0), 0);
  }

  static async listOverlapping(
    merchantId: string,
    start: Date,
    end: Date,
    excludeId?: string
  ) {
    const db = getDb();
    const rows = await db.query.reservations.findMany({
      where: and(
        eq(schema.reservations.merchantId, merchantId),
        inArray(schema.reservations.status, ACTIVE_STATUSES),
        // reservedAt within a wide window; filter in JS for duration overlap
        gte(schema.reservations.reservedAt, new Date(start.getTime() - 8 * 3600_000)),
        lte(schema.reservations.reservedAt, new Date(end.getTime() + 8 * 3600_000))
      ),
    });
    return rows.filter((r) => {
      if (excludeId && r.id === excludeId) return false;
      const rStart = new Date(r.reservedAt).getTime();
      const rEnd = rStart + (Number(r.durationMinutes) || 90) * 60_000;
      return rangesOverlap(start.getTime(), end.getTime(), rStart, rEnd);
    });
  }

  static async getSlots(merchantId: string, dateYmd: string, partySize: number) {
    const cfg = await this.getConfig(merchantId);
    if (!cfg.enabled) throw new Error("Reservations are not enabled");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) throw new Error("Invalid date");

    const settings = cfg.settings;
    const size = clampInt(partySize, settings.minPartySize, settings.maxPartySize, 2);
    if (size < settings.minPartySize || size > settings.maxPartySize) {
      throw new Error(`Party size must be between ${settings.minPartySize} and ${settings.maxPartySize}`);
    }

    const day = dayKeyForYmd(dateYmd);
    const daySlots: HoursSlot[] = cfg.hours[day] || [];
    if (!daySlots.length) {
      return { date: dateYmd, partySize: size, slots: [] as Array<{ time: string; available: boolean; remainingCovers: number }> };
    }

    const tableCap = await this.totalTableCapacity(merchantId);
    const maxCovers =
      settings.maxCoversPerSlot != null && settings.maxCoversPerSlot > 0
        ? settings.maxCoversPerSlot
        : tableCap > 0
          ? tableCap
          : 40;

    const interval = settings.slotIntervalMinutes;
    const duration = settings.seatingDurationMinutes;
    const buffer = settings.bufferMinutes;
    const now = new Date();
    const minStart = new Date(now.getTime() + settings.minHoursBefore * 3600_000);
    const maxDate = addDaysYmd(formatZurichDate(now), settings.maxDaysAhead);
    if (dateYmd > maxDate) {
      return { date: dateYmd, partySize: size, slots: [] };
    }

    // Load day's active reservations once
    const dayStart = zurichLocalToDate(dateYmd, "00:00");
    const dayEnd = zurichLocalToDate(addDaysYmd(dateYmd, 1), "00:00");
    const overlapping = await this.listOverlapping(merchantId, dayStart, dayEnd);

    const slots: Array<{ time: string; available: boolean; remainingCovers: number }> = [];

    for (const range of daySlots) {
      let cursor = parseHm(range.open);
      const close = parseHm(range.close);
      const endBound = close >= cursor ? close : close + 24 * 60;
      while (cursor + 1 < endBound) {
        const minsOfDay = cursor % (24 * 60);
        const hm = `${pad2(Math.floor(minsOfDay / 60))}:${pad2(minsOfDay % 60)}`;
        // Slot must finish seating before close (best-effort)
        const slotStart = zurichLocalToDate(dateYmd, hm);
        // If overnight and mins rolled past midnight, date may need +1 — keep simple: only generate within open<=close same day for now
        if (close < parseHm(range.open)) {
          // overnight: still generate until midnight then skip (rare for restaurants)
        }
        if (slotStart.getTime() <= now.getTime() || slotStart < minStart) {
          cursor += interval;
          continue;
        }
        const slotEnd = new Date(slotStart.getTime() + (duration + buffer) * 60_000);
        const used = overlapping
          .filter((r) => {
            const rStart = new Date(r.reservedAt).getTime();
            const rEnd = rStart + ((Number(r.durationMinutes) || duration) + buffer) * 60_000;
            return rangesOverlap(slotStart.getTime(), slotEnd.getTime(), rStart, rEnd);
          })
          .reduce((s, r) => s + (Number(r.partySize) || 0), 0);
        const remaining = Math.max(0, maxCovers - used);
        slots.push({
          time: hm,
          available: remaining >= size,
          remainingCovers: remaining,
        });
        cursor += interval;
      }
    }

    return { date: dateYmd, partySize: size, slots, settings: {
      slotIntervalMinutes: interval,
      seatingDurationMinutes: duration,
      bufferMinutes: buffer,
      minHoursBefore: settings.minHoursBefore,
      maxDaysAhead: settings.maxDaysAhead,
    }};
  }

  static async create(
    merchantId: string,
    input: {
      guestName: string;
      guestEmail?: string | null;
      guestPhone: string;
      partySize: number;
      reservedAt: Date | string;
      notes?: string | null;
      source?: string;
      customerId?: string | null;
      tableId?: string | null;
      status?: ReservationStatus;
      skipSlotCheck?: boolean;
    }
  ) {
    const db = getDb();
    const merchant = await getMerchant(merchantId);
    const cfg = this.getSettingsForMerchant(merchant);
    if (!cfg.enabled && input.source === "web") {
      throw new Error("Reservations are not enabled");
    }
    const settings = cfg.settings;
    const name = (input.guestName || "").trim().slice(0, 200);
    const phone = (input.guestPhone || "").trim().slice(0, 50);
    const email = input.guestEmail?.trim().toLowerCase().slice(0, 255) || null;
    if (!name) throw new Error("Guest name is required");
    if (!phone) throw new Error("Phone is required");
    const partySize = clampInt(input.partySize, settings.minPartySize, settings.maxPartySize, 2);
    if (partySize < settings.minPartySize || partySize > settings.maxPartySize) {
      throw new Error(`Party size must be between ${settings.minPartySize} and ${settings.maxPartySize}`);
    }

    const reservedAt = input.reservedAt instanceof Date ? input.reservedAt : new Date(input.reservedAt);
    if (Number.isNaN(reservedAt.getTime())) throw new Error("Invalid reservation time");

    if (input.source === "web" || !input.skipSlotCheck) {
      const dateYmd = formatZurichDate(reservedAt);
      const hm = formatZurichHm(reservedAt);
      const slotRes = await this.getSlots(merchantId, dateYmd, partySize);
      const match = slotRes.slots.find((s) => s.time === hm && s.available);
      if (!match) throw new Error("Selected time is not available");
      const minStart = new Date(Date.now() + settings.minHoursBefore * 3600_000);
      if (reservedAt < minStart) {
        throw new Error(`Please book at least ${settings.minHoursBefore} hour(s) in advance`);
      }
    }

    let status: ReservationStatus =
      input.status ||
      (settings.autoAccept || input.source === "dashboard" || input.source === "pos" || input.source === "phone"
        ? "confirmed"
        : "pending");
    if (input.source === "web") {
      status = settings.autoAccept ? "confirmed" : "pending";
    }

    let tableId = input.tableId || null;
    let tableLabel: string | null = null;
    if (tableId) {
      const tables = await FloorPlanService.listTablesForSync(merchantId);
      const table = tables.find((t) => t.id === tableId);
      if (!table) throw new Error("Table not found");
      if (Number(table.capacity) < partySize) throw new Error("Table is too small for this party");
      tableLabel = table.label;
    }

    const durationMinutes = settings.seatingDurationMinutes;
    const [row] = await db
      .insert(schema.reservations)
      .values({
        merchantId,
        code: makeCode(),
        customerId: input.customerId || null,
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        partySize,
        reservedAt,
        durationMinutes,
        status,
        tableId,
        tableLabel,
        notes: input.notes?.trim() || null,
        source: input.source || "web",
        acceptedAt: status === "confirmed" ? new Date() : null,
      })
      .returning();

    if (tableId && (status === "confirmed" || status === "pending")) {
      try {
        await FloorPlanService.setTableStatus(merchantId, tableId, "reserved");
      } catch {
        /* non-fatal */
      }
    }

    if (settings.sendConfirmationEmail && email) {
      await this.sendLifecycleEmail(merchant, row, status === "confirmed" ? "confirmed" : "received");
    }

    return row;
  }

  static async list(
    merchantId: string,
    opts: {
      from?: Date;
      to?: Date;
      status?: string;
      limit?: number;
    } = {}
  ) {
    const db = getDb();
    const conditions = [eq(schema.reservations.merchantId, merchantId)];
    if (opts.from) conditions.push(gte(schema.reservations.reservedAt, opts.from));
    if (opts.to) conditions.push(lte(schema.reservations.reservedAt, opts.to));
    if (opts.status && opts.status !== "all") {
      conditions.push(eq(schema.reservations.status, opts.status));
    }
    return db.query.reservations.findMany({
      where: and(...conditions),
      orderBy: [asc(schema.reservations.reservedAt)],
      limit: Math.min(500, opts.limit || 200),
    });
  }

  static async listForSync(merchantId: string) {
    const now = new Date();
    const from = new Date(now.getTime() - 6 * 3600_000);
    const to = new Date(now.getTime() + 48 * 3600_000);
    return this.list(merchantId, {
      from,
      to,
      limit: 100,
    }).then((rows) =>
      rows.filter((r) => ACTIVE_STATUSES.includes(r.status as ReservationStatus) || r.status === "pending")
    );
  }

  static async get(merchantId: string, id: string) {
    const db = getDb();
    const row = await db.query.reservations.findFirst({
      where: and(eq(schema.reservations.id, id), eq(schema.reservations.merchantId, merchantId)),
    });
    if (!row) throw new Error("Reservation not found");
    return row;
  }

  static async action(
    merchantId: string,
    id: string,
    action:
      | "accept"
      | "reject"
      | "seat"
      | "complete"
      | "cancel"
      | "no_show"
      | "assign_table"
      | "unassign_table",
    payload: { tableId?: string | null; internalNotes?: string | null } = {}
  ) {
    const db = getDb();
    const merchant = await getMerchant(merchantId);
    const current = await this.get(merchantId, id);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    let emailKind: "confirmed" | "rejected" | "cancelled" | "seated" | null = null;

    if (payload.internalNotes !== undefined) {
      patch.internalNotes = payload.internalNotes;
    }

    switch (action) {
      case "accept":
        if (!["pending", "rejected"].includes(current.status)) {
          throw new Error("Only pending reservations can be accepted");
        }
        patch.status = "confirmed";
        patch.acceptedAt = new Date();
        emailKind = "confirmed";
        break;
      case "reject":
        if (current.status !== "pending") throw new Error("Only pending reservations can be rejected");
        patch.status = "rejected";
        patch.cancelledAt = new Date();
        emailKind = "rejected";
        break;
      case "seat":
        if (!["confirmed", "pending"].includes(current.status)) {
          throw new Error("Cannot seat this reservation");
        }
        patch.status = "seated";
        patch.seatedAt = new Date();
        if (current.tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "occupied");
          } catch {
            /* ignore */
          }
        }
        break;
      case "complete":
        patch.status = "completed";
        if (current.tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "dirty");
          } catch {
            /* ignore */
          }
        }
        break;
      case "cancel":
        patch.status = "cancelled";
        patch.cancelledAt = new Date();
        emailKind = "cancelled";
        if (current.tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
          } catch {
            /* ignore */
          }
          patch.tableId = null;
          patch.tableLabel = null;
        }
        break;
      case "no_show":
        patch.status = "no_show";
        if (current.tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
          } catch {
            /* ignore */
          }
        }
        break;
      case "assign_table": {
        const tableId = payload.tableId;
        if (!tableId) throw new Error("tableId required");
        const tables = await FloorPlanService.listTablesForSync(merchantId);
        const table = tables.find((t) => t.id === tableId);
        if (!table) throw new Error("Table not found");
        if (Number(table.capacity) < current.partySize) {
          throw new Error("Table is too small for this party");
        }
        if (current.tableId && current.tableId !== tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
          } catch {
            /* ignore */
          }
        }
        patch.tableId = tableId;
        patch.tableLabel = table.label;
        if (["confirmed", "pending"].includes(current.status)) {
          try {
            await FloorPlanService.setTableStatus(merchantId, tableId, "reserved");
          } catch {
            /* ignore */
          }
        }
        break;
      }
      case "unassign_table":
        if (current.tableId) {
          try {
            await FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
          } catch {
            /* ignore */
          }
        }
        patch.tableId = null;
        patch.tableLabel = null;
        break;
      default:
        throw new Error("Unknown action");
    }

    const [updated] = await db
      .update(schema.reservations)
      .set(patch)
      .where(and(eq(schema.reservations.id, id), eq(schema.reservations.merchantId, merchantId)))
      .returning();

    const settings = resolveSettings(merchant.reservationSettings);
    if (emailKind && settings.sendStatusEmails && updated.guestEmail) {
      await this.sendLifecycleEmail(merchant, updated, emailKind);
    }

    return updated;
  }

  static async sendLifecycleEmail(
    merchant: { name?: string | null; address?: string | null; city?: string | null; phone?: string | null },
    reservation: typeof schema.reservations.$inferSelect,
    kind: "received" | "confirmed" | "rejected" | "cancelled" | "seated"
  ) {
    if (!reservation.guestEmail) return;
    if (!(await EmailService.isConfigured())) return;

    const when = new Date(reservation.reservedAt).toLocaleString("en-CH", {
      timeZone: MERCHANT_TZ,
      dateStyle: "full",
      timeStyle: "short",
    });
    const shop = merchant.name || "Restaurant";
    const place = [merchant.address, merchant.city].filter(Boolean).join(", ");
    const subjects: Record<typeof kind, string> = {
      received: `Reservation request received — ${shop}`,
      confirmed: `Reservation confirmed — ${shop}`,
      rejected: `Reservation not available — ${shop}`,
      cancelled: `Reservation cancelled — ${shop}`,
      seated: `Welcome — ${shop}`,
    };
    const bodies: Record<typeof kind, string> = {
      received: `We received your reservation request and will confirm shortly.`,
      confirmed: `Your table is confirmed. We look forward to seeing you!`,
      rejected: `Unfortunately we cannot accommodate this reservation. Please try another time.`,
      cancelled: `Your reservation has been cancelled.`,
      seated: `Welcome! Your table is ready.`,
    };

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${subjects[kind]}</h1>
        <p>${bodies[kind]}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">Code</td><td style="padding:6px 0;text-align:right"><strong>${reservation.code}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">When</td><td style="padding:6px 0;text-align:right">${when}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Guests</td><td style="padding:6px 0;text-align:right">${reservation.partySize}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Name</td><td style="padding:6px 0;text-align:right">${reservation.guestName}</td></tr>
          ${reservation.tableLabel ? `<tr><td style="padding:6px 0;color:#78716c">Table</td><td style="padding:6px 0;text-align:right">${reservation.tableLabel}</td></tr>` : ""}
          ${place ? `<tr><td style="padding:6px 0;color:#78716c">Where</td><td style="padding:6px 0;text-align:right">${place}</td></tr>` : ""}
        </table>
        ${merchant.phone ? `<p style="font-size:13px;color:#78716c">Questions? Call ${merchant.phone}</p>` : ""}
      </div>
    `;

    try {
      await EmailService.send({
        to: reservation.guestEmail,
        subject: subjects[kind],
        html,
        text: `${subjects[kind]}\n${bodies[kind]}\nCode: ${reservation.code}\nWhen: ${when}\nGuests: ${reservation.partySize}`,
      });
      const db = getDb();
      await db
        .update(schema.reservations)
        .set({ confirmationSentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.reservations.id, reservation.id));
    } catch (err) {
      console.error("[reservations] email failed", err);
    }
  }
}
