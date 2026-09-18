import { z } from "zod";

export const paymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre"),
  requiresAccount: z.boolean(),
  active: z.boolean(),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export const accountTypes = ["cash", "bank", "wallet", "other"] as const;
export type AccountType = (typeof accountTypes)[number];

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Efectivo",
  bank: "Banco",
  wallet: "Billetera virtual",
  other: "Otro",
};

export const paymentAccountSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre"),
  accountType: z.enum(accountTypes),
  bankName: z.string().trim().max(200).optional().or(z.literal("")),
  alias: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  active: z.boolean(),
});
export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;

export const jobPaymentSchema = z.object({
  paymentDate: z.string().min(1, "Elegí una fecha"),
  amount: z.string().min(1, "Ingresá un importe"),
  paymentMethodId: z.string().uuid("Seleccioná un medio de pago"),
  paymentAccountId: z.string().uuid().optional().or(z.literal("")),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type JobPaymentInput = z.infer<typeof jobPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(1, "Ingresá un motivo"),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export type PaymentStatus = "no_contract" | "unpaid" | "partial" | "paid";

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  no_contract: "Sin cotización aceptada",
  unpaid: "Sin cobrar",
  partial: "Cobro parcial",
  paid: "Cobrado",
};

/** application/pdf + los formatos de imagen que suele generar la cámara del celular. */
export const RECEIPT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
