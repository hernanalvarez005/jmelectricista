import { AgendaDayCard } from "@/components/agenda/agenda-day-card";
import { AgendaWeekNav } from "@/components/agenda/agenda-week-nav";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getAgendaWeek } from "@/lib/data/agenda";
import { mondayOfWeek, todayKeyInTZ } from "@/lib/scheduling/timezone";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const { organization } = await requireCurrentOrg();

  const referenceKey = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : todayKeyInTZ(organization.timezone);
  const mondayKey = mondayOfWeek(referenceKey);

  const days = await getAgendaWeek(organization.id, organization.timezone, mondayKey);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Agenda</h2>
        <p className="text-sm text-muted-foreground">
          Carga de trabajo semanal: horas programadas vs. capacidad laboral.
        </p>
      </div>

      <AgendaWeekNav mondayKey={mondayKey} timezone={organization.timezone} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => (
          <AgendaDayCard key={day.dateKey} day={day} timezone={organization.timezone} />
        ))}
      </div>
    </div>
  );
}
