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

export const stockAdjustmentSchema = z.object({
  direction: z.enum(["in", "out"]),
  quantity: z.string().min(1, "Ingresá una cantidad"),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockInitialSchema = z.object({
  quantity: z.string().min(1, "Ingresá una cantidad"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type StockInitialInput = z.infer<typeof stockInitialSchema>;
