"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { friendlyBillingError, markInvoicedSchema, type MarkInvoicedInput } from "@/lib/validations/billing";

type SimpleResult = { error: string } | { ok: true };

function revalidateBilling(jobId: string) {
  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/cobros");
  revalidatePath("/app");
  revalidatePath("/app/clientes", "layout");
}

/** Marca operativa interna: no cambia el estado del trabajo, los cobros ni la cotización. */
export async function markJobInvoicedAction(jobId: string, input: MarkInvoicedInput): Promise<SimpleResult> {
  const parsed = markInvoicedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos de facturación." };

  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede modificar la facturación." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("mark_job_invoiced", {
    p_job_id: jobId,
    p_invoiced_at: parsed.data.invoicedAt,
    p_invoice_number: parsed.data.invoiceNumber || undefined,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { error: friendlyBillingError(error.message, "No se pudo marcar como facturado.") };

  revalidateBilling(jobId);
  return { ok: true };
}

export async function revertJobBillingAction(jobId: string, notes?: string): Promise<SimpleResult> {
  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede modificar la facturación." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("revert_job_billing", { p_job_id: jobId, p_notes: notes?.trim() || undefined });
  if (error) return { error: friendlyBillingError(error.message, "No se pudo volver a pendiente.") };

  revalidateBilling(jobId);
  return { ok: true };
}
