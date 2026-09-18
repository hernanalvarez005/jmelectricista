const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export function formatDateTime(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Para columnas `date` puras (sin hora, ej. payment_date, target_date):
 * formatea "YYYY-MM-DD" directamente como texto, sin construir un `Date` ni
 * pasar por timezone. `formatDate(`${dateKey}T00:00:00Z`, tz)` se ve tentador
 * para reusar el mismo formatter, pero en un timezone de offset negativo
 * (ej. Argentina, UTC-3) la medianoche UTC cae en las 21:00 del día
 * anterior, y el valor se muestra un día antes del real. Una fecha
 * calendario no tiene componente horario que convertir.
 */
export function formatDateOnly(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

export function formatTime(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatWeekday(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: timezone, weekday: "long" }).format(
    new Date(iso)
  );
}

/** Returns the Monday..Sunday range (as Date, local midnight) containing `date`. */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
