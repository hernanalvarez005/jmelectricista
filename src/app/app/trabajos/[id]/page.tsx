import Link from "next/link";
import { notFound } from "next/navigation";

import { JobSessionDialog } from "@/components/jobs/job-session-dialog";
import { JobSessionsList } from "@/components/jobs/job-sessions-list";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getJobDetail, sumActualMinutes, sumSessionMinutes } from "@/lib/data/jobs";
import { getJobFormOptions } from "@/lib/data/job-form-options";
import { getOrgMembers } from "@/lib/data/members";
import { formatDate, formatDateTime } from "@/lib/format/dates";
import { formatMinutes, formatMinutesCompact } from "@/lib/format/duration";
import { jobPriorityLabel } from "@/lib/validations/job";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const [detail, options, members] = await Promise.all([
    getJobDetail(organization.id, id),
    getJobFormOptions(organization.id),
    getOrgMembers(organization.id),
  ]);

  if (!detail) notFound();

  const { job, clientName, addressLabel, jobTypeName, statusName, assignedMemberName, sessions, history } =
    detail;

  const membersById = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const scheduledMinutes = sumSessionMinutes(sessions, ["scheduled", "completed"]);
  const executedMinutes = sumActualMinutes(sessions);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{job.title}</h2>
            <Badge>{jobPriorityLabel(job.priority)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/app/clientes/${job.client_id}`} className="hover:underline">
              {clientName}
            </Link>
            {addressLabel ? ` · ${addressLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JobStatusSelect jobId={job.id} statusId={job.status_id} statuses={options.statuses} />
          <Button variant="outline" asChild>
            <Link href={`/app/trabajos/${job.id}/editar`}>Editar</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Summary label="Duración estimada" value={formatMinutesCompact(job.estimated_minutes)} />
          <Summary label="Horas programadas" value={formatMinutes(scheduledMinutes)} />
          <Summary label="Horas ejecutadas" value={formatMinutes(executedMinutes)} />
          <Summary
            label="Fecha objetivo"
            value={job.target_date ? formatDate(`${job.target_date}T00:00:00Z`) : "-"}
          />
          <Summary label="Responsable" value={assignedMemberName ?? "Sin asignar"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Estado" value={statusName} />
          <Row label="Tipo de trabajo" value={jobTypeName ?? "-"} />
          <Row label="Descripción" value={job.description ?? "-"} />
          <Row label="Notas" value={job.notes ?? "-"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Agenda / sesiones</CardTitle>
          <JobSessionDialog
            jobId={job.id}
            members={options.members}
            trigger={<Button size="sm">Programar sesión</Button>}
          />
        </CardHeader>
        <CardContent>
          <JobSessionsList
            jobId={job.id}
            sessions={sessions}
            membersById={membersById}
            timezone={organization.timezone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {entry.fromStatusName ? `${entry.fromStatusName} → ` : "Creado en "}
                    <span className="font-medium">{entry.toStatusName}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(entry.changedAt, organization.timezone)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[70%] text-right">{value}</span>
    </div>
  );
}
