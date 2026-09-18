import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type OrgRole = Tables<"organization_members">["role"];

export type CurrentOrg = {
  userId: string;
  userEmail: string | null;
  membershipId: string;
  role: OrgRole;
  organization: Tables<"organizations">;
};

/**
 * Loads the signed-in user's organization membership. There is no org
 * switcher yet (out of scope for this phase): a user's *first* active
 * membership is treated as "the" organization. Redirects to /onboarding
 * when there is none.
 *
 * Wrapped in React's `cache()` so the layout and every page in the /app
 * segment share a single query per request instead of each re-fetching it.
 */
export const requireCurrentOrg = cache(async (): Promise<CurrentOrg> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("id, role, organization:organizations(*)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership || !membership.organization) {
    redirect("/onboarding");
  }

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    membershipId: membership.id,
    role: membership.role,
    organization: membership.organization,
  };
});

export function canOperate(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "worker";
}

export function canAdminister(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}
