import { createPublicClient } from "@/lib/supabase/public";

/**
 * DTO público de una cotización compartida (lo devuelve get_public_quote). Es la ÚNICA información
 * que la página y el PDF públicos pueden usar: datos comerciales para el cliente, nada interno.
 */
export type PublicQuote = {
  organization_name: string;
  currency: string;
  quote_number: string;
  issue_date: string;
  valid_until: string | null;
  client_name: string;
  client_address: string | null;
  job_title: string;
  job_description: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  terms: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }[];
};

export const PUBLIC_QUOTE_KEYS = [
  "organization_name",
  "currency",
  "quote_number",
  "issue_date",
  "valid_until",
  "client_name",
  "client_address",
  "job_title",
  "job_description",
  "subtotal",
  "discount_amount",
  "total",
  "terms",
  "notes",
  "items",
] as const;

export const PUBLIC_QUOTE_ITEM_KEYS = ["description", "quantity", "unit", "unit_price", "subtotal"] as const;

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_quote", { p_token: token });
  if (error || !data) return null;
  return data as unknown as PublicQuote;
}

/** Cuenta la apertura (contador + última apertura, sin IP ni user agent). Es una operación atómica del lado de la DB. */
export async function recordPublicQuoteOpen(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return;
  const supabase = createPublicClient();
  await supabase.rpc("record_quote_share_open", { p_token: token });
}
