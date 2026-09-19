import Link from "next/link";

import { ContributionPerformance, MaterialPerformance, TimePerformance } from "@/components/analysis/job-type-performance";
import { WeekdayLoadChart } from "@/components/analysis/weekday-load-chart";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJobTypePerformance, getWeekdayLoad, parseWeeks } from "@/lib/data/analysis";
import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";

export default async function AnalisisPage({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const params = await searchParams;
  const weeks = parseWeeks(params.weeks);
  const { organization, role } = await requireCurrentOrg();
  const isAdmin = canAdminister(role);

  const [load, performance] = await Promise.all([
    getWeekdayLoad(organization.id, organization.timezone, weeks),
    getJobTypePerformance(organization.id, isAdmin),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Análisis</h2>
        <p className="text-sm text-muted-foreground">
          Datos históricos descriptivos de tus trabajos cerrados y de la carga real. Son números para interpretar, no evaluaciones.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Carga real por día de la semana</CardTitle>
          <div className="flex gap-1" role="group" aria-label="Período">
            {([4, 8, 12] as const).map((w) => (
              <Link
                key={w}
                href={`/app/analisis?weeks=${w}`}
                aria-current={w === weeks ? "true" : undefined}
                className={buttonVariants({ size: "sm", variant: w === weeks ? "default" : "outline" })}
              >
                {w} sem
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <WeekdayLoadChart result={load} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiempo estimado vs real por tipo de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Solo trabajos cerrados con horas estimadas y tiempo real completo. Desvío = (horas reales − horas estimadas) / horas estimadas,
            sobre los totales de cada tipo (los trabajos grandes pesan más). Con menos de 3 trabajos la muestra es limitada.
          </p>
          <TimePerformance rows={performance} />
        </CardContent>
      </Card>

      {isAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Materiales estimados vs reales por tipo de trabajo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Trabajos cerrados con cotización aceptada y costo real de materiales completo. Desvío sobre los totales del tipo.
              </p>
              <MaterialPerformance rows={performance} currency={organization.currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contribución por tipo de trabajo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Contratado menos costos directos (materiales, mano de obra y gastos directos registrados), solo trabajos cerrados con datos
                completos. Antes de costos indirectos e impuestos.
              </p>
              <ContributionPerformance rows={performance} currency={organization.currency} />
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Los análisis de costos y contribución están disponibles solo para owner y admin.</p>
      )}
    </div>
  );
}
