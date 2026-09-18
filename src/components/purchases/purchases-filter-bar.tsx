"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export function PurchasesFilterBar({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <Select value={searchParams.get("supplier") ?? ALL} onValueChange={(v) => setParam("supplier", v)}>
        <SelectTrigger className="w-full sm:w-[200px]" aria-label="Proveedor">
          <SelectValue placeholder="Proveedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los proveedores</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Estado">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="received">Recibida</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Desde"
        className="w-full sm:w-[160px]"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
      />
      <Input
        type="date"
        aria-label="Hasta"
        className="w-full sm:w-[160px]"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
      />
    </div>
  );
}
