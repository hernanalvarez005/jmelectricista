import { z } from "zod";

export const materialCategorySchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre").max(120),
  active: z.boolean(),
});
export type MaterialCategoryInput = z.infer<typeof materialCategorySchema>;

export const materialUnitSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre").max(60),
  symbol: z.string().trim().min(1, "Ingresá un símbolo").max(20),
  active: z.boolean(),
});
export type MaterialUnitInput = z.infer<typeof materialUnitSchema>;

export const materialSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre").max(200),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  unitId: z.string().uuid("Seleccioná una unidad"),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  minimumStock: z.string().optional().or(z.literal("")),
  active: z.boolean(),
});
export type MaterialInput = z.infer<typeof materialSchema>;

export const stockAdjustmentSchema = z
  .object({
    direction: z.enum(["in", "out"]),
    quantity: z.string().min(1, "Ingresá una cantidad"),
    // Un aumento de stock necesita costo: si no, el inventario quedaría sin valor.
    unitCost: z.string().optional(),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.direction === "out" || (v.unitCost ?? "").trim() !== "", {
    path: ["unitCost"],
    message: "Ingresá el costo unitario del ingreso",
  });
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockInitialSchema = z.object({
  quantity: z.string().min(1, "Ingresá una cantidad"),
  unitCost: z.string().min(1, "Ingresá el costo unitario"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type StockInitialInput = z.infer<typeof stockInitialSchema>;
