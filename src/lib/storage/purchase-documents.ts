import { createClient } from "@/lib/supabase/server";

const BUCKET = "purchase-documents";

export function purchaseDocumentStoragePath(organizationId: string, purchaseId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `organizations/${organizationId}/purchases/${purchaseId}/${Date.now()}-${safeName}`;
}

export async function uploadPurchaseDocument(path: string, file: File): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return { error: error?.message ?? null };
}

export async function getPurchaseDocumentSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
