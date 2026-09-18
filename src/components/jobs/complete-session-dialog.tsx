"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateJobSessionStatusAction, updateSessionActualTimeAction } from "@/app/app/trabajos/actions";
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
import { zonedParts } from "@/lib/scheduling/timezone";
import { actualTimeSchema, type ActualTimeInput } from "@/lib/validations/session";

type Mode = "complete" | "edit";

export function CompleteSessionDialog({
  jobId,
  sessionId,
  plannedStartAt,
  plannedEndAt,
  actualStartAt,
  actualEndAt,
  timezone,
  mode,
  trigger,
}: {
  jobId: string;
  sessionId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  timezone: string;
  mode: Mode;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  // Fecha/hora en la zona horaria de la organización (mismo criterio con el
  // que el servidor guarda: zonedDateTimeToIso), no la del navegador.
  const toLocalParts = (iso: string) => zonedParts(iso, timezone);

  const initialActual = actualStartAt && actualEndAt
    ? { date: toLocalParts(actualStartAt).date, startTime: toLocalParts(actualStartAt).time, endTime: toLocalParts(actualEndAt).time }
    : { date: "", startTime: "", endTime: "" };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ActualTimeInput>({
    resolver: zodResolver(actualTimeSchema),
    defaultValues: initialActual,
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(initialActual);
      setServerError(null);
    }
  }

  function usePlannedSchedule() {
    const startParts = toLocalParts(plannedStartAt);
    const endParts = toLocalParts(plannedEndAt);
    setValue("date", startParts.date, { shouldValidate: true });
    setValue("startTime", startParts.time, { shouldValidate: true });
    setValue("endTime", endParts.time, { shouldValidate: true });
  }

  function onSubmit(values: ActualTimeInput) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "complete"
          ? await updateJobSessionStatusAction(jobId, sessionId, "completed", values)
          : await updateSessionActualTimeAction(jobId, sessionId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(mode === "complete" ? "Sesión completada" : "Tiempo real actualizado");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "complete" ? "Completar sesión" : "Editar tiempo real"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Registrá el horario real trabajado. Puede ser distinto del horario planificado.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={usePlannedSchedule} className="w-fit">
            Usar horario planificado
          </Button>
          <div className="grid gap-2">
            <Label htmlFor="actual-date">Fecha</Label>
            <Input id="actual-date" type="date" {...register("date")} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="actual-start">Hora real de inicio</Label>
              <Input id="actual-start" type="time" {...register("startTime")} />
              {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actual-end">Hora real de fin</Label>
              <Input id="actual-end" type="time" {...register("endTime")} />
              {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : mode === "complete" ? "Completar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
