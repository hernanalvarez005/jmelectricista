import { beforeAll, describe, expect, it } from "vitest";

import { createTestUserWithOrg, anonClient } from "../helpers/supabase";

/**
 * Bucket privado `quotes`, path organizations/{org_id}/quotes/{quote_id}/cotizacion.pdf.
 * Verifica: el dueño puede subir y leer su propio PDF; anon no puede leer
 * nada; un usuario de otra organización no puede leer el PDF ajeno aunque
 * conozca el path exacto.
 */
describe("RLS — Storage del bucket de cotizaciones", () => {
  let owner: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let outsider: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let path: string;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("storage-owner");
    outsider = await createTestUserWithOrg("storage-outsider");
    path = `organizations/${owner.organizationId}/quotes/test-quote/cotizacion.pdf`;

    const { error } = await owner.client.storage
      .from("quotes")
      .upload(path, new Blob([new Uint8Array([1, 2, 3])]), { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`No se pudo subir el PDF de test: ${error.message}`);
  }, 30_000);

  it("el dueño puede generar una signed URL y descargar su propio PDF", async () => {
    const { data, error } = await owner.client.storage.from("quotes").createSignedUrl(path, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  it("otra organización no puede generar una signed URL para el PDF ajeno", async () => {
    const { data, error } = await outsider.client.storage.from("quotes").createSignedUrl(path, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("otra organización no puede listar el path de la organización ajena", async () => {
    const { data } = await outsider.client.storage.from("quotes").list(`organizations/${owner.organizationId}/quotes`);
    expect(data ?? []).toEqual([]);
  });

  it("anon no puede generar una signed URL ni descargar el PDF", async () => {
    const anon = anonClient();
    const { data, error } = await anon.storage.from("quotes").createSignedUrl(path, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

/**
 * Bucket privado `payment-receipts`, path
 * organizations/{org_id}/jobs/{job_id}/payments/{payment_id}/{filename}.
 * Mismo patrón de seguridad que el bucket de cotizaciones.
 */
describe("RLS — Storage del bucket de comprobantes de cobro", () => {
  let owner: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let outsider: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let path: string;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("receipt-owner");
    outsider = await createTestUserWithOrg("receipt-outsider");
    path = `organizations/${owner.organizationId}/jobs/test-job/payments/test-payment/comprobante.jpg`;

    const { error } = await owner.client.storage
      .from("payment-receipts")
      .upload(path, new Blob([new Uint8Array([1, 2, 3])]), { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`No se pudo subir el comprobante de test: ${error.message}`);
  }, 30_000);

  it("el dueño puede generar una signed URL y descargar su propio comprobante", async () => {
    const { data, error } = await owner.client.storage.from("payment-receipts").createSignedUrl(path, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  it("otra organización no puede generar una signed URL para el comprobante ajeno", async () => {
    const { data, error } = await outsider.client.storage.from("payment-receipts").createSignedUrl(path, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("otra organización no puede subir un comprobante bajo el path de la organización ajena", async () => {
    const { error } = await outsider.client.storage
      .from("payment-receipts")
      .upload(path, new Blob([new Uint8Array([9])]), { contentType: "image/jpeg", upsert: true });
    expect(error).not.toBeNull();
  });

  it("anon no puede generar una signed URL ni descargar el comprobante", async () => {
    const anon = anonClient();
    const { data, error } = await anon.storage.from("payment-receipts").createSignedUrl(path, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
