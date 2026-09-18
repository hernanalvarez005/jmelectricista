"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createPurchaseAction } from "@/app/app/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PurchasableMaterial } from "@/lib/data/purchases";
import { formatMoney } from "@/lib/format/money";
import { parseDecimal } from "@/lib/format/quantity";
import { newPurchaseSchema, type NewPurchaseInput } from "@/lib/validations/purchase";

export type PurchaseFormPrefill = {
  supplierId?: string;
  sourceJobId?: string;
  sourceJobTitle?: string;
  items: { materialId: string; quantity: string }[];
};

function formatCostInput(value: number | null): string {
  return value === null ? "" : String(Math.round(value * 10000) / 10000).replace(".", ",");
}

export function PurchaseForm({
  suppliers,
  materials,
  todayKey,
  currency,
  prefill,
}: {
  suppliers: { id: string; name: string }[];
  materials: PurchasableMaterial[];
  todayKey: string;
  currency: string;
  prefill: PurchaseFormPrefill;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // Un id por formulario montado: si el envío se repite (doble click, retry) la creación es idempotente.
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const materialById = new Map(materials.map((m) => [m.id, m]));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<NewPurchaseInput>({
    resolver: zodResolver(newPurchaseSchema),
    defaultValues: {
      supplierId: prefill.supplierId ?? "",
      purchaseDate: todayKey,
      notes: "",
      sourceJobId: prefill.sourceJobId ?? "",
      items:
        prefill.items.length > 0
          ? prefill.items.map((i) => ({
              materialId: i.materialId,
              quantity: i.quantity,
              unitCost: formatCostInput(materialById.get(i.materialId)?.suggestedUnitCost ?? null),
              notes: "",
            }))
          : [{ materialId: "", quantity: "", unitCost: "", notes: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const total = (items ?? []).reduce((sum, item) => {
    const q = parseDecimal(item?.quantity);
    const c = parseDecimal(item?.unitCost);
    return q !== null && c !== null ? sum + q * c : sum;
  }, 0);

  function onSubmit(values: NewPurchaseInput) {
    if (isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = await createPurchaseAction(values, clientRequestId);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      toast.success("Compra creada como borrador");
      router.push(`/app/compras/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {prefill.sourceJobTitle && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          Creada desde el faltante del trabajo <span className="font-medium">{prefill.sourceJobTitle}</span>. Las cantidades son el
          faltante actual; ajustalas si querés. La compra no reserva stock para ese trabajo.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Proveedor</Label>
          <Controller
            name="supplierId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" aria-label="Proveedor">
                  <SelectValue placeholder="Elegí un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="purchaseDate">Fecha de compra</Label>
          <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={2} {...register("notes")} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Materiales</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ materialId: "", quantity: "", unitCost: "", notes: "" })}>
            <Plus /> Agregar material
          </Button>
        </div>
        {typeof errors.items?.message === "string" && <p className="text-sm text-destructive">{errors.items.message}</p>}

        {fields.map((field, index) => {
          const material = materialById.get(items?.[index]?.materialId ?? "");
          const q = parseDecimal(items?.[index]?.quantity);
          const c = parseDecimal(items?.[index]?.unitCost);
          const rowErrors = errors.items?.[index];
          return (
            <div key={field.id} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Controller
                  name={`items.${index}.materialId`}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={f.value}
                      onValueChange={(value) => {
                        f.onChange(value);
                        if (!getValues(`items.${index}.unitCost`)) {
                          setValue(`items.${index}.unitCost`, formatCostInput(materialById.get(value)?.suggestedUnitCost ?? null));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label={`Material ${index + 1}`}>
                        <SelectValue placeholder="Elegí un material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.unitSymbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {rowErrors?.materialId && <p className="text-sm text-destructive">{rowErrors.materialId.message}</p>}
                {material?.needsInitialization && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Tiene stock sin costo: inicializá su valoración antes de recibir esta compra.
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Cantidad{material ? ` (${material.unitSymbol})` : ""}</Label>
                <Input inputMode="decimal" aria-label={`Cantidad ${index + 1}`} {...register(`items.${index}.quantity`)} />
                {rowErrors?.quantity && <p className="text-sm text-destructive">{rowErrors.quantity.message}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Costo unitario</Label>
                <Input inputMode="decimal" aria-label={`Costo unitario ${index + 1}`} {...register(`items.${index}.unitCost`)} />
                {rowErrors?.unitCost && <p className="text-sm text-destructive">{rowErrors.unitCost.message}</p>}
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-sm font-medium sm:hidden">Subtotal</span>
                <span className="text-sm font-medium">{q !== null && c !== null ? formatMoney(q * c, currency) : "-"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar material ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
        <span className="font-medium">Total</span>
        <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/app/compras")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar borrador"}
        </Button>
      </div>
    </form>
  );
}
