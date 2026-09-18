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
      {/* Mobile: cards. Evita la tabla horizontal ilegible en celular. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {materials.map((m) => (
          <div key={m.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/app/materiales/${m.id}`} className="font-medium hover:underline">
                {m.name}
              </Link>
              <Badge variant={m.active ? "default" : "secondary"}>
                {m.active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {m.categoryName ?? "Sin categoría"} · {m.unitSymbol}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Stock</p>
                <p className={`flex items-center gap-1 font-medium ${m.lowStock ? "text-warning" : ""}`}>
                  {m.lowStock && <AlertTriangle className="size-3.5" />}
                  {formatQuantity(m.currentStock, m.unitSymbol)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último costo</p>
                <p className="font-medium">
                  {m.lastPrice != null ? formatMoney(m.lastPrice, currency) : "-"}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setEditing(m)}>
              Editar
            </Button>
          </div>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
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
