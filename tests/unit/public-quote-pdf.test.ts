import { describe, expect, it } from "vitest";

import type { PublicQuote } from "@/lib/data/public-quote";
import { PUBLIC_QUOTE_KEYS } from "@/lib/data/public-quote";
import { renderPublicQuotePdf } from "@/lib/pdf/public-quote-pdf";

const quote: PublicQuote = {
  organization_name: "JM Electricista",
  currency: "ARS",
  quote_number: "COT-000023",
  issue_date: "2026-09-19",
  valid_until: "2026-10-19",
  client_name: "Juan Pérez",
  client_address: "Casa, Belgrano 123, Córdoba",
  job_title: "Instalación eléctrica cocina",
  job_description: "Tomas y luces",
  subtotal: 120000,
  discount_amount: 20000,
  total: 100000,
  terms: "Pago 50% al comienzo",
  notes: "Incluye materiales",
  items: [
    { description: "Instalación", quantity: 1, unit: "trabajo", unit_price: 100000, subtotal: 100000 },
    { description: "Cable 2,5 mm", quantity: 20, unit: "m", unit_price: 1000, subtotal: 20000 },
  ],
};

describe("PDF público de una cotización compartida", () => {
  it("se renderiza solo desde el DTO público y devuelve un PDF válido", async () => {
    const pdf = await renderPublicQuotePdf(quote);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  }, 30_000);

  it("el tipo del DTO no tiene campos de costos ni internos (guarda de claves)", () => {
    const forbidden = /cost|margin|contribution|labor|expense|purchase|supplier|stock|hourly|token|_id$/;
    for (const key of PUBLIC_QUOTE_KEYS) expect(key).not.toMatch(forbidden);
  });
});
