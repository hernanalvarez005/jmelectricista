"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getJobFinancialStatus } from "@/lib/data/payments";
import { parseDecimal } from "@/lib/format/quantity";
import { paymentReceiptStoragePath, uploadPaymentReceipt } from "@/lib/storage/payment-receipts";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  RECEIPT_ALLOWED_TYPES,
  RECEIPT_MAX_BYTES,
  jobPaymentSchema,
  voidPaymentSchema,
} from "@/lib/validations/payment";

type RegisterPaymentResult = { error: string } | { id: string; outstandingAmount: number | null };
type SimpleResult = { error: string } | { ok: true };

/** Traduce errores crudos de Postgres/RPC a mensajes que un usuario puede entender. */
function friendlyPaymentError(message: string | undefined): string {
  if (!message) return "No se pudo registrar el cobro.";
  if (message.includes("requiere una cuenta")) return "Este medio de pago requiere una cuenta.";
  if (message.includes("not authorized")) return "No tenés permiso para registrar cobros.";
  if (message.includes("amount debe ser mayor a 0")) return "El importe debe ser mayor a 0.";
  return "No se pudo registrar el cobro.";
}

export async function registerPaymentAction(jobId: string, formData: FormData): Promise<RegisterPaymentResult> {
  const clientRequestId = formData.get("clientRequestId");
  if (typeof clientRequestId !== "string" || !clientRequestId) {
    return { error: "Solicitud inválida, volvé a intentar." };
  }

  const parsed = jobPaymentSchema.safeParse({
    paymentDate: formData.get("paymentDate"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentAccountId: formData.get("paymentAccountId") ?? "",
    reference: formData.get("reference") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "Revisá los datos del cobro." };

  const amount = parseDecimal(parsed.data.amount);
  if (amount === null || amount <= 0) return { error: "El importe debe ser mayor a 0." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para registrar cobros." };

  const supabase = await createSupabaseClient();

  let receiptPath: string | undefined;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    if (!RECEIPT_ALLOWED_TYPES.includes(receipt.type)) {
      return { error: "El comprobante debe ser PDF, JPG, PNG o WEBP." };
    }
    if (receipt.size > RECEIPT_MAX_BYTES) {
      return { error: "El comprobante no puede superar los 8 MB." };
    }
    const path = paymentReceiptStoragePath(organization.id, jobId, clientRequestId, receipt.name);
    const { error: uploadError } = await uploadPaymentReceipt(path, receipt);
    if (uploadError) return { error: "No se pudo subir el comprobante." };
    receiptPath = path;
  }

  const { data, error } = await supabase.rpc("register_job_payment", {
    p_job_id: jobId,
    p_payment_date: parsed.data.paymentDate,
    p_amount: amount,
    p_payment_method_id: parsed.data.paymentMethodId,
    p_client_request_id: clientRequestId,
    p_payment_account_id: parsed.data.paymentAccountId || undefined,
    p_reference: parsed.data.reference || undefined,
    p_notes: parsed.data.notes || undefined,
    p_receipt_path: receiptPath,
  });

  if (error || !data) return { error: friendlyPaymentError(error?.message) };

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/cobros");
  revalidatePath("/app");

  const financialStatus = await getJobFinancialStatus(organization.id, jobId);
  return { id: data as string, outstandingAmount: financialStatus.outstandingAmount };
}

export async function voidPaymentAction(
  paymentId: string,
  jobId: string,
  input: { reason: string }
): Promise<SimpleResult> {
  const parsed = voidPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá un motivo de anulación." };

  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "No tenés permiso para anular cobros." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("void_job_payment", {
    p_payment_id: paymentId,
    p_void_reason: parsed.data.reason,
  });

  if (error) {
    if (error.message.includes("ya fue anulado")) return { error: "Este cobro ya fue anulado." };
    return { error: "No se pudo anular el cobro." };
  }

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/cobros");
  revalidatePath("/app");
  return { ok: true };
}
