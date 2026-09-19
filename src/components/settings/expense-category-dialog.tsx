"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createExpenseCategoryAction, updateExpenseCategoryAction } from "@/app/app/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/lib/supabase/database.types";
import { expenseCategorySchema, type ExpenseCategoryInput } from "@/lib/validations/expense";

export function ExpenseCategoryDialog({
  category,
  trigger,
}: {
  category?: Tables<"job_expense_categories">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!category;
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
  } = useForm<ExpenseCategoryInput>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: { name: category?.name ?? "", active: category?.active ?? true },
  });

  function onSubmit(values: ExpenseCategoryInput) {
    if (isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = isEdit ? await updateExpenseCategoryAction(category.id, values) : await createExpenseCategoryAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(isEdit ? "Categoría actualizada" : "Categoría creada");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset({ name: category?.name ?? "", active: category?.active ?? true });
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría de gasto" : "Nueva categoría de gasto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="expenseCategoryName">Nombre</Label>
            <Input id="expenseCategoryName" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <Checkbox id="expenseCategoryActive" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            <Label htmlFor="expenseCategoryActive" className="font-normal">
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
