import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del cliente").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(160)
    .optional()
    .or(z.literal("")),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean(),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const clientAddressSchema = z.object({
  label: z.string().trim().max(80).optional().or(z.literal("")),
  street: z.string().trim().max(200).optional().or(z.literal("")),
  locality: z.string().trim().max(120).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  isDefault: z.boolean(),
});

export type ClientAddressInput = z.infer<typeof clientAddressSchema>;
