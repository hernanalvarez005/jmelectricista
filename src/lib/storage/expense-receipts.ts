import { createClient } from "@/lib/supabase/server";

const BUCKET = "job-expense-receipts";

/**
 * Igual que los comprobantes de cobro: el path usa client_request_id (el UUID que
 * genera el formulario antes de registrar el gasto), porque el id del gasto todavía
 * no existe cuando se sube el archivo.
 */
export function expenseReceiptStoragePath(organizationId: string, jobId: string, clientRequestId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `organizations/${organizationId}/jobs/${jobId}/expenses/${clientRequestId}/${safeName}`;
}

export async function uploadExpenseReceipt(path: string, file: File): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  return { error: error?.message ?? null };
}

export async function getExpenseReceiptSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
