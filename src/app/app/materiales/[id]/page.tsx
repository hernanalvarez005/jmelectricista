import { notFound } from "next/navigation";

import { InitialStockDialog, StockAdjustDialog } from "@/components/materials/stock-dialogs";
import { SupplierPriceDialog } from "@/components/suppliers/supplier-price-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMaterialDetail } from "@/lib/data/materials";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatDate, formatDateTime } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";

const movementLabels: Record<string, string> = {
  in: "Ingreso",
  consumption: "Consumo",
  return: "Devolución",
  adjustment_in: "Ajuste (+)",
  adjustment_out: "Ajuste (-)",
};

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();
  const [detail, suppliers] = await Promise.all([
    getMaterialDetail(organization.id, id),
    listSuppliers(organization.id),
  ]);

  if (!detail) notFound();

  const { material, categoryName, unit, currentStock, recentMovements, priceHistory } = detail;
  const lowStock = material.minimum_stock > 0 && currentStock < Number(material.minimum_stock);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{material.name}</h2>
            <Badge variant={material.active ? "default" : "secondary"}>
              {material.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryName ?? "Sin categoría"} · {unit.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InitialStockDialog materialId={material.id} trigger={<Button variant="outline">Stock inicial</Button>} />
          <StockAdjustDialog materialId={material.id} trigger={<Button variant="outline">Ajustar stock</Button>} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="SKU" value={material.sku} />
            <Row label="Descripción" value={material.description} />
            <Row label="Stock mínimo" value={formatQuantity(Number(material.minimum_stock), unit.symbol)} />
          </CardContent>
        </Card>

        <Card className={lowStock ? "border-warning/50" : undefined}>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold ${lowStock ? "text-warning" : ""}`}>
              {formatQuantity(currentStock, unit.symbol)}
            </p>
            {lowStock && <p className="mt-1 text-sm text-warning">Por debajo del stock mínimo.</p>}
            <div className="mt-4 flex flex-col divide-y">
              {recentMovements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                recentMovements.slice(0, 8).map((mv) => (
                  <div key={mv.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{movementLabels[mv.movement_type] ?? mv.movement_type}</span>
                    <span
                      className={
                        ["in", "return", "adjustment_in"].includes(mv.movement_type)
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {["in", "return", "adjustment_in"].includes(mv.movement_type) ? "+" : "-"}
                      {formatQuantity(Number(mv.quantity), unit.symbol)}
                    </span>
                    <span className="text-muted-foreground">{formatDateTime(mv.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Historial de precios</CardTitle>
          <SupplierPriceDialog
            materialId={material.id}
            suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
            trigger={<Button size="sm">Registrar precio</Button>}
          />
        </CardHeader>
        <CardContent>
          {priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin precios registrados todavía.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {priceHistory.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{p.supplierName}</span>
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
