import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type WhatsAppPhone =
  | { status: "ok"; digits: string; e164: string }
  | { status: "missing" }
  | { status: "invalid" };

/**
 * Normaliza un teléfono tal como lo tipea una persona (espacios, guiones, paréntesis, +,
 * código de país, código de área, prefijos locales como el 0 y el 15) a formato internacional
 * para wa.me. `defaultCountry` viene de la organización (organizations.default_country_code):
 * no se asume ningún país acá.
 *
 * Argentina: WhatsApp usa +54 9 <área><número> para celulares. Si el número es válido y no
 * trae el 9, se agrega (WhatsApp solo opera sobre celulares; un fijo no tendría cuenta).
 *
 * Nunca devuelve un número dudoso: si no puede convertirlo con confianza -> "invalid".
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined, defaultCountry: string = "AR"): WhatsAppPhone {
  const value = (raw ?? "").trim();
  if (value === "") return { status: "missing" };

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(value, defaultCountry.toUpperCase() as CountryCode);
  } catch {
    return { status: "invalid" };
  }
  if (!parsed || !parsed.isValid()) return { status: "invalid" };

  let e164 = parsed.number;
  if (parsed.country === "AR") {
    const national = parsed.nationalNumber;
    if (national.length === 10 && !national.startsWith("9")) e164 = `+549${national}`;
  }

  return { status: "ok", digits: e164.replace(/^\+/, ""), e164 };
}

/** Solo los dígitos internacionales de un teléfono válido, o null (para listas donde un teléfono dudoso simplemente no muestra WhatsApp). */
export function whatsappDigits(raw: string | null | undefined, defaultCountry: string = "AR"): string | null {
  const result = normalizeWhatsAppPhone(raw, defaultCountry);
  return result.status === "ok" ? result.digits : null;
}
