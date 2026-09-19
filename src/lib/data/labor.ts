import { createClient } from "@/lib/supabase/server";

export type LaborRateItem = {
  id: string;
  hourlyCost: number;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
};

export type MemberLaborInfo = {
  memberId: string;
  fullName: string;
  role: string;
  currentRate: LaborRateItem | null;
  rates: LaborRateItem[];
  /** Sesiones con tiempo real y responsable que todavía no tienen tarifa congelada. */
  sessionsWithoutCost: number;
};

/** Miembros activos con su tarifa vigente hoy, el historial y las sesiones sin valorizar. Solo owner/admin (RLS de tarifas). */
export async function listMembersWithLabor(orgId: string, todayKey: string): Promise<MemberLaborInfo[]> {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("organization_id", orgId)
    .eq("active", true);
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const [{ data: profiles, error: profilesError }, { data: rates, error: ratesError }, { data: sessions, error: sessionsError }, { data: snapshots, error: snapshotsError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", members.map((m) => m.user_id)),
      supabase
        .from("member_labor_rates")
        .select("id, organization_member_id, hourly_cost, valid_from, valid_to, notes")
        .eq("organization_id", orgId)
        .order("valid_from", { ascending: false }),
      supabase
        .from("job_sessions")
        .select("id, assigned_member_id")
        .eq("organization_id", orgId)
        .neq("status", "cancelled")
        .not("assigned_member_id", "is", null)
        .not("actual_start_at", "is", null)
        .not("actual_end_at", "is", null),
      supabase.from("job_session_labor_costs").select("job_session_id").eq("organization_id", orgId),
    ]);
  if (profilesError) throw profilesError;
  if (ratesError) throw ratesError;
  if (sessionsError) throw sessionsError;
  if (snapshotsError) throw snapshotsError;

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const costed = new Set((snapshots ?? []).map((s) => s.job_session_id));
  const pendingByMember = new Map<string, number>();
  for (const s of sessions ?? []) {
    if (!costed.has(s.id) && s.assigned_member_id) {
      pendingByMember.set(s.assigned_member_id, (pendingByMember.get(s.assigned_member_id) ?? 0) + 1);
    }
  }

  return members
    .map((m) => {
      const memberRates: LaborRateItem[] = (rates ?? [])
        .filter((r) => r.organization_member_id === m.id)
        .map((r) => ({ id: r.id, hourlyCost: Number(r.hourly_cost), validFrom: r.valid_from, validTo: r.valid_to, notes: r.notes }));
      const currentRate = memberRates.find((r) => r.validFrom <= todayKey && (r.validTo === null || r.validTo >= todayKey)) ?? null;
      return {
        memberId: m.id,
        fullName: nameByUser.get(m.user_id) || "Sin nombre",
        role: m.role,
        currentRate,
        rates: memberRates,
        sessionsWithoutCost: pendingByMember.get(m.id) ?? 0,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
}
