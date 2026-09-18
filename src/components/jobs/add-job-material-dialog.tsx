"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { addJobMaterialAction } from "@/app/app/trabajos/materials-actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  materialId: z.string().uuid("Seleccioná un material"),
  estimatedQuantity: z.string().min(1, "Ingresá una cantidad"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function AddJobMaterialDialog({
  jobId,
  materials,
  trigger,
}: {
  jobId: string;
  materials: { id: string; name: string; unitSymbol: string }[];
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
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { materialId: "", estimatedQuantity: "", notes: "" },
  });

  const selectedMaterialId = useWatch({ control, name: "materialId" });
  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addJobMaterialAction(jobId, values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Material agregado");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset();
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar material</DialogTitle>
        </DialogHeader>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Primero creá materiales en la sección Materiales.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Material</Label>
              <Controller
                name="materialId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.materialId && (
                <p className="text-sm text-destructive">{errors.materialId.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimatedQuantity">
                Cantidad necesaria{selectedMaterial ? ` (${selectedMaterial.unitSymbol})` : ""}
              </Label>
              <Input id="estimatedQuantity" inputMode="decimal" {...register("estimatedQuantity")} />
              {errors.estimatedQuantity && (
                <p className="text-sm text-destructive">{errors.estimatedQuantity.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
