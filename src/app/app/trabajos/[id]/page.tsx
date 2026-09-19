import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddJobMaterialDialog } from "@/components/jobs/add-job-material-dialog";
import { JobMaterialsList } from "@/components/jobs/job-materials-list";
import { BillingBadge } from "@/components/billing/billing-badge";
import { BillingActions } from "@/components/jobs/billing-actions";
import { WhatsAppAction } from "@/components/whatsapp/whatsapp-action";
import { EconomicsSummary } from "@/components/jobs/economics-summary";
import { JobCostsPanel } from "@/components/jobs/job-costs-panel";
import { MaterialCostCard } from "@/components/jobs/material-cost-card";
import { JobPaymentsPanel } from "@/components/jobs/job-payments-panel";
import { JobSessionDialog } from "@/components/jobs/job-session-dialog";
import { JobSessionsList } from "@/components/jobs/job-sessions-list";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import { RequestPricesDialog } from "@/components/jobs/request-prices-dialog";
import { CreateQuoteButton } from "@/components/quotes/create-quote-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { listExpenseCategories, getJobExpenses } from "@/lib/data/expenses";
import { getJobBilling } from "@/lib/data/billing";
import { getJobCostStatus } from "@/lib/data/job-costs";
import { getJobEconomics, getJobLaborBreakdown } from "@/lib/data/job-economics";
import { getJobDetail } from "@/lib/data/jobs";
import { buildJobWhatsAppMessage, buildPaymentWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp/messages";
import { normalizeWhatsAppPhone, whatsappDigits } from "@/lib/whatsapp/phone";
import { todayKeyInTZ } from "@/lib/scheduling/timezone";
import { getJobFormOptions } from "@/lib/data/job-form-options";
import { getJobMaterials } from "@/lib/data/job-materials";
import { listMaterialsForQuoteItems } from "@/lib/data/materials";
import { getOrgMembers } from "@/lib/data/members";
import {
  getJobFinancialStatus,
  getJobPayments,
  listPaymentAccounts,
  listPaymentMethods,
} from "@/lib/data/payments";
import { getJobQuotes } from "@/lib/data/quotes";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatDateOnly, formatDateTime } from "@/lib/format/dates";
import { formatMinutes, formatMinutesCompact, formatVarianceMinutes } from "@/lib/format/duration";
import { formatMoney } from "@/lib/format/money";
import { calculateJobTimeStatus } from "@/lib/time/job-time-status";
import { jobPriorityLabel } from "@/lib/validations/job";
import { paymentStatusLabels } from "@/lib/validations/payment";
import { quoteStatusLabels } from "@/lib/validations/quote";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization, role } = await requireCurrentOrg();

  const [detail, options, members, jobMaterials, suppliers, quotes, allMaterials, financialStatus, payments, paymentMethods, paymentAccounts, costStatus, expenses, expenseCategories, economics, laborSessions, billing] =
    await Promise.all([
      getJobDetail(organization.id, id),
      getJobFormOptions(organization.id),
      getOrgMembers(organization.id),
      getJobMaterials(organization.id, id),
      listSuppliers(organization.id),
      getJobQuotes(organization.id, id),
      listMaterialsForQuoteItems(organization.id),
      getJobFinancialStatus(organization.id, id),
      getJobPayments(organization.id, id),
      listPaymentMethods(organization.id, { activeOnly: true }),
      listPaymentAccounts(organization.id, { activeOnly: true }),
      getJobCostStatus(organization.id, id),
      getJobExpenses(organization.id, id),
      listExpenseCategories(organization.id, { activeOnly: true }),
      canAdminister(role) ? getJobEconomics(organization.id, id) : Promise.resolve(null),
      canAdminister(role) ? getJobLaborBreakdown(organization.id, id, organization.timezone) : Promise.resolve([]),
      getJobBilling(organization.id, id),
    ]);

  if (!detail) notFound();

  const { job, clientName, clientPhone, addressLabel, jobTypeName, statusName, statusIsClosed, assignedMemberName, sessions, activity } =
    detail;

  const membersById = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const timeStatus = calculateJobTimeStatus(job.estimated_minutes, sessions);
  const todayKey = todayKeyInTZ(organization.timezone);
  const clientWhatsApp = normalizeWhatsAppPhone(clientPhone, organization.default_country_code);
  const confirmationUrls: Record<string, string> = {};
  if (clientWhatsApp.status === "ok") {
    for (const p of payments) {
      if (!p.isVoided) {
        confirmationUrls[p.id] = buildWhatsAppUrl(
          clientWhatsApp.digits,
          buildPaymentWhatsAppMessage({ clientName, amount: p.amount, currency: organization.currency, jobTitle: job.title })
        );
      }
    }
  }
  const confirmationHint =
    clientWhatsApp.status === "missing"
      ? "Cargá el teléfono del cliente para enviar la confirmación"
      : clientWhatsApp.status === "invalid"
        ? "El teléfono del cliente no es válido para WhatsApp"
        : null;
  const materialsWithMissing = jobMaterials.filter((m) => m.missing > 0).length;
  const materialsWithOverconsumption = jobMaterials.filter((m) => m.varianceQuantity > 0).length;
  const latestQuote = quotes[0];
  const materialsPending = jobMaterials.filter((m) => m.remainingQuantity > 0).length;
  const hasMaterialConsumption = jobMaterials.some((m) => m.realCost !== null);

  // Advertencias NO bloqueantes: un trabajo cerrado (status.is_closed, no por
  // nombre) con información pendiente no debe mostrarse como análisis completo.
  const closeWarnings: string[] = [];
  if (statusIsClosed) {
    if (financialStatus.contractedAmount === null) {
      closeWarnings.push("No tiene cotización aceptada.");
    } else if ((financialStatus.outstandingAmount ?? 0) > 0) {
      closeWarnings.push(`${formatMoney(financialStatus.outstandingAmount ?? 0, organization.currency)} por cobrar.`);
    }
    if (timeStatus.completedSessionsWithoutActualTime > 0) {
      const n = timeStatus.completedSessionsWithoutActualTime;
      closeWarnings.push(`${n} sesión${n === 1 ? "" : "es"} sin tiempo real registrado.`);
    }
    if (!costStatus.materialCostComplete) {
      closeWarnings.push("Costo real de materiales incompleto: hay consumos sin valoración histórica.");
    }
    if (economics && !economics.laborCostComplete) {
      closeWarnings.push("Costo de mano de obra incompleto: hay sesiones sin tarifa, responsable o tiempo real.");
    }
    if (materialsPending > 0) {
      closeWarnings.push(`${materialsPending} material${materialsPending === 1 ? "" : "es"} con cantidad pendiente de consumir.`);
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <WhatsAppAction
            phone={clientPhone}
            defaultCountry={organization.default_country_code}
            message={buildJobWhatsAppMessage({ clientName, jobTitle: job.title })}
            label="Contactar cliente"
            editHref={`/app/clientes/${job.client_id}`}
          />
          <JobStatusSelect jobId={job.id} statusId={job.status_id} statuses={options.statuses} />
          <Button variant="outline" asChild>
            <Link href={`/app/trabajos/${job.id}/editar`}>Editar</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="materiales">Materiales</TabsTrigger>
            <TabsTrigger value="cotizacion">Cotización</TabsTrigger>
            <TabsTrigger value="cobros">Cobros</TabsTrigger>
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="actividad">Actividad</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="mt-4 flex flex-col gap-6">
          {closeWarnings.length > 0 && (
            <div className="rounded-lg border border-warning/50 bg-warning/5 p-4 text-sm">
              <p className="font-medium text-warning">Trabajo finalizado con información pendiente:</p>
              <ul className="mt-1 list-disc pl-5">
                {closeWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Tiempo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Row label="Estimado" value={formatMinutesCompact(timeStatus.estimatedMinutes)} />
                <Row label="Programado" value={formatMinutes(timeStatus.plannedMinutes)} />
                <Row label="Real" value={formatMinutes(timeStatus.actualMinutes)} />
                <Row
                  label="Desvío"
                  value={
                    <span className={timeStatus.varianceMinutes != null && timeStatus.varianceMinutes > 0 ? "text-warning" : undefined}>
                      {formatVarianceMinutes(timeStatus.varianceMinutes, timeStatus.variancePercentage)}
                    </span>
                  }
                />
                <Row
                  label="Fecha objetivo"
                  value={job.target_date ? formatDateOnly(job.target_date) : "-"}
                />
                {!timeStatus.actualTimeComplete && (
                  <p className="text-xs text-warning">Datos reales incompletos.</p>
                )}
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
                <Row
                  label="Con sobreconsumo"
                  value={
                    materialsWithOverconsumption > 0 ? (
                      <span className="font-medium text-info">{materialsWithOverconsumption}</span>
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

            <Card>
              <CardHeader>
                <CardTitle>Finanzas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {financialStatus.contractedAmount === null ? (
                  <p className="text-muted-foreground">Sin cotización aceptada.</p>
                ) : (
                  <>
                    <Row label="Contratado" value={formatMoney(financialStatus.contractedAmount, organization.currency)} />
                    <Row label="Cobrado" value={formatMoney(financialStatus.collectedAmount, organization.currency)} />
                    <Row
                      label="Pendiente"
                      value={
                        <span className={financialStatus.outstandingAmount! > 0 ? "font-medium text-warning" : "text-success"}>
                          {formatMoney(financialStatus.outstandingAmount ?? 0, organization.currency)}
                        </span>
                      }
                    />
                  </>
                )}
                <Row label="Cobro" value={<Badge variant="outline">{paymentStatusLabels[financialStatus.paymentStatus]}</Badge>} />
                <Row label="Facturación" value={<BillingBadge status={billing.status} />} />
                {billing.status === "invoiced" && (
                  <>
                    <Row label="Fecha" value={billing.invoicedAt ? formatDateOnly(billing.invoicedAt) : "-"} />
                    <Row label="Comprobante" value={billing.invoiceNumber ?? "-"} />
                  </>
                )}
                {canAdminister(role) && (
                  <div className="pt-1">
                    <BillingActions
                      jobId={job.id}
                      invoiced={billing.status === "invoiced"}
                      todayKey={todayKey}
                      current={{ invoicedAt: billing.invoicedAt, invoiceNumber: billing.invoiceNumber, notes: billing.notes }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {economics && (
            <Card>
              <CardHeader>
                <CardTitle>Economía del trabajo</CardTitle>
              </CardHeader>
              <CardContent className="sm:max-w-xl">
                <EconomicsSummary economics={economics} currency={organization.currency} />
              </CardContent>
            </Card>
          )}

          <MaterialCostCard
            costStatus={costStatus}
            hasConsumption={hasMaterialConsumption}
            materialsPending={materialsPending}
            currency={organization.currency}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Agenda / sesiones</CardTitle>
              <JobSessionDialog
                jobId={job.id}
                members={options.members}
                defaultMemberId={job.assigned_member_id}
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {materialsWithMissing > 0 && canOperate(role) && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/compras/nueva?job=${job.id}`}>
                      <ShoppingCart /> Crear compra
                    </Link>
                  </Button>
                )}
                <RequestPricesDialog
                  materials={jobMaterials}
                  suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, phone: s.phone, whatsappDigits: whatsappDigits(s.phone, organization.default_country_code) }))}
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
              <JobMaterialsList jobId={job.id} materials={jobMaterials} currency={organization.currency} />
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

        <TabsContent value="cobros" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cobros</CardTitle>
            </CardHeader>
            <CardContent>
              <JobPaymentsPanel
                jobId={job.id}
                currency={organization.currency}
                timezone={organization.timezone}
                financialStatus={financialStatus}
                payments={payments}
                paymentMethods={paymentMethods}
                paymentAccounts={paymentAccounts}
                jobStatuses={options.statuses}
                canVoid={canAdminister(role)}
                confirmationUrls={confirmationUrls}
                confirmationHint={confirmationHint}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costos" className="mt-4">
          <JobCostsPanel
            jobId={job.id}
            currency={organization.currency}
            timezone={organization.timezone}
            economics={economics}
            laborSessions={laborSessions}
            members={options.members}
            expenses={expenses}
            expenseCategories={expenseCategories}
            costStatus={costStatus}
            hasMaterialConsumption={hasMaterialConsumption}
            materialsPending={materialsPending}
            isAdmin={canAdminister(role)}
            canOperate={canOperate(role)}
          />
        </TabsContent>

        <TabsContent value="actividad" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
              ) : (
                <div className="flex flex-col divide-y">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        {entry.kind === "status" && (
                          <>
                            {entry.fromStatusName ? `${entry.fromStatusName} → ` : "Creado en "}
                            <span className="font-medium">{entry.toStatusName}</span>
                          </>
                        )}
                        {entry.kind === "payment_registered" && (
                          <>
                            Cobro registrado:{" "}
                            <span className="font-medium">
                              {formatMoney(entry.amount, organization.currency)}
                            </span>{" "}
                            por {entry.methodName}
                          </>
                        )}
                        {entry.kind === "payment_voided" && (
                          <span className="text-destructive">
                            Cobro anulado: {formatMoney(entry.amount, organization.currency)} — {entry.voidReason}
                          </span>
                        )}
                        {entry.kind === "billing_invoiced" && (
                          <>
                            {entry.edited ? "Datos de facturación actualizados" : "Facturación realizada"}
                            {entry.invoiceNumber ? ` · comprobante ${entry.invoiceNumber}` : ""}
                            {entry.invoicedAt ? ` · ${formatDateOnly(entry.invoicedAt)}` : ""}
                          </>
                        )}
                        {entry.kind === "billing_reverted" && (
                          <>
                            Facturación revertida a pendiente
                            {entry.invoiceNumber ? ` (era el comprobante ${entry.invoiceNumber})` : ""}
                          </>
                        )}
                      </span>
                      <span className="text-muted-foreground">{formatDateTime(entry.at, organization.timezone)}</span>
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
