import { createClient } from "@/lib/supabase/server";
import { getCapacityByWeekday } from "@/lib/data/business-hours";
import { getOrgMembers } from "@/lib/data/members";
import { sessionDurationMinutes } from "@/lib/scheduling/capacity";
import {
  addDaysToKey,
  dateKeyInTZ,
  weekDateKeys,
  weekdayIndexForDateKey,
  weekdayLabel,
} from "@/lib/scheduling/timezone";

export type AgendaSession = {
  id: string;
  jobId: string;
  jobTitle: string;
  clientName: string;
  startAt: string;
  endAt: string;
  minutes: number;
  status: string;
  assignedMemberName: string | null;
};

export type AgendaDay = {
  dateKey: string;
  weekday: number;
  weekdayLabel: string;
  capacityMinutes: number;
  scheduledMinutes: number;
  isOverCapacity: boolean;
  sessions: AgendaSession[];
};

export async function getAgendaWeek(
  orgId: string,
  timezone: string,
  mondayKey: string
): Promise<AgendaDay[]> {
  const supabase = await createClient();
  const dateKeys = weekDateKeys(mondayKey);

  const windowStart = `${addDaysToKey(mondayKey, -1)}T00:00:00Z`;
  const windowEnd = `${addDaysToKey(mondayKey, 8)}T00:00:00Z`;

  const [{ data: sessionRows, error }, capacityByWeekday, members] = await Promise.all([
    supabase
      .from("job_sessions")
      .select(
        "id, job_id, assigned_member_id, planned_start_at, planned_end_at, status, job:jobs(title, client:clients(name))"
      )
      .eq("organization_id", orgId)
      .neq("status", "cancelled")
      .gte("planned_start_at", windowStart)
      .lt("planned_start_at", windowEnd)
      .order("planned_start_at", { ascending: true }),
    getCapacityByWeekday(orgId),
    getOrgMembers(orgId),
  ]);

  if (error) throw error;

  const memberNameById = new Map(members.map((m) => [m.id, m.fullName]));

  const sessions: (AgendaSession & { dateKey: string })[] = (sessionRows ?? [])
    .map((row) => ({
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job?.title ?? "Trabajo",
      clientName: row.job?.client?.name ?? "-",
      startAt: row.planned_start_at,
      endAt: row.planned_end_at,
      minutes: sessionDurationMinutes(row.planned_start_at, row.planned_end_at),
      status: row.status,
      assignedMemberName: row.assigned_member_id
        ? (memberNameById.get(row.assigned_member_id) ?? null)
        : null,
      dateKey: dateKeyInTZ(row.planned_start_at, timezone),
    }))
    .filter((s) => dateKeys.includes(s.dateKey));

  return dateKeys.map((dateKey) => {
    const weekday = weekdayIndexForDateKey(dateKey);
    const daySessions = sessions.filter((s) => s.dateKey === dateKey);
    const scheduledMinutes = daySessions
      .filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + s.minutes, 0);
    const capacityMinutes = capacityByWeekday[weekday] ?? 0;

    return {
      dateKey,
      weekday,
      weekdayLabel: weekdayLabel(weekday),
      capacityMinutes,
      scheduledMinutes,
      isOverCapacity: capacityMinutes > 0 && scheduledMinutes > capacityMinutes,
      sessions: daySessions,
    };
  });
}
