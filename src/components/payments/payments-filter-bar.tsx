"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

export function PaymentsFilterBar({
  clients,
  paymentMethods,
  paymentAccounts,
}: {
  clients: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
  paymentAccounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={searchParams.get("period") ?? ALL} onValueChange={(v) => setParam("period", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todo el historial</SelectItem>
          <SelectItem value="30">Últimos 30 días</SelectItem>
          <SelectItem value="90">Últimos 90 días</SelectItem>
        </SelectContent>
      </Select>
      <Select value={searchParams.get("client") ?? ALL} onValueChange={(v) => setParam("client", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("method") ?? ALL} onValueChange={(v) => setParam("method", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Medio de pago" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los medios</SelectItem>
          {paymentMethods.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("account") ?? ALL} onValueChange={(v) => setParam("account", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Cuenta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las cuentas</SelectItem>
          {paymentAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
