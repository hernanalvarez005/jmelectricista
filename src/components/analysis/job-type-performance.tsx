import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { JobTypePerformance } from "@/lib/data/analysis";
import { formatMoney } from "@/lib/format/money";
import { describeVariancePercent, formatHoursDecimal, formatPercent } from "@/lib/format/variance";

export const LIMITED_SAMPLE_THRESHOLD = 3;

function Sample({ jobs, label = "trabajos" }: { jobs: number; label?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {jobs} {label}
      {jobs < LIMITED_SAMPLE_THRESHOLD && <Badge variant="outline">Muestra limitada</Badge>}
    </span>
  );
}

export function TimePerformance({ rows }: { rows: JobTypePerformance[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay trabajos cerrados para analizar.</p>;
  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.jobTypeId ?? "none"} className="rounded-lg border bg-card p-4">
            <p className="font-medium">{r.typeName}</p>
            <p className="text-xs text-muted-foreground">
              {r.closedJobs} cerrados · <Sample jobs={r.sampleJobs} label="con datos" />
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Horas estimadas</p>
                <p className="font-medium">{formatHoursDecimal(r.estimatedMinutes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas reales</p>
                <p className="font-medium">{formatHoursDecimal(r.actualMinutes)}</p>
              </div>
            </div>
            <p className="mt-2 text-sm">{describeVariancePercent(r.timeVariancePercent)}</p>
          </div>
        ))}
      </div>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de trabajo</TableHead>
              <TableHead className="text-right">Cerrados</TableHead>
              <TableHead>Muestra (con datos)</TableHead>
              <TableHead className="text-right">Horas estimadas</TableHead>
              <TableHead className="text-right">Horas reales</TableHead>
              <TableHead>Desvío de tiempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.jobTypeId ?? "none"}>
                <TableCell className="font-medium">{r.typeName}</TableCell>
                <TableCell className="text-right">{r.closedJobs}</TableCell>
                <TableCell>
                  <Sample jobs={r.sampleJobs} />
                </TableCell>
                <TableCell className="text-right">{formatHoursDecimal(r.estimatedMinutes)}</TableCell>
                <TableCell className="text-right">{formatHoursDecimal(r.actualMinutes)}</TableCell>
                <TableCell>{describeVariancePercent(r.timeVariancePercent)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function MaterialPerformance({ rows, currency }: { rows: JobTypePerformance[]; currency: string }) {
  const withData = rows.filter((r) => r.materials);
  if (withData.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay trabajos cerrados con cotización aceptada y costo de materiales completo.</p>;
  return (
    <div className="flex flex-col gap-3">
      {withData.map((r) => {
        const m = r.materials!;
        return (
          <div key={r.jobTypeId ?? "none"} className="grid gap-1 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1.2fr] sm:items-center">
            <div>
              <p className="font-medium">{r.typeName}</p>
              <p className="text-xs text-muted-foreground">
                <Sample jobs={m.jobs} />
              </p>
            </div>
            <p>
              <span className="text-xs text-muted-foreground">Estimado </span>
              {formatMoney(m.estimated, currency)}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Real </span>
              {formatMoney(m.actual, currency)}
            </p>
            <p>{describeVariancePercent(m.variancePercent)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function ContributionPerformance({ rows, currency }: { rows: JobTypePerformance[]; currency: string }) {
  const withData = rows.filter((r) => r.contribution);
  if (withData.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay trabajos cerrados con costos completos y cotización aceptada.</p>;
  return (
    <div className="flex flex-col gap-3">
      {withData.map((r) => {
        const c = r.contribution!;
        return (
          <div key={r.jobTypeId ?? "none"} className="grid gap-1 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1.2fr] sm:items-center">
            <div>
              <p className="font-medium">{r.typeName}</p>
              <p className="text-xs text-muted-foreground">
                <Sample jobs={c.jobs} />
              </p>
            </div>
            <p>
              <span className="text-xs text-muted-foreground">Contratado </span>
              {formatMoney(c.contracted, currency)}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Costos directos </span>
              {formatMoney(c.directCost, currency)}
            </p>
            <p className="font-medium">
              {formatMoney(c.contribution, currency)}
              {c.percentage !== null && <span className="ml-2 font-normal text-muted-foreground">{formatPercent(c.percentage)}</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
