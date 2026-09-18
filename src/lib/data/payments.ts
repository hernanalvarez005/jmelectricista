import { createClient } from "@/lib/supabase/server";
import { addMonthsToKey, monthStartKey, todayKeyInTZ } from "@/lib/scheduling/timezone";
import type { PaymentStatus } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

export async function listPaymentMethods(
  orgId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Tables<"payment_methods">[]> {
  const supabase = await createClient();
  let query = supabase
    .from("payment_methods")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listPaymentAccounts(
  orgId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {}
): Promise<Tables<"payment_accounts">[]> {
  const supabase = await createClient();
  let query = supabase.from("payment_accounts").select("*").eq("organization_id", orgId).order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type JobPaymentItem = {
  id: string;
  paymentDate: string;
  amount: number;
  methodName: string;
  accountName: string | null;
  reference: string | null;
  notes: string | null;
  receiptPath: string | null;
  createdAt: string;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
};

export async function getJobPayments(orgId: string, jobId: string): Promise<JobPaymentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_payments")
    .select(
      "id, payment_date, amount, reference, notes, receipt_path, created_at, voided_at, void_reason, method:payment_methods(name), account:payment_accounts(name)"
    )
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    paymentDate: p.payment_date,
    amount: Number(p.amount),
    methodName: p.method?.name ?? "-",
    accountName: p.account?.name ?? null,
    reference: p.reference,
    notes: p.notes,
    receiptPath: p.receipt_path,
    createdAt: p.created_at,
    isVoided: p.voided_at != null,
    voidedAt: p.voided_at,
    voidReason: p.void_reason,
  }));
}

export type JobFinancialStatus = {
  jobId: string;
  acceptedQuoteId: string | null;
  contractedAmount: number | null;
  collectedAmount: number;
  outstandingAmount: number | null;
  overpaidAmount: number;
  paymentStatus: PaymentStatus;
  lastPaymentDate: string | null;
};

const EMPTY_FINANCIAL_STATUS: Omit<JobFinancialStatus, "jobId"> = {
  acceptedQuoteId: null,
  contractedAmount: null,
  collectedAmount: 0,
  outstandingAmount: null,
  overpaidAmount: 0,
  paymentStatus: "no_contract",
  lastPaymentDate: null,
};

export async function getJobFinancialStatus(orgId: string, jobId: string): Promise<JobFinancialStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_financial_status")
    .select("*")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { jobId, ...EMPTY_FINANCIAL_STATUS };

  return {
    jobId,
    acceptedQuoteId: data.accepted_quote_id,
    contractedAmount: data.contracted_amount != null ? Number(data.contracted_amount) : null,
    collectedAmount: Number(data.collected_amount ?? 0),
    outstandingAmount: data.outstanding_amount != null ? Number(data.outstanding_amount) : null,
    overpaidAmount: Number(data.overpaid_amount ?? 0),
    paymentStatus: (data.payment_status ?? "no_contract") as PaymentStatus,
    lastPaymentDate: data.last_payment_date,
  };
}

/**
 * Fecha en la que el trabajo entró por última vez a un status
 * `is_closed = true`, derivada de job_status_history (no existe una columna
 * explícita de "fecha de cierre" y no se debe inventar con `updated_at`).
 */
async function getClosedAtByJob(orgId: string, jobIds: string[]): Promise<Map<string, string>> {
  if (jobIds.length === 0) return new Map();
  const supabase = await createClient();

  const { data: statuses, error: statusesError } = await supabase
    .from("job_statuses")
    .select("id, is_closed")
    .eq("organization_id", orgId);
  if (statusesError) throw statusesError;
  const closedStatusIds = new Set((statuses ?? []).filter((s) => s.is_closed).map((s) => s.id));
  if (closedStatusIds.size === 0) return new Map();

  const { data: history, error: historyError } = await supabase
    .from("job_status_history")
    .select("job_id, to_status_id, changed_at")
    .in("job_id", jobIds)
    .order("changed_at", { ascending: false });
  if (historyError) throw historyError;

  const closedAtByJob = new Map<string, string>();
  for (const row of history ?? []) {
    if (closedAtByJob.has(row.job_id)) continue;
    if (closedStatusIds.has(row.to_status_id)) {
      closedAtByJob.set(row.job_id, row.changed_at);
    }
  }
  return closedAtByJob;
}

export type JobBalanceItem = {
  jobId: string;
  jobTitle: string;
  clientName: string;
  contractedAmount: number | null;
  collectedAmount: number;
  outstandingAmount: number;
  statusName: string;
  statusIsClosed: boolean;
  lastPaymentDate: string | null;
  closedAt: string | null;
  targetDate: string | null;
};

/**
 * Trabajos con saldo pendiente (outstanding_amount > 0; los trabajos sin
 * cotización aceptada no entran acá porque no tienen saldo calculable).
 * Orden: cerrados con saldo primero (más urgente: ya se hizo el trabajo y
 * falta cobrar), ordenados por fecha de cierre más antigua primero; luego
 * los abiertos, por fecha objetivo más próxima primero.
 */
export async function getJobsWithOutstandingBalance(orgId: string, limit = 200): Promise<JobBalanceItem[]> {
  const supabase = await createClient();
  // job_financial_status es una view (sin FK declaradas), así que el embed
  // de jobs/clients/job_statuses a través de ella no tipa bien; se resuelve
  // con una segunda consulta sobre la tabla real jobs (con FKs) y se mergea
  // acá, igual que getJobMaterials hace con job_material_status.
  const { data: balances, error: balancesError } = await supabase
    .from("job_financial_status")
    .select("job_id, contracted_amount, collected_amount, outstanding_amount, last_payment_date")
    .eq("organization_id", orgId)
    .gt("outstanding_amount", 0)
    .limit(limit);
  if (balancesError) throw balancesError;
  // job_id nunca es null en la práctica (jobs.id es la tabla conductora del
  // join), pero las columnas de una view no llevan NOT NULL en el catálogo,
  // así que Postgres los tipa nullable — se filtra explícitamente en vez de
  // usar `!` para mantener el tipado honesto.
  const validBalances = (balances ?? []).filter((b): b is typeof b & { job_id: string } => b.job_id != null);
  if (validBalances.length === 0) return [];

  const jobIds = validBalances.map((b) => b.job_id);
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, target_date, client:clients(name), status:job_statuses(name, is_closed)")
    .in("id", jobIds);
  if (jobsError) throw jobsError;
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));

  const closedAtByJob = await getClosedAtByJob(
    orgId,
    jobIds.filter((id) => jobById.get(id)?.status?.is_closed)
  );

  const items: JobBalanceItem[] = validBalances.map((b) => {
    const job = jobById.get(b.job_id);
    return {
      jobId: b.job_id,
      jobTitle: job?.title ?? "-",
      clientName: job?.client?.name ?? "-",
      contractedAmount: b.contracted_amount != null ? Number(b.contracted_amount) : null,
      collectedAmount: Number(b.collected_amount ?? 0),
      outstandingAmount: Number(b.outstanding_amount ?? 0),
      statusName: job?.status?.name ?? "-",
      statusIsClosed: job?.status?.is_closed ?? false,
      lastPaymentDate: b.last_payment_date,
      closedAt: closedAtByJob.get(b.job_id) ?? null,
      targetDate: job?.target_date ?? null,
    };
  });

  return items.sort((a, b) => {
    if (a.statusIsClosed !== b.statusIsClosed) return a.statusIsClosed ? -1 : 1;
    if (a.statusIsClosed) {
      if (a.closedAt && b.closedAt) return a.closedAt.localeCompare(b.closedAt);
      return 0;
    }
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return 0;
  });
}

export type PaymentsDashboardStats = {
  collectedThisMonth: number;
  outstandingTotal: number;
  jobsWithBalanceCount: number;
  closedJobsWithBalanceCount: number;
};

export async function getPaymentsDashboardStats(orgId: string, timezone: string): Promise<PaymentsDashboardStats> {
  const supabase = await createClient();
  const todayKey = todayKeyInTZ(timezone);
  const startKey = monthStartKey(todayKey);
  const nextStartKey = addMonthsToKey(startKey, 1);

  const [{ data: paymentsThisMonth, error: paymentsError }, { data: balances, error: balancesError }] =
    await Promise.all([
      supabase
        .from("job_payments")
        .select("amount")
        .eq("organization_id", orgId)
        .is("voided_at", null)
        .gte("payment_date", startKey)
        .lt("payment_date", nextStartKey),
      supabase
        .from("job_financial_status")
        .select("job_id, outstanding_amount")
        .eq("organization_id", orgId)
        .gt("outstanding_amount", 0),
    ]);

  if (paymentsError) throw paymentsError;
  if (balancesError) throw balancesError;

  const collectedThisMonth = (paymentsThisMonth ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingTotal = (balances ?? []).reduce((sum, b) => sum + Number(b.outstanding_amount), 0);

  let closedJobsWithBalanceCount = 0;
  const balanceJobIds = (balances ?? [])
    .map((b) => b.job_id)
    .filter((id): id is string => id != null);
  if (balanceJobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, status:job_statuses(is_closed)")
      .in("id", balanceJobIds);
    if (jobsError) throw jobsError;
    closedJobsWithBalanceCount = (jobs ?? []).filter((j) => j.status?.is_closed).length;
  }

  return {
    collectedThisMonth,
    outstandingTotal,
    jobsWithBalanceCount: (balances ?? []).length,
    closedJobsWithBalanceCount,
  };
}

export type RecentPaymentItem = {
  id: string;
  paymentDate: string;
  amount: number;
  jobId: string;
  jobTitle: string;
  clientName: string;
  methodName: string;
  accountName: string | null;
  isVoided: boolean;
};

export type RecentPaymentsFilters = {
  clientId?: string;
  paymentMethodId?: string;
  paymentAccountId?: string;
  sinceDate?: string;
};

export async function getRecentPayments(
  orgId: string,
  filters: RecentPaymentsFilters = {},
  limit = 100
): Promise<RecentPaymentItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("job_payments")
    .select(
      "id, payment_date, amount, voided_at, job:jobs(id, title, client:clients(id, name)), method:payment_methods(name), account:payment_accounts(name)"
    )
    .eq("organization_id", orgId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.paymentMethodId) query = query.eq("payment_method_id", filters.paymentMethodId);
  if (filters.paymentAccountId) query = query.eq("payment_account_id", filters.paymentAccountId);
  if (filters.sinceDate) query = query.gte("payment_date", filters.sinceDate);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).filter((p) => !filters.clientId || p.job?.client?.id === filters.clientId);

  return rows.map((p) => ({
    id: p.id,
    paymentDate: p.payment_date,
    amount: Number(p.amount),
    jobId: p.job?.id ?? "",
    jobTitle: p.job?.title ?? "-",
    clientName: p.job?.client?.name ?? "-",
    methodName: p.method?.name ?? "-",
    accountName: p.account?.name ?? null,
    isVoided: p.voided_at != null,
  }));
}

export type ClientFinancialSummary = {
  contractedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  uncontractedCollections: number;
};

export async function getClientFinancialSummary(orgId: string, clientId: string): Promise<ClientFinancialSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_financial_summary")
    .select("*")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return {
    contractedAmount: Number(data?.contracted_amount ?? 0),
    collectedAmount: Number(data?.collected_amount ?? 0),
    outstandingAmount: Number(data?.outstanding_amount ?? 0),
    uncontractedCollections: Number(data?.uncontracted_collections ?? 0),
  };
}

export type ClientJobFinancialDetail = {
  jobId: string;
  jobTitle: string;
  contractedAmount: number | null;
  collectedAmount: number;
  outstandingAmount: number | null;
  paymentStatus: PaymentStatus;
};

export async function getClientJobsFinancialDetail(
  orgId: string,
  clientId: string
): Promise<ClientJobFinancialDetail[]> {
  const supabase = await createClient();
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (jobsError) throw jobsError;
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const { data: statuses, error: statusesError } = await supabase
    .from("job_financial_status")
    .select("*")
    .in("job_id", jobIds);
  if (statusesError) throw statusesError;

  const statusByJob = new Map((statuses ?? []).map((s) => [s.job_id, s]));

  return jobs.map((j) => {
    const s = statusByJob.get(j.id);
    return {
      jobId: j.id,
      jobTitle: j.title,
      contractedAmount: s?.contracted_amount != null ? Number(s.contracted_amount) : null,
      collectedAmount: Number(s?.collected_amount ?? 0),
      outstandingAmount: s?.outstanding_amount != null ? Number(s.outstanding_amount) : null,
      paymentStatus: (s?.payment_status ?? "no_contract") as PaymentStatus,
    };
  });
}
