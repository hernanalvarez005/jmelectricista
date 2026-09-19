import { z } from "zod";

export type BillingStatus = "pending" | "invoiced";

/** "Facturado" = marca operativa interna (comprobante emitido). No implica validación ARCA ni CAE. */
export const billingStatusLabels: Record<BillingStatus, string> = {
  pending: "Pendiente de facturar",
  invoiced: "Facturado",
};

/** Versión corta para tablas compactas. */
export const billingStatusShortLabels: Record<BillingStatus, string> = {
  pending: "Pendiente",
  invoiced: "Realizada",
};

export const billingFilters = ["all", "pending", "invoiced"] as const;
export type BillingFilter = (typeof billingFilters)[number];

export function parseBillingFilter(value: string | undefined): BillingFilter {
  return value === "pending" || value === "invoiced" ? value : "all";
}

export const markInvoicedSchema = z.object({
  invoicedAt: z.string().min(1, "Elegí la fecha de facturación"),
  invoiceNumber: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type MarkInvoicedInput = z.infer<typeof markInvoicedSchema>;

export function friendlyBillingError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes("not authorized")) return "Solo un administrador puede modificar la facturación.";
  if (message.includes("fecha de facturación")) return "La fecha de facturación es obligatoria.";
  if (message.includes("no está marcado como facturado")) return "El trabajo no está marcado como facturado.";
  return fallback;
}
