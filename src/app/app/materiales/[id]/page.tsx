import Link from "next/link";
import { notFound } from "next/navigation";

import { InitializeValuationDialog, InitialStockDialog, StockAdjustDialog } from "@/components/materials/stock-dialogs";
import { SupplierPriceDialog } from "@/components/suppliers/supplier-price-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMaterialDetail } from "@/lib/data/materials";
import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/format/dates";
import { formatMoney, formatUnitCost } from "@/lib/format/money";
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
  const { organization, role } = await requireCurrentOrg();
  const [detail, suppliers] = await Promise.all([
    getMaterialDetail(organization.id, id),
    listSuppliers(organization.id),
  ]);

  if (!detail) notFound();

  const { material, categoryName, unit, currentStock, recentMovements, priceHistory, valuation, lastPurchase, openingEvent } = detail;
  const currency = organization.currency;
  const lastConsultedPrice = priceHistory[0] ?? null;
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
            <CardTitle>Stock y valoración</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className={`text-3xl font-semibold ${lowStock ? "text-warning" : ""}`}>
                {formatQuantity(currentStock, unit.symbol)}
              </p>
              {lowStock && <p className="mt-1 text-sm text-warning">Por debajo del stock mínimo.</p>}
            </div>

            {valuation.needsInitialization ? (
              <div className="rounded-lg border border-warning/50 p-3 text-sm">
                <p className="font-medium">Costo no inicializado</p>
                <p className="mt-1 text-muted-foreground">
                  Este material tiene stock anterior a la valoración y no se le inventó un costo. Sus consumos se registran sin costo
                  hasta que un administrador inicialice la valoración.
                </p>
                {canAdminister(role) && (
                  <InitializeValuationDialog
                    materialId={material.id}
                    currentStock={String(currentStock).replace(".", ",")}
                    unitSymbol={unit.symbol}
                    trigger={
                      <Button size="sm" className="mt-3">
                        Inicializar valoración
                      </Button>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <Row
                  label="Costo promedio"
                  value={valuation.averageCost != null ? formatUnitCost(valuation.averageCost, currency) : null}
                />
                <Row
                  label="Valor del stock"
                  value={valuation.inventoryValue != null ? formatMoney(valuation.inventoryValue, currency) : null}
                />
              </div>
            )}

            <div className="grid gap-2 border-t pt-3 text-sm">
              <Row
                label="Última compra"
                value={
                  lastPurchase
                    ? `${formatUnitCost(lastPurchase.unitCost, currency)} · ${lastPurchase.purchaseNumber} · ${formatDateOnly(lastPurchase.purchaseDate)}`
                    : null
                }
              />
              <Row
                label="Último precio consultado"
                value={
                  lastConsultedPrice
                    ? `${formatMoney(Number(lastConsultedPrice.price), lastConsultedPrice.currency)} · ${lastConsultedPrice.supplierName}`
                    : null
                }
              />
              {openingEvent && (
                <Row
                  label="Valoración inicial"
                  value={`${formatUnitCost(openingEvent.unitCost, currency)} · ${formatDateTime(openingEvent.createdAt, organization.timezone)}`}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos de stock</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {recentMovements.slice(0, 20).map((mv) => {
                const isIn = ["in", "return", "adjustment_in"].includes(mv.movement_type);
                const origin = mv.purchaseNumber ?? mv.jobTitle ?? mv.notes;
                return (
                  <div key={mv.id} className="grid gap-1 py-2 text-sm sm:grid-cols-[110px_120px_1fr_150px_150px] sm:items-center sm:gap-3">
                    <span className="font-medium">{movementLabels[mv.movement_type] ?? mv.movement_type}</span>
                    <span className={isIn ? "text-success" : "text-destructive"}>
                      {isIn ? "+" : "-"}
                      {formatQuantity(Number(mv.quantity), unit.symbol)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {mv.purchase_id ? (
                        <Link href={`/app/compras/${mv.purchase_id}`} className="hover:underline">
                          {origin}
                        </Link>
                      ) : (
                        origin || "-"
                      )}
                    </span>
                    <span className="sm:text-right">
                      {mv.unit_cost != null ? (
                        <>
                          {formatUnitCost(Number(mv.unit_cost), currency)} c/u ·{" "}
                          <span className="font-medium">{formatMoney(Number(mv.total_cost ?? 0), currency)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin costo</span>
                      )}
                    </span>
                    <span className="text-muted-foreground sm:text-right">{formatDateTime(mv.created_at, organization.timezone)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Historial de precios</CardTitle>
          <SupplierPriceDialog
            materialId={material.id}
            timezone={organization.timezone}
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
                <div
                  key={p.id}
                  className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="font-medium">{p.supplierName}</span>
                  <div className="flex items-center justify-between gap-4 sm:contents">
                    <span>{formatMoney(Number(p.price), p.currency)}</span>
                    <span className="text-muted-foreground">{formatDate(p.recorded_at, organization.timezone)}</span>
                  </div>
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
