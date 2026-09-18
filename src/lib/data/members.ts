import { createClient } from "@/lib/supabase/server";

export type OrgMember = { id: string; fullName: string };

/**
 * organization_members and profiles both key off auth.users.id but there is
 * no direct FK between them (profiles is keyed by user, members by org+user),
 * so PostgREST can't embed one in the other. Two bulk queries + an in-memory
 * join avoids per-row lookups.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, user_id")
    .eq("organization_id", orgId)
    .eq("active", true);

  if (error) throw error;
  if (!members || members.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in(
      "id",
      members.map((m) => m.user_id)
    );

  if (profilesError) throw profilesError;

  const fullNameByUserId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return members.map((m) => ({
    id: m.id,
    fullName: fullNameByUserId.get(m.user_id) || "Sin nombre",
  }));
}
