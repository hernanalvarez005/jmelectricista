"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getQuoteDetail } from "@/lib/data/quotes";
import { parseDecimal } from "@/lib/format/quantity";
import { getOrCreateQuotePdfSignedUrl } from "@/lib/pdf/generate-quote-pdf";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  quoteDetailsSchema,
  quoteItemSchema,
  type QuoteDetailsInput,
  type QuoteItemInput,
} from "@/lib/validations/quote";

type ActionResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

function revalidateQuote(jobId: string, quoteId: string) {
  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath(`/app/cotizaciones/${quoteId}`);
  revalidatePath("/app");
}

export async function createQuoteAction(jobId: string, clientId: string): Promise<ActionResult> {
  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear cotizaciones." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("create_quote", {
    p_job_id: jobId,
    p_client_id: clientId,
  });

  if (error || !data) return { error: "No se pudo crear la cotización." };
  revalidatePath(`/app/trabajos/${jobId}`);
  return { id: data };
}

export async function importJobMaterialsAction(quoteId: string, jobId: string): Promise<SimpleResult> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar esta cotización." };

  const supabase = await createSupabaseClient();

  const { data: jobMaterials, error: jmError } = await supabase
    .from("job_materials")
    .select("material_id, estimated_quantity, material:materials(name, unit:material_units(symbol))")
    .eq("job_id", jobId);
  if (jmError) return { error: "No se pudieron leer los materiales del trabajo." };
  if (!jobMaterials || jobMaterials.length === 0) return { error: "Este trabajo no tiene materiales cargados." };

  const materialIds = jobMaterials.map((m) => m.material_id);
  const { data: latestPrices } = await supabase
    .from("material_latest_prices")
    .select("material_id, price")
    .in("material_id", materialIds);
  const priceByMaterial = new Map((latestPrices ?? []).map((p) => [p.material_id, Number(p.price)]));

  const { data: existingItems } = await supabase
    .from("quote_items")
    .select("material_id")
    .eq("quote_id", quoteId)
    .not("material_id", "is", null);
  const existingMaterialIds = new Set((existingItems ?? []).map((i) => i.material_id));

  const { data: maxSort } = await supabase
    .from("quote_items")
    .select("sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = (maxSort?.sort_order ?? 0) + 1;

  const rows = jobMaterials
    .filter((m) => !existingMaterialIds.has(m.material_id))
    .map((m) => ({
      organization_id: organization.id,
      quote_id: quoteId,
      item_type: "material" as const,
      material_id: m.material_id,
      description: m.material?.name ?? "Material",
      quantity: Number(m.estimated_quantity),
      unit: m.material?.unit?.symbol ?? "u",
      cost_unit_price: priceByMaterial.get(m.material_id) ?? null,
      sale_unit_price: priceByMaterial.get(m.material_id) ?? 0,
      sort_order: sortOrder++,
    }));

  if (rows.length === 0) return { error: "Los materiales de este trabajo ya fueron importados." };

  const { error } = await supabase.from("quote_items").insert(rows);
  if (error) return { error: "No se pudieron importar los materiales." };

  revalidatePath(`/app/cotizaciones/${quoteId}`);
  return { ok: true };
}

export async function addQuoteItemAction(quoteId: string, jobId: string, input: QuoteItemInput): Promise<ActionResult> {
  const parsed = quoteItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del ítem." };

  const quantity = parseDecimal(parsed.data.quantity);
  const salePrice = parseDecimal(parsed.data.saleUnitPrice);
  const costPrice = parsed.data.costUnitPrice ? parseDecimal(parsed.data.costUnitPrice) : null;
  if (quantity === null || quantity <= 0) return { error: "La cantidad debe ser mayor a 0." };
  if (salePrice === null || salePrice < 0) return { error: "Ingresá un precio de venta válido." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar esta cotización." };

  const supabase = await createSupabaseClient();
  const { data: maxSort } = await supabase
    .from("quote_items")
    .select("sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("quote_items")
    .insert({
      organization_id: organization.id,
      quote_id: quoteId,
      item_type: parsed.data.itemType,
      material_id: parsed.data.itemType === "material" ? parsed.data.materialId || null : null,
      description: parsed.data.description,
      quantity,
      unit: parsed.data.unit,
      cost_unit_price: costPrice,
      sale_unit_price: salePrice,
      sort_order: (maxSort?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo agregar el ítem. Verificá que la cotización siga en borrador." };
  revalidateQuote(jobId, quoteId);
  return { id: data.id };
}

export async function deleteQuoteItemAction(itemId: string, jobId: string, quoteId: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar esta cotización." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
  if (error) return { error: "No se pudo quitar el ítem." };
  revalidateQuote(jobId, quoteId);
  return { ok: true };
}

export async function updateQuoteDetailsAction(
  quoteId: string,
  jobId: string,
  input: QuoteDetailsInput
): Promise<SimpleResult> {
  const parsed = quoteDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos." };

  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar esta cotización." };

  const discount = parsed.data.discountAmount ? (parseDecimal(parsed.data.discountAmount) ?? 0) : 0;

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      valid_until: parsed.data.validUntil || null,
      discount_amount: discount,
      notes: parsed.data.notes || null,
      terms: parsed.data.terms || null,
    })
    .eq("id", quoteId);

  if (error) return { error: "No se pudo actualizar la cotización. Verificá que siga en borrador." };
  revalidateQuote(jobId, quoteId);
  return { ok: true };
}

async function transitionQuote(quoteId: string, jobId: string, status: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para esta acción." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId);
  if (error) {
    // Índice único parcial quotes_one_accepted_per_job: un trabajo no puede
    // tener dos cotizaciones "accepted" al mismo tiempo.
    if (error.code === "23505" && error.message.includes("quotes_one_accepted_per_job")) {
      return { error: "Ya existe una cotización aceptada para este trabajo." };
    }
    return { error: "No se pudo actualizar el estado de la cotización." };
  }
  revalidateQuote(jobId, quoteId);
  return { ok: true };
}

export async function markQuoteSentAction(quoteId: string, jobId: string): Promise<SimpleResult> {
  const result = await transitionQuote(quoteId, jobId, "sent");
  if ("error" in result) return result;

  // Congela el PDF en el momento del envío: a partir de acá se sirve
  // siempre esa misma versión, nunca una regenerada en silencio.
  const { organization } = await requireCurrentOrg();
  const detail = await getQuoteDetail(organization.id, quoteId);
  if (detail) {
    try {
      await getOrCreateQuotePdfSignedUrl(organization, detail);
    } catch {
      // El envío ya se registró; si el PDF falla acá, se puede regenerar
      // más tarde desde el botón "Ver PDF" (self-heals si falta en Storage).
    }
  }

  return result;
}
export async function acceptQuoteAction(quoteId: string, jobId: string) {
  return transitionQuote(quoteId, jobId, "accepted");
}
export async function rejectQuoteAction(quoteId: string, jobId: string) {
  return transitionQuote(quoteId, jobId, "rejected");
}
