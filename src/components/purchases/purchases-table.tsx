import Link from "next/link";

import { PurchaseStatusBadge } from "@/components/purchases/purchase-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PurchaseListItem } from "@/lib/data/purchases";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

export function PurchasesTable({
  purchases,
  currency,
  showSupplier = true,
}: {
  purchases: PurchaseListItem[];
  currency: string;
  showSupplier?: boolean;
}) {
  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No hay compras para mostrar.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {purchases.map((p) => (
          <Link key={p.id} href={`/app/compras/${p.id}`} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{p.purchaseNumber}</span>
              <PurchaseStatusBadge status={p.status} />
            </div>
            {showSupplier && <p className="text-sm text-muted-foreground">{p.supplierName}</p>}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{formatDateOnly(p.purchaseDate)}</span>
              <span className="font-medium">{formatMoney(p.total, currency)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.itemCount} ítem{p.itemCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              {showSupplier && <TableHead>Proveedor</TableHead>}
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/compras/${p.id}`} className="hover:underline">
                    {p.purchaseNumber}
                  </Link>
                </TableCell>
                <TableCell>{formatDateOnly(p.purchaseDate)}</TableCell>
                {showSupplier && <TableCell>{p.supplierName}</TableCell>}
                <TableCell className="text-right">{p.itemCount}</TableCell>
                <TableCell className="text-right">{formatMoney(p.total, currency)}</TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
