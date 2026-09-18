"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg, canOperate } from "@/lib/data/current-org";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { clientAddressSchema, clientSchema, type ClientAddressInput, type ClientInput } from "@/lib/validations/client";

type ActionResult = { error: string } | { id: string };

export async function createClientAction(input: ClientInput): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del cliente." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear clientes." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      tax_id: parsed.data.taxId || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el cliente." };

  revalidatePath("/app/clientes");
  return { id: data.id };
}

export async function updateClientAction(
  clientId: string,
  input: ClientInput
): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del cliente." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar clientes." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      tax_id: parsed.data.taxId || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .eq("id", clientId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el cliente." };

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${clientId}`);
  return { id: clientId };
}

export async function createClientAddressAction(
  clientId: string,
  input: ClientAddressInput
): Promise<ActionResult> {
  const parsed = clientAddressSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la dirección." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para agregar direcciones." };

  const supabase = await createSupabaseClient();

  if (parsed.data.isDefault) {
    await supabase
      .from("client_addresses")
      .update({ is_default: false })
      .eq("client_id", clientId)
      .eq("organization_id", organization.id);
  }

  const { data, error } = await supabase
    .from("client_addresses")
    .insert({
      organization_id: organization.id,
      client_id: clientId,
      label: parsed.data.label || null,
      street: parsed.data.street || null,
      locality: parsed.data.locality || null,
      province: parsed.data.province || null,
      postal_code: parsed.data.postalCode || null,
      notes: parsed.data.notes || null,
      is_default: parsed.data.isDefault,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo guardar la dirección." };

  revalidatePath(`/app/clientes/${clientId}`);
  revalidatePath("/app/clientes");
  return { id: data.id };
}
