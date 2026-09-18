import { createClient } from "@/lib/supabase/server";

export type JobMissingMaterials = {
  jobId: string;
  jobTitle: string;
  targetDate: string | null;
  missingItems: { materialName: string; missing: number; unitSymbol: string }[];
};

/** Trabajos activos con al menos un material cuyo faltante > 0. */
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
      "job_id, material_id, estimated_quantity, material:materials(name, unit:material_units(symbol)), job:jobs(title, target_date, status_id)"
    )
    .eq("organization_id", orgId);

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const activeRows = rows.filter((r) => r.job && !closedStatusIds.has(r.job.status_id));
  if (activeRows.length === 0) return [];

  const materialIds = [...new Set(activeRows.map((r) => r.material_id))];
  const { data: balances } = await supabase
    .from("material_stock_balances")
    .select("material_id, current_stock")
    .in("material_id", materialIds);
  const stockByMaterial = new Map((balances ?? []).map((b) => [b.material_id, Number(b.current_stock)]));

  const byJob = new Map<string, JobMissingMaterials>();
  for (const row of activeRows) {
    const stock = stockByMaterial.get(row.material_id) ?? 0;
    const missing = Math.max(0, Number(row.estimated_quantity) - stock);
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
