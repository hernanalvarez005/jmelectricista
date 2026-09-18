export function formatMoney(amount: number, currency: string = "ARS"): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount);
}
