import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientAddressDialog } from "@/components/clients/client-address-dialog";
import { ClientFormSheet } from "@/components/clients/client-form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientDetail } from "@/lib/data/clients";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getClientFinancialSummary, getClientJobsFinancialDetail } from "@/lib/data/payments";
import { BillingBadge } from "@/components/billing/billing-badge";
import { WhatsAppAction } from "@/components/whatsapp/whatsapp-action";
import { getBillingByJobIds } from "@/lib/data/billing";
import { buildClientWhatsAppMessage } from "@/lib/whatsapp/messages";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { jobPriorityLabel } from "@/lib/validations/job";
import { paymentStatusLabels } from "@/lib/validations/payment";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();
  const [detail, financialSummary, jobsFinancial] = await Promise.all([
    getClientDetail(organization.id, id),
    getClientFinancialSummary(organization.id, id),
    getClientJobsFinancialDetail(organization.id, id),
  ]);

  if (!detail) notFound();

  const { client, addresses, jobs } = detail;
  const financialByJob = new Map(jobsFinancial.map((f) => [f.jobId, f]));
  const billingByJob = await getBillingByJobIds(
    organization.id,
    jobs.map((j) => j.id)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{client.name}</h2>
            <Badge variant={client.active ? "default" : "secondary"}>
              {client.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {jobs.length} trabajo{jobs.length === 1 ? "" : "s"} asociado{jobs.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppAction
            phone={client.phone}
            defaultCountry={organization.default_country_code}
            message={buildClientWhatsAppMessage({ clientName: client.name })}
            editHref={`/app/clientes/${client.id}`}
          />
          <ClientFormSheet client={client} trigger={<Button variant="outline">Editar</Button>} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Teléfono" value={client.phone} />
            <Row label="Email" value={client.email} />
            <Row label="CUIT / DNI" value={client.tax_id} />
            <Row label="Notas" value={client.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Direcciones</CardTitle>
            <ClientAddressDialog
              clientId={client.id}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus /> Agregar
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin direcciones cargadas.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {addresses.map((addr) => (
                  <div key={addr.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{addr.label || "Dirección"}</span>
                      {addr.is_default && <Badge variant="outline">Principal</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[addr.street, addr.locality, addr.province].filter(Boolean).join(", ") ||
                        "Sin detalle"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 sm:gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Contratado</p>
              <p className="text-lg font-semibold sm:text-xl">{formatMoney(financialSummary.contractedAmount, organization.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-lg font-semibold sm:text-xl">{formatMoney(financialSummary.collectedAmount, organization.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className={`text-lg font-semibold sm:text-xl ${financialSummary.outstandingAmount > 0 ? "text-warning" : "text-success"}`}>
                {formatMoney(financialSummary.outstandingAmount, organization.currency)}
              </p>
            </div>
          </div>
          {financialSummary.uncontractedCollections > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Cobros sin cotización aceptada:{" "}
              {formatMoney(financialSummary.uncontractedCollections, organization.currency)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trabajos</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este cliente todavía no tiene trabajos.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {jobs.map((job) => {
                const fin = financialByJob.get(job.id);
                return (
                  <Link
                    key={job.id}
                    href={`/app/trabajos/${job.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.statusName} · {jobPriorityLabel(job.priority)}
                        {job.target_date ? ` · ${formatDateOnly(job.target_date)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      {fin?.contractedAmount != null ? (
                        <p className="font-medium">{formatMoney(fin.contractedAmount, organization.currency)}</p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge variant="outline">
                          {fin?.paymentStatus === "partial" && fin.outstandingAmount != null
                            ? `Pendiente ${formatMoney(fin.outstandingAmount, organization.currency)}`
                            : paymentStatusLabels[fin?.paymentStatus ?? "no_contract"]}
                        </Badge>
                        {billingByJob.get(job.id)?.isBillable && <BillingBadge status={billingByJob.get(job.id)!.status} />}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "-"}</span>
    </div>
  );
}
