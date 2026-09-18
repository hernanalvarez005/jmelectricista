import { beforeAll, describe, expect, it } from "vitest";

import { createJob, createTestClient, getAnyStatusId, getSeedUnitId, createMaterial } from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

describe("Cotizaciones — numeración, totales y máquina de estados", () => {
  let orgId: string;
  let client: Awaited<ReturnType<typeof createTestUserWithOrg>>["client"];
  let unitId: string;
  let statusId: string;
  let clientId: string;

  beforeAll(async () => {
    const ctx = await createTestUserWithOrg("quotes");
    orgId = ctx.organizationId;
    client = ctx.client;
    unitId = await getSeedUnitId(client, orgId, "u");
    statusId = await getAnyStatusId(client, orgId, { closed: false });
    clientId = await createTestClient(client, orgId, "Cliente cotizaciones");
  }, 30_000);

  async function createQuoteForNewJob(title: string): Promise<string> {
    const jobId = await createJob(client, orgId, { clientId, statusId, title });
    const { data, error } = await client.rpc("create_quote", { p_job_id: jobId, p_client_id: clientId });
    if (error || !data) throw new Error(`create_quote falló: ${error?.message}`);
    return data as string;
  }

  it("numeración atómica: 5 altas concurrentes generan 5 números secuenciales sin colisión", async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createQuoteForNewJob(`Trabajo concurrente ${i}`))
    );
    const { data: quotes, error } = await client.from("quotes").select("quote_number").in("id", ids);
    if (error) throw error;
    const numbers = (quotes ?? []).map((q) => q.quote_number).sort();
    expect(new Set(numbers).size).toBe(5); // sin duplicados
    for (const n of numbers) expect(n).toMatch(/^COT-\d{6}$/);
  });

  it("subtotal/total se recalculan en el servidor al agregar ítems y aplicar descuento (nunca se confía en el cliente)", async () => {
    const quoteId = await createQuoteForNewJob("Trabajo totales");
    const materialId = await createMaterial(client, orgId, { name: "Material cotización", unitId });

    await client.from("quote_items").insert({
      organization_id: orgId,
      quote_id: quoteId,
      item_type: "material",
      material_id: materialId,
      description: "Cable",
      quantity: 10,
      unit: "u",
      sale_unit_price: 100,
    });
    await client.from("quote_items").insert({
      organization_id: orgId,
      quote_id: quoteId,
      item_type: "labor",
      description: "Mano de obra",
      quantity: 2,
      unit: "h",
      sale_unit_price: 500,
    });

    let { data: quote } = await client.from("quotes").select("subtotal, total").eq("id", quoteId).single();
    expect(Number(quote?.subtotal)).toBe(10 * 100 + 2 * 500); // 2000
    expect(Number(quote?.total)).toBe(2000);

    await client.from("quotes").update({ discount_amount: 200 }).eq("id", quoteId);
    ({ data: quote } = await client.from("quotes").select("subtotal, total").eq("id", quoteId).single());
    expect(Number(quote?.subtotal)).toBe(2000); // no cambia
    expect(Number(quote?.total)).toBe(1800); // recalculado en servidor
  });

  it("máquina de estados: draft -> sent -> accepted es válida y estampa timestamps", async () => {
    const quoteId = await createQuoteForNewJob("Trabajo estados válidos");

    let { error } = await client.from("quotes").update({ status: "sent" }).eq("id", quoteId);
    expect(error).toBeNull();
    let { data: quote } = await client.from("quotes").select("status, sent_at, accepted_at").eq("id", quoteId).single();
    expect(quote?.status).toBe("sent");
    expect(quote?.sent_at).not.toBeNull();
    expect(quote?.accepted_at).toBeNull();

    ({ error } = await client.from("quotes").update({ status: "accepted" }).eq("id", quoteId));
    expect(error).toBeNull();
    ({ data: quote } = await client.from("quotes").select("status, accepted_at").eq("id", quoteId).single());
    expect(quote?.status).toBe("accepted");
    expect(quote?.accepted_at).not.toBeNull();
  });

  it("máquina de estados: sent -> rejected es válida", async () => {
    const quoteId = await createQuoteForNewJob("Trabajo rechazo");
    await client.from("quotes").update({ status: "sent" }).eq("id", quoteId);
    const { error } = await client.from("quotes").update({ status: "rejected" }).eq("id", quoteId);
    expect(error).toBeNull();
    const { data: quote } = await client.from("quotes").select("status, rejected_at").eq("id", quoteId).single();
    expect(quote?.status).toBe("rejected");
    expect(quote?.rejected_at).not.toBeNull();
  });

  it("máquina de estados: transición inválida draft -> accepted es rechazada", async () => {
    const quoteId = await createQuoteForNewJob("Trabajo transición inválida");
    const { error } = await client.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
    expect(error).not.toBeNull();
    const { data: quote } = await client.from("quotes").select("status").eq("id", quoteId).single();
    expect(quote?.status).toBe("draft");
  });

  it("mutación prohibida fuera de borrador: no se puede editar notas/descuento de una cotización enviada", async () => {
    const quoteId = await createQuoteForNewJob("Trabajo mutación bloqueada");
    await client.from("quotes").update({ status: "sent" }).eq("id", quoteId);

    const { error } = await client.from("quotes").update({ discount_amount: 999 }).eq("id", quoteId);
    expect(error).not.toBeNull();

    const { error: itemError } = await client.from("quote_items").insert({
      organization_id: orgId,
      quote_id: quoteId,
      item_type: "other",
      description: "No debería poder agregarse",
      quantity: 1,
      unit: "u",
      sale_unit_price: 1,
    });
    expect(itemError).not.toBeNull();
  });
});
