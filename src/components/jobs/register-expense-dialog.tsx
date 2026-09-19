"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { registerExpenseAction } from "@/app/app/trabajos/expenses-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayKeyInTZ } from "@/lib/scheduling/timezone";
import type { Tables } from "@/lib/supabase/database.types";
import { jobExpenseSchema, type JobExpenseInput } from "@/lib/validations/expense";

export function RegisterExpenseDialog({
  jobId,
  timezone,
  categories,
}: {
  jobId: string;
  timezone: string;
  categories: Tables<"job_expense_categories">[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // Un UUID por intento de carga: reenviar el formulario (doble click, retry) no duplica el gasto.
  const [clientRequestId, setClientRequestId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<JobExpenseInput>({
    resolver: zodResolver(jobExpenseSchema),
    defaultValues: { categoryId: "", expenseDate: todayKeyInTZ(timezone), description: "", amount: "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ categoryId: "", expenseDate: todayKeyInTZ(timezone), description: "", amount: "" });
      setServerError(null);
      setClientRequestId(crypto.randomUUID());
      setReceiptFile(null);
    }
  }

  function onSubmit(values: JobExpenseInput) {
    if (isPending) return;
    setServerError(null);
    const formData = new FormData();
    formData.set("categoryId", values.categoryId);
    formData.set("expenseDate", values.expenseDate);
    formData.set("description", values.description);
    formData.set("amount", values.amount);
    formData.set("clientRequestId", clientRequestId);
    if (receiptFile) formData.set("receipt", receiptFile);

    startTransition(async () => {
      const result = await registerExpenseAction(jobId, formData);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Gasto registrado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* El botón se crea acá, en el cliente: un trigger renderizado por un server component llega como elemento
          lazy y el Slot de Radix falla de forma intermitente al montarse dentro de una pestaña. */}
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Registrar gasto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar gasto directo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Categoría">
                    <SelectValue placeholder="Elegí una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="expenseDate">Fecha</Label>
              <Input id="expenseDate" type="date" className="min-w-0" {...register("expenseDate")} />
              {errors.expenseDate && <p className="text-sm text-destructive">{errors.expenseDate.message}</p>}
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="expenseAmount">Importe</Label>
              <Input id="expenseAmount" inputMode="decimal" className="min-w-0" {...register("amount")} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expenseDescription">Descripción</Label>
            <Input id="expenseDescription" placeholder="Ej: Alquiler de zanjadora" {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expenseReceipt">Comprobante (opcional)</Label>
            <input
              key={clientRequestId}
              id="expenseReceipt"
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
              {isPending ? "Guardando..." : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
