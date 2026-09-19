"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { parseDecimal } from "@/lib/format/quantity";
import { expenseReceiptStoragePath, uploadExpenseReceipt } from "@/lib/storage/expense-receipts";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  EXPENSE_RECEIPT_ALLOWED_TYPES,
  EXPENSE_RECEIPT_MAX_BYTES,
  friendlyExpenseError,
  jobExpenseSchema,
  voidExpenseSchema,
  type VoidExpenseInput,
} from "@/lib/validations/expense";
import { friendlyLaborError } from "@/lib/validations/labor";

type SimpleResult = { error: string } | { ok: true };

function revalidateJob(jobId: string) {
  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/analisis");
}

/** Alta idempotente por client_request_id (doble click / retry no duplican el gasto). */
export async function registerExpenseAction(jobId: string, formData: FormData): Promise<{ error: string } | { id: string }> {
  const clientRequestId = formData.get("clientRequestId");
  if (typeof clientRequestId !== "string" || !clientRequestId) return { error: "Solicitud inválida, volvé a intentar." };

  const parsed = jobExpenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    expenseDate: formData.get("expenseDate"),
    description: formData.get("description"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del gasto." };

  const amount = parseDecimal(parsed.data.amount);
  if (amount === null || amount <= 0) return { error: "El importe debe ser mayor a 0." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para registrar gastos." };

  let receiptPath: string | undefined;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    if (!EXPENSE_RECEIPT_ALLOWED_TYPES.includes(receipt.type)) return { error: "El comprobante debe ser PDF, JPG, PNG o WEBP." };
    if (receipt.size > EXPENSE_RECEIPT_MAX_BYTES) return { error: "El comprobante no puede superar los 8 MB." };
    const path = expenseReceiptStoragePath(organization.id, jobId, clientRequestId, receipt.name);
    const { error: uploadError } = await uploadExpenseReceipt(path, receipt);
    if (uploadError) return { error: "No se pudo subir el comprobante." };
    receiptPath = path;
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("register_job_expense", {
    p_job_id: jobId,
    p_category_id: parsed.data.categoryId,
    p_expense_date: parsed.data.expenseDate,
    p_description: parsed.data.description,
    p_amount: amount,
    p_client_request_id: clientRequestId,
    p_receipt_path: receiptPath,
  });
  if (error || !data) return { error: friendlyExpenseError(error?.message, "No se pudo registrar el gasto.") };

  revalidateJob(jobId);
  return { id: data };
}

export async function voidExpenseAction(expenseId: string, jobId: string, input: VoidExpenseInput): Promise<SimpleResult> {
  const parsed = voidExpenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá el motivo de la anulación." };

  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede anular gastos." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("void_job_expense", { p_expense_id: expenseId, p_void_reason: parsed.data.reason });
  if (error) return { error: friendlyExpenseError(error.message, "No se pudo anular el gasto.") };

  revalidateJob(jobId);
  return { ok: true };
}

/** Corrección explícita del responsable de una sesión con tiempo real: reemplaza el snapshot de tarifa. */
export async function reassignSessionMemberAction(
  jobId: string,
  sessionId: string,
  memberId: string
): Promise<{ error: string } | { result: "costed" | "no_rate" | "no_time" }> {
  const { role } = await requireCurrentOrg();
  if (!canAdminister(role)) return { error: "Solo un administrador puede cambiar el responsable de una sesión con costo." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("reassign_session_member", { p_session_id: sessionId, p_member_id: memberId });
  if (error) return { error: friendlyLaborError(error.message, "No se pudo cambiar el responsable.") };

  revalidateJob(jobId);
  revalidatePath("/app/agenda");
  return { result: data as "costed" | "no_rate" | "no_time" };
}
