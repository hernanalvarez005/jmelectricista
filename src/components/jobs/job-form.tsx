"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createJobAction, updateJobAction } from "@/app/app/trabajos/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { minutesToHoursAndMinutes } from "@/lib/format/duration";
import type { JobFormOptions } from "@/lib/data/job-form-options";
import { jobPriorities, jobPriorityLabels, jobSchema, type JobInput } from "@/lib/validations/job";
import type { Tables } from "@/lib/supabase/database.types";

const NONE = "__none__";

export function JobForm({
  options,
  job,
  defaultClientId,
}: {
  options: JobFormOptions;
  job?: Tables<"jobs">;
  defaultClientId?: string;
}) {
  const isEdit = !!job;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const initialEstimated = minutesToHoursAndMinutes(job?.estimated_minutes ?? 0);
  const defaultStatusId = job?.status_id ?? options.statuses[0]?.id ?? "";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      clientId: job?.client_id ?? defaultClientId ?? "",
      clientAddressId: job?.client_address_id ?? "",
      title: job?.title ?? "",
      jobTypeId: job?.job_type_id ?? "",
      statusId: defaultStatusId,
      priority: (job?.priority as JobInput["priority"]) ?? "normal",
      description: job?.description ?? "",
      estimatedHours: initialEstimated.hours,
      estimatedMinutesPart: initialEstimated.minutes,
      targetDate: job?.target_date ?? "",
      assignedMemberId: job?.assigned_member_id ?? "",
      notes: job?.notes ?? "",
    },
  });

  const selectedClientId = useWatch({ control, name: "clientId" });
  const addressesForClient = useMemo(
    () => options.addressesByClient[selectedClientId] ?? [],
    [options.addressesByClient, selectedClientId]
  );

  function onJobTypeChange(jobTypeId: string) {
    setValue("jobTypeId", jobTypeId === NONE ? "" : jobTypeId);
    const type = options.jobTypes.find((t) => t.id === jobTypeId);
    if (type?.defaultEstimatedMinutes != null) {
      const { hours, minutes } = minutesToHoursAndMinutes(type.defaultEstimatedMinutes);
      setValue("estimatedHours", hours);
      setValue("estimatedMinutesPart", minutes);
    }
  }

  function onSubmit(values: JobInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateJobAction(job.id, values)
        : await createJobAction(values);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      toast.success(isEdit ? "Trabajo actualizado" : "Trabajo creado");
      router.push(`/app/trabajos/${result.id}`);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{isEdit ? "Editar trabajo" : "Nuevo trabajo"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Controller
                name="clientId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue("clientAddressId", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.clientId && (
                <p className="text-sm text-destructive">{errors.clientId.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Dirección</Label>
              <Controller
                name="clientAddressId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                    disabled={addressesForClient.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin dirección" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin dirección</SelectItem>
                      {addressesForClient.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label || a.street || "Dirección"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de trabajo</Label>
              <Controller
                name="jobTypeId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={onJobTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin tipo</SelectItem>
                      {options.jobTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Controller
                name="statusId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Prioridad</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jobPriorities.map((p) => (
                        <SelectItem key={p} value={p}>
                          {jobPriorityLabels[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label>Responsable</Label>
              <Controller
                name="assignedMemberId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin asignar</SelectItem>
                      {options.members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Duración estimada</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-24"
                {...register("estimatedHours", { valueAsNumber: true })}
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min={0}
                max={59}
                className="w-24"
                {...register("estimatedMinutesPart", { valueAsNumber: true })}
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            {(errors.estimatedHours || errors.estimatedMinutesPart) && (
              <p className="text-sm text-destructive">Ingresá una duración válida.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="targetDate">Fecha objetivo</Label>
            <Input id="targetDate" type="date" {...register("targetDate")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
