"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { addQuoteItemAction } from "@/app/app/cotizaciones/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quoteItemLabels, quoteItemSchema, quoteItemTypes, type QuoteItemInput } from "@/lib/validations/quote";

export type MaterialOption = {
  id: string;
  name: string;
  unitSymbol: string;
  lastPrice: number | null;
};

export function AddQuoteItemDialog({
  quoteId,
  jobId,
  materials,
  trigger,
}: {
  quoteId: string;
  jobId: string;
  materials: MaterialOption[];
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
    setValue,
    reset,
    formState: { errors },
  } = useForm<QuoteItemInput>({
    resolver: zodResolver(quoteItemSchema),
    defaultValues: {
      itemType: "material",
      materialId: "",
      description: "",
      quantity: "",
      unit: "",
      costUnitPrice: "",
      saleUnitPrice: "",
    },
  });

  const itemType = useWatch({ control, name: "itemType" });

  function onMaterialChange(materialId: string) {
    setValue("materialId", materialId);
    const material = materials.find((m) => m.id === materialId);
    if (material) {
      setValue("description", material.name);
      setValue("unit", material.unitSymbol);
      if (material.lastPrice != null) {
        setValue("costUnitPrice", String(material.lastPrice));
      }
    }
  }

  function onSubmit(values: QuoteItemInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await addQuoteItemAction(quoteId, jobId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Ítem agregado");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset();
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar ítem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Controller
              name="itemType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quoteItemTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {quoteItemLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {itemType === "material" && (
            <div className="grid gap-2">
              <Label>Material</Label>
              <Select onValueChange={onMaterialChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" {...register("description")} />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input id="quantity" inputMode="decimal" {...register("quantity")} />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Unidad</Label>
              <Input id="unit" {...register("unit")} />
              {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="costUnitPrice">Costo interno (opcional)</Label>
              <Input id="costUnitPrice" inputMode="decimal" {...register("costUnitPrice")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="saleUnitPrice">Precio al cliente</Label>
              <Input id="saleUnitPrice" inputMode="decimal" {...register("saleUnitPrice")} />
              {errors.saleUnitPrice && (
                <p className="text-sm text-destructive">{errors.saleUnitPrice.message}</p>
              )}
            </div>
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
