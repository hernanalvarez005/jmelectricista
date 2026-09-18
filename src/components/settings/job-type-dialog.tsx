"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createJobTypeAction, updateJobTypeAction } from "@/app/app/configuracion/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { jobTypeSchema, type JobTypeInput } from "@/lib/validations/settings";
import type { Tables } from "@/lib/supabase/database.types";

export function JobTypeDialog({
  jobType,
  trigger,
}: {
  jobType?: Tables<"job_types">;
  trigger: React.ReactNode;
}) {
  const isEdit = !!jobType;
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
  } = useForm<JobTypeInput>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: {
      name: jobType?.name ?? "",
      description: jobType?.description ?? "",
      defaultEstimatedMinutes: jobType?.default_estimated_minutes?.toString() ?? "",
      active: jobType?.active ?? true,
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset();
      setServerError(null);
    }
  }

  function onSubmit(values: JobTypeInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateJobTypeAction(jobType.id, values)
        : await createJobTypeAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(isEdit ? "Tipo actualizado" : "Tipo creado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tipo de trabajo" : "Nuevo tipo de trabajo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultEstimatedMinutes">Duración sugerida (minutos)</Label>
            <Input
              id="defaultEstimatedMinutes"
              type="number"
              min={0}
              {...register("defaultEstimatedMinutes")}
            />
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
