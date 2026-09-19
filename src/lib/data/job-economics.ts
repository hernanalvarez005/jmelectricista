import { createClient } from "@/lib/supabase/server";
import { getOrgMembers } from "@/lib/data/members";
import { dateKeyInTZ } from "@/lib/scheduling/timezone";

export type JobEconomics = {
  isClosed: boolean;
  contractedAmount: number | null;
  collectedAmount: number;
  outstandingAmount: number | null;
  estimatedMaterialCost: number | null;
  actualMaterialCost: number;
  materialCostComplete: boolean;
  actualMinutes: number;
  actualLaborCost: number;
  laborCostComplete: boolean;
  laborSessionsCount: number;
  sessionsMissingTime: number;
  sessionsMissingMember: number;
  sessionsMissingRate: number;
  directExpenseTotal: number;
  directExpenseCount: number;
  recordedDirectCost: number;
  directCostDataComplete: boolean;
  actualDirectCost: number | null;
  contributionAmount: number | null;
  contributionPercentage: number | null;
};

const n = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

/**
 * Economía del trabajo desde job_economics_status (la vista solo devuelve filas a owner/admin;
 * para cualquier otro rol la respuesta es null y la UI no muestra costos internos).
 */
export async function getJobEconomics(orgId: string, jobId: string): Promise<JobEconomics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_economics_status")
    .select("*")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    isClosed: Boolean(data.job_is_closed),
    contractedAmount: n(data.contracted_amount),
    collectedAmount: n(data.collected_amount) ?? 0,
    outstandingAmount: n(data.outstanding_amount),
    estimatedMaterialCost: n(data.estimated_material_cost),
    actualMaterialCost: n(data.actual_material_cost) ?? 0,
    materialCostComplete: Boolean(data.material_cost_complete),
    actualMinutes: n(data.actual_minutes) ?? 0,
    actualLaborCost: n(data.actual_labor_cost) ?? 0,
    laborCostComplete: Boolean(data.labor_cost_complete),
    laborSessionsCount: n(data.labor_sessions_count) ?? 0,
    sessionsMissingTime: n(data.sessions_missing_time) ?? 0,
    sessionsMissingMember: n(data.sessions_missing_member) ?? 0,
    sessionsMissingRate: n(data.sessions_missing_rate) ?? 0,
    directExpenseTotal: n(data.direct_expense_total) ?? 0,
    directExpenseCount: n(data.direct_expense_count) ?? 0,
    recordedDirectCost: n(data.recorded_direct_cost) ?? 0,
    directCostDataComplete: Boolean(data.direct_cost_data_complete),
    actualDirectCost: n(data.actual_direct_cost),
    contributionAmount: n(data.contribution_amount),
    contributionPercentage: n(data.contribution_percentage),
  };
}

export type LaborSessionIssue = "ok" | "no_time" | "no_member" | "no_rate";

export type LaborSessionItem = {
  id: string;
  dateKey: string;
  minutes: number | null;
  memberId: string | null;
  memberName: string | null;
  hourlyCost: number | null;
  cost: number | null;
  issue: LaborSessionIssue;
};

/** Sesiones que aportan (o deberían aportar) costo laboral, con su tarifa congelada. Solo owner/admin ven las tarifas (RLS). */
export async function getJobLaborBreakdown(orgId: string, jobId: string, timezone: string): Promise<LaborSessionItem[]> {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("job_sessions")
    .select("id, status, assigned_member_id, planned_start_at, actual_start_at, actual_end_at")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .neq("status", "cancelled")
    .order("planned_start_at");
  if (error) throw error;

  const relevant = (sessions ?? []).filter((s) => s.status === "completed" || (s.actual_start_at && s.actual_end_at));
  if (relevant.length === 0) return [];

  const [{ data: snapshots, error: snapshotsError }, members] = await Promise.all([
    supabase.from("job_session_labor_costs").select("job_session_id, hourly_cost_snapshot").in("job_session_id", relevant.map((s) => s.id)),
    getOrgMembers(orgId),
  ]);
  if (snapshotsError) throw snapshotsError;

  const rateBySession = new Map((snapshots ?? []).map((s) => [s.job_session_id, Number(s.hourly_cost_snapshot)]));
  const nameByMember = new Map(members.map((m) => [m.id, m.fullName]));

  return relevant.map((s) => {
    const hasTime = Boolean(s.actual_start_at && s.actual_end_at);
    const minutes = hasTime ? (new Date(s.actual_end_at as string).getTime() - new Date(s.actual_start_at as string).getTime()) / 60000 : null;
    const hourlyCost = rateBySession.get(s.id) ?? null;
    let issue: LaborSessionIssue = "ok";
    if (!hasTime) issue = "no_time";
    else if (!s.assigned_member_id) issue = "no_member";
    else if (hourlyCost === null) issue = "no_rate";
    return {
      id: s.id,
      dateKey: dateKeyInTZ((s.actual_start_at ?? s.planned_start_at) as string, timezone),
      minutes,
      memberId: s.assigned_member_id,
      memberName: s.assigned_member_id ? (nameByMember.get(s.assigned_member_id) ?? "Sin nombre") : null,
      hourlyCost,
      cost: minutes !== null && hourlyCost !== null ? Math.round((minutes / 60) * hourlyCost * 100) / 100 : null,
      issue,
    };
  });
}
