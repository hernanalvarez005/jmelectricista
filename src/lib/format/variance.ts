const percentFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** (real - estimado) / estimado * 100; null si el estimado no permite el cálculo (<= 0). Agregación ponderada: pasar totales, no promedios. */
export function variancePercent(actual: number, estimated: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(estimated) || estimated <= 0) return null;
  return ((actual - estimated) / estimated) * 100;
}

/** 37.0588 -> "37,1%". */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

/**
 * Desvío como texto (no depende del color): "+25% sobre lo estimado",
 * "-10% bajo lo estimado" o "Sin desvío". Un desvío es información, no un juicio.
 */
export function describeVariancePercent(value: number | null): string {
  if (value === null) return "-";
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "Sin desvío";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${percentFormatter.format(Math.abs(rounded))}% ${rounded > 0 ? "sobre" : "bajo"} lo estimado`;
}

/** 93.6 h -> "93,6 h" (horas decimales, para totales y promedios). */
export function formatHoursDecimal(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${percentFormatter.format(hours)} h`;
}
