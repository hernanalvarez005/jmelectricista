import { createClient } from "@/lib/supabase/server";

export type JobCostStatus = {
  estimatedMaterialCost: number | null;
  actualMaterialCost: number;
  materialCostComplete: boolean;
  materialCostVariance: number | null;
};

const EMPTY: JobCostStatus = {
  estimatedMaterialCost: null,
  actualMaterialCost: 0,
  materialCostComplete: true,
  materialCostVariance: null,
};

/** Costo estimado (cotización aceptada) vs costo REAL de materiales (movimientos con costo congelado). */
export async function getJobCostStatus(orgId: string, jobId: string): Promise<JobCostStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_cost_status")
    .select("estimated_material_cost, actual_material_cost, material_cost_complete, material_cost_variance")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY;
  return {
    estimatedMaterialCost: data.estimated_material_cost != null ? Number(data.estimated_material_cost) : null,
    actualMaterialCost: Number(data.actual_material_cost ?? 0),
    materialCostComplete: data.material_cost_complete ?? true,
    materialCostVariance: data.material_cost_variance != null ? Number(data.material_cost_variance) : null,
  };
}

/** Trabajos cerrados (status.is_closed) cuyo costo real de materiales es incompleto. */
export async function countClosedJobsWithIncompleteMaterialCost(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data: costs, error } = await supabase
    .from("job_cost_status")
    .select("job_id")
    .eq("organization_id", orgId)
    .eq("material_cost_complete", false);
  if (error) throw error;
  const ids = (costs ?? []).map((c) => c.job_id).filter((id): id is string => id != null);
  if (ids.length === 0) return 0;
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, status:job_statuses(is_closed)")
    .in("id", ids);
  if (jobsError) throw jobsError;
  return (jobs ?? []).filter((j) => j.status?.is_closed).length;
}
