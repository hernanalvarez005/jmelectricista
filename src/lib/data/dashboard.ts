import { createClient } from "@/lib/supabase/server";
import { getWeeklyLoad, type WeeklyLoadDay } from "@/lib/data/weekly-load";
import { mondayOfWeek, todayKeyInTZ } from "@/lib/scheduling/timezone";

export type DashboardData = {
  activeJobsCount: number;
  jobsScheduledTodayCount: number;
  minutesScheduledToday: number;
  minutesScheduledThisWeek: number;
  overdueJobsCount: number;
  jobsWithoutSessionCount: number;
  weeklyLoad: WeeklyLoadDay[];
};

export async function getDashboardData(orgId: string, timezone: string): Promise<DashboardData> {
  const supabase = await createClient();
  const todayKey = todayKeyInTZ(timezone);

  const [{ data: statuses, error: statusesError }, { data: jobs, error: jobsError }, weeklyLoad] =
    await Promise.all([
      supabase.from("job_statuses").select("id, is_closed").eq("organization_id", orgId),
      supabase
        .from("jobs")
        .select("id, status_id, target_date")
        .eq("organization_id", orgId)
        .limit(2000),
      getWeeklyLoad(orgId, timezone, mondayOfWeek(todayKey)),
    ]);

  if (statusesError) throw statusesError;
  if (jobsError) throw jobsError;

  const closedStatusIds = new Set((statuses ?? []).filter((s) => s.is_closed).map((s) => s.id));
  const activeJobs = (jobs ?? []).filter((j) => !closedStatusIds.has(j.status_id));
  const overdueJobsCount = activeJobs.filter(
    (j) => j.target_date && j.target_date < todayKey
  ).length;

  const activeJobIds = activeJobs.map((j) => j.id);
  let jobsWithoutSessionCount = 0;
  if (activeJobIds.length > 0) {
    const { data: sessionJobIds, error: sessionsError } = await supabase
      .from("job_sessions")
      .select("job_id")
      .in("job_id", activeJobIds);
    if (sessionsError) throw sessionsError;
    const withSession = new Set((sessionJobIds ?? []).map((s) => s.job_id));
    jobsWithoutSessionCount = activeJobIds.filter((id) => !withSession.has(id)).length;
  }

  const todaySessions = weeklyLoad.sessions.filter((s) => s.dateKey === todayKey);
  const jobsScheduledTodayCount = new Set(todaySessions.map((s) => s.jobId)).size;
  const minutesScheduledToday = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const minutesScheduledThisWeek = weeklyLoad.sessions.reduce((sum, s) => sum + s.minutes, 0);

  return {
    activeJobsCount: activeJobs.length,
    jobsScheduledTodayCount,
    minutesScheduledToday,
    minutesScheduledThisWeek,
    overdueJobsCount,
    jobsWithoutSessionCount,
    weeklyLoad: weeklyLoad.days,
  };
}
