import { createClient } from "@/lib/supabase/server";

export type JobMissingMaterials = {
  jobId: string;
  jobTitle: string;
  targetDate: string | null;
  missingItems: { materialName: string; missing: number; unitSymbol: string }[];
};

/**
 * Trabajos activos con al menos un material cuyo faltante > 0.
 * El faltante sale de public.job_material_status (considera el consumo ya
 * registrado en ese trabajo), no de `estimated_quantity - stock`.
 */
export async function getJobsWithMissingMaterials(orgId: string): Promise<JobMissingMaterials[]> {
  const supabase = await createClient();

  const { data: statuses } = await supabase
    .from("job_statuses")
    .select("id, is_closed")
    .eq("organization_id", orgId);
  const closedStatusIds = new Set((statuses ?? []).filter((s) => s.is_closed).map((s) => s.id));

  const { data: rows, error } = await supabase
    .from("job_materials")
    .select(
      "id, job_id, material:materials(name, unit:material_units(symbol)), job:jobs(title, target_date, status_id)"
    )
    .eq("organization_id", orgId);

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const activeRows = rows.filter((r) => r.job && !closedStatusIds.has(r.job.status_id));
  if (activeRows.length === 0) return [];

  const jobMaterialIds = activeRows.map((r) => r.id);
  const { data: statusRows } = await supabase
    .from("job_material_status")
    .select("job_material_id, missing_quantity")
    .in("job_material_id", jobMaterialIds);
  const missingById = new Map((statusRows ?? []).map((s) => [s.job_material_id, Number(s.missing_quantity)]));

  const byJob = new Map<string, JobMissingMaterials>();
  for (const row of activeRows) {
    const missing = missingById.get(row.id) ?? 0;
    if (missing <= 0) continue;

    if (!byJob.has(row.job_id)) {
      byJob.set(row.job_id, {
        jobId: row.job_id,
        jobTitle: row.job?.title ?? "-",
        targetDate: row.job?.target_date ?? null,
        missingItems: [],
      });
    }
    byJob.get(row.job_id)!.missingItems.push({
      materialName: row.material?.name ?? "-",
      missing,
      unitSymbol: row.material?.unit?.symbol ?? "",
    });
  }

  return [...byJob.values()].sort((a, b) => {
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return 0;
  });
}
