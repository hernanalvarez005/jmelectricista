import { createClient } from "@/lib/supabase/server";
import type { BillingFilter, BillingStatus } from "@/lib/validations/billing";
import type { PaymentStatus } from "@/lib/validations/payment";

export type JobBillingInfo = {
  jobId: string;
  status: BillingStatus;
  invoicedAt: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  /** Ya tiene sentido facturar: cotización aceptada, algún cobro vigente o ya facturado. */
  isBillable: boolean;
};

const PENDING = (jobId: string): JobBillingInfo => ({
  jobId,
  status: "pending",
  invoicedAt: null,
  invoiceNumber: null,
  notes: null,
  isBillable: false,
});

type BillingRow = {
  job_id: string | null;
  billing_status: string | null;
  invoiced_at: string | null;
  invoice_number: string | null;
  billing_notes: string | null;
  is_billable: boolean | null;
};

function toInfo(row: BillingRow & { job_id: string }): JobBillingInfo {
  return {
    jobId: row.job_id,
    status: row.billing_status === "invoiced" ? "invoiced" : "pending",
    invoicedAt: row.invoiced_at,
    invoiceNumber: row.invoice_number,
    notes: row.billing_notes,
    isBillable: Boolean(row.is_billable),
  };
}

export async function getJobBilling(orgId: string, jobId: string): Promise<JobBillingInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_billing_status")
    .select("job_id, billing_status, invoiced_at, invoice_number, billing_notes, is_billable")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data && data.job_id ? toInfo({ ...data, job_id: data.job_id }) : PENDING(jobId);
}

/** Una sola consulta para varios trabajos (ficha de cliente, listados): sin N+1. */
export async function getBillingByJobIds(orgId: string, jobIds: string[]): Promise<Map<string, JobBillingInfo>> {
  const map = new Map<string, JobBillingInfo>();
  if (jobIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_billing_status")
    .select("job_id, billing_status, invoiced_at, invoice_number, billing_notes, is_billable")
    .eq("organization_id", orgId)
    .in("job_id", jobIds);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.job_id) map.set(row.job_id, toInfo({ ...row, job_id: row.job_id }));
  }
  return map;
}

export type BillingHistoryItem = {
  id: string;
  fromStatus: BillingStatus | null;
  toStatus: BillingStatus;
  invoicedAt: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  changedAt: string;
};

/** Historial de facturación: solo owner/admin lo pueden leer (RLS); para el resto vuelve vacío. */
export async function getJobBillingHistory(orgId: string, jobId: string): Promise<BillingHistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_billing_history")
    .select("id, from_status, to_status, invoiced_at, invoice_number, notes, changed_at")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id,
    fromStatus: h.from_status as BillingStatus | null,
    toStatus: h.to_status as BillingStatus,
    invoicedAt: h.invoiced_at,
    invoiceNumber: h.invoice_number,
    notes: h.notes,
    changedAt: h.changed_at,
  }));
}

export type BillingPendingSummary = { pending: number; paidAndPending: number };

export async function getBillingPendingSummary(orgId: string): Promise<BillingPendingSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_pending_summary")
    .select("billing_pending_count, paid_and_billing_pending_count")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return {
    pending: Number(data?.billing_pending_count ?? 0),
    paidAndPending: Number(data?.paid_and_billing_pending_count ?? 0),
  };
}

export type BillingOverviewItem = {
  jobId: string;
  jobTitle: string;
  clientName: string;
  statusName: string;
  statusIsClosed: boolean;
  paymentStatus: PaymentStatus;
  contractedAmount: number | null;
  collectedAmount: number;
  outstandingAmount: number | null;
  billing: JobBillingInfo;
};

/**
 * Trabajos facturables con su estado de cobro, saldo y facturación, para /app/cobros. Tres consultas
 * agrupadas (billing, jobs, financial status): no hay una consulta por trabajo.
 * Orden: pendientes primero y, dentro de ellos, los ya cobrados por completo, luego cerrados; después por
 * los más antiguos.
 */
export async function getBillingOverview(orgId: string, filter: BillingFilter, limit = 200): Promise<BillingOverviewItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("job_billing_status")
    .select("job_id, billing_status, invoiced_at, invoice_number, billing_notes, is_billable")
    .eq("organization_id", orgId)
    .eq("is_billable", true)
    .limit(limit);
  if (filter !== "all") query = query.eq("billing_status", filter);
  const { data: billingRows, error } = await query;
  if (error) throw error;

  const rows = (billingRows ?? []).filter((r): r is typeof r & { job_id: string } => r.job_id != null);
  if (rows.length === 0) return [];
  const jobIds = rows.map((r) => r.job_id);

  const [{ data: jobs, error: jobsError }, { data: fin, error: finError }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, created_at, client:clients(name), status:job_statuses(name, is_closed)")
      .in("id", jobIds),
    supabase
      .from("job_financial_status")
      .select("job_id, contracted_amount, collected_amount, outstanding_amount, payment_status")
      .in("job_id", jobIds),
  ]);
  if (jobsError) throw jobsError;
  if (finError) throw finError;

  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const finByJob = new Map((fin ?? []).map((f) => [f.job_id, f]));

  const items = rows.map((r): BillingOverviewItem & { createdAt: string } => {
    const job = jobById.get(r.job_id);
    const f = finByJob.get(r.job_id);
    return {
      jobId: r.job_id,
      jobTitle: job?.title ?? "-",
      clientName: job?.client?.name ?? "-",
      statusName: job?.status?.name ?? "-",
      statusIsClosed: job?.status?.is_closed ?? false,
      paymentStatus: (f?.payment_status ?? "no_contract") as PaymentStatus,
      contractedAmount: f?.contracted_amount != null ? Number(f.contracted_amount) : null,
      collectedAmount: Number(f?.collected_amount ?? 0),
      outstandingAmount: f?.outstanding_amount != null ? Number(f.outstanding_amount) : null,
      billing: toInfo(r),
      createdAt: job?.created_at ?? "",
    };
  });

  const rank = (i: BillingOverviewItem) =>
    i.billing.status === "invoiced" ? 3 : i.paymentStatus === "paid" ? 0 : i.statusIsClosed ? 1 : 2;

  items.sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
  return items.map((item) => {
    const clean: Partial<typeof item> = { ...item };
    delete clean.createdAt;
    return clean as BillingOverviewItem;
  });
}
