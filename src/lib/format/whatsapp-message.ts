import { formatQuantity } from "@/lib/format/quantity";

export function buildPriceRequestMessage(
  items: { name: string; quantity: number; unitSymbol: string }[]
): string {
  const lines = items.map((i) => `- ${formatQuantity(i.quantity, i.unitSymbol)} de ${i.name}`);
  return ["Hola, ¿cómo estás?", "", "¿Me cotizás por favor los siguientes materiales?", "", ...lines, "", "Gracias."].join(
    "\n"
  );
}
