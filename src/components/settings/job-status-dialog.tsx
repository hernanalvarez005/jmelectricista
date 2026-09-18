"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createJobStatusAction,
  updateJobStatusDefinitionAction,
} from "@/app/app/configuracion/actions";
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
import { jobStatusSchema, type JobStatusInput } from "@/lib/validations/settings";
import type { Tables } from "@/lib/supabase/database.types";

export function JobStatusDialog({
  jobStatus,
  trigger,
}: {
  jobStatus?: Tables<"job_statuses">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!jobStatus;
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
  } = useForm<JobStatusInput>({
    resolver: zodResolver(jobStatusSchema),
    defaultValues: {
      name: jobStatus?.name ?? "",
      isClosed: jobStatus?.is_closed ?? false,
      active: jobStatus?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: JobStatusInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateJobStatusDefinitionAction(jobStatus.id, values)
        : await createJobStatusAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(isEdit ? "Estado actualizado" : "Estado creado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar estado" : "Nuevo estado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="isClosed"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="isClosed"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="isClosed" className="font-normal">
              Es un estado de cierre (trabajo finalizado)
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
