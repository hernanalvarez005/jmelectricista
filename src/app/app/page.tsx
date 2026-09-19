import { AlertTriangle, Boxes, CalendarClock, ChartColumn, CalendarDays, Clock, FileText, ListTodo, ShoppingCart, Wallet, Wrench } from "lucide-react";
import Link from "next/link";

import { WeeklyLoadBars } from "@/components/weekly-load-bars";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getWeekdayLoad } from "@/lib/data/analysis";
import { getBillingPendingSummary } from "@/lib/data/billing";
import { getDashboardData } from "@/lib/data/dashboard";
import { countClosedJobsWithIncompleteMaterialCost } from "@/lib/data/job-costs";
import { getPurchasesDashboardStats } from "@/lib/data/purchases";
import { getJobsWithMissingMaterials } from "@/lib/data/dashboard-materials";
import { getJobsWithOutstandingBalance, getPaymentsDashboardStats } from "@/lib/data/payments";
import { getQuoteDashboardStats } from "@/lib/data/quotes";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMinutes } from "@/lib/format/duration";
import { formatMoney } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";
import { formatHoursDecimal } from "@/lib/format/variance";
import { weekdayLabel } from "@/lib/scheduling/timezone";

export default async function DashboardPage() {
  const { organization } = await requireCurrentOrg();
  const [data, jobsWithMissing, quoteStats, paymentsStats, jobsWithBalance, purchasesStats, closedIncompleteCost, weekdayLoad, billingSummary] = await Promise.all([
    getDashboardData(organization.id, organization.timezone),
    getJobsWithMissingMaterials(organization.id),
    getQuoteDashboardStats(organization.id, organization.timezone),
    getPaymentsDashboardStats(organization.id, organization.timezone),
    getJobsWithOutstandingBalance(organization.id),
    getPurchasesDashboardStats(organization.id, organization.timezone),
    countClosedJobsWithIncompleteMaterialCost(organization.id),
    getWeekdayLoad(organization.id, organization.timezone, 8),
    getBillingPendingSummary(organization.id),
  ]);

  const busiestDay = weekdayLoad.days.reduce<(typeof weekdayLoad.days)[number] | null>(
    (best, d) => (d.averageMinutes > (best?.averageMinutes ?? 0) ? d : best),
    null
  );

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
    {
      label: "Cobrado este mes",
      value: formatMoney(paymentsStats.collectedThisMonth, organization.currency),
      icon: Wallet,
    },
    {
      label: "Saldo pendiente",
      value: formatMoney(paymentsStats.outstandingTotal, organization.currency),
      icon: Wallet,
      alert: paymentsStats.outstandingTotal > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Finalizados con saldo",
      value: paymentsStats.closedJobsWithBalanceCount,
      icon: AlertTriangle,
      alert: paymentsStats.closedJobsWithBalanceCount > 0 ? ("destructive" as const) : undefined,
    },
    {
      label: "Pendientes de facturar",
      value: billingSummary.pending,
      hint: `${billingSummary.paidAndPending} ya cobrado${billingSummary.paidAndPending === 1 ? "" : "s"} completamente`,
      icon: FileText,
      alert: billingSummary.paidAndPending > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Compras del mes",
      value: formatMoney(purchasesStats.purchasedThisMonth, organization.currency),
      icon: ShoppingCart,
    },
    {
      label: "Materiales sin valoración",
      value: purchasesStats.materialsWithoutValuation,
      icon: Boxes,
      alert: purchasesStats.materialsWithoutValuation > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Finalizados con costo incompleto",
      value: closedIncompleteCost,
      icon: AlertTriangle,
      alert: closedIncompleteCost > 0 ? ("warning" as const) : undefined,
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
              {"hint" in stat && stat.hint && <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Carga real (últimas 8 semanas)</CardTitle>
            <ChartColumn className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {busiestDay ? (
              <>
                <p className="text-2xl font-semibold">{weekdayLabel(busiestDay.weekday)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatHoursDecimal(busiestDay.averageMinutes)} promedio, el día con más horas reales.{" "}
                  <Link href="/app/analisis" className="font-medium text-foreground hover:underline">
                    Ver análisis
                  </Link>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay horas reales registradas.{" "}
                <Link href="/app/analisis" className="font-medium text-foreground hover:underline">
                  Ver análisis
                </Link>
              </p>
            )}
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
                    <Badge variant="outline">{formatDateOnly(job.targetDate)}</Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldos pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsWithBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ningún trabajo tiene saldo pendiente.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {jobsWithBalance.slice(0, 8).map((job) => (
                <Link
                  key={job.jobId}
                  href={`/app/trabajos/${job.jobId}`}
                  className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{job.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.jobTitle}
                      {job.statusIsClosed ? " · Finalizado" : ""}
                    </p>
                  </div>
                  <span className={`font-medium ${job.statusIsClosed ? "text-destructive" : "text-warning"}`}>
                    {formatMoney(job.outstandingAmount, organization.currency)} pendientes
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
