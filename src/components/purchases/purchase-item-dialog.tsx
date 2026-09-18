"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { addPurchaseItemAction, updatePurchaseItemAction } from "@/app/app/compras/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PurchasableMaterial } from "@/lib/data/purchases";
import { purchaseItemSchema, type PurchaseItemInput } from "@/lib/validations/purchase";

function num(value: number): string {
  return String(value).replace(".", ",");
}

export type EditableItem = { id: string; materialId: string; quantity: number; unitCost: number; notes: string | null };

export function PurchaseItemDialog({
  purchaseId,
  materials,
  usedMaterialIds,
  item,
  trigger,
}: {
  purchaseId: string;
  materials: PurchasableMaterial[];
  usedMaterialIds: string[];
  item?: EditableItem;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PurchaseItemInput>({
    resolver: zodResolver(purchaseItemSchema),
    defaultValues: { materialId: "", quantity: "", unitCost: "", notes: "" },
  });

  const available = materials.filter((m) => item?.materialId === m.id || !usedMaterialIds.includes(m.id));

  function onSubmit(values: PurchaseItemInput) {
    if (isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = item
        ? await updatePurchaseItemAction(purchaseId, item.id, values)
        : await addPurchaseItemAction(purchaseId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(item ? "Ítem actualizado" : "Ítem agregado");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(
            item
              ? { materialId: item.materialId, quantity: num(item.quantity), unitCost: num(item.unitCost), notes: item.notes ?? "" }
              : { materialId: "", quantity: "", unitCost: "", notes: "" }
          );
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar ítem" : "Agregar ítem"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Material</Label>
            <Controller
              name="materialId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={Boolean(item)}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (!getValues("unitCost")) {
                      const suggested = materials.find((m) => m.id === value)?.suggestedUnitCost;
                      if (suggested != null) setValue("unitCost", num(Math.round(suggested * 10000) / 10000));
                    }
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Material">
                    <SelectValue placeholder="Elegí un material" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.unitSymbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.materialId && <p className="text-sm text-destructive">{errors.materialId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="itemQuantity">Cantidad</Label>
              <Input id="itemQuantity" inputMode="decimal" {...register("quantity")} />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemUnitCost">Costo unitario</Label>
              <Input id="itemUnitCost" inputMode="decimal" {...register("unitCost")} />
              {errors.unitCost && <p className="text-sm text-destructive">{errors.unitCost.message}</p>}
            </div>
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
