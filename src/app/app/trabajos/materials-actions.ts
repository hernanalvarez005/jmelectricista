"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

type ActionResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

const addJobMaterialSchema = z.object({
  materialId: z.string().uuid("Seleccioná un material"),
  estimatedQuantity: z.string().min(1, "Ingresá una cantidad"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AddJobMaterialInput = z.infer<typeof addJobMaterialSchema>;

export async function addJobMaterialAction(jobId: string, input: AddJobMaterialInput): Promise<ActionResult> {
  const parsed = addJobMaterialSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del material." };

  const quantity = parseDecimal(parsed.data.estimatedQuantity);
  if (quantity === null || quantity <= 0) return { error: "La cantidad debe ser mayor a 0." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para agregar materiales." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("job_materials")
    .insert({
      organization_id: organization.id,
      job_id: jobId,
      material_id: parsed.data.materialId,
      estimated_quantity: quantity,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ese material ya está agregado a este trabajo." };
    return { error: "No se pudo agregar el material." };
  }
  if (!data) return { error: "No se pudo agregar el material." };

  revalidatePath(`/app/trabajos/${jobId}`);
  return { id: data.id };
}

export async function removeJobMaterialAction(jobMaterialId: string, jobId: string): Promise<SimpleResult> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para quitar materiales." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("job_materials")
    .delete()
    .eq("id", jobMaterialId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo quitar el material." };
  revalidatePath(`/app/trabajos/${jobId}`);
  return { ok: true };
}

const consumptionSchema = z.object({ actualQuantity: z.string().min(1, "Ingresá una cantidad") });
export type RegisterConsumptionInput = z.infer<typeof consumptionSchema>;

export async function registerConsumptionAction(
  jobMaterialId: string,
  jobId: string,
  input: RegisterConsumptionInput
): Promise<SimpleResult> {
  const parsed = consumptionSchema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá una cantidad válida." };

  const quantity = parseDecimal(parsed.data.actualQuantity);
  if (quantity === null || quantity < 0) return { error: "Ingresá una cantidad válida." };

  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para registrar consumo." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("register_job_material_consumption", {
    p_job_material_id: jobMaterialId,
    p_actual_quantity: quantity,
  });

  if (error) return { error: "No se pudo registrar el consumo." };

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/materiales");
  return { ok: true };
}
