import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export async function listExpenseCategories(
  orgId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<Tables<"job_expense_categories">[]> {
  const supabase = await createClient();
  let query = supabase
    .from("job_expense_categories")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("name");
  if (opts.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type JobExpenseItem = {
  id: string;
  expenseDate: string;
  description: string;
  amount: number;
  categoryName: string;
  receiptPath: string | null;
  isVoided: boolean;
  voidReason: string | null;
};

/** Todos los gastos del trabajo (los anulados incluidos, marcados); el total que suma excluye anulados. */
export async function getJobExpenses(orgId: string, jobId: string): Promise<JobExpenseItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_expenses")
    .select("id, expense_date, description, amount, receipt_path, voided_at, void_reason, category:job_expense_categories(name)")
    .eq("organization_id", orgId)
    .eq("job_id", jobId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    expenseDate: e.expense_date,
    description: e.description,
    amount: Number(e.amount),
    categoryName: e.category?.name ?? "-",
    receiptPath: e.receipt_path,
    isVoided: e.voided_at !== null,
    voidReason: e.void_reason,
  }));
}
