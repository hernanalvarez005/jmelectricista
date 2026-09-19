import type { JobEconomics } from "@/lib/data/job-economics";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Motivos por los que el costo directo (y por lo tanto la contribución) no es definitivo.
 * Cada uno explica un faltante real: nunca se rellena con $0 ni con la tarifa actual.
 */
export function costDataGaps(e: Pick<JobEconomics, "materialCostComplete" | "sessionsMissingRate" | "sessionsMissingMember" | "sessionsMissingTime">): string[] {
  const gaps: string[] = [];
  if (!e.materialCostComplete) {
    gaps.push("Hay consumos de materiales sin valoración histórica: el costo real de materiales está incompleto.");
  }
  if (e.sessionsMissingRate > 0) {
    gaps.push(`${plural(e.sessionsMissingRate, "sesión", "sesiones")} sin tarifa configurada para su fecha: costo laboral no configurado.`);
  }
  if (e.sessionsMissingMember > 0) {
    gaps.push(`${plural(e.sessionsMissingMember, "sesión", "sesiones")} con tiempo real y sin responsable asignado.`);
  }
  if (e.sessionsMissingTime > 0) {
    gaps.push(`${plural(e.sessionsMissingTime, "sesión completada", "sesiones completadas")} sin tiempo real registrado.`);
  }
  return gaps;
}

export type ContributionView =
  | { kind: "available"; label: string; amount: number; percentage: number | null; final: boolean }
  | { kind: "no_contract" }
  | { kind: "incomplete"; gaps: string[] };

/**
 * Trabajo cerrado + datos completos -> "Contribución del trabajo" (final).
 * Trabajo abierto + datos completos -> "Contribución acumulada" (no es resultado final).
 * Sin monto contratado o con costos incompletos -> no calculable, con el motivo.
 */
export function contributionView(e: JobEconomics): ContributionView {
  if (!e.directCostDataComplete) return { kind: "incomplete", gaps: costDataGaps(e) };
  if (e.contributionAmount === null) return { kind: "no_contract" };
  return {
    kind: "available",
    label: e.isClosed ? "Contribución del trabajo" : "Contribución acumulada",
    amount: e.contributionAmount,
    percentage: e.contributionPercentage,
    final: e.isClosed,
  };
}

export const CONTRIBUTION_DISCLAIMER = "Antes de costos indirectos e impuestos.";
