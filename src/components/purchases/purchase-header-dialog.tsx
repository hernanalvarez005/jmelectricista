"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { updatePurchaseHeaderAction } from "@/app/app/compras/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { purchaseHeaderSchema, type PurchaseHeaderInput } from "@/lib/validations/purchase";

export function PurchaseHeaderDialog({
  purchaseId,
  suppliers,
  initial,
  trigger,
}: {
  purchaseId: string;
  suppliers: { id: string; name: string }[];
  initial: PurchaseHeaderInput;
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
    formState: { errors },
  } = useForm<PurchaseHeaderInput>({ resolver: zodResolver(purchaseHeaderSchema), defaultValues: initial });

  function onSubmit(values: PurchaseHeaderInput) {
    if (isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = await updatePurchaseHeaderAction(purchaseId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Compra actualizada");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(initial);
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar compra</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Proveedor">
                    <SelectValue />
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
            <Label htmlFor="headerDate">Fecha de compra</Label>
            <Input id="headerDate" type="date" {...register("purchaseDate")} />
            {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="headerNotes">Notas</Label>
            <Textarea id="headerNotes" rows={3} {...register("notes")} />
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
