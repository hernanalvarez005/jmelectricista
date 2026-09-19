"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { friendlyLaborError, laborRateSchema, type LaborRateInput } from "@/lib/validations/labor";

type SimpleResult = { error: string } | { ok: true };

export async function setLaborRateAction(input: LaborRateInput): Promise<{ error: string } | { id: string }> {
  const parsed = laborRateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos de la tarifa." };

  const hourlyCost = parseDecimal(parsed.data.hourlyCost);
  if (hourlyCost === null || hourlyCost < 0) return { error: "El costo por hora debe ser mayor o igual a 0." };

  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede configurar costos de mano de obra." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("set_member_labor_rate", {
    p_member_id: parsed.data.memberId,
    p_hourly_cost: hourlyCost,
    p_valid_from: parsed.data.validFrom,
    p_notes: parsed.data.notes || undefined,
  });
  if (error || !data) return { error: friendlyLaborError(error?.message, "No se pudo guardar la tarifa.") };

  revalidatePath("/app/configuracion");
  return { id: data };
}

export async function deleteLaborRateAction(rateId: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede configurar costos de mano de obra." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("delete_member_labor_rate", { p_rate_id: rateId });
  if (error) return { error: friendlyLaborError(error.message, "No se pudo eliminar la tarifa.") };

  revalidatePath("/app/configuracion");
  return { ok: true };
}

/** Acción explícita: valoriza las sesiones con tiempo real y responsable que no tienen tarifa congelada. */
export async function backfillLaborCostsAction(memberId?: string): Promise<{ error: string } | { count: number }> {
  const { organization, role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede valorizar sesiones históricas." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("backfill_session_labor_costs", {
    p_organization_id: organization.id,
    p_member_id: memberId,
  });
  if (error) return { error: friendlyLaborError(error.message, "No se pudieron valorizar las sesiones.") };

  revalidatePath("/app/configuracion");
  revalidatePath("/app/trabajos", "layout");
  revalidatePath("/app/analisis");
  return { count: Number(data ?? 0) };
}
