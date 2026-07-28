import type { LocalizedText, VacationPeriod, VacationSettings } from "@/db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Calendar date YYYY-MM-DD in Europe/Zurich. */
export function ymdZurich(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** HH:mm in Europe/Zurich. */
export function hmZurich(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

function normalizeTime(raw: unknown, fallback: string): string {
  const t = String(raw || "").trim().slice(0, 5);
  if (TIME_RE.test(t)) return t;
  return fallback;
}

export function normalizeLocalizedText(
  raw: LocalizedText | string | null | undefined
): LocalizedText | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim().slice(0, 500);
    return s ? { en: s, fr: s, de: s } : null;
  }
  if (typeof raw !== "object") return null;
  const en = raw.en != null ? String(raw.en).trim().slice(0, 500) : "";
  const fr = raw.fr != null ? String(raw.fr).trim().slice(0, 500) : "";
  const de = raw.de != null ? String(raw.de).trim().slice(0, 500) : "";
  if (!en && !fr && !de) return null;
  return {
    en: en || null,
    fr: fr || null,
    de: de || null,
  };
}

export function resolveLocalized(
  raw: LocalizedText | string | null | undefined,
  locale: string,
  fallback = ""
): string {
  if (raw == null) return fallback;
  if (typeof raw === "string") return raw.trim() || fallback;
  const lang = (locale || "en").toLowerCase().slice(0, 2);
  const pick =
    (raw as LocalizedText)[lang as keyof LocalizedText] ||
    raw.en ||
    raw.fr ||
    raw.de ||
    "";
  return String(pick || "").trim() || fallback;
}

/** Master switch: schedules only apply when enabled. */
export function isVacationEnabled(raw: VacationSettings | null | undefined): boolean {
  if (!raw || typeof raw !== "object") return false;
  if (raw.enabled !== undefined) return !!raw.enabled;
  // Legacy: old "Closed for holidays right now" flag
  return !!raw.manualActive;
}

export function normalizeVacationSettings(
  raw: VacationSettings | null | undefined
): VacationSettings {
  const periods: VacationPeriod[] = [];
  const list = Array.isArray(raw?.periods) ? raw!.periods! : [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const startDate = String(p.startDate || "").slice(0, 10);
    const endDate = String(p.endDate || "").slice(0, 10);
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) continue;
    if (endDate < startDate) continue;
    const startTime = normalizeTime(p.startTime, "00:00");
    const endTime = normalizeTime(p.endTime, "23:59");
    if (startDate === endDate && endTime < startTime) continue;
    periods.push({
      id: String(p.id || `${startDate}-${endDate}`),
      startDate,
      startTime,
      endDate,
      endTime,
      title: normalizeLocalizedText(p.title),
    });
  }
  periods.sort((a, b) => {
    const c = a.startDate.localeCompare(b.startDate);
    if (c !== 0) return c;
    return String(a.startTime || "").localeCompare(String(b.startTime || ""));
  });
  const popupImageUrl =
    raw?.popupImageUrl != null && String(raw.popupImageUrl).trim()
      ? String(raw.popupImageUrl).trim().slice(0, 500)
      : null;
  return {
    enabled: isVacationEnabled(raw),
    popupImageUrl,
    popupTitle: normalizeLocalizedText(raw?.popupTitle),
    message: normalizeLocalizedText(raw?.message),
    periods,
  };
}

function periodContainsDateTime(period: VacationPeriod, at: Date): boolean {
  const ymd = ymdZurich(at);
  const hm = hmZurich(at);
  const start = `${period.startDate}T${normalizeTime(period.startTime, "00:00")}`;
  const end = `${period.endDate}T${normalizeTime(period.endTime, "23:59")}`;
  const cur = `${ymd}T${hm}`;
  return cur >= start && cur <= end;
}

export function findActiveVacationPeriod(
  raw: VacationSettings | null | undefined,
  at: Date = new Date()
): VacationPeriod | null {
  const settings = normalizeVacationSettings(raw);
  if (!settings.enabled) return null;
  return (settings.periods || []).find((p) => periodContainsDateTime(p, at)) || null;
}

export function isVacationActive(
  raw: VacationSettings | null | undefined,
  at: Date = new Date()
): boolean {
  return !!findActiveVacationPeriod(raw, at);
}

/**
 * True when a calendar date (YYYY-MM-DD) overlaps a programmed vacation period.
 * Only when the master switch is enabled.
 */
export function isDateInVacationPeriods(
  raw: VacationSettings | null | undefined,
  ymd: string
): boolean {
  const settings = normalizeVacationSettings(raw);
  if (!settings.enabled) return false;
  if (!DATE_RE.test(ymd)) return false;
  return (settings.periods || []).some(
    (p) => p.startDate <= ymd && ymd <= p.endDate
  );
}

export function vacationPublicPayload(
  raw: VacationSettings | null | undefined,
  at: Date = new Date()
) {
  const settings = normalizeVacationSettings(raw);
  const activePeriod = findActiveVacationPeriod(settings, at);
  const active = !!activePeriod;
  return {
    active,
    enabled: !!settings.enabled,
    message: settings.message,
    popupTitle: settings.popupTitle,
    popupImageUrl: settings.popupImageUrl,
    /** Label of the currently active period (multilingual) */
    label: activePeriod?.title || null,
    periods: settings.periods,
  };
}

export const VACATION_BLOCK_MESSAGE =
  "We are currently on vacation. Online orders and reservations are temporarily unavailable.";
