import { z } from "zod";

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre"),
  active: z.boolean(),
});
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

export const jobExpenseSchema = z.object({
  categoryId: z.string().uuid("Seleccioná una categoría"),
  expenseDate: z.string().min(1, "Elegí una fecha"),
  description: z.string().trim().min(1, "Ingresá una descripción").max(300),
  amount: z.string().min(1, "Ingresá un importe"),
});
export type JobExpenseInput = z.infer<typeof jobExpenseSchema>;

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(1, "Ingresá un motivo"),
});
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;

export const EXPENSE_RECEIPT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
export const EXPENSE_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

export function friendlyExpenseError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes("not authorized")) return "No tenés permiso para esta acción.";
  if (message.includes("amount debe ser mayor a 0")) return "El importe debe ser mayor a 0.";
  if (message.includes("ya fue anulado")) return "Este gasto ya fue anulado.";
  if (message.includes("motivo")) return "Ingresá el motivo de la anulación.";
  if (message.includes("no pertenece")) return "La categoría o el trabajo no son válidos.";
  return fallback;
}
