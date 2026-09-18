"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerConsumptionAction, removeJobMaterialAction } from "@/app/app/trabajos/materials-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQuantity } from "@/lib/format/quantity";
import type { JobMaterialItem } from "@/lib/data/job-materials";

export function JobMaterialsList({ jobId, materials }: { jobId: string; materials: JobMaterialItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [consumptionDrafts, setConsumptionDrafts] = useState<Record<string, string>>({});

  function saveConsumption(jobMaterialId: string) {
    const value = consumptionDrafts[jobMaterialId];
    if (!value) return;
    startTransition(async () => {
      const result = await registerConsumptionAction(jobMaterialId, jobId, { actualQuantity: value });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Consumo registrado");
      router.refresh();
    });
  }

  function remove(jobMaterialId: string) {
    startTransition(async () => {
      const result = await removeJobMaterialAction(jobMaterialId, jobId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (materials.length === 0) {
    return <p className="text-sm text-muted-foreground">Este trabajo todavía no tiene materiales asociados.</p>;
  }

  const withMissing = materials.filter((m) => m.missing > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {materials.length} material{materials.length === 1 ? "" : "es"} · {materials.length - withMissing}{" "}
        disponible{materials.length - withMissing === 1 ? "" : "s"} · {withMissing} con faltante
        {withMissing === 1 ? "" : "s"}
      </p>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {materials.map((m) => (
          <div key={m.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{m.materialName}</p>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => remove(m.id)}>
                Quitar
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Necesario</p>
                <p>{formatQuantity(m.estimatedQuantity, m.unitSymbol)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock</p>
                <p>{formatQuantity(m.availableStock, m.unitSymbol)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falta</p>
                <p className={m.missing > 0 ? "font-medium text-warning" : ""}>
                  {m.missing > 0 ? formatQuantity(m.missing, m.unitSymbol) : "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Input
                className="flex-1"
                inputMode="decimal"
                placeholder={m.actualQuantity != null ? String(m.actualQuantity) : "Consumo real"}
                value={consumptionDrafts[m.id] ?? ""}
                onChange={(e) => setConsumptionDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || !consumptionDrafts[m.id]}
                onClick={() => saveConsumption(m.id)}
              >
                Registrar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Necesario</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Falta</TableHead>
              <TableHead className="text-right">Consumo real</TableHead>
              <TableHead className="w-9" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.materialName}</TableCell>
                <TableCell className="text-right">{formatQuantity(m.estimatedQuantity, m.unitSymbol)}</TableCell>
                <TableCell className="text-right">{formatQuantity(m.availableStock, m.unitSymbol)}</TableCell>
                <TableCell className={`text-right ${m.missing > 0 ? "font-medium text-warning" : ""}`}>
                  {m.missing > 0 ? formatQuantity(m.missing, m.unitSymbol) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      placeholder={m.actualQuantity != null ? String(m.actualQuantity) : "0"}
                      value={consumptionDrafts[m.id] ?? ""}
                      onChange={(e) =>
                        setConsumptionDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || !consumptionDrafts[m.id]}
                      onClick={() => saveConsumption(m.id)}
                    >
                      Registrar
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => remove(m.id)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
