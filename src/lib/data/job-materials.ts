import { createClient } from "@/lib/supabase/server";

export type JobMaterialItem = {
  id: string;
  materialId: string;
  materialName: string;
  unitSymbol: string;
  estimatedQuantity: number;
  actualQuantity: number | null;
  consumedQuantity: number;
  remainingQuantity: number;
  availableStock: number;
  missing: number;
  varianceQuantity: number;
  notes: string | null;
  /** Costo real neto (consumos - devoluciones) con costo congelado; null si todavía no hay consumos. */
  realCost: number | null;
  /** false si algún movimiento del material en este trabajo no tiene costo (stock sin valoración). */
  realCostComplete: boolean;
};

/**
 * "Faltante" y "pendiente" salen siempre de la vista public.job_material_status
 * (ver esa migración para la fórmula), nunca se recalculan acá con
 * `estimated_quantity - stock` — eso ignoraría el material ya consumido por
 * este trabajo. Ver README para la definición de cada campo.
 */
export async function getJobMaterials(orgId: string, jobId: string): Promise<JobMaterialItem[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("job_materials")
    .select(
      "id, material_id, actual_quantity, notes, material:materials(name, unit:material_units(symbol))"
    )
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const { data: statusRows, error: statusError } = await supabase
    .from("job_material_status")
    .select(
      "job_material_id, estimated_quantity, consumed_quantity, remaining_quantity, current_stock, missing_quantity, variance_quantity"
    )
    .eq("organization_id", orgId)
    .eq("job_id", jobId);

  if (statusError) throw statusError;
  const statusById = new Map((statusRows ?? []).map((s) => [s.job_material_id, s]));

  const { data: costRows, error: costError } = await supabase
    .from("job_material_costs")
    .select("material_id, net_cost, cost_complete")
    .eq("organization_id", orgId)
    .eq("job_id", jobId);
  if (costError) throw costError;
  const costByMaterial = new Map((costRows ?? []).map((c) => [c.material_id, c]));

  return rows.map((r) => {
    const status = statusById.get(r.id);
    return {
      id: r.id,
      materialId: r.material_id,
      materialName: r.material?.name ?? "-",
      unitSymbol: r.material?.unit?.symbol ?? "",
      estimatedQuantity: Number(status?.estimated_quantity ?? 0),
      actualQuantity: r.actual_quantity != null ? Number(r.actual_quantity) : null,
      consumedQuantity: Number(status?.consumed_quantity ?? 0),
      remainingQuantity: Number(status?.remaining_quantity ?? 0),
      availableStock: Number(status?.current_stock ?? 0),
      missing: Number(status?.missing_quantity ?? 0),
      varianceQuantity: Number(status?.variance_quantity ?? 0),
      notes: r.notes,
      realCost: costByMaterial.has(r.material_id) ? Number(costByMaterial.get(r.material_id)?.net_cost ?? 0) : null,
      realCostComplete: costByMaterial.get(r.material_id)?.cost_complete ?? true,
    };
  });
}
