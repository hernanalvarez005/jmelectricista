import { createClient } from "@/lib/supabase/server";

export type JobMaterialItem = {
  id: string;
  materialId: string;
  materialName: string;
  unitSymbol: string;
  estimatedQuantity: number;
  actualQuantity: number | null;
  availableStock: number;
  missing: number;
  notes: string | null;
};

export async function getJobMaterials(orgId: string, jobId: string): Promise<JobMaterialItem[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("job_materials")
    .select("id, material_id, estimated_quantity, actual_quantity, notes, material:materials(name, unit:material_units(symbol))")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const materialIds = rows.map((r) => r.material_id);
  const { data: balances, error: balancesError } = await supabase
    .from("material_stock_balances")
    .select("material_id, current_stock")
    .in("material_id", materialIds);
  if (balancesError) throw balancesError;

  const stockByMaterial = new Map((balances ?? []).map((b) => [b.material_id, Number(b.current_stock)]));

  return rows.map((r) => {
    const availableStock = stockByMaterial.get(r.material_id) ?? 0;
    const estimatedQuantity = Number(r.estimated_quantity);
    return {
      id: r.id,
      materialId: r.material_id,
      materialName: r.material?.name ?? "-",
      unitSymbol: r.material?.unit?.symbol ?? "",
      estimatedQuantity,
      actualQuantity: r.actual_quantity != null ? Number(r.actual_quantity) : null,
      availableStock,
      missing: Math.max(0, estimatedQuantity - availableStock),
      notes: r.notes,
    };
  });
}
