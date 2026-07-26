/** Point-in-polygon (ray casting). Ring is [lng, lat][]. */
export function pointInPolygon(lng: number, lat: number, ring: Array<[number, number]>): boolean {
  if (!ring?.length || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function normalizeRing(ring: Array<[number, number]>): Array<[number, number]> {
  if (!ring?.length) return [];
  const cleaned = ring
    .map(([a, b]) => [Number(a), Number(b)] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (cleaned.length < 3) return cleaned;
  const [fLng, fLat] = cleaned[0];
  const [lLng, lLat] = cleaned[cleaned.length - 1];
  if (fLng !== lLng || fLat !== lLat) {
    cleaned.push([fLng, fLat]);
  }
  return cleaned;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type DayKey = (typeof DAY_KEYS)[number];
export type HoursSlot = { open: string; close: string };
export type ChannelHours = Partial<Record<DayKey, HoursSlot[]>>;
/** `display` = homepage / shop banner hours (informational). Order channels gate checkout. */
export type StoreHoursChannel = "takeaway" | "dine_in" | "delivery" | "display";
export type StoreHours = Partial<Record<StoreHoursChannel, ChannelHours>>;

/** Merchants are CH-based; evaluate hours in Zurich wall-clock, not server UTC. */
export const MERCHANT_TZ = "Europe/Zurich";

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function zonedDayAndMinutes(at: Date, timeZone = MERCHANT_TZ): { day: DayKey; mins: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const day = WEEKDAY_TO_KEY[map.weekday || "Mon"] || "mon";
  const hour = Number(map.hour === "24" ? "0" : map.hour || 0);
  const minute = Number(map.minute || 0);
  return { day, mins: hour * 60 + minute };
}

/** Is the channel open at `at` in merchant timezone (Europe/Zurich). */
export function isChannelOpenNow(
  storeHours: StoreHours | null | undefined,
  channel: StoreHoursChannel,
  at: Date = new Date()
): { open: boolean; todayLabel: string; slots: HoursSlot[] } {
  const { day, mins } = zonedDayAndMinutes(at);
  const channelHours = storeHours?.[channel] || {};
  const slots = channelHours[day] || [];
  const open =
    slots.length > 0 &&
    slots.some((s) => {
      const a = parseHm(s.open);
      const b = parseHm(s.close);
      if (b >= a) return mins >= a && mins < b;
      // overnight e.g. 22:00-02:00
      return mins >= a || mins < b;
    });
  const todayLabel =
    slots.length === 0 ? "Closed today" : slots.map((s) => `${s.open}-${s.close}`).join(", ");
  return { open: slots.length === 0 ? false : open, todayLabel, slots };
}

/**
 * Homepage / shop banner hours. Prefers `display`, else falls back to the active order channel.
 */
export function getDisplayHoursNow(
  storeHours: StoreHours | null | undefined,
  fallbackChannel: "takeaway" | "dine_in" | "delivery" = "takeaway",
  at: Date = new Date()
) {
  if (storeHours?.display && Object.keys(storeHours.display).length) {
    return isChannelOpenNow(storeHours, "display", at);
  }
  return isChannelOpenNow(storeHours, fallbackChannel, at);
}

/** True if `at` falls inside any opening range for that channel/day (Zurich time). */
export function isWithinChannelHours(
  storeHours: StoreHours | null | undefined,
  channel: "takeaway" | "dine_in" | "delivery",
  at: Date
): boolean {
  return isChannelOpenNow(storeHours, channel, at).open;
}

export function defaultStoreHours(): StoreHours {
  const lunchDinner: HoursSlot[] = [
    { open: "11:00", close: "14:00" },
    { open: "17:00", close: "23:00" },
  ];
  const week = (): ChannelHours => ({
    mon: lunchDinner.map((s) => ({ ...s })),
    tue: lunchDinner.map((s) => ({ ...s })),
    wed: lunchDinner.map((s) => ({ ...s })),
    thu: lunchDinner.map((s) => ({ ...s })),
    fri: lunchDinner.map((s) => ({ ...s })),
    sat: lunchDinner.map((s) => ({ ...s })),
    sun: lunchDinner.map((s) => ({ ...s })),
  });
  const w = week();
  return {
    takeaway: week(),
    dine_in: week(),
    delivery: week(),
    display: w,
  };
}
