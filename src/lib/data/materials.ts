import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export async function listMaterialCategories(
  orgId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Tables<"material_categories">[]> {
  const supabase = await createClient();
  let query = supabase
    .from("material_categories")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listMaterialUnits(
  orgId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Tables<"material_units">[]> {
  const supabase = await createClient();
  let query = supabase
    .from("material_units")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type MaterialListItem = {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
  minimumStock: number;
  categoryName: string | null;
  unitSymbol: string;
  currentStock: number;
  lowStock: boolean;
  lastPrice: number | null;
  lastPriceSupplierName: string | null;
  lastPriceDate: string | null;
  /** Costo promedio ponderado del inventario (null si no está valorizado). No es el precio consultado a proveedores. */
  averageCost: number | null;
  inventoryValue: number | null;
  needsInitialization: boolean;
  /** Fila cruda, para no tener que refetchear al abrir el formulario de edición. */
  raw: Tables<"materials">;
};

export type MaterialFilters = {
  search?: string;
  categoryId?: string;
  activeOnly?: boolean;
  lowStockOnly?: boolean;
  needsValuationOnly?: boolean;
};

export async function listMaterials(
  orgId: string,
  filters: MaterialFilters = {}
): Promise<MaterialListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("materials")
    .select("*, category:material_categories(name), unit:material_units(symbol)")
    .eq("organization_id", orgId)
    .order("name")
    .limit(1000);

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.activeOnly) query = query.eq("active", true);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);

  const { data: materials, error } = await query;
  if (error) throw error;
  if (!materials || materials.length === 0) return [];

  const materialIds = materials.map((m) => m.id);

  const [
    { data: balances, error: balancesError },
    { data: latestPrices, error: pricesError },
    { data: valuations, error: valuationsError },
  ] =
    await Promise.all([
      supabase
        .from("material_stock_balances")
        .select("material_id, current_stock")
        .in("material_id", materialIds),
      supabase
        .from("material_latest_prices")
        .select("material_id, price, recorded_at, supplier:suppliers(name)")
        .in("material_id", materialIds),
      supabase
        .from("material_valuation")
        .select("material_id, average_cost, inventory_value, needs_initialization")
        .in("material_id", materialIds),
    ]);

  if (balancesError) throw balancesError;
  if (pricesError) throw pricesError;
  if (valuationsError) throw valuationsError;
  const valuationByMaterial = new Map((valuations ?? []).map((v) => [v.material_id, v]));

  const stockByMaterial = new Map((balances ?? []).map((b) => [b.material_id, Number(b.current_stock)]));
  const priceByMaterial = new Map((latestPrices ?? []).map((p) => [p.material_id, p]));

  const items: MaterialListItem[] = materials.map((m) => {
    const currentStock = stockByMaterial.get(m.id) ?? 0;
    const minimumStock = Number(m.minimum_stock);
    const price = priceByMaterial.get(m.id);
    const valuation = valuationByMaterial.get(m.id);
    return {
      id: m.id,
      name: m.name,
      sku: m.sku,
      active: m.active,
      minimumStock,
      categoryName: m.category?.name ?? null,
      unitSymbol: m.unit?.symbol ?? "",
      currentStock,
      lowStock: minimumStock > 0 && currentStock < minimumStock,
      lastPrice: price ? Number(price.price) : null,
      lastPriceSupplierName: price?.supplier?.name ?? null,
      lastPriceDate: price?.recorded_at ?? null,
      averageCost: valuation?.average_cost != null ? Number(valuation.average_cost) : null,
      inventoryValue: valuation?.inventory_value != null ? Number(valuation.inventory_value) : null,
      needsInitialization: Boolean(valuation?.needs_initialization),
      raw: m,
    };
  });

  return items.filter((i) => (!filters.lowStockOnly || i.lowStock) && (!filters.needsValuationOnly || i.needsInitialization));
}

export type MaterialDetail = {
  material: Tables<"materials">;
  categoryName: string | null;
  unit: Tables<"material_units">;
  currentStock: number;
  recentMovements: (Tables<"stock_movements"> & { purchaseNumber: string | null; jobTitle: string | null })[];
  valuation: {
    initialized: boolean;
    needsInitialization: boolean;
    averageCost: number | null;
    inventoryValue: number | null;
  };
  lastPurchase: { unitCost: number; purchaseDate: string; purchaseNumber: string; supplierName: string | null } | null;
  openingEvent: { unitCost: number; quantity: number; createdAt: string; notes: string | null } | null;
  priceHistory: (Tables<"supplier_material_prices"> & { supplierName: string })[];
};

export async function getMaterialDetail(orgId: string, materialId: string): Promise<MaterialDetail | null> {
  const supabase = await createClient();

  const { data: material, error } = await supabase
    .from("materials")
    .select("*, category:material_categories(name), unit:material_units(*)")
    .eq("organization_id", orgId)
    .eq("id", materialId)
    .maybeSingle();

  if (error) throw error;
  if (!material) return null;

  const [
    { data: balance },
    { data: movements, error: movementsError },
    { data: prices, error: pricesError },
    { data: valuation },
    { data: lastPurchase },
    { data: openingEvent },
  ] =
    await Promise.all([
      supabase
        .from("material_stock_balances")
        .select("current_stock")
        .eq("material_id", materialId)
        .maybeSingle(),
      supabase
        .from("stock_movements")
        .select("*, purchase:purchases(purchase_number), job:jobs(title)")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("supplier_material_prices")
        .select("*, supplier:suppliers(name)")
        .eq("material_id", materialId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("material_valuation")
        .select("valuation_initialized, needs_initialization, average_cost, inventory_value")
        .eq("material_id", materialId)
        .maybeSingle(),
      supabase
        .from("material_latest_purchases")
        .select("unit_cost, purchase_date, purchase_number, supplier:suppliers(name)")
        .eq("material_id", materialId)
        .maybeSingle(),
      supabase
        .from("material_valuation_events")
        .select("unit_cost, quantity, created_at, notes")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (movementsError) throw movementsError;
  if (pricesError) throw pricesError;

  return {
    material,
    categoryName: material.category?.name ?? null,
    unit: material.unit,
    currentStock: Number(balance?.current_stock ?? 0),
    recentMovements: (movements ?? []).map(({ purchase, job, ...mv }) => ({
      ...mv,
      purchaseNumber: purchase?.purchase_number ?? null,
      jobTitle: job?.title ?? null,
    })),
    valuation: {
      initialized: Boolean(valuation?.valuation_initialized),
      needsInitialization: Boolean(valuation?.needs_initialization),
      averageCost: valuation?.average_cost != null ? Number(valuation.average_cost) : null,
      inventoryValue: valuation?.inventory_value != null ? Number(valuation.inventory_value) : null,
    },
    lastPurchase: lastPurchase
      ? {
          unitCost: Number(lastPurchase.unit_cost),
          purchaseDate: lastPurchase.purchase_date ?? "",
          purchaseNumber: lastPurchase.purchase_number ?? "",
          supplierName: lastPurchase.supplier?.name ?? null,
        }
      : null,
    openingEvent: openingEvent
      ? {
          unitCost: Number(openingEvent.unit_cost),
          quantity: Number(openingEvent.quantity),
          createdAt: openingEvent.created_at,
          notes: openingEvent.notes,
        }
      : null,
    priceHistory: (prices ?? []).map((p) => ({ ...p, supplierName: p.supplier?.name ?? "-" })),
  };
}

export type MaterialForQuoteItem = { id: string; name: string; unitSymbol: string; lastPrice: number | null };

export async function listMaterialsForQuoteItems(orgId: string): Promise<MaterialForQuoteItem[]> {
  const supabase = await createClient();
  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, name, unit:material_units(symbol)")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  if (!materials || materials.length === 0) return [];

  const { data: latestPrices } = await supabase
    .from("material_latest_prices")
    .select("material_id, price")
    .in(
      "material_id",
      materials.map((m) => m.id)
    );
  const priceByMaterial = new Map((latestPrices ?? []).map((p) => [p.material_id, Number(p.price)]));

  return materials.map((m) => ({
    id: m.id,
    name: m.name,
    unitSymbol: m.unit?.symbol ?? "",
    lastPrice: priceByMaterial.get(m.id) ?? null,
  }));
}

export async function getMaterialsWithStock(
  orgId: string,
  materialIds: string[]
): Promise<Map<string, number>> {
  if (materialIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_stock_balances")
    .select("material_id, current_stock")
    .in("material_id", materialIds);
  if (error) throw error;
  return new Map(
    (data ?? [])
      .filter((b): b is typeof b & { material_id: string } => b.material_id != null)
      .map((b) => [b.material_id, Number(b.current_stock)])
  );
}
