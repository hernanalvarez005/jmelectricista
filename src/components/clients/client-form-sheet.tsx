"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createClientAction, updateClientAction } from "@/app/app/clientes/actions";
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
import { clientSchema, type ClientInput } from "@/lib/validations/client";
import type { Tables } from "@/lib/supabase/database.types";

export function ClientFormSheet({
  client,
  trigger,
}: {
  client?: Tables<"clients">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!client;
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
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      taxId: client?.tax_id ?? "",
      notes: client?.notes ?? "",
      active: client?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({
        name: client?.name ?? "",
        phone: client?.phone ?? "",
        email: client?.email ?? "",
        taxId: client?.tax_id ?? "",
        notes: client?.notes ?? "",
        active: client?.active ?? true,
      });
      setServerError(null);
    }
  }

  function onSubmit(values: ClientInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateClientAction(client.id, values)
        : await createClientAction(values);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      setOpen(false);
      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/app/clientes/${result.id}`);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualizá los datos del cliente." : "El teléfono suele ser el dato principal de contacto."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
            <Label htmlFor="taxId">CUIT / DNI</Label>
            <Input id="taxId" {...register("taxId")} />
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
              Cliente activo
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
