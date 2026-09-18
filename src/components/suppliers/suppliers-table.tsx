"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format/dates";
import { buildWhatsAppLink } from "@/lib/format/phone";
import type { SupplierListItem } from "@/lib/data/suppliers";

export function SuppliersTable({ suppliers }: { suppliers: SupplierListItem[] }) {
  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tenés proveedores cargados todavía.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Último precio cargado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-9" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => {
            const waLink = buildWhatsAppLink(s.phone);
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/proveedores/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>{s.contact_name || "-"}</TableCell>
                <TableCell>{s.phone || "-"}</TableCell>
                <TableCell>{s.lastPriceDate ? formatDate(s.lastPriceDate) : "-"}</TableCell>
                <TableCell>
                  <Badge variant={s.active ? "default" : "secondary"}>
                    {s.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir WhatsApp"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
