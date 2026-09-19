"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { setLaborRateAction } from "@/app/app/configuracion/labor-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { laborRateSchema, type LaborRateInput } from "@/lib/validations/labor";

export function LaborRateDialog({
  memberId,
  memberName,
  todayKey,
  trigger,
}: {
  memberId: string;
  memberName: string;
  todayKey: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LaborRateInput>({
    resolver: zodResolver(laborRateSchema),
    defaultValues: { memberId, hourlyCost: "", validFrom: todayKey, notes: "" },
  });

  function onSubmit(values: LaborRateInput) {
    if (isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = await setLaborRateAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Tarifa guardada");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset({ memberId, hourlyCost: "", validFrom: todayKey, notes: "" });
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarifa — {memberName}</DialogTitle>
          <DialogDescription>
            Costo interno por hora imputable al análisis del trabajo (no es un sueldo). Una tarifa nueva cierra la anterior el día previo a su
            vigencia y nunca modifica sesiones ya valorizadas. Podés cargar $0 para no imputar costo laboral a esta persona.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="laborHourlyCost">Costo por hora ($)</Label>
              <Input id="laborHourlyCost" inputMode="decimal" className="min-w-0" {...register("hourlyCost")} />
              {errors.hourlyCost && <p className="text-sm text-destructive">{errors.hourlyCost.message}</p>}
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="laborValidFrom">Vigente desde</Label>
              <Input id="laborValidFrom" type="date" className="min-w-0" {...register("validFrom")} />
              {errors.validFrom && <p className="text-sm text-destructive">{errors.validFrom.message}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="laborNotes">Nota (opcional)</Label>
            <Textarea id="laborNotes" rows={2} {...register("notes")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar tarifa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
