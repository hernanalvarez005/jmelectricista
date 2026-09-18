"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { adjustStockAction, initializeValuationAction, registerInitialStockAction } from "@/app/app/materiales/actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  stockAdjustmentSchema,
  stockInitialSchema,
  type StockAdjustmentInput,
  type StockInitialInput,
} from "@/lib/validations/material";
import { initializeValuationSchema, type InitializeValuationInput } from "@/lib/validations/purchase";

export function InitialStockDialog({ materialId, trigger }: { materialId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockInitialInput>({
    resolver: zodResolver(stockInitialSchema),
    defaultValues: { quantity: "", unitCost: "", notes: "" },
  });

  function onSubmit(values: StockInitialInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await registerInitialStockAction(materialId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Stock inicial registrado");
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
          <DialogTitle>Registrar stock inicial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input id="quantity" inputMode="decimal" {...register("quantity")} />
            {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unitCost">Costo unitario ($)</Label>
            <Input id="unitCost" inputMode="decimal" {...register("unitCost")} />
            {errors.unitCost && <p className="text-sm text-destructive">{errors.unitCost.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StockAdjustDialog({ materialId, trigger }: { materialId: string; trigger: React.ReactNode }) {
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
  } = useForm<StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { direction: "in", quantity: "", unitCost: "", reason: "" },
  });
  const direction = useWatch({ control, name: "direction" });

  function onSubmit(values: StockAdjustmentInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await adjustStockAction(materialId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Ajuste registrado");
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
          <DialogTitle>Ajustar stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tipo de ajuste</Label>
            <Controller
              name="direction"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Aumentar</SelectItem>
                    <SelectItem value="out">Disminuir</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input id="quantity" inputMode="decimal" {...register("quantity")} />
            {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
          </div>
          {direction === "in" && (
            <div className="grid gap-2">
              <Label htmlFor="unitCost">Costo unitario ($)</Label>
              <Input id="unitCost" inputMode="decimal" {...register("unitCost")} />
              {errors.unitCost && <p className="text-sm text-destructive">{errors.unitCost.message}</p>}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea id="reason" rows={2} {...register("reason")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InitializeValuationDialog({
  materialId,
  currentStock,
  unitSymbol,
  trigger,
}: {
  materialId: string;
  currentStock: string;
  unitSymbol: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InitializeValuationInput>({
    resolver: zodResolver(initializeValuationSchema),
    defaultValues: { unitCost: "", notes: "" },
  });

  function onSubmit(values: InitializeValuationInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await initializeValuationAction(materialId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Valoración inicializada");
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
          <DialogTitle>Inicializar valoración</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Este material tiene {currentStock} {unitSymbol} en stock sin costo asociado. Indicá el costo unitario con el que se
            valoriza ese stock existente. Queda registrado como valoración inicial y no se puede deshacer.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="initUnitCost">Costo unitario ($)</Label>
            <Input id="initUnitCost" inputMode="decimal" {...register("unitCost")} />
            {errors.unitCost && <p className="text-sm text-destructive">{errors.unitCost.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="initNotes">Notas</Label>
            <Textarea id="initNotes" rows={2} {...register("notes")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Inicializar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
