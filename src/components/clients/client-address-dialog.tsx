"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createClientAddressAction } from "@/app/app/clientes/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientAddressSchema, type ClientAddressInput } from "@/lib/validations/client";

export function ClientAddressDialog({
  clientId,
  trigger,
}: {
  clientId: string;
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
  } = useForm<ClientAddressInput>({
    resolver: zodResolver(clientAddressSchema),
    defaultValues: {
      label: "",
      street: "",
      locality: "",
      province: "",
      postalCode: "",
      notes: "",
      isDefault: false,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: ClientAddressInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createClientAddressAction(clientId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Dirección agregada");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva dirección</DialogTitle>
          <DialogDescription>Ej: Casa, Local, Obra, Depósito.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Etiqueta</Label>
            <Input id="label" placeholder="Casa" {...register("label")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="street">Calle y número</Label>
            <Input id="street" {...register("street")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="locality">Localidad</Label>
              <Input id="locality" {...register("locality")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="province">Provincia</Label>
              <Input id="province" {...register("province")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="postalCode">Código postal</Label>
            <Input id="postalCode" {...register("postalCode")} />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="isDefault"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="isDefault"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="isDefault" className="font-normal">
              Usar como dirección principal
            </Label>
          </div>
          {errors.street && <p className="text-sm text-destructive">{errors.street.message}</p>}
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar dirección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
