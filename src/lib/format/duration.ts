/** Converts hours+minutes input into a total minute count (the only unit persisted). */
export function toMinutes(hours: number, minutes: number): number {
  return Math.max(0, Math.round(hours)) * 60 + Math.max(0, Math.round(minutes));
}

export function minutesToHoursAndMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/** Human-friendly representation, e.g. 390 -> "6 h 30 min", 60 -> "1 h", 45 -> "45 min". */
export function formatMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null) return "Sin estimar";
  const { hours, minutes } = minutesToHoursAndMinutes(totalMinutes);
  if (hours === 0 && minutes === 0) return "0 min";
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" ");
}

/** Same as formatMinutes but renders "-" for null, useful in dense table cells. */
export function formatMinutesCompact(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null) return "-";
  return formatMinutes(totalMinutes);
}

/** e.g. +120 min (+20%) / -60 min (-10%). Sin signo cuando la diferencia es 0. */
export function formatVarianceMinutes(minutes: number | null, percentage: number | null): string {
  if (minutes == null) return "-";
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  const magnitude = formatMinutes(Math.abs(minutes));
  const percentagePart = percentage != null ? ` (${percentage > 0 ? "+" : ""}${percentage}%)` : "";
  return `${sign}${magnitude}${percentagePart}`;
}
