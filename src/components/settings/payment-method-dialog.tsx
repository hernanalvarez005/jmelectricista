"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPaymentMethodAction, updatePaymentMethodAction } from "@/app/app/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { paymentMethodSchema, type PaymentMethodInput } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

export function PaymentMethodDialog({
  paymentMethod,
  trigger,
}: {
  paymentMethod?: Tables<"payment_methods">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!paymentMethod;
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
  } = useForm<PaymentMethodInput>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: paymentMethod?.name ?? "",
      requiresAccount: paymentMethod?.requires_account ?? false,
      active: paymentMethod?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: PaymentMethodInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updatePaymentMethodAction(paymentMethod.id, values)
        : await createPaymentMethodAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(isEdit ? "Medio de pago actualizado" : "Medio de pago creado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar medio de pago" : "Nuevo medio de pago"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="requiresAccount"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="requiresAccount"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="requiresAccount" className="font-normal">
              Requiere cuenta al registrar un cobro
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="active" className="font-normal">
              Activo
            </Label>
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
