import { createClient } from "@/lib/supabase/server";
import { getOrgMembers } from "@/lib/data/members";
import { sessionDurationMinutes } from "@/lib/scheduling/capacity";
import type { Tables } from "@/lib/supabase/database.types";

export type JobFilters = {
  statusId?: string;
  clientId?: string;
  jobTypeId?: string;
  priority?: string;
};

export type JobListItem = {
  id: string;
  title: string;
  priority: string;
  targetDate: string | null;
  estimatedMinutes: number | null;
  clientName: string;
  statusName: string;
  statusIsClosed: boolean;
  nextSessionAt: string | null;
};

export async function listJobs(orgId: string, filters: JobFilters = {}): Promise<JobListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select(
      "id, title, priority, target_date, estimated_minutes, client:clients(name), status:job_statuses(name, is_closed)"
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.jobTypeId) query = query.eq("job_type_id", filters.jobTypeId);
  if (filters.priority) query = query.eq("priority", filters.priority);

  const { data: jobs, error } = await query;
  if (error) throw error;
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const { data: sessions, error: sessionsError } = await supabase
    .from("job_sessions")
    .select("job_id, planned_start_at")
    .in("job_id", jobIds)
    .eq("status", "scheduled")
    .gte("planned_start_at", new Date().toISOString())
    .order("planned_start_at", { ascending: true });

  if (sessionsError) throw sessionsError;

  const nextSessionByJob = new Map<string, string>();
  for (const session of sessions ?? []) {
    if (!nextSessionByJob.has(session.job_id)) {
      nextSessionByJob.set(session.job_id, session.planned_start_at);
    }
  }

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    priority: job.priority,
    targetDate: job.target_date,
    estimatedMinutes: job.estimated_minutes,
    clientName: job.client?.name ?? "-",
    statusName: job.status?.name ?? "-",
    statusIsClosed: job.status?.is_closed ?? false,
    nextSessionAt: nextSessionByJob.get(job.id) ?? null,
  }));
}

export type JobActivityEntry =
  | { id: string; at: string; kind: "status"; fromStatusName: string | null; toStatusName: string }
  | { id: string; at: string; kind: "payment_registered"; amount: number; methodName: string }
  | { id: string; at: string; kind: "payment_voided"; amount: number; voidReason: string };

export type JobDetail = {
  job: Tables<"jobs">;
  clientName: string;
  addressLabel: string | null;
  jobTypeName: string | null;
  statusName: string;
  statusIsClosed: boolean;
  assignedMemberName: string | null;
  sessions: Tables<"job_sessions">[];
  activity: JobActivityEntry[];
};

export async function getJobDetail(orgId: string, jobId: string): Promise<JobDetail | null> {
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "*, client:clients(name), address:client_addresses(label, street, locality), job_type:job_types(name), status:job_statuses(name, is_closed)"
    )
    .eq("organization_id", orgId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  if (!job) return null;

  const [
    { data: sessions, error: sessionsError },
    { data: historyRows, error: historyError },
    { data: paymentRows, error: paymentsError },
    members,
  ] = await Promise.all([
    supabase
      .from("job_sessions")
      .select("*")
      .eq("job_id", jobId)
      .order("planned_start_at", { ascending: true }),
    supabase
      .from("job_status_history")
      .select("id, changed_at, from_status:job_statuses!job_status_history_from_status_id_fkey(name), to_status:job_statuses!job_status_history_to_status_id_fkey(name)")
      .eq("job_id", jobId)
      .order("changed_at", { ascending: false }),
    supabase
      .from("job_payments")
      .select("id, amount, created_at, voided_at, void_reason, method:payment_methods(name)")
      .eq("job_id", jobId),
    getOrgMembers(orgId),
  ]);

  if (sessionsError) throw sessionsError;
  if (historyError) throw historyError;
  if (paymentsError) throw paymentsError;

  const activity: JobActivityEntry[] = [
    ...(historyRows ?? []).map(
      (h): JobActivityEntry => ({
        id: h.id,
        at: h.changed_at,
        kind: "status",
        fromStatusName: h.from_status?.name ?? null,
        toStatusName: h.to_status?.name ?? "-",
      })
    ),
    ...(paymentRows ?? []).flatMap((p): JobActivityEntry[] => {
      const entries: JobActivityEntry[] = [
        {
          id: `${p.id}-registered`,
          at: p.created_at,
          kind: "payment_registered",
          amount: Number(p.amount),
          methodName: p.method?.name ?? "-",
        },
      ];
      if (p.voided_at) {
        entries.push({
          id: `${p.id}-voided`,
          at: p.voided_at,
          kind: "payment_voided",
          amount: Number(p.amount),
          voidReason: p.void_reason ?? "-",
        });
      }
      return entries;
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const memberName = job.assigned_member_id
    ? (members.find((m) => m.id === job.assigned_member_id)?.fullName ?? null)
    : null;

  const addressParts = job.address
    ? [job.address.label, job.address.street, job.address.locality].filter(Boolean)
    : [];

  return {
    job,
    clientName: job.client?.name ?? "-",
    addressLabel: addressParts.length > 0 ? addressParts.join(" · ") : null,
    jobTypeName: job.job_type?.name ?? null,
    statusName: job.status?.name ?? "-",
    statusIsClosed: job.status?.is_closed ?? false,
    assignedMemberName: memberName,
    sessions: sessions ?? [],
    activity,
  };
}

export function sumSessionMinutes(
  sessions: Pick<Tables<"job_sessions">, "planned_start_at" | "planned_end_at" | "status">[],
  statuses: string[]
): number {
  return sessions
    .filter((s) => statuses.includes(s.status))
    .reduce((sum, s) => sum + sessionDurationMinutes(s.planned_start_at, s.planned_end_at), 0);
}

export function sumActualMinutes(
  sessions: Pick<Tables<"job_sessions">, "actual_start_at" | "actual_end_at">[]
): number {
  return sessions.reduce((sum, s) => {
    if (!s.actual_start_at || !s.actual_end_at) return sum;
    return sum + sessionDurationMinutes(s.actual_start_at, s.actual_end_at);
  }, 0);
}
