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
