import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientAddressDialog } from "@/components/clients/client-address-dialog";
import { ClientFormSheet } from "@/components/clients/client-form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientDetail } from "@/lib/data/clients";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { buildWhatsAppLink } from "@/lib/format/phone";
import { formatDate } from "@/lib/format/dates";
import { jobPriorityLabel } from "@/lib/validations/job";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();
  const detail = await getClientDetail(organization.id, id);

  if (!detail) notFound();

  const { client, addresses, jobs } = detail;
  const waLink = buildWhatsAppLink(client.phone);

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
          {waLink && (
            <Button variant="outline" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          )}
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
          <CardTitle>Trabajos</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este cliente todavía no tiene trabajos.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/app/trabajos/${job.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.statusName} · {jobPriorityLabel(job.priority)}
                      {job.target_date ? ` · ${formatDate(job.target_date)}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
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
