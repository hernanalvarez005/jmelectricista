"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import {
  friendlyInventoryError,
  initializeValuationSchema,
  type InitializeValuationInput,
} from "@/lib/validations/purchase";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  materialCategorySchema,
  materialSchema,
  materialUnitSchema,
  stockAdjustmentSchema,
  stockInitialSchema,
  type MaterialCategoryInput,
  type MaterialInput,
  type MaterialUnitInput,
  type StockAdjustmentInput,
  type StockInitialInput,
} from "@/lib/validations/material";

type ActionResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

export async function createMaterialCategoryAction(input: MaterialCategoryInput): Promise<ActionResult> {
  const parsed = materialCategorySchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la categoría." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear categorías." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("material_categories")
    .insert({ organization_id: organization.id, name: parsed.data.name, active: parsed.data.active })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear la categoría." };
  revalidatePath("/app/materiales");
  return { id: data.id };
}

export async function createMaterialUnitAction(input: MaterialUnitInput): Promise<ActionResult> {
  const parsed = materialUnitSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la unidad." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear unidades." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("material_units")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear la unidad." };
  revalidatePath("/app/materiales");
  return { id: data.id };
}

export async function createMaterialAction(input: MaterialInput): Promise<ActionResult> {
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del material." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear materiales." };

  const minimumStock = parseDecimal(parsed.data.minimumStock) ?? 0;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({
      organization_id: organization.id,
      category_id: parsed.data.categoryId || null,
      unit_id: parsed.data.unitId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      minimum_stock: minimumStock,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el material." };
  revalidatePath("/app/materiales");
  return { id: data.id };
}

export async function updateMaterialAction(materialId: string, input: MaterialInput): Promise<ActionResult> {
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del material." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar materiales." };

  const minimumStock = parseDecimal(parsed.data.minimumStock) ?? 0;
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("materials")
    .update({
      category_id: parsed.data.categoryId || null,
      unit_id: parsed.data.unitId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      minimum_stock: minimumStock,
      active: parsed.data.active,
    })
    .eq("id", materialId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el material." };
  revalidatePath("/app/materiales");
  revalidatePath(`/app/materiales/${materialId}`);
  return { id: materialId };
}

export async function registerInitialStockAction(
  materialId: string,
  input: StockInitialInput
): Promise<SimpleResult> {
  const parsed = stockInitialSchema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá una cantidad válida." };

  const quantity = parseDecimal(parsed.data.quantity);
  if (quantity === null || quantity <= 0) return { error: "La cantidad debe ser mayor a 0." };
  const unitCost = parseDecimal(parsed.data.unitCost);
  if (unitCost === null || unitCost < 0) return { error: "El costo unitario no es válido." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para registrar stock." };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("stock_movements").insert({
    organization_id: organization.id,
    material_id: materialId,
    movement_type: "in",
    quantity,
    unit_cost: unitCost,
    notes: parsed.data.notes || "Stock inicial",
    created_by: user?.id ?? null,
  });

  if (error) return { error: friendlyInventoryError(error.message, "No se pudo registrar el stock inicial.") };
  revalidatePath("/app/materiales");
  revalidatePath(`/app/materiales/${materialId}`);
  return { ok: true };
}

export async function adjustStockAction(
  materialId: string,
  input: StockAdjustmentInput
): Promise<SimpleResult> {
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del ajuste." };

  const quantity = parseDecimal(parsed.data.quantity);
  if (quantity === null || quantity <= 0) return { error: "La cantidad debe ser mayor a 0." };
  let unitCost: number | undefined;
  if (parsed.data.direction === "in") {
    const parsedCost = parseDecimal(parsed.data.unitCost ?? "");
    if (parsedCost === null || parsedCost < 0) return { error: "El costo unitario no es válido." };
    unitCost = parsedCost;
  }

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para ajustar stock." };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("stock_movements").insert({
    organization_id: organization.id,
    material_id: materialId,
    movement_type: parsed.data.direction === "in" ? "adjustment_in" : "adjustment_out",
    quantity,
    unit_cost: unitCost,
    notes: parsed.data.reason || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: friendlyInventoryError(error.message, "No se pudo registrar el ajuste.") };
  revalidatePath("/app/materiales");
  revalidatePath(`/app/materiales/${materialId}`);
  return { ok: true };
}

export async function initializeValuationAction(
  materialId: string,
  input: InitializeValuationInput
): Promise<SimpleResult> {
  const parsed = initializeValuationSchema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá un costo unitario válido." };

  const unitCost = parseDecimal(parsed.data.unitCost);
  if (unitCost === null || unitCost < 0) return { error: "El costo unitario no es válido." };

  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede inicializar la valoración." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("initialize_material_valuation", {
    p_material_id: materialId,
    p_unit_cost: unitCost,
    p_notes: parsed.data.notes || undefined,
  });

  if (error) return { error: friendlyInventoryError(error.message, "No se pudo inicializar la valoración.") };
  revalidatePath("/app/materiales");
  revalidatePath(`/app/materiales/${materialId}`);
  return { ok: true };
}
