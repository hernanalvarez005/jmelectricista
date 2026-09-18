/** Parses a decimal quantity typed by the user (accepts "," as separator). */
export function parseDecimal(value: string | undefined | null): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatQuantity(quantity: number, unitSymbol?: string): string {
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(quantity);
  return unitSymbol ? `${formatted} ${unitSymbol}` : formatted;
}
