"use server";

import { revalidatePath } from "next/cache";

import { zonedDateTimeToIso } from "@/lib/scheduling/timezone";

import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { supplierPriceSchema, supplierSchema, type SupplierInput, type SupplierPriceInput } from "@/lib/validations/supplier";

type ActionResult = { error: string } | { id: string };

export async function createSupplierAction(input: SupplierInput): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del proveedor." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear proveedores." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      contact_name: parsed.data.contactName || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el proveedor." };
  revalidatePath("/app/proveedores");
  return { id: data.id };
}

export async function updateSupplierAction(supplierId: string, input: SupplierInput): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del proveedor." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar proveedores." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      contact_name: parsed.data.contactName || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .eq("id", supplierId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el proveedor." };
  revalidatePath("/app/proveedores");
  revalidatePath(`/app/proveedores/${supplierId}`);
  return { id: supplierId };
}

export async function registerSupplierPriceAction(
  materialId: string,
  input: SupplierPriceInput
): Promise<ActionResult> {
  const parsed = supplierPriceSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del precio." };

  const price = parseDecimal(parsed.data.price);
  if (price === null || price < 0) return { error: "Ingresá un precio válido." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para registrar precios." };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("supplier_material_prices")
    .insert({
      organization_id: organization.id,
      supplier_id: parsed.data.supplierId,
      material_id: materialId,
      price,
      currency: organization.currency,
      // El usuario elige una fecha (calendario); se guarda al mediodía de la zona
      // de la organización para que se muestre ese mismo día en cualquier lado.
      recorded_at: zonedDateTimeToIso(parsed.data.recordedAt, "12:00", organization.timezone),
      notes: parsed.data.notes || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo registrar el precio." };
  revalidatePath(`/app/materiales/${materialId}`);
  revalidatePath("/app/materiales");
  revalidatePath("/app/proveedores");
  return { id: data.id };
}
