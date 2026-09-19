import { createClient } from "@/lib/supabase/server";

export type QuoteShareLink = {
  id: string;
  token: string;
  openCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
};

/** Enlace ACTIVO de la cotización (RLS: solo owner/admin/worker; viewer recibe null). */
export async function getActiveQuoteShareLink(orgId: string, quoteId: string): Promise<QuoteShareLink | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_share_links")
    .select("id, token, open_count, last_opened_at, created_at")
    .eq("organization_id", orgId)
    .eq("quote_id", quoteId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, token: data.token, openCount: data.open_count, lastOpenedAt: data.last_opened_at, createdAt: data.created_at };
}
