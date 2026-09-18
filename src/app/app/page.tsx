import { AlertTriangle, CalendarClock, CalendarDays, Clock, ListTodo, Wrench } from "lucide-react";

import { WeeklyLoadBars } from "@/components/weekly-load-bars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data/dashboard";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { formatMinutes } from "@/lib/format/duration";

export default async function DashboardPage() {
  const { organization } = await requireCurrentOrg();
  const data = await getDashboardData(organization.id, organization.timezone);

  const stats = [
    { label: "Trabajos activos", value: data.activeJobsCount, icon: Wrench },
    { label: "Programados hoy", value: data.jobsScheduledTodayCount, icon: CalendarDays },
    { label: "Horas programadas hoy", value: formatMinutes(data.minutesScheduledToday), icon: Clock },
    {
      label: "Horas programadas esta semana",
      value: formatMinutes(data.minutesScheduledThisWeek),
      icon: CalendarClock,
    },
    { label: "Trabajos vencidos", value: data.overdueJobsCount, icon: AlertTriangle, alert: data.overdueJobsCount > 0 },
    { label: "Sin sesión programada", value: data.jobsWithoutSessionCount, icon: ListTodo },
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
                className={`size-4 ${stat.alert ? "text-destructive" : "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${stat.alert ? "text-destructive" : ""}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carga semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyLoadBars days={data.weeklyLoad} />
        </CardContent>
      </Card>
    </div>
  );
}
