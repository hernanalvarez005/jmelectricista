import { beforeAll, describe, expect, it } from "vitest";

import {
  addJobMaterial,
  createJob,
  createMaterial,
  createTestClient,
  getAnyStatusId,
  getSeedUnitId,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

/**
 * Dos organizaciones (A y B) completamente separadas. El usuario de A nunca
 * debe poder leer ni escribir datos de B, incluyendo asociar un material de
 * B a un trabajo de A (integridad cross-org reforzada por triggers, no solo
 * por RLS).
 */
describe("RLS — aislamiento entre organizaciones", () => {
  let a: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let b: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let materialB: string;
  let supplierB: string;
  let quoteB: string;
  let jobA: string;

  beforeAll(async () => {
    a = await createTestUserWithOrg("org-a");
    b = await createTestUserWithOrg("org-b");

    const unitB = await getSeedUnitId(b.client, b.organizationId, "u");
    materialB = await createMaterial(b.client, b.organizationId, { name: "Material de B", unitId: unitB });

    const { data: supplier, error: supplierError } = await b.client
      .from("suppliers")
      .insert({ organization_id: b.organizationId, name: "Proveedor de B" })
      .select("id")
      .single();
    if (supplierError || !supplier) throw new Error(supplierError?.message);
    supplierB = supplier.id;

    const clientB = await createTestClient(b.client, b.organizationId, "Cliente de B");
    const statusB = await getAnyStatusId(b.client, b.organizationId, { closed: false });
    const jobB = await createJob(b.client, b.organizationId, { clientId: clientB, statusId: statusB, title: "Trabajo de B" });
    const { data: quote, error: quoteError } = await b.client.rpc("create_quote", {
      p_job_id: jobB,
      p_client_id: clientB,
    });
    if (quoteError || !quote) throw new Error(quoteError?.message);
    quoteB = quote as string;

    const unitA = await getSeedUnitId(a.client, a.organizationId, "u");
    await createMaterial(a.client, a.organizationId, { name: "Material de A", unitId: unitA }); // no usado, solo para que A tenga datos propios
    const clientA = await createTestClient(a.client, a.organizationId, "Cliente de A");
    const statusA = await getAnyStatusId(a.client, a.organizationId, { closed: false });
    jobA = await createJob(a.client, a.organizationId, { clientId: clientA, statusId: statusA, title: "Trabajo de A" });
  }, 90_000);

  it("A no puede leer el material de B", async () => {
    const { data } = await a.client.from("materials").select("*").eq("id", materialB);
    expect(data).toEqual([]);
  });

  it("A no puede leer el proveedor de B ni sus precios", async () => {
    const { data } = await a.client.from("suppliers").select("*").eq("id", supplierB);
    expect(data).toEqual([]);
  });

  it("A no puede leer la cotización de B", async () => {
    const { data } = await a.client.from("quotes").select("*").eq("id", quoteB);
    expect(data).toEqual([]);
  });

  it("A no puede agregar el material de B a un trabajo propio (trigger de integridad cross-org)", async () => {
    const { error } = await a.client
      .from("job_materials")
      .insert({ organization_id: a.organizationId, job_id: jobA, material_id: materialB, estimated_quantity: 10 });
    expect(error).not.toBeNull();
  });

  it("A no puede consumir un job_material de B llamando el RPC directamente", async () => {
    const unitB = await getSeedUnitId(b.client, b.organizationId, "m");
    const materialB2 = await createMaterial(b.client, b.organizationId, { name: "Material B2", unitId: unitB });
    const clientB2 = await createTestClient(b.client, b.organizationId, "Cliente B2");
    const statusB2 = await getAnyStatusId(b.client, b.organizationId, { closed: false });
    const jobB2 = await createJob(b.client, b.organizationId, { clientId: clientB2, statusId: statusB2, title: "Job B2" });
    const jobMaterialB2 = await addJobMaterial(b.client, b.organizationId, {
      jobId: jobB2,
      materialId: materialB2,
      estimatedQuantity: 10,
    });

    const { error } = await a.client.rpc("register_job_material_consumption", {
      p_job_material_id: jobMaterialB2,
      p_actual_quantity: 5,
    });
    expect(error).not.toBeNull();
  });

  it("A no puede cambiar el estado de la cotización de B", async () => {
    const { data } = await a.client.from("quotes").update({ status: "sent" }).eq("id", quoteB).select();
    expect(data).toEqual([]);

    const { data: stillDraft } = await b.client.from("quotes").select("status").eq("id", quoteB).single();
    expect(stillDraft?.status).toBe("draft");
  });
});
