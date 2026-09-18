import { sessionDurationMinutes } from "@/lib/scheduling/capacity";

/**
 * Sesiones son la única fuente de tiempo real (actual_start_at/actual_end_at)
 * y planificado (planned_start_at/planned_end_at) — no se recalcula acá,
 * solo se agrega. No es un view SQL: a diferencia de job_material_status
 * (que agrega a través de todos los trabajos para el dashboard), estas
 * cuentas siempre se resuelven para un único trabajo cuyas sesiones ya
 * llegaron fetcheadas por la página, así que un helper puro alcanza sin
 * introducir una query adicional.
 */
export type SessionForTimeStatus = {
  status: string;
  planned_start_at: string;
  planned_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
};

export type JobTimeStatus = {
  estimatedMinutes: number | null;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number | null;
  variancePercentage: number | null;
  completedSessions: number;
  completedSessionsWithoutActualTime: number;
  actualTimeComplete: boolean;
};

export function calculateJobTimeStatus(
  estimatedMinutes: number | null,
  sessions: SessionForTimeStatus[]
): JobTimeStatus {
  const plannedMinutes = sessions
    .filter((s) => s.status === "scheduled" || s.status === "completed")
    .reduce((sum, s) => sum + sessionDurationMinutes(s.planned_start_at, s.planned_end_at), 0);

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const completedWithActualTime = completedSessions.filter((s) => s.actual_start_at && s.actual_end_at);
  const completedSessionsWithoutActualTime = completedSessions.length - completedWithActualTime.length;

  // Nunca usar planned_end_at - planned_start_at como sustituto del tiempo
  // real: una sesión completada sin actual_start_at/actual_end_at
  // simplemente no aporta minutos reales todavía.
  const actualMinutes = completedWithActualTime.reduce(
    (sum, s) => sum + sessionDurationMinutes(s.actual_start_at!, s.actual_end_at!),
    0
  );

  const varianceMinutes = estimatedMinutes != null ? actualMinutes - estimatedMinutes : null;
  const variancePercentage =
    estimatedMinutes != null && estimatedMinutes > 0
      ? Math.round((varianceMinutes! / estimatedMinutes) * 1000) / 10
      : null;

  return {
    estimatedMinutes,
    plannedMinutes,
    actualMinutes,
    varianceMinutes,
    variancePercentage,
    completedSessions: completedSessions.length,
    completedSessionsWithoutActualTime,
    actualTimeComplete: completedSessionsWithoutActualTime === 0,
  };
}
