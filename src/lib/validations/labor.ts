import { z } from "zod";

export const laborRateSchema = z.object({
  memberId: z.string().uuid("Seleccioná un miembro"),
  hourlyCost: z.string().min(1, "Ingresá el costo por hora"),
  validFrom: z.string().min(1, "Elegí la fecha de vigencia"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type LaborRateInput = z.infer<typeof laborRateSchema>;

/** Traduce los errores de los RPC/triggers de mano de obra a mensajes de usuario. */
export function friendlyLaborError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes("tarifa_superpuesta")) {
    if (message.includes("ya cerrada")) return "Esa fecha cae dentro de una tarifa ya cerrada. Elegí una fecha posterior o revisá el historial.";
    if (message.includes("empieza en esa fecha")) return "Ya existe una tarifa que empieza en esa fecha.";
    return "La vigencia se superpone con otra tarifa de esta persona.";
  }
  if (message.includes("tarifa_en_uso")) return "Esta tarifa ya se usó para valorizar sesiones y no se puede eliminar.";
  if (message.includes("responsable_bloqueado")) {
    return "La sesión ya tiene tiempo real o costo: el cambio de responsable lo hace un administrador desde la pestaña Costos.";
  }
  if (message.includes("not authorized")) return "No tenés permiso para esta acción.";
  if (message.includes("costo hora")) return "El costo por hora debe ser mayor o igual a 0.";
  return fallback;
}
