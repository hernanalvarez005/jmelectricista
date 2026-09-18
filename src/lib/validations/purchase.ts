import { z } from "zod";

export type PurchaseStatus = "draft" | "received" | "cancelled";

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: "Borrador",
  received: "Recibida",
  cancelled: "Cancelada",
};

export const purchaseItemSchema = z.object({
  materialId: z.string().uuid("Seleccioná un material"),
  quantity: z.string().min(1, "Ingresá una cantidad"),
  unitCost: z.string().min(1, "Ingresá el costo unitario"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;

export const purchaseHeaderSchema = z.object({
  supplierId: z.string().uuid("Seleccioná un proveedor"),
  purchaseDate: z.string().min(1, "Elegí una fecha"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type PurchaseHeaderInput = z.infer<typeof purchaseHeaderSchema>;

export const newPurchaseSchema = purchaseHeaderSchema.extend({
  sourceJobId: z.string().uuid().optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "Agregá al menos un material"),
});
export type NewPurchaseInput = z.infer<typeof newPurchaseSchema>;

export const initializeValuationSchema = z.object({
  unitCost: z.string().min(1, "Ingresá el costo unitario"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type InitializeValuationInput = z.infer<typeof initializeValuationSchema>;

export const PURCHASE_DOC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
export const PURCHASE_DOC_MAX_BYTES = 10 * 1024 * 1024;

/** Traduce los códigos que lanzan los triggers/RPC de valuación y compras a mensajes de usuario. */
export function friendlyInventoryError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes("stock_insuficiente")) {
    const m = message.match(/stock_insuficiente: (.*?) tiene ([\d.]+)/);
    return m ? `Stock insuficiente de ${m[1]}: hay ${Number(m[2])} disponible.` : "Stock insuficiente para esta operación.";
  }
  if (message.includes("valoracion_no_inicializada")) {
    return "Este material tiene stock sin costo. Inicializá su valoración (ficha del material) antes de ingresar stock valorizado.";
  }
  if (message.includes("costo_requerido")) return "Este material tiene valoración: ingresá el costo unitario del ingreso.";
  if (message.includes("costo_devolucion")) return "No se puede determinar el costo de la devolución.";
  if (message.includes("no tiene ítems")) return "La compra no tiene ítems.";
  if (message.includes("cancelada")) return "La compra está cancelada.";
  if (message.includes("recibida")) return "La compra ya fue recibida.";
  if (message.includes("not authorized")) return "No tenés permiso para esta acción.";
  if (message.includes("sin_stock")) return "El material no tiene stock: su costo se define con la primera compra.";
  if (message.includes("ya está inicializada")) return "La valoración de este material ya está inicializada.";
  return fallback;
}
