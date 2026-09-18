"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createMaterialAction, updateMaterialAction } from "@/app/app/materiales/actions";
import { MaterialCategoryDialog } from "@/components/materials/material-category-dialog";
import { MaterialUnitDialog } from "@/components/materials/material-unit-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { materialSchema, type MaterialInput } from "@/lib/validations/material";
import type { Tables } from "@/lib/supabase/database.types";

const NONE = "__none__";

export function MaterialFormSheet({
  open,
  onOpenChange,
  material,
  categories,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: Tables<"materials">;
  categories: Tables<"material_categories">[];
  units: Tables<"material_units">[];
}) {
  const isEdit = !!material;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<MaterialInput>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: material?.name ?? "",
      categoryId: material?.category_id ?? "",
      unitId: material?.unit_id ?? "",
      sku: material?.sku ?? "",
      description: material?.description ?? "",
      minimumStock: material?.minimum_stock != null ? String(material.minimum_stock) : "0",
      active: material?.active ?? true,
    },
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      reset({
        name: material?.name ?? "",
        categoryId: material?.category_id ?? "",
        unitId: material?.unit_id ?? "",
        sku: material?.sku ?? "",
        description: material?.description ?? "",
        minimumStock: material?.minimum_stock != null ? String(material.minimum_stock) : "0",
        active: material?.active ?? true,
      });
      setServerError(null);
    }
  }

  function onSubmit(values: MaterialInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateMaterialAction(material.id, values)
        : await createMaterialAction(values);

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      onOpenChange(false);
      toast.success(isEdit ? "Material actualizado" : "Material creado");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar material" : "Nuevo material"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Categoría</Label>
              <MaterialCategoryDialog
                trigger={
                  <button type="button" className="text-xs text-muted-foreground underline">
                    + nueva
                  </button>
                }
              />
            </div>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Unidad</Label>
              <MaterialUnitDialog
                trigger={
                  <button type="button" className="text-xs text-muted-foreground underline">
                    + nueva
                  </button>
                }
              />
            </div>
            <Controller
              name="unitId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.unitId && <p className="text-sm text-destructive">{errors.unitId.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" {...register("sku")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="minimumStock">Stock mínimo</Label>
            <Input id="minimumStock" inputMode="decimal" {...register("minimumStock")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} {...register("description")} />
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
