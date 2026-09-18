import { createClient } from "@/lib/supabase/server";
import { addMonthsToKey, monthStartKey, todayKeyInTZ } from "@/lib/scheduling/timezone";
import type { PurchaseStatus } from "@/lib/validations/purchase";
import type { Tables } from "@/lib/supabase/database.types";

export type PurchaseListItem = {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  status: PurchaseStatus;
  total: number;
  supplierId: string;
  supplierName: string;
  itemCount: number;
};

export type PurchaseFilters = {
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
};

export async function listPurchases(orgId: string, filters: PurchaseFilters = {}): Promise<PurchaseListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("purchases")
    .select("id, purchase_number, purchase_date, status, total, supplier_id, supplier:suppliers(name), items:purchase_items(count)")
    .eq("organization_id", orgId)
    .order("purchase_date", { ascending: false })
    .order("purchase_number", { ascending: false })
    .limit(300);

  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("purchase_date", filters.from);
  if (filters.to) query = query.lte("purchase_date", filters.to);
  if (filters.q) query = query.ilike("purchase_number", `%${filters.q}%`);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    purchaseNumber: p.purchase_number,
    purchaseDate: p.purchase_date,
    status: p.status as PurchaseStatus,
    total: Number(p.total),
    supplierId: p.supplier_id,
    supplierName: p.supplier?.name ?? "-",
    itemCount: p.items?.[0]?.count ?? 0,
  }));
}

export type PurchaseDetail = {
  purchase: Tables<"purchases">;
  supplierName: string;
  sourceJob: { id: string; title: string } | null;
  items: {
    id: string;
    materialId: string;
    materialName: string;
    unitSymbol: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
    notes: string | null;
  }[];
};

export async function getPurchaseDetail(orgId: string, purchaseId: string): Promise<PurchaseDetail | null> {
  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("*, supplier:suppliers(name), job:jobs(id, title)")
    .eq("organization_id", orgId)
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw error;
  if (!purchase) return null;

  const { data: items, error: itemsError } = await supabase
    .from("purchase_items")
    .select("id, material_id, quantity, unit_cost, subtotal, notes, material:materials(name, unit:material_units(symbol))")
    .eq("purchase_id", purchaseId)
    .order("sort_order")
    .order("created_at");
  if (itemsError) throw itemsError;

  return {
    purchase,
    supplierName: purchase.supplier?.name ?? "-",
    sourceJob: purchase.job ? { id: purchase.job.id, title: purchase.job.title } : null,
    items: (items ?? []).map((i) => ({
      id: i.id,
      materialId: i.material_id,
      materialName: i.material?.name ?? "-",
      unitSymbol: i.material?.unit?.symbol ?? "",
      quantity: Number(i.quantity),
      unitCost: Number(i.unit_cost),
      subtotal: Number(i.subtotal),
      notes: i.notes,
    })),
  };
}

export type PurchasableMaterial = {
  id: string;
  name: string;
  unitSymbol: string;
  suggestedUnitCost: number | null;
  needsInitialization: boolean;
};

/** Materiales activos para armar una compra, con un costo sugerido (última compra > costo promedio > último precio consultado). */
export async function listPurchasableMaterials(orgId: string): Promise<PurchasableMaterial[]> {
  const supabase = await createClient();
  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, name, unit:material_units(symbol)")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  if (!materials || materials.length === 0) return [];
  const ids = materials.map((m) => m.id);

  const [{ data: valuation }, { data: lastPurchases }, { data: lastPrices }] = await Promise.all([
    supabase.from("material_valuation").select("material_id, average_cost, needs_initialization").in("material_id", ids),
    supabase.from("material_latest_purchases").select("material_id, unit_cost").in("material_id", ids),
    supabase.from("material_latest_prices").select("material_id, price").in("material_id", ids),
  ]);
  const valById = new Map((valuation ?? []).map((v) => [v.material_id, v]));
  const purchaseById = new Map((lastPurchases ?? []).map((p) => [p.material_id, Number(p.unit_cost)]));
  const priceById = new Map((lastPrices ?? []).map((p) => [p.material_id, Number(p.price)]));

  return materials.map((m) => {
    const val = valById.get(m.id);
    const avg = val?.average_cost != null ? Number(val.average_cost) : null;
    return {
      id: m.id,
      name: m.name,
      unitSymbol: m.unit?.symbol ?? "",
      suggestedUnitCost: purchaseById.get(m.id) ?? avg ?? priceById.get(m.id) ?? null,
      needsInitialization: Boolean(val?.needs_initialization),
    };
  });
}

export type ShortageItem = { materialId: string; quantity: number };

/** Faltantes reales de un trabajo (job_material_status.missing_quantity), no el estimado ni el pendiente. */
export async function getJobShortages(orgId: string, jobId: string): Promise<{ jobTitle: string; items: ShortageItem[] } | null> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, title").eq("organization_id", orgId).eq("id", jobId).maybeSingle();
  if (!job) return null;
  const { data, error } = await supabase
    .from("job_material_status")
    .select("material_id, missing_quantity")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .gt("missing_quantity", 0);
  if (error) throw error;
  return {
    jobTitle: job.title,
    items: (data ?? [])
      .filter((r): r is typeof r & { material_id: string } => r.material_id != null)
      .map((r) => ({ materialId: r.material_id, quantity: Number(r.missing_quantity) })),
  };
}

export type SupplierPurchaseSummary = {
  recent: PurchaseListItem[];
  totalPurchased: number;
  purchaseCount: number;
};

export async function getSupplierPurchases(orgId: string, supplierId: string): Promise<SupplierPurchaseSummary> {
  const all = await listPurchases(orgId, { supplierId });
  const received = all.filter((p) => p.status === "received");
  return {
    recent: all.slice(0, 8),
    totalPurchased: received.reduce((s, p) => s + p.total, 0),
    purchaseCount: received.length,
  };
}

export type PurchasesDashboardStats = {
  purchasedThisMonth: number;
  materialsWithoutValuation: number;
};

export async function getPurchasesDashboardStats(orgId: string, timezone: string): Promise<PurchasesDashboardStats> {
  const supabase = await createClient();
  const startKey = monthStartKey(todayKeyInTZ(timezone));
  const nextKey = addMonthsToKey(startKey, 1);
  const [{ data: purchases, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("purchases")
      .select("total")
      .eq("organization_id", orgId)
      .eq("status", "received")
      .gte("purchase_date", startKey)
      .lt("purchase_date", nextKey),
    supabase.from("material_valuation").select("material_id", { count: "exact", head: true }).eq("organization_id", orgId).eq("needs_initialization", true),
  ]);
  if (error) throw error;
  if (countError) throw countError;
  return {
    purchasedThisMonth: (purchases ?? []).reduce((s, p) => s + Number(p.total), 0),
    materialsWithoutValuation: count ?? 0,
  };
}
