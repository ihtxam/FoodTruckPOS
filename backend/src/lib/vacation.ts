import type { VacationPeriod, VacationSettings } from "@/db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date YYYY-MM-DD in Europe/Zurich. */
export function ymdZurich(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
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
    periods.push({
      id: String(p.id || `${startDate}-${endDate}`),
      startDate,
      endDate,
      title: p.title != null ? String(p.title).slice(0, 120) : null,
    });
  }
  periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const popupImageUrl =
    raw?.popupImageUrl != null && String(raw.popupImageUrl).trim()
      ? String(raw.popupImageUrl).trim().slice(0, 500)
      : null;
  const message =
    raw?.message != null && String(raw.message).trim()
      ? String(raw.message).trim().slice(0, 500)
      : null;
  return {
    manualActive: !!raw?.manualActive,
    popupImageUrl,
    message,
    periods,
  };
}

export function isVacationActive(
  raw: VacationSettings | null | undefined,
  at: Date = new Date()
): boolean {
  const settings = normalizeVacationSettings(raw);
  if (settings.manualActive) return true;
  const today = ymdZurich(at);
  return isDateInVacationPeriods(settings, today);
}

/** True when a calendar date (YYYY-MM-DD) falls inside a programmed vacation period. */
export function isDateInVacationPeriods(
  raw: VacationSettings | null | undefined,
  ymd: string
): boolean {
  const settings = normalizeVacationSettings(raw);
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
  const active = isVacationActive(settings, at);
  return {
    active,
    message: settings.message,
    popupImageUrl: settings.popupImageUrl,
    periods: settings.periods,
    manualActive: settings.manualActive,
  };
}

export const VACATION_BLOCK_MESSAGE =
  "We are currently on vacation. Online orders and reservations are temporarily unavailable.";
