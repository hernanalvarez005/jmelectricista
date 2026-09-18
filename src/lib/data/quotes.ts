import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type QuoteSummary = Pick<Tables<"quotes">, "id" | "quote_number" | "status" | "total">;

export async function getJobQuotes(orgId: string, jobId: string): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_number, status, total")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type QuoteListItem = Pick<
  Tables<"quotes">,
  "id" | "quote_number" | "status" | "total" | "issue_date"
> & {
  clientName: string;
  jobTitle: string;
};

export async function listQuotes(orgId: string, status?: string): Promise<QuoteListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, total, issue_date, client:clients(name), job:jobs(title)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    status: q.status,
    total: q.total,
    issue_date: q.issue_date,
    clientName: q.client?.name ?? "-",
    jobTitle: q.job?.title ?? "-",
  }));
}

export async function getQuoteCounts(orgId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select("status").eq("organization_id", orgId);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export type QuoteDashboardStats = { drafts: number; sentPending: number; acceptedThisMonth: number };

export async function getQuoteDashboardStats(orgId: string): Promise<QuoteDashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("status, accepted_at")
    .eq("organization_id", orgId);
  if (error) throw error;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let drafts = 0;
  let sentPending = 0;
  let acceptedThisMonth = 0;
  for (const row of data ?? []) {
    if (row.status === "draft") drafts++;
    if (row.status === "sent") sentPending++;
    if (row.status === "accepted" && row.accepted_at && new Date(row.accepted_at) >= monthStart) {
      acceptedThisMonth++;
    }
  }
  return { drafts, sentPending, acceptedThisMonth };
}

export type QuoteDetail = {
  quote: Tables<"quotes">;
  clientName: string;
  clientAddress: string | null;
  jobTitle: string;
  jobDescription: string | null;
  items: Tables<"quote_items">[];
};

export async function getQuoteDetail(orgId: string, quoteId: string): Promise<QuoteDetail | null> {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "*, client:clients(name), job:jobs(title, description, client_address:client_addresses(label, street, locality, province))"
    )
    .eq("organization_id", orgId)
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw error;
  if (!quote) return null;

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });
  if (itemsError) throw itemsError;

  const address = quote.job?.client_address;
  const addressParts = address ? [address.label, address.street, address.locality, address.province].filter(Boolean) : [];

  return {
    quote,
    clientName: quote.client?.name ?? "-",
    clientAddress: addressParts.length > 0 ? addressParts.join(", ") : null,
    jobTitle: quote.job?.title ?? "-",
    jobDescription: quote.job?.description ?? null,
    items: items ?? [],
  };
}
