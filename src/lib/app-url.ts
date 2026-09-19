import { headers } from "next/headers";

/** Une la URL base de la app con el path público de una cotización (sin doble barra). */
export function buildPublicQuoteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/cotizacion/${token}`;
}

/**
 * URL base de la app para armar enlaces que salen del sistema (WhatsApp). Usa NEXT_PUBLIC_APP_URL;
 * si no está definida, la deduce del request (host + protocolo). Nunca hay un dominio hardcodeado.
 */
export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
