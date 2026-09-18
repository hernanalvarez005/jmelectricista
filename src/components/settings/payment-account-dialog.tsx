"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPaymentAccountAction, updatePaymentAccountAction } from "@/app/app/configuracion/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { accountTypeLabels, accountTypes, paymentAccountSchema, type PaymentAccountInput } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

export function PaymentAccountDialog({
  paymentAccount,
  trigger,
}: {
  paymentAccount?: Tables<"payment_accounts">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!paymentAccount;
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
  } = useForm<PaymentAccountInput>({
    resolver: zodResolver(paymentAccountSchema),
    defaultValues: {
      name: paymentAccount?.name ?? "",
      accountType: (paymentAccount?.account_type as PaymentAccountInput["accountType"]) ?? "cash",
      bankName: paymentAccount?.bank_name ?? "",
      alias: paymentAccount?.alias ?? "",
      notes: paymentAccount?.notes ?? "",
      active: paymentAccount?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: PaymentAccountInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updatePaymentAccountAction(paymentAccount.id, values)
        : await createPaymentAccountAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(isEdit ? "Cuenta actualizada" : "Cuenta creada");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" placeholder="Ej: Banco Galicia" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Controller
              name="accountType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {accountTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bankName">Banco (opcional)</Label>
            <Input id="bankName" {...register("bankName")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="alias">Alias / CBU (opcional)</Label>
            <Input id="alias" {...register("alias")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
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
              Activa
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
