/**
 * Timezone-safe calendar-day helpers built on Intl (no extra dependency).
 * A "date key" is always "YYYY-MM-DD" in the organization's timezone.
 */

export function todayKeyInTZ(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function dateKeyInTZ(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
}

/** 0 = domingo ... 6 = sábado, matching business_hours.weekday. */
export function weekdayIndexForDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsToKey(dateKey: string, months: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-01" para el mes que contiene dateKey. */
export function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function mondayOfWeek(dateKey: string): string {
  const weekday = weekdayIndexForDateKey(dateKey);
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToKey(dateKey, diff);
}

export function weekDateKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(mondayKey, i));
}

const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "";
}

function tzOffsetMs(ts: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallAsUtc - Math.floor(ts / 1000) * 1000;
}

/**
 * "2026-09-18" + "08:00" interpretados como hora de pared en `timezone` ->
 * ISO UTC. Nunca usa la zona horaria del proceso: en Vercel (UTC) y en una
 * notebook argentina da el mismo resultado.
 */
export function zonedDateTimeToIso(dateKey: string, time: string, timezone: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const firstOffset = tzOffsetMs(wall, timezone);
  let ts = wall - firstOffset;
  const secondOffset = tzOffsetMs(ts, timezone);
  if (secondOffset !== firstOffset) ts = wall - secondOffset;
  return new Date(ts).toISOString();
}

/** Inverso de zonedDateTimeToIso: fecha "YYYY-MM-DD" y hora "HH:MM" de un instante en `timezone`. */
export function zonedParts(iso: string, timezone: string): { date: string; time: string } {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return { date: dateKeyInTZ(iso, timezone), time };
}
