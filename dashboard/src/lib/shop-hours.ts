/** Client-side helpers for shop opening hours & schedule slots (Europe/Zurich). */

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type HoursSlot = { open: string; close: string };
export type ChannelHours = Partial<Record<DayKey, HoursSlot[]>>;
export type StoreHours = Partial<Record<'takeaway' | 'dine_in' | 'delivery', ChannelHours>>;
export type ShopChannel = 'takeaway' | 'dine_in' | 'delivery';

export const MERCHANT_TZ = 'Europe/Zurich';

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Sun: 'sun',
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
};

export function parseHm(hm: string): number {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Zurich wall-clock parts for a Date. */
export function zonedParts(at: Date, timeZone = MERCHANT_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const day = WEEKDAY_TO_KEY[map.weekday || 'Mon'] || 'mon';
  const hour = Number(map.hour === '24' ? '0' : map.hour || 0);
  const minute = Number(map.minute || 0);
  return {
    day,
    year: Number(map.year),
    month: Number(map.month),
    dayOfMonth: Number(map.day),
    hour,
    minute,
    mins: hour * 60 + minute,
  };
}

export function dayKeyOf(date: Date): DayKey {
  return zonedParts(date).day;
}

/**
 * Build a Date whose Zurich wall-clock equals y/m/d h:m.
 * Uses iterative offset correction (DST-safe enough for slot generation).
 */
export function zonedLocalDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  // Initial guess: treat as UTC then correct
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc));
    const asMins = p.hour * 60 + p.minute;
    const wantMins = hour * 60 + minute;
    const dayDiff =
      Date.UTC(p.year, p.month - 1, p.dayOfMonth) - Date.UTC(year, month - 1, day);
    const diffMins = dayDiff / 60000 + (asMins - wantMins);
    utc -= diffMins * 60_000;
  }
  return new Date(utc);
}

/** Local datetime-local string in Zurich: YYYY-MM-DDTHH:mm */
export function toZurichDateTimeValue(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.dayOfMonth)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function addCalendarDaysZurich(from: Date, days: number): { year: number; month: number; day: number } {
  const p = zonedParts(from);
  // noon UTC-ish to avoid DST edge when advancing calendar days
  const base = zonedLocalDate(p.year, p.month, p.dayOfMonth, 12, 0);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const n = zonedParts(next);
  return { year: n.year, month: n.month, day: n.dayOfMonth };
}

export function isChannelOpenAt(
  storeHours: StoreHours | null | undefined,
  channel: ShopChannel,
  at: Date = new Date()
): { open: boolean; todayLabel: string; slots: HoursSlot[] } {
  const { day, mins } = zonedParts(at);
  const channelHours = storeHours?.[channel] || {};
  const slots = channelHours[day] || [];
  const open =
    slots.length > 0 &&
    slots.some((s) => {
      const a = parseHm(s.open);
      const b = parseHm(s.close);
      if (b >= a) return mins >= a && mins < b;
      return mins >= a || mins < b;
    });
  const todayLabel =
    slots.length === 0 ? 'Closed today' : slots.map((s) => `${s.open}–${s.close}`).join(', ');
  return { open, todayLabel, slots };
}

export type ScheduleDayOption = {
  offset: number;
  label: string;
  weekday: string;
  dateLabel: string;
  slots: Array<{ value: string; label: string }>;
};

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === 2) return 'Day after tomorrow';
  return `+${offset} days`;
}

/**
 * Build schedule days (today → +horizonDays) with 15-min slots inside opening hours (Zurich).
 * Today only includes slots after `now + leadMinutes`.
 */
export function buildScheduleDays(opts: {
  storeHours: StoreHours | null | undefined;
  channel: ShopChannel;
  now?: Date;
  leadMinutes?: number;
  intervalMinutes?: number;
  horizonDays?: number;
  locale?: string;
}): ScheduleDayOption[] {
  const now = opts.now || new Date();
  const lead = opts.leadMinutes ?? 30;
  const interval = opts.intervalMinutes ?? 15;
  const horizon = opts.horizonDays ?? 2;
  const locale = opts.locale || 'en-CH';
  const channelHours = opts.storeHours?.[opts.channel] || {};
  const earliest = new Date(now.getTime() + lead * 60_000);

  const days: ScheduleDayOption[] = [];

  for (let offset = 0; offset <= horizon; offset++) {
    const cal = addCalendarDaysZurich(now, offset);
    const noon = zonedLocalDate(cal.year, cal.month, cal.day, 12, 0);
    const dayKey = zonedParts(noon).day;
    const ranges = channelHours[dayKey] || [];
    if (!ranges.length) continue;

    const slots: Array<{ value: string; label: string }> = [];

    for (const range of ranges) {
      const openMin = parseHm(range.open);
      const closeMin = parseHm(range.close);
      if (!Number.isFinite(openMin) || !Number.isFinite(closeMin) || closeMin <= openMin) continue;

      for (let m = openMin; m + interval <= closeMin; m += interval) {
        const slot = zonedLocalDate(cal.year, cal.month, cal.day, Math.floor(m / 60), m % 60);
        if (slot < earliest) continue;
        slots.push({
          value: toZurichDateTimeValue(slot),
          label: `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`,
        });
      }
    }

    if (!slots.length) continue;

    days.push({
      offset,
      label: dayLabel(offset),
      weekday: noon.toLocaleDateString(locale, { weekday: 'short', timeZone: MERCHANT_TZ }),
      dateLabel: noon.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: MERCHANT_TZ }),
      slots,
    });
  }

  return days;
}

/** Convert Zurich datetime-local value to ISO string for API. */
export function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, d, h, mi] = m;
  return zonedLocalDate(Number(y), Number(mo), Number(d), Number(h), Number(mi)).toISOString();
}
