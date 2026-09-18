"use client";

import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildWhatsAppLink } from "@/lib/format/phone";
import type { ClientListItem } from "@/lib/data/clients";

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.defaultLocality?.toLowerCase().includes(term)
    );
  }, [clients, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o localidad..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {clients.length === 0
            ? "Todavía no hay clientes cargados."
            : "No hay clientes que coincidan con la búsqueda."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Localidad</TableHead>
                <TableHead className="text-right">Trabajos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => {
                const waLink = buildWhatsAppLink(client.phone);
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/clientes/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
                    <TableCell>{client.defaultLocality || "-"}</TableCell>
                    <TableCell className="text-right">{client.jobCount}</TableCell>
                    <TableCell>
                      <Badge variant={client.active ? "default" : "secondary"}>
                        {client.active ? "Activo" : "Inactivo"}
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
      )}
    </div>
  );
}
