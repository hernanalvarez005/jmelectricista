import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type SupplierListItem = Tables<"suppliers"> & { lastPriceDate: string | null };

export async function listSuppliers(orgId: string): Promise<SupplierListItem[]> {
  const supabase = await createClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");
  if (error) throw error;
  if (!suppliers || suppliers.length === 0) return [];

  const { data: prices, error: pricesError } = await supabase
    .from("supplier_material_prices")
    .select("supplier_id, recorded_at")
    .in(
      "supplier_id",
      suppliers.map((s) => s.id)
    )
    .order("recorded_at", { ascending: false });
  if (pricesError) throw pricesError;

  const lastPriceBySupplier = new Map<string, string>();
  for (const p of prices ?? []) {
    if (!lastPriceBySupplier.has(p.supplier_id)) lastPriceBySupplier.set(p.supplier_id, p.recorded_at);
  }

  return suppliers.map((s) => ({ ...s, lastPriceDate: lastPriceBySupplier.get(s.id) ?? null }));
}

export type SupplierDetail = {
  supplier: Tables<"suppliers">;
  prices: (Tables<"supplier_material_prices"> & { materialName: string })[];
};

export async function getSupplierDetail(orgId: string, supplierId: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw error;
  if (!supplier) return null;

  const { data: prices, error: pricesError } = await supabase
    .from("supplier_material_prices")
    .select("*, material:materials(name)")
    .eq("supplier_id", supplierId)
    .order("recorded_at", { ascending: false });
  if (pricesError) throw pricesError;

  return {
    supplier,
    prices: (prices ?? []).map((p) => ({ ...p, materialName: p.material?.name ?? "-" })),
  };
}
