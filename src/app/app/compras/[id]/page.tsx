import { ArrowLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchaseActions } from "@/components/purchases/purchase-actions";
import { PurchaseDocumentPanel } from "@/components/purchases/purchase-document-panel";
import { PurchaseHeaderDialog } from "@/components/purchases/purchase-header-dialog";
import { PurchaseItemDialog } from "@/components/purchases/purchase-item-dialog";
import { PurchaseRemoveItemButton } from "@/components/purchases/purchase-remove-item-button";
import { PurchaseStatusBadge } from "@/components/purchases/purchase-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canAdminister, canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getPurchaseDetail, listPurchasableMaterials } from "@/lib/data/purchases";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatDateOnly, formatDateTime } from "@/lib/format/dates";
import { formatMoney, formatUnitCost } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";
import type { PurchaseStatus } from "@/lib/validations/purchase";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization, role } = await requireCurrentOrg();

  const detail = await getPurchaseDetail(organization.id, id);
  if (!detail) notFound();

  const { purchase, items } = detail;
  const status = purchase.status as PurchaseStatus;
  const isDraft = status === "draft";
  const canEditDraft = isDraft && canOperate(role);
  const currency = organization.currency;

  const [suppliers, materials] = canEditDraft
    ? await Promise.all([listSuppliers(organization.id), listPurchasableMaterials(organization.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/compras" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Compras
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{purchase.purchase_number}</h2>
            <PurchaseStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/app/proveedores/${purchase.supplier_id}`} className="hover:underline">
              {detail.supplierName}
            </Link>{" "}
            · {formatDateOnly(purchase.purchase_date)}
          </p>
          {detail.sourceJob && (
            <p className="text-sm text-muted-foreground">
              Creada desde el faltante de{" "}
              <Link href={`/app/trabajos/${detail.sourceJob.id}`} className="hover:underline">
                {detail.sourceJob.title}
              </Link>
            </p>
          )}
          {purchase.received_at && (
            <p className="text-sm text-muted-foreground">Recibida el {formatDateTime(purchase.received_at, organization.timezone)}</p>
          )}
          {purchase.cancelled_at && (
            <p className="text-sm text-muted-foreground">Cancelada el {formatDateTime(purchase.cancelled_at, organization.timezone)}</p>
          )}
        </div>
        {canEditDraft && (
          <PurchaseHeaderDialog
            purchaseId={purchase.id}
            suppliers={suppliers.filter((s) => s.active || s.id === purchase.supplier_id).map((s) => ({ id: s.id, name: s.name }))}
            initial={{ supplierId: purchase.supplier_id, purchaseDate: purchase.purchase_date, notes: purchase.notes ?? "" }}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil /> Editar datos
              </Button>
            }
          />
        )}
      </div>

      {purchase.notes && <p className="rounded-lg border bg-muted/40 p-3 text-sm">{purchase.notes}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Materiales</CardTitle>
          {canEditDraft && (
            <PurchaseItemDialog
              purchaseId={purchase.id}
              materials={materials}
              usedMaterialIds={items.map((i) => i.materialId)}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus /> Agregar ítem
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">La compra todavía no tiene ítems.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:hidden">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/app/materiales/${item.materialId}`} className="font-medium hover:underline">
                        {item.materialName}
                      </Link>
                      <span className="font-medium">{formatMoney(item.subtotal, currency)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatQuantity(item.quantity, item.unitSymbol)} × {formatUnitCost(item.unitCost, currency)}
                    </p>
                    {canEditDraft && (
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <PurchaseItemDialog
                          purchaseId={purchase.id}
                          materials={materials}
                          usedMaterialIds={items.map((i) => i.materialId)}
                          item={item}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Editar ${item.materialName}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <PurchaseRemoveItemButton purchaseId={purchase.id} itemId={item.id} label={item.materialName} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden rounded-lg border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo unitario</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      {canEditDraft && <TableHead className="w-24" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <Link href={`/app/materiales/${item.materialId}`} className="hover:underline">
                            {item.materialName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{formatQuantity(item.quantity, item.unitSymbol)}</TableCell>
                        <TableCell className="text-right">{formatUnitCost(item.unitCost, currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(item.subtotal, currency)}</TableCell>
                        {canEditDraft && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <PurchaseItemDialog
                                purchaseId={purchase.id}
                                materials={materials}
                                usedMaterialIds={items.map((i) => i.materialId)}
                                item={item}
                                trigger={
                                  <Button variant="ghost" size="icon" aria-label={`Editar ${item.materialName}`}>
                                    <Pencil />
                                  </Button>
                                }
                              />
                              <PurchaseRemoveItemButton purchaseId={purchase.id} itemId={item.id} label={item.materialName} />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold">{formatMoney(Number(purchase.total), currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factura / remito del proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseDocumentPanel purchaseId={purchase.id} hasDocument={Boolean(purchase.document_path)} canEdit={canOperate(role) && status !== "cancelled"} />
        </CardContent>
      </Card>

      {isDraft && canAdminister(role) && (
        <PurchaseActions purchaseId={purchase.id} hasItems={items.length > 0} totalLabel={formatMoney(Number(purchase.total), currency)} />
      )}
      {isDraft && !canAdminister(role) && (
        <p className="text-sm text-muted-foreground">Solo un administrador puede recibir o cancelar la compra.</p>
      )}
    </div>
  );
}
