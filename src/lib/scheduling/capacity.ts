import type { Tables } from "@/lib/supabase/database.types";

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Working minutes for a business_hours row, discounting the break if present. */
export function businessHoursCapacityMinutes(
  row: Pick<
    Tables<"business_hours">,
    "is_working_day" | "start_time" | "end_time" | "break_start" | "break_end"
  >
): number {
  if (!row.is_working_day || !row.start_time || !row.end_time) return 0;
  let capacity = timeToMinutes(row.end_time) - timeToMinutes(row.start_time);
  if (row.break_start && row.break_end) {
    capacity -= timeToMinutes(row.break_end) - timeToMinutes(row.break_start);
  }
  return Math.max(0, capacity);
}

export function sessionDurationMinutes(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}
