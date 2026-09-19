import { formatQuantity } from "@/lib/format/quantity";

/** Deep link universal de WhatsApp (abre la app en el celular y WhatsApp Web en desktop). Sin API. */
export function buildWhatsAppUrl(digits: string, message?: string): string {
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** "Juan Pérez" -> "Juan". El usuario revisa y edita el mensaje en WhatsApp antes de enviarlo. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function greeting(clientName: string): string {
  const name = firstName(clientName);
  return name ? `Hola ${name}, ¿cómo estás?` : "Hola, ¿cómo estás?";
}

/** $300.000 (sin decimales cuando el importe es entero). */
export function formatMoneyForMessage(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/[\s ]/g, "");
}

export function buildClientWhatsAppMessage({ clientName }: { clientName: string }): string {
  return greeting(clientName);
}

export function buildJobWhatsAppMessage({ clientName, jobTitle }: { clientName: string; jobTitle: string }): string {
  return [greeting(clientName), "", `Te escribo por el trabajo "${jobTitle}".`].join("\n");
}

export function buildQuoteWhatsAppMessage({
  clientName,
  quoteNumber,
  jobTitle,
  url,
}: {
  clientName: string;
  quoteNumber: string;
  jobTitle: string;
  url: string;
}): string {
  return [
    greeting(clientName),
    "",
    `Te envío la cotización ${quoteNumber} correspondiente a "${jobTitle}".`,
    "",
    "Podés verla acá:",
    url,
    "",
    "Cualquier duda escribime.",
  ].join("\n");
}

/** Confirmación de pago: solo cliente, importe y trabajo (nunca cuenta interna, referencia, costos ni márgenes). */
export function buildPaymentWhatsAppMessage({
  clientName,
  amount,
  currency,
  jobTitle,
}: {
  clientName: string;
  amount: number;
  currency: string;
  jobTitle: string;
}): string {
  return [
    greeting(clientName),
    "",
    `Registramos el pago de ${formatMoneyForMessage(amount, currency)} correspondiente al trabajo "${jobTitle}".`,
    "",
    "Muchas gracias.",
  ].join("\n");
}

export function buildPriceRequestMessage(items: { name: string; quantity: number; unitSymbol: string }[]): string {
  const lines = items.map((i) => `- ${formatQuantity(i.quantity, i.unitSymbol)} de ${i.name}`);
  return ["Hola, ¿cómo estás?", "", "¿Me cotizás por favor los siguientes materiales?", "", ...lines, "", "Gracias."].join("\n");
}
