import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupplierDetail } from "@/lib/data/suppliers";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { buildWhatsAppLink } from "@/lib/format/phone";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();
  const detail = await getSupplierDetail(organization.id, id);

  if (!detail) notFound();

  const { supplier, prices } = detail;
  const waLink = buildWhatsAppLink(supplier.phone);
  const quotedMaterials = new Set(prices.map((p) => p.material_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{supplier.name}</h2>
            <Badge variant={supplier.active ? "default" : "secondary"}>
              {supplier.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {quotedMaterials} material{quotedMaterials === 1 ? "" : "es"} cotizado
            {quotedMaterials === 1 ? "" : "s"}
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
          <SupplierFormSheet supplier={supplier} trigger={<Button variant="outline">Editar</Button>} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row label="Contacto" value={supplier.contact_name} />
          <Row label="Teléfono" value={supplier.phone} />
          <Row label="Email" value={supplier.email} />
          <Row label="Notas" value={supplier.notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precios registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se registraron precios.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {prices.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/app/materiales/${p.material_id}`} className="font-medium hover:underline">
                    {p.materialName}
                  </Link>
                  <span>{formatMoney(Number(p.price), p.currency)}</span>
                  <span className="text-muted-foreground">{formatDate(p.recorded_at)}</span>
                </div>
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
      <span className="max-w-[70%] text-right">{value || "-"}</span>
    </div>
  );
}
