import { createClient } from "@/lib/supabase/server";
import { getOrgMembers } from "@/lib/data/members";

export type JobFormOptions = {
  clients: { id: string; name: string }[];
  addressesByClient: Record<string, { id: string; label: string | null; street: string | null }[]>;
  jobTypes: { id: string; name: string; defaultEstimatedMinutes: number | null }[];
  statuses: { id: string; name: string; sortOrder: number }[];
  members: { id: string; fullName: string }[];
};

/** Everything the "nuevo trabajo" / edit form needs, in as few queries as possible. */
export async function getJobFormOptions(orgId: string): Promise<JobFormOptions> {
  const supabase = await createClient();

  const [{ data: clients }, { data: addresses }, { data: jobTypes }, { data: statuses }, members] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("client_addresses")
        .select("id, client_id, label, street")
        .eq("organization_id", orgId),
      supabase
        .from("job_types")
        .select("id, name, default_estimated_minutes")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("job_statuses")
        .select("id, name, sort_order")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("sort_order"),
      getOrgMembers(orgId),
    ]);

  const addressesByClient: JobFormOptions["addressesByClient"] = {};
  for (const addr of addresses ?? []) {
    if (!addressesByClient[addr.client_id]) addressesByClient[addr.client_id] = [];
    addressesByClient[addr.client_id].push({ id: addr.id, label: addr.label, street: addr.street });
  }

  return {
    clients: clients ?? [],
    addressesByClient,
    jobTypes: (jobTypes ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      defaultEstimatedMinutes: t.default_estimated_minutes,
    })),
    statuses: (statuses ?? []).map((s) => ({ id: s.id, name: s.name, sortOrder: s.sort_order })),
    members,
  };
}
