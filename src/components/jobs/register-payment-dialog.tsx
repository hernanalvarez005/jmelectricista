"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { registerPaymentAction } from "@/app/app/trabajos/payments-actions";
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
import { todayKeyInTZ } from "@/lib/scheduling/timezone";
import { jobPaymentSchema, type JobPaymentInput } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

const NONE = "__none__";

export function RegisterPaymentDialog({
  jobId,
  timezone,
  paymentMethods,
  paymentAccounts,
  trigger,
  onRegistered,
}: {
  jobId: string;
  timezone: string;
  paymentMethods: Tables<"payment_methods">[];
  paymentAccounts: Tables<"payment_accounts">[];
  trigger: React.ReactNode;
  /** Se llama con el nuevo saldo pendiente tras registrar el cobro (antes del router.refresh()). */
  onRegistered?: (outstandingAmount: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<JobPaymentInput>({
    resolver: zodResolver(jobPaymentSchema),
    defaultValues: {
      paymentDate: todayKeyInTZ(timezone),
      amount: "",
      paymentMethodId: "",
      paymentAccountId: "",
      reference: "",
      notes: "",
    },
  });

  const paymentMethodId = useWatch({ control, name: "paymentMethodId" });
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({
        paymentDate: todayKeyInTZ(timezone),
        amount: "",
        paymentMethodId: "",
        paymentAccountId: "",
        reference: "",
        notes: "",
      });
      setServerError(null);
      setClientRequestId(crypto.randomUUID());
      setReceiptFile(null);
    }
  }

  function onSubmit(values: JobPaymentInput) {
    setServerError(null);
    if (selectedMethod?.requires_account && !values.paymentAccountId) {
      setServerError("Este medio de pago requiere una cuenta.");
      return;
    }

    const formData = new FormData();
    formData.set("paymentDate", values.paymentDate);
    formData.set("amount", values.amount);
    formData.set("paymentMethodId", values.paymentMethodId);
    formData.set("paymentAccountId", values.paymentAccountId || "");
    formData.set("reference", values.reference || "");
    formData.set("notes", values.notes || "");
    formData.set("clientRequestId", clientRequestId);
    if (receiptFile) formData.set("receipt", receiptFile);

    startTransition(async () => {
      const result = await registerPaymentAction(jobId, formData);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Cobro registrado");
      onRegistered?.(result.outstandingAmount);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="paymentDate">Fecha</Label>
              <Input id="paymentDate" type="date" className="min-w-0" {...register("paymentDate")} />
              {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate.message}</p>}
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="amount">Importe</Label>
              <Input id="amount" inputMode="decimal" className="min-w-0" {...register("amount")} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Medio de pago</Label>
            <Controller
              name="paymentMethodId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un medio de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.paymentMethodId && (
              <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>
              Cuenta{selectedMethod?.requires_account ? "" : " (opcional)"}
            </Label>
            <Controller
              name="paymentAccountId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin cuenta</SelectItem>
                    {paymentAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input id="reference" placeholder="Ej: Nº de operación" {...register("reference")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="receipt">Comprobante (opcional)</Label>
            <input
              key={clientRequestId}
              id="receipt"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Máximo 8 MB.</p>
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
