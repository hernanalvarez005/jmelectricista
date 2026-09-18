import { createClient } from "@/lib/supabase/server";

const RECEIPTS_BUCKET = "payment-receipts";

/**
 * El path usa client_request_id (generado por el cliente antes de llamar a
 * register_job_payment) en vez del id del cobro, porque ese id todavía no
 * existe cuando el archivo se sube: subimos el comprobante primero y recién
 * después creamos el job_payment con ese receipt_path. client_request_id ya
 * es único por organización (constraint de idempotencia), así que sirve
 * igual de bien como segmento del path.
 */
export function paymentReceiptStoragePath(
  organizationId: string,
  jobId: string,
  clientRequestId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `organizations/${organizationId}/jobs/${jobId}/payments/${clientRequestId}/${safeName}`;
}

export async function uploadPaymentReceipt(
  path: string,
  file: File
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

export async function getPaymentReceiptSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
