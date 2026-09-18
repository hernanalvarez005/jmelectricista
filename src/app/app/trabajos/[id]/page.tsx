import Link from "next/link";
import { notFound } from "next/navigation";

import { AddJobMaterialDialog } from "@/components/jobs/add-job-material-dialog";
import { JobMaterialsList } from "@/components/jobs/job-materials-list";
import { JobSessionDialog } from "@/components/jobs/job-session-dialog";
import { JobSessionsList } from "@/components/jobs/job-sessions-list";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import { RequestPricesDialog } from "@/components/jobs/request-prices-dialog";
import { CreateQuoteButton } from "@/components/quotes/create-quote-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getJobDetail, sumActualMinutes, sumSessionMinutes } from "@/lib/data/jobs";
import { getJobFormOptions } from "@/lib/data/job-form-options";
import { getJobMaterials } from "@/lib/data/job-materials";
import { listMaterialsForQuoteItems } from "@/lib/data/materials";
import { getOrgMembers } from "@/lib/data/members";
import { getJobQuotes } from "@/lib/data/quotes";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatDate, formatDateTime } from "@/lib/format/dates";
import { formatMinutes, formatMinutesCompact } from "@/lib/format/duration";
import { formatMoney } from "@/lib/format/money";
import { jobPriorityLabel } from "@/lib/validations/job";
import { quoteStatusLabels } from "@/lib/validations/quote";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const [detail, options, members, jobMaterials, suppliers, quotes, allMaterials] = await Promise.all([
    getJobDetail(organization.id, id),
    getJobFormOptions(organization.id),
    getOrgMembers(organization.id),
    getJobMaterials(organization.id, id),
    listSuppliers(organization.id),
    getJobQuotes(organization.id, id),
    listMaterialsForQuoteItems(organization.id),
  ]);

  if (!detail) notFound();

  const { job, clientName, addressLabel, jobTypeName, statusName, assignedMemberName, sessions, history } =
    detail;

  const membersById = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const scheduledMinutes = sumSessionMinutes(sessions, ["scheduled", "completed"]);
  const executedMinutes = sumActualMinutes(sessions);
  const materialsWithMissing = jobMaterials.filter((m) => m.missing > 0).length;
  const latestQuote = quotes[0];

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

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="materiales">Materiales</TabsTrigger>
          <TabsTrigger value="cotizacion">Cotización</TabsTrigger>
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Trabajo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Cliente" value={clientName} />
              <Row label="Dirección" value={addressLabel ?? "-"} />
              <Row label="Tipo de trabajo" value={jobTypeName ?? "-"} />
              <Row label="Estado" value={statusName} />
              <Row label="Prioridad" value={jobPriorityLabel(job.priority)} />
              <Row label="Responsable" value={assignedMemberName ?? "Sin asignar"} />
              <Row label="Descripción" value={job.description ?? "-"} />
              <Row label="Notas" value={job.notes ?? "-"} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Planificación</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Row label="Duración estimada" value={formatMinutesCompact(job.estimated_minutes)} />
                <Row label="Horas programadas" value={formatMinutes(scheduledMinutes)} />
                <Row label="Horas reales" value={formatMinutes(executedMinutes)} />
                <Row
                  label="Fecha objetivo"
                  value={job.target_date ? formatDate(`${job.target_date}T00:00:00Z`) : "-"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Materiales</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Row label="Cantidad requerida" value={String(jobMaterials.length)} />
                <Row label="Disponibles" value={String(jobMaterials.length - materialsWithMissing)} />
                <Row
                  label="Con faltante"
                  value={
                    materialsWithMissing > 0 ? (
                      <span className="font-medium text-warning">{materialsWithMissing}</span>
                    ) : (
                      "0"
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cotización</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {latestQuote ? (
                  <div className="grid gap-2">
                    <Row label="Número" value={latestQuote.quote_number} />
                    <Row label="Estado" value={quoteStatusLabels[latestQuote.status] ?? latestQuote.status} />
                    <Row label="Total" value={formatMoney(Number(latestQuote.total), organization.currency)} />
                    <Link
                      href={`/app/cotizaciones/${latestQuote.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Ver cotización →
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sin cotización.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
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
        </TabsContent>

        <TabsContent value="materiales" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Materiales</CardTitle>
              <div className="flex items-center gap-2">
                <RequestPricesDialog
                  materials={jobMaterials}
                  suppliers={suppliers.filter((s) => s.active)}
                  trigger={
                    <Button size="sm" variant="outline">
                      Solicitar precios
                    </Button>
                  }
                />
                <AddJobMaterialDialog
                  jobId={job.id}
                  materials={allMaterials.filter((m) => !jobMaterials.some((jm) => jm.materialId === m.id))}
                  trigger={<Button size="sm">Agregar material</Button>}
                />
              </div>
            </CardHeader>
            <CardContent>
              <JobMaterialsList jobId={job.id} materials={jobMaterials} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotizacion" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Cotizaciones</CardTitle>
              <CreateQuoteButton jobId={job.id} clientId={job.client_id} />
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este trabajo todavía no tiene cotizaciones.</p>
              ) : (
                <div className="flex flex-col divide-y">
                  {quotes.map((q) => (
                    <Link
                      key={q.id}
                      href={`/app/cotizaciones/${q.id}`}
                      className="flex items-center justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                    >
                      <span className="font-medium">{q.quote_number}</span>
                      <Badge variant="outline">{quoteStatusLabels[q.status] ?? q.status}</Badge>
                      <span>{formatMoney(Number(q.total), organization.currency)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actividad" className="mt-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[70%] text-right">{value}</span>
    </div>
  );
}
