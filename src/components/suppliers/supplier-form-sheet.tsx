"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createSupplierAction, updateSupplierAction } from "@/app/app/proveedores/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supplierSchema, type SupplierInput } from "@/lib/validations/supplier";
import type { Tables } from "@/lib/supabase/database.types";

export function SupplierFormSheet({
  supplier,
  trigger,
}: {
  supplier?: Tables<"suppliers">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!supplier;
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
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contactName: supplier?.contact_name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      notes: supplier?.notes ?? "",
      active: supplier?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: SupplierInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateSupplierAction(supplier.id, values)
        : await createSupplierAction(values);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
      toast.success(isEdit ? "Proveedor actualizado" : "Proveedor creado");
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/app/proveedores/${result.id}`);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</SheetTitle>
          <SheetDescription>Datos de contacto para pedir precios rápido.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contactName">Contacto</Label>
            <Input id="contactName" {...register("contactName")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Teléfono / WhatsApp</Label>
            <Input id="phone" placeholder="+54 9 11 1234-5678" {...register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
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
              Proveedor activo
            </Label>
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
