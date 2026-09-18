import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export async function listJobTypesForSettings(orgId: string): Promise<Tables<"job_types">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_types")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listJobStatusesForSettings(orgId: string): Promise<Tables<"job_statuses">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_statuses")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}
