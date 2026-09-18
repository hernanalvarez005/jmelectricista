"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { MaterialFormSheet } from "@/components/materials/material-form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";
import type { MaterialListItem } from "@/lib/data/materials";
import type { Tables } from "@/lib/supabase/database.types";

export function MaterialsTable({
  materials,
  categories,
  units,
  currency,
}: {
  materials: MaterialListItem[];
  categories: Tables<"material_categories">[];
  units: Tables<"material_units">[];
  currency: string;
}) {
  const [editing, setEditing] = useState<MaterialListItem | null>(null);

  if (materials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tenés materiales cargados todavía.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Último costo</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/materiales/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                  {m.sku && <span className="ml-2 text-xs text-muted-foreground">{m.sku}</span>}
                </TableCell>
                <TableCell>{m.categoryName ?? "-"}</TableCell>
                <TableCell>{m.unitSymbol}</TableCell>
                <TableCell className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    {m.lowStock && <AlertTriangle className="size-3.5 text-warning" />}
                    <span className={m.lowStock ? "font-medium text-warning" : undefined}>
                      {formatQuantity(m.currentStock, m.unitSymbol)}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {m.lastPrice != null ? formatMoney(m.lastPrice, currency) : "-"}
                </TableCell>
                <TableCell>
                  {m.lastPriceSupplierName ? (
                    <span title={m.lastPriceDate ? formatDate(m.lastPriceDate) : undefined}>
                      {m.lastPriceSupplierName}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={m.active ? "default" : "secondary"}>
                    {m.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MaterialFormSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        material={editing?.raw}
        categories={categories}
        units={units}
      />
    </>
  );
}
