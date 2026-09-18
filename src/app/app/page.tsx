import { AlertTriangle, Boxes, CalendarClock, CalendarDays, Clock, FileText, ListTodo, Wrench } from "lucide-react";
import Link from "next/link";

import { WeeklyLoadBars } from "@/components/weekly-load-bars";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getDashboardData } from "@/lib/data/dashboard";
import { getJobsWithMissingMaterials } from "@/lib/data/dashboard-materials";
import { getQuoteDashboardStats } from "@/lib/data/quotes";
import { formatDate } from "@/lib/format/dates";
import { formatMinutes } from "@/lib/format/duration";
import { formatQuantity } from "@/lib/format/quantity";

export default async function DashboardPage() {
  const { organization } = await requireCurrentOrg();
  const [data, jobsWithMissing, quoteStats] = await Promise.all([
    getDashboardData(organization.id, organization.timezone),
    getJobsWithMissingMaterials(organization.id),
    getQuoteDashboardStats(organization.id),
  ]);

  const stats = [
    { label: "Trabajos activos", value: data.activeJobsCount, icon: Wrench },
    { label: "Programados hoy", value: data.jobsScheduledTodayCount, icon: CalendarDays },
    { label: "Horas programadas hoy", value: formatMinutes(data.minutesScheduledToday), icon: Clock },
    {
      label: "Horas programadas esta semana",
      value: formatMinutes(data.minutesScheduledThisWeek),
      icon: CalendarClock,
    },
    {
      label: "Trabajos vencidos",
      value: data.overdueJobsCount,
      icon: AlertTriangle,
      alert: data.overdueJobsCount > 0 ? ("destructive" as const) : undefined,
    },
    { label: "Sin sesión programada", value: data.jobsWithoutSessionCount, icon: ListTodo },
    {
      label: "Trabajos con materiales faltantes",
      value: jobsWithMissing.length,
      icon: Boxes,
      alert: jobsWithMissing.length > 0 ? ("warning" as const) : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Inicio</h2>
        <p className="text-sm text-muted-foreground">
          Resumen operativo de {organization.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon
                className={`size-4 ${
                  stat.alert === "destructive"
                    ? "text-destructive"
                    : stat.alert === "warning"
                      ? "text-warning"
                      : "text-muted-foreground"
                }`}
              />
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-semibold ${
                  stat.alert === "destructive"
                    ? "text-destructive"
                    : stat.alert === "warning"
                      ? "text-warning"
                      : ""
                }`}
              >
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cotizaciones</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-semibold">{quoteStats.drafts}</p>
              <p className="text-xs text-muted-foreground">Borradores</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{quoteStats.sentPending}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{quoteStats.acceptedThisMonth}</p>
              <p className="text-xs text-muted-foreground">Aceptadas (mes)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carga semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyLoadBars days={data.weeklyLoad} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas operativas</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsWithMissing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ningún trabajo activo tiene materiales faltantes.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {jobsWithMissing.slice(0, 8).map((job) => (
                <Link
                  key={job.jobId}
                  href={`/app/trabajos/${job.jobId}`}
                  className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{job.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      Faltan:{" "}
                      {job.missingItems
                        .map((i) => `${formatQuantity(i.missing, i.unitSymbol)} de ${i.materialName}`)
                        .join(", ")}
                    </p>
                  </div>
                  {job.targetDate && (
                    <Badge variant="outline">{formatDate(`${job.targetDate}T00:00:00Z`)}</Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
