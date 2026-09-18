import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del proveedor").max(160),
  contactName: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierPriceSchema = z.object({
  supplierId: z.string().uuid("Seleccioná un proveedor"),
  price: z.string().min(1, "Ingresá un precio"),
  recordedAt: z.string().min(1, "Ingresá una fecha"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type SupplierPriceInput = z.infer<typeof supplierPriceSchema>;
