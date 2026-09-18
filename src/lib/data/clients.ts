import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type ClientListItem = Pick<
  Tables<"clients">,
  "id" | "name" | "phone" | "email" | "active"
> & {
  defaultLocality: string | null;
  jobCount: number;
};

export async function listClients(orgId: string): Promise<ClientListItem[]> {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, active")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })
    .limit(500);

  if (error) throw error;
  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);
  const [{ data: addresses, error: addressesError }, { data: jobs, error: jobsError }] =
    await Promise.all([
      supabase
        .from("client_addresses")
        .select("client_id, locality, is_default")
        .in("client_id", clientIds),
      supabase.from("jobs").select("client_id").in("client_id", clientIds),
    ]);

  if (addressesError) throw addressesError;
  if (jobsError) throw jobsError;

  const defaultLocalityByClient = new Map<string, string | null>();
  for (const addr of addresses ?? []) {
    if (addr.is_default || !defaultLocalityByClient.has(addr.client_id)) {
      defaultLocalityByClient.set(addr.client_id, addr.locality);
    }
  }

  const jobCountByClient = new Map<string, number>();
  for (const job of jobs ?? []) {
    jobCountByClient.set(job.client_id, (jobCountByClient.get(job.client_id) ?? 0) + 1);
  }

  return clients.map((c) => ({
    ...c,
    defaultLocality: defaultLocalityByClient.get(c.id) ?? null,
    jobCount: jobCountByClient.get(c.id) ?? 0,
  }));
}

export type ClientDetail = {
  client: Tables<"clients">;
  addresses: Tables<"client_addresses">[];
  jobs: (Pick<Tables<"jobs">, "id" | "title" | "priority" | "target_date"> & {
    statusName: string;
  })[];
};

export async function getClientDetail(orgId: string, clientId: string): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client) return null;

  const [{ data: addresses, error: addressesError }, { data: jobs, error: jobsError }] =
    await Promise.all([
      supabase
        .from("client_addresses")
        .select("*")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, title, priority, target_date, status:job_statuses(name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
    ]);

  if (addressesError) throw addressesError;
  if (jobsError) throw jobsError;

  return {
    client,
    addresses: addresses ?? [],
    jobs: (jobs ?? []).map((j) => ({
      id: j.id,
      title: j.title,
      priority: j.priority,
      target_date: j.target_date,
      statusName: j.status?.name ?? "-",
    })),
  };
}
