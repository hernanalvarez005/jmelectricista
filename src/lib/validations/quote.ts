import { z } from "zod";

export const quoteItemTypes = ["material", "labor", "service", "other"] as const;

export const quoteItemLabels: Record<(typeof quoteItemTypes)[number], string> = {
  material: "Material",
  labor: "Mano de obra",
  service: "Servicio",
  other: "Otro",
};

export const quoteItemSchema = z.object({
  itemType: z.enum(quoteItemTypes),
  materialId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Ingresá una descripción").max(300),
  quantity: z.string().min(1, "Ingresá una cantidad"),
  unit: z.string().trim().min(1, "Ingresá una unidad").max(30),
  costUnitPrice: z.string().optional().or(z.literal("")),
  saleUnitPrice: z.string().min(1, "Ingresá un precio"),
});
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;

export const quoteDetailsSchema = z.object({
  validUntil: z.string().optional().or(z.literal("")),
  discountAmount: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  terms: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type QuoteDetailsInput = z.infer<typeof quoteDetailsSchema>;

export const quoteStatusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};
