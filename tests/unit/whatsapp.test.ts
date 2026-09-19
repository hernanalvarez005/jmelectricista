import { describe, expect, it } from "vitest";

import { buildPublicQuoteUrl } from "@/lib/app-url";
import { billingStatusLabels, billingStatusShortLabels, parseBillingFilter } from "@/lib/validations/billing";
import {
  buildClientWhatsAppMessage,
  buildJobWhatsAppMessage,
  buildPaymentWhatsAppMessage,
  buildQuoteWhatsAppMessage,
  buildWhatsAppUrl,
  firstName,
  formatMoneyForMessage,
} from "@/lib/whatsapp/messages";
import { normalizeWhatsAppPhone, whatsappDigits } from "@/lib/whatsapp/phone";

describe("normalizeWhatsAppPhone — Argentina (país por defecto AR)", () => {
  it.each([
    ["011 15-5123-4567", "5491151234567"],
    ["(011) 15 5123 4567", "5491151234567"],
    ["+54 9 11 5123-4567", "5491151234567"],
    ["+5491151234567", "5491151234567"],
    ["11 5123-4567", "5491151234567"], // celular sin 15: WhatsApp exige el 9
    ["+54 11 5123 4567", "5491151234567"],
    ["0351 15 456-7890", "5493514567890"], // Córdoba
    ["  011-15-5123-4567  ", "5491151234567"], // espacios alrededor
    ["011.15.5123.4567", "5491151234567"], // puntos
  ])("%s -> %s", (raw, digits) => {
    expect(normalizeWhatsAppPhone(raw, "AR")).toEqual({ status: "ok", digits, e164: `+${digits}` });
  });

  it("no agrega un segundo 9 a un número que ya lo trae", () => {
    const result = normalizeWhatsAppPhone("+54 9 351 456 7890", "AR");
    expect(result).toMatchObject({ status: "ok", digits: "5493514567890" });
  });
});

describe("normalizeWhatsAppPhone — internacionales y país de la organización", () => {
  it("números con código de país explícito ignoran el país por defecto", () => {
    expect(normalizeWhatsAppPhone("+34 612 34 56 78", "AR")).toMatchObject({ status: "ok", digits: "34612345678" });
    expect(normalizeWhatsAppPhone("+1 (415) 555-2671", "AR")).toMatchObject({ status: "ok", digits: "14155552671" });
    expect(normalizeWhatsAppPhone("+598 99 123 456", "AR")).toMatchObject({ status: "ok", digits: "59899123456" });
  });

  it("67 — el país de la organización manda para números locales: no se asume AR", () => {
    expect(normalizeWhatsAppPhone("612 34 56 78", "ES")).toMatchObject({ status: "ok", digits: "34612345678" });
    // el mismo texto con AR no es un número argentino válido
    expect(normalizeWhatsAppPhone("612 34 56 78", "AR").status).toBe("invalid");
    expect(normalizeWhatsAppPhone("099 123 456", "UY")).toMatchObject({ status: "ok", digits: "59899123456" });
    // el país en minúsculas se acepta
    expect(normalizeWhatsAppPhone("612 34 56 78", "es")).toMatchObject({ status: "ok", digits: "34612345678" });
  });
});

describe("normalizeWhatsAppPhone — vacío e inválido (nunca abre un número dudoso)", () => {
  it.each([[null], [undefined], [""], ["   "]])("%s -> missing", (raw) => {
    expect(normalizeWhatsAppPhone(raw as string | null | undefined)).toEqual({ status: "missing" });
  });

  it.each([["12345"], ["abc"], ["123"], ["+54"], ["0000000000"], ["15 5123 4567"]])("%s -> invalid", (raw) => {
    expect(normalizeWhatsAppPhone(raw, "AR").status).toBe("invalid");
  });

  it("un país desconocido no rompe: queda inválido", () => {
    expect(normalizeWhatsAppPhone("011 5123 4567", "ZZ").status).toBe("invalid");
  });

  it("whatsappDigits devuelve null para lo que no es válido", () => {
    expect(whatsappDigits("011 15-5123-4567", "AR")).toBe("5491151234567");
    expect(whatsappDigits("12345", "AR")).toBeNull();
    expect(whatsappDigits(null, "AR")).toBeNull();
  });
});

describe("mensajes y URL de WhatsApp", () => {
  it("buildWhatsAppUrl codifica acentos, $, comillas, saltos de línea y URLs", () => {
    const message = 'Hola José, ¿cómo estás?\n\nTe escribo por "Instalación & tablero" ($300.000).\nhttps://ejemplo.com/cotizacion/abc?x=1&y=2';
    const url = buildWhatsAppUrl("5491151234567", message);
    expect(url.startsWith("https://wa.me/5491151234567?text=")).toBe(true);
    expect(url).not.toMatch(/[\s"<>]/);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(message);
    expect(url).toContain("%0A"); // salto de línea
    expect(url).toContain("%24300.000"); // $
    expect(url).toContain("%26"); // &
  });

  it("sin mensaje devuelve solo el enlace del contacto", () => {
    expect(buildWhatsAppUrl("5491151234567")).toBe("https://wa.me/5491151234567");
  });

  it("firstName toma el primer nombre y tolera espacios y nombres compuestos por caracteres especiales", () => {
    expect(firstName("Juan Pérez")).toBe("Juan");
    expect(firstName("  Ñandú  López ")).toBe("Ñandú");
    expect(firstName("Zoë")).toBe("Zoë");
    expect(firstName("")).toBe("");
  });

  it("mensaje general y de trabajo", () => {
    expect(buildClientWhatsAppMessage({ clientName: "Juan Pérez" })).toBe("Hola Juan, ¿cómo estás?");
    expect(buildJobWhatsAppMessage({ clientName: "Juan Pérez", jobTitle: "Instalación eléctrica cocina" })).toBe(
      'Hola Juan, ¿cómo estás?\n\nTe escribo por el trabajo "Instalación eléctrica cocina".'
    );
  });

  it("mensaje de cotización con el enlace público", () => {
    const message = buildQuoteWhatsAppMessage({
      clientName: "Juan Pérez",
      quoteNumber: "COT-000023",
      jobTitle: "Instalación eléctrica cocina",
      url: "https://dominio.com/cotizacion/abc123",
    });
    expect(message).toBe(
      [
        "Hola Juan, ¿cómo estás?",
        "",
        'Te envío la cotización COT-000023 correspondiente a "Instalación eléctrica cocina".',
        "",
        "Podés verla acá:",
        "https://dominio.com/cotizacion/abc123",
        "",
        "Cualquier duda escribime.",
      ].join("\n")
    );
  });

  it("confirmación de pago: importe sin decimales y sin datos internos", () => {
    const message = buildPaymentWhatsAppMessage({ clientName: "Juan Pérez", amount: 300000, currency: "ARS", jobTitle: "Instalación eléctrica cocina" });
    expect(message).toBe(
      'Hola Juan, ¿cómo estás?\n\nRegistramos el pago de $300.000 correspondiente al trabajo "Instalación eléctrica cocina".\n\nMuchas gracias.'
    );
    expect(message).not.toMatch(/cuenta|referencia|costo|margen|contribuci/i);
    expect(formatMoneyForMessage(1250.5, "ARS")).toBe("$1.250,50");
  });
});

describe("URL pública y etiquetas de facturación", () => {
  it("buildPublicQuoteUrl no duplica barras ni hardcodea el dominio", () => {
    expect(buildPublicQuoteUrl("https://app.jm.com/", "tok")).toBe("https://app.jm.com/cotizacion/tok");
    expect(buildPublicQuoteUrl("http://localhost:3000", "tok")).toBe("http://localhost:3000/cotizacion/tok");
  });

  it("estados de facturación con texto (no solo color) y filtro seguro", () => {
    expect(billingStatusLabels).toEqual({ pending: "Pendiente de facturar", invoiced: "Facturado" });
    expect(billingStatusShortLabels).toEqual({ pending: "Pendiente", invoiced: "Realizada" });
    expect(parseBillingFilter("pending")).toBe("pending");
    expect(parseBillingFilter("invoiced")).toBe("invoiced");
    expect(parseBillingFilter("cualquier-cosa")).toBe("all");
    expect(parseBillingFilter(undefined)).toBe("all");
  });
});
