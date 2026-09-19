import { Badge } from "@/components/ui/badge";
import type { WeekdayLoadResult } from "@/lib/data/analysis";
import { formatDateOnly } from "@/lib/format/dates";
import { formatHoursDecimal } from "@/lib/format/variance";
import { weekdayLabel } from "@/lib/scheduling/timezone";

/** Barras horizontales en CSS (sin librería de charts). Orden Lunes..Domingo. */
export function WeekdayLoadChart({ result }: { result: WeekdayLoadResult }) {
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => result.days.find((d) => d.weekday === weekday))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);
  const scale = Math.max(1, ...ordered.map((d) => Math.max(d.averageMinutes, d.capacityMinutes ?? 0)));
  const max = Math.max(0, ...ordered.map((d) => d.averageMinutes));
  const hasData = max > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="weekday-load">
      <p className="text-sm text-muted-foreground">
        Últimas {result.weeks} semanas ({formatDateOnly(result.fromKey)} a {formatDateOnly(result.toKey)}). Promedio de horas reales por día de
        la semana: horas de ese día en el período dividido por la cantidad de esos días (un día sin trabajo cuenta como 0). El día se toma en
        la zona horaria del negocio.
      </p>
      {!hasData && <p className="text-sm text-muted-foreground">Todavía no hay sesiones con tiempo real en este período.</p>}
      <div className="flex flex-col gap-3">
        {ordered.map((d) => {
          const isMax = hasData && d.averageMinutes === max;
          return (
            <div key={d.weekday} className="grid gap-1" data-testid={`weekday-${d.weekday}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">
                  {weekdayLabel(d.weekday)}
                  {isMax && (
                    <Badge variant="outline" className="ml-2">
                      Mayor promedio del período
                    </Badge>
                  )}
                </span>
                <span>
                  <span className="font-semibold">{formatHoursDecimal(d.averageMinutes)}</span>
                  <span className="text-muted-foreground"> promedio · {formatHoursDecimal(d.totalMinutes)} en {d.daysInPeriod} días</span>
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${weekdayLabel(d.weekday)}: ${formatHoursDecimal(d.averageMinutes)} promedio`}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${(d.averageMinutes / scale) * 100}%` }} />
                {d.capacityMinutes !== null && d.capacityMinutes > 0 && (
                  <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${(d.capacityMinutes / scale) * 100}%` }} title="Capacidad configurada actual" />
                )}
              </div>
              {d.capacityMinutes !== null && (
                <p className="text-xs text-muted-foreground">Capacidad configurada actual: {d.capacityMinutes > 0 ? formatHoursDecimal(d.capacityMinutes) : "día no laborable"}</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        La capacidad es la configurada hoy en Horarios laborales: no hay historial de horarios, así que no indica si en el pasado se superó.
      </p>
    </div>
  );
}
