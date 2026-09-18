import { createClient } from "@/lib/supabase/server";
import { getCapacityByWeekday } from "@/lib/data/business-hours";
import { sessionDurationMinutes } from "@/lib/scheduling/capacity";
import {
  addDaysToKey,
  dateKeyInTZ,
  weekDateKeys,
  weekdayIndexForDateKey,
  weekdayLabel,
} from "@/lib/scheduling/timezone";

export type WeeklyLoadSession = {
  id: string;
  jobId: string;
  dateKey: string;
  startAt: string;
  endAt: string;
  minutes: number;
};

export type WeeklyLoadDay = {
  dateKey: string;
  weekday: number;
  weekdayLabel: string;
  scheduledMinutes: number;
  capacityMinutes: number;
  isOverCapacity: boolean;
};

export type WeeklyLoad = {
  days: WeeklyLoadDay[];
  sessions: WeeklyLoadSession[];
};

/**
 * Loads every scheduled/completed session that falls within the Mon..Sun
 * week starting at `mondayKey` (in the org's timezone) and aggregates the
 * scheduled minutes per day against the organization's working capacity.
 * Shared by the dashboard's "carga semanal" and the weekly agenda view.
 */
export async function getWeeklyLoad(
  orgId: string,
  timezone: string,
  mondayKey: string
): Promise<WeeklyLoad> {
  const supabase = await createClient();
  const dateKeys = weekDateKeys(mondayKey);

  // Widen the UTC query window by a day on each side to safely cover any
  // timezone offset, then bucket precisely by the real local date below.
  const windowStart = `${addDaysToKey(mondayKey, -1)}T00:00:00Z`;
  const windowEnd = `${addDaysToKey(mondayKey, 8)}T00:00:00Z`;

  const [{ data: sessionRows, error }, capacityByWeekday] = await Promise.all([
    supabase
      .from("job_sessions")
      .select("id, job_id, planned_start_at, planned_end_at, status")
      .eq("organization_id", orgId)
      .in("status", ["scheduled", "completed"])
      .gte("planned_start_at", windowStart)
      .lt("planned_start_at", windowEnd),
    getCapacityByWeekday(orgId),
  ]);

  if (error) throw error;

  const sessions: WeeklyLoadSession[] = (sessionRows ?? [])
    .map((row) => ({
      id: row.id,
      jobId: row.job_id,
      dateKey: dateKeyInTZ(row.planned_start_at, timezone),
      startAt: row.planned_start_at,
      endAt: row.planned_end_at,
      minutes: sessionDurationMinutes(row.planned_start_at, row.planned_end_at),
    }))
    .filter((s) => dateKeys.includes(s.dateKey));

  const minutesByDay = new Map<string, number>();
  for (const session of sessions) {
    minutesByDay.set(session.dateKey, (minutesByDay.get(session.dateKey) ?? 0) + session.minutes);
  }

  const days: WeeklyLoadDay[] = dateKeys.map((dateKey) => {
    const weekday = weekdayIndexForDateKey(dateKey);
    const capacityMinutes = capacityByWeekday[weekday] ?? 0;
    const scheduledMinutes = minutesByDay.get(dateKey) ?? 0;
    return {
      dateKey,
      weekday,
      weekdayLabel: weekdayLabel(weekday),
      scheduledMinutes,
      capacityMinutes,
      isOverCapacity: capacityMinutes > 0 && scheduledMinutes > capacityMinutes,
    };
  });

  return { days, sessions };
}
