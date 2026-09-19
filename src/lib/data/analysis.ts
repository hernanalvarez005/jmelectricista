import { createClient } from "@/lib/supabase/server";
import { getCapacityByWeekday } from "@/lib/data/business-hours";
import { addDaysToKey, todayKeyInTZ } from "@/lib/scheduling/timezone";
import { variancePercent } from "@/lib/format/variance";

export type AnalysisWeeks = 4 | 8 | 12;

export function parseWeeks(value: string | undefined): AnalysisWeeks {
  return value === "4" ? 4 : value === "12" ? 12 : 8;
}

export type WeekdayLoad = {
  weekday: number; // 0 = domingo ... 6 = sábado
  totalMinutes: number;
  daysInPeriod: number;
  averageMinutes: number;
  /** Capacidad configurada HOY (business_hours no tiene historial). */
  capacityMinutes: number | null;
};

export type WeekdayLoadResult = { fromKey: string; toKey: string; weeks: AnalysisWeeks; days: WeekdayLoad[] };

/**
 * Ventana de N semanas completas que termina AYER (hoy todavía no terminó): cada día de la semana
 * aparece exactamente N veces. El promedio divide por esa cantidad, así los días sin trabajo cuentan 0.
 */
export async function getWeekdayLoad(orgId: string, timezone: string, weeks: AnalysisWeeks): Promise<WeekdayLoadResult> {
  const todayKey = todayKeyInTZ(timezone);
  const toKey = addDaysToKey(todayKey, -1);
  const fromKey = addDaysToKey(todayKey, -7 * weeks);

  const supabase = await createClient();
  const [{ data, error }, capacity] = await Promise.all([
    supabase.rpc("weekday_workload", { p_organization_id: orgId, p_from: fromKey, p_to: toKey }),
    getCapacityByWeekday(orgId),
  ]);
  if (error) throw error;

  const days: WeekdayLoad[] = (data ?? []).map((r) => ({
    weekday: r.weekday,
    totalMinutes: Number(r.total_minutes),
    daysInPeriod: r.days_in_period,
    averageMinutes: Number(r.average_minutes),
    capacityMinutes: capacity[r.weekday] ?? null,
  }));
  return { fromKey, toKey, weeks, days };
}

export type JobTypePerformance = {
  jobTypeId: string | null;
  typeName: string;
  closedJobs: number;
  sampleJobs: number;
  estimatedMinutes: number;
  actualMinutes: number;
  timeVariancePercent: number | null;
  materials: { jobs: number; estimated: number; actual: number; variancePercent: number | null } | null;
  contribution: { jobs: number; contracted: number; directCost: number; contribution: number; percentage: number | null } | null;
};

/**
 * Desempeño por tipo de trabajo (solo trabajos cerrados con datos suficientes). Los desvíos se calculan
 * sobre totales agregados: (SUM(real) - SUM(estimado)) / SUM(estimado), no promediando porcentajes.
 * Materiales y contribución son información de costos: solo se consultan para owner/admin.
 */
export async function getJobTypePerformance(orgId: string, isAdmin: boolean): Promise<JobTypePerformance[]> {
  const supabase = await createClient();
  const [types, time, materials, contribution] = await Promise.all([
    supabase.from("job_types").select("id, name").eq("organization_id", orgId),
    supabase.from("job_type_time_performance").select("*").eq("organization_id", orgId),
    isAdmin ? supabase.from("job_type_material_performance").select("*").eq("organization_id", orgId) : Promise.resolve({ data: [], error: null }),
    isAdmin ? supabase.from("job_type_contribution").select("*").eq("organization_id", orgId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (types.error) throw types.error;
  if (time.error) throw time.error;
  if (materials.error) throw materials.error;
  if (contribution.error) throw contribution.error;

  const nameById = new Map((types.data ?? []).map((t) => [t.id, t.name]));
  const key = (id: string | null) => id ?? "none";
  const materialByType = new Map((materials.data ?? []).map((m) => [key(m.job_type_id), m]));
  const contributionByType = new Map((contribution.data ?? []).map((c) => [key(c.job_type_id), c]));

  return (time.data ?? [])
    .map((row) => {
      const estimated = Number(row.estimated_minutes_total);
      const actual = Number(row.actual_minutes_total);
      const mat = materialByType.get(key(row.job_type_id));
      const con = contributionByType.get(key(row.job_type_id));
      const matEstimated = mat ? Number(mat.estimated_material_cost_total) : 0;
      const matActual = mat ? Number(mat.actual_material_cost_total) : 0;
      const contracted = con ? Number(con.contracted_total) : 0;
      return {
        jobTypeId: row.job_type_id,
        typeName: row.job_type_id ? (nameById.get(row.job_type_id) ?? "Sin nombre") : "Sin tipo de trabajo",
        closedJobs: Number(row.closed_jobs_count),
        sampleJobs: Number(row.jobs_count),
        estimatedMinutes: estimated,
        actualMinutes: actual,
        timeVariancePercent: variancePercent(actual, estimated),
        materials: mat
          ? { jobs: Number(mat.jobs_count), estimated: matEstimated, actual: matActual, variancePercent: variancePercent(matActual, matEstimated) }
          : null,
        contribution: con
          ? {
              jobs: Number(con.jobs_count),
              contracted,
              directCost: Number(con.direct_cost_total),
              contribution: Number(con.contribution_total),
              percentage: contracted > 0 ? (Number(con.contribution_total) / contracted) * 100 : null,
            }
          : null,
      };
    })
    .sort((a, b) => b.closedJobs - a.closedJobs || a.typeName.localeCompare(b.typeName, "es"));
}
