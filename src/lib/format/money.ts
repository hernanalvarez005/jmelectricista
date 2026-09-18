export function formatMoney(amount: number, currency: string = "ARS"): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount);
}

/** Costos unitarios pueden tener más de 2 decimales (ej. costo promedio $1.133,3333); se muestran hasta 4. */
export function formatUnitCost(amount: number, currency: string = "ARS"): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);
}
