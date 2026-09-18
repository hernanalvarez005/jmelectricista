import { createClient } from "@/lib/supabase/server";
import { businessHoursCapacityMinutes } from "@/lib/scheduling/capacity";
import type { Tables } from "@/lib/supabase/database.types";

export async function getBusinessHours(orgId: string): Promise<Tables<"business_hours">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .eq("organization_id", orgId)
    .order("weekday", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** weekday (0-6) -> working capacity in minutes. */
export async function getCapacityByWeekday(orgId: string): Promise<Record<number, number>> {
  const rows = await getBusinessHours(orgId);
  const map: Record<number, number> = {};
  for (const row of rows) {
    map[row.weekday] = businessHoursCapacityMinutes(row);
  }
  return map;
}
