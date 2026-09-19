"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { backfillLaborCostsAction, deleteLaborRateAction } from "@/app/app/configuracion/labor-actions";
import { Button } from "@/components/ui/button";
import type { LaborRateItem } from "@/lib/data/labor";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

/** Valoriza las sesiones con tiempo real y responsable que no tienen tarifa (acción explícita, nunca automática). */
export function BackfillLaborButton({ memberId, pending }: { memberId?: string; pending: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const result = await backfillLaborCostsAction(memberId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.count === 0
          ? "Ninguna sesión pudo valorizarse: falta una tarifa vigente en esas fechas."
          : `${result.count} sesión${result.count === 1 ? "" : "es"} valorizada${result.count === 1 ? "" : "s"}.`
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={run}>
      {isPending ? "Valorizando..." : `Asignar costo a ${pending} sesión${pending === 1 ? "" : "es"} sin valoración`}
    </Button>
  );
}

export function LaborRateHistory({ rates, currency }: { rates: LaborRateItem[]; currency: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function remove(rateId: string) {
    startTransition(async () => {
      const result = await deleteLaborRateAction(rateId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarifa eliminada");
      router.refresh();
    });
  }

  if (rates.length === 0) return <p className="text-sm text-muted-foreground">Sin tarifas configuradas.</p>;

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="ghost" className="w-fit px-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Ocultar historial" : `Ver historial (${rates.length})`}
      </Button>
      {open && (
        <div className="flex flex-col divide-y rounded-md border">
          {rates.map((rate) => (
            <div key={rate.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">{formatMoney(rate.hourlyCost, currency)} / hora</p>
                <p className="text-muted-foreground">
                  Desde {formatDateOnly(rate.validFrom)} {rate.validTo ? `hasta ${formatDateOnly(rate.validTo)}` : "(vigente)"}
                </p>
                {rate.notes && <p className="text-muted-foreground">{rate.notes}</p>}
              </div>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => remove(rate.id)}>
                Eliminar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
