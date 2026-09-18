"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import { purchaseDocumentStoragePath, uploadPurchaseDocument } from "@/lib/storage/purchase-documents";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  PURCHASE_DOC_ALLOWED_TYPES,
  PURCHASE_DOC_MAX_BYTES,
  friendlyInventoryError,
  newPurchaseSchema,
  purchaseHeaderSchema,
  purchaseItemSchema,
  type NewPurchaseInput,
  type PurchaseHeaderInput,
  type PurchaseItemInput,
} from "@/lib/validations/purchase";

type IdResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

function parseItem(item: PurchaseItemInput): { materialId: string; quantity: number; unitCost: number; notes: string | null } | { error: string } {
  const quantity = parseDecimal(item.quantity);
  if (quantity === null || quantity <= 0) return { error: "La cantidad debe ser mayor a 0." };
  const unitCost = parseDecimal(item.unitCost);
  if (unitCost === null || unitCost < 0) return { error: "El costo unitario no es válido." };
  return { materialId: item.materialId, quantity, unitCost, notes: item.notes?.trim() || null };
}

function revalidatePurchase(purchaseId?: string) {
  revalidatePath("/app/compras");
  if (purchaseId) revalidatePath(`/app/compras/${purchaseId}`);
  revalidatePath("/app/materiales");
  revalidatePath("/app");
}

/**
 * Crea el borrador y sus ítems. create_purchase es idempotente por
 * client_request_id: si la solicitud se reenvía (doble click, retry) se reutiliza
 * el borrador y los ítems solo se insertan si todavía no hay ninguno.
 */
export async function createPurchaseAction(input: NewPurchaseInput, clientRequestId: string): Promise<IdResult> {
  const parsed = newPurchaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos de la compra." };
  if (!clientRequestId) return { error: "Solicitud inválida, volvé a intentar." };

  const items = [];
  for (const raw of parsed.data.items) {
    const item = parseItem(raw);
    if ("error" in item) return { error: item.error };
    items.push(item);
  }
  if (new Set(items.map((i) => i.materialId)).size !== items.length) {
    return { error: "Un material aparece más de una vez. Unificá las cantidades en una sola línea." };
  }

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear compras." };

  const supabase = await createSupabaseClient();
  const { data: purchaseId, error } = await supabase.rpc("create_purchase", {
    p_supplier_id: parsed.data.supplierId,
    p_purchase_date: parsed.data.purchaseDate,
    p_client_request_id: clientRequestId,
    p_notes: parsed.data.notes || undefined,
    p_source_job_id: parsed.data.sourceJobId || undefined,
  });
  if (error || !purchaseId) return { error: friendlyInventoryError(error?.message, "No se pudo crear la compra.") };

  const { count } = await supabase
    .from("purchase_items")
    .select("id", { count: "exact", head: true })
    .eq("purchase_id", purchaseId);

  if (!count) {
    const { error: itemsError } = await supabase.from("purchase_items").insert(
      items.map((item, index) => ({
        organization_id: organization.id,
        purchase_id: purchaseId,
        material_id: item.materialId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        notes: item.notes,
        sort_order: index,
      }))
    );
    if (itemsError) return { error: "No se pudieron guardar los ítems de la compra." };
  }

  revalidatePurchase(purchaseId);
  return { id: purchaseId };
}

export async function updatePurchaseHeaderAction(purchaseId: string, input: PurchaseHeaderInput): Promise<SimpleResult> {
  const parsed = purchaseHeaderSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la compra." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar compras." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("purchases")
    .update({
      supplier_id: parsed.data.supplierId,
      purchase_date: parsed.data.purchaseDate,
      notes: parsed.data.notes || null,
    })
    .eq("id", purchaseId)
    .eq("organization_id", organization.id);

  if (error) return { error: friendlyInventoryError(error.message, "No se pudo actualizar la compra.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function addPurchaseItemAction(purchaseId: string, input: PurchaseItemInput): Promise<SimpleResult> {
  const parsedInput = purchaseItemSchema.safeParse(input);
  if (!parsedInput.success) return { error: parsedInput.error.issues[0]?.message ?? "Revisá los datos del ítem." };
  const item = parseItem(parsedInput.data);
  if ("error" in item) return { error: item.error };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar compras." };

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("purchase_items")
    .select("id, sort_order")
    .eq("purchase_id", purchaseId)
    .eq("material_id", item.materialId)
    .maybeSingle();
  if (existing) return { error: "Ese material ya está en la compra. Editá su línea." };

  const { data: last } = await supabase
    .from("purchase_items")
    .select("sort_order")
    .eq("purchase_id", purchaseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("purchase_items").insert({
    organization_id: organization.id,
    purchase_id: purchaseId,
    material_id: item.materialId,
    quantity: item.quantity,
    unit_cost: item.unitCost,
    notes: item.notes,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { error: friendlyInventoryError(error.message, "No se pudo agregar el ítem.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function updatePurchaseItemAction(purchaseId: string, itemId: string, input: PurchaseItemInput): Promise<SimpleResult> {
  const parsedInput = purchaseItemSchema.safeParse(input);
  if (!parsedInput.success) return { error: parsedInput.error.issues[0]?.message ?? "Revisá los datos del ítem." };
  const item = parseItem(parsedInput.data);
  if ("error" in item) return { error: item.error };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar compras." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("purchase_items")
    .update({ quantity: item.quantity, unit_cost: item.unitCost, notes: item.notes })
    .eq("id", itemId)
    .eq("purchase_id", purchaseId)
    .eq("organization_id", organization.id);
  if (error) return { error: friendlyInventoryError(error.message, "No se pudo actualizar el ítem.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function removePurchaseItemAction(purchaseId: string, itemId: string): Promise<SimpleResult> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar compras." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("purchase_items")
    .delete()
    .eq("id", itemId)
    .eq("purchase_id", purchaseId)
    .eq("organization_id", organization.id);
  if (error) return { error: friendlyInventoryError(error.message, "No se pudo quitar el ítem.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function receivePurchaseAction(purchaseId: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede recibir compras." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("receive_purchase", { p_purchase_id: purchaseId });
  if (error) return { error: friendlyInventoryError(error.message, "No se pudo recibir la compra.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function cancelPurchaseAction(purchaseId: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede cancelar compras." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("cancel_purchase", { p_purchase_id: purchaseId });
  if (error) {
    if (error.message.includes("recibida")) return { error: "Una compra recibida no se puede cancelar." };
    return { error: friendlyInventoryError(error.message, "No se pudo cancelar la compra.") };
  }
  revalidatePurchase(purchaseId);
  return { ok: true };
}

export async function uploadPurchaseDocumentAction(purchaseId: string, formData: FormData): Promise<SimpleResult> {
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí un archivo." };
  if (!PURCHASE_DOC_ALLOWED_TYPES.includes(file.type)) return { error: "El documento debe ser PDF, JPG, PNG o WEBP." };
  if (file.size > PURCHASE_DOC_MAX_BYTES) return { error: "El documento no puede superar los 10 MB." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar compras." };

  const supabase = await createSupabaseClient();
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("id", purchaseId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!purchase) return { error: "Compra no encontrada." };

  const path = purchaseDocumentStoragePath(organization.id, purchaseId, file.name);
  const { error: uploadError } = await uploadPurchaseDocument(path, file);
  if (uploadError) return { error: "No se pudo subir el documento." };

  const { error } = await supabase.from("purchases").update({ document_path: path }).eq("id", purchaseId);
  if (error) return { error: friendlyInventoryError(error.message, "No se pudo asociar el documento.") };
  revalidatePurchase(purchaseId);
  return { ok: true };
}
