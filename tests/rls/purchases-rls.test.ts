import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buy,
  createMaterial,
  createPurchaseDraft,
  createSupplier,
  getMaterialValuation,
  getSeedUnitId,
} from "../helpers/fixtures";
import { anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("RLS — compras, valuación y documentos", () => {
  let a: Ctx;
  let b: Ctx;
  let supplierA: string;
  let supplierB: string;
  let materialA: string;
  let materialB: string;
  let purchaseB: string;
  let draftA: string;

  beforeAll(async () => {
    a = await createTestUserWithOrg("pur-a");
    b = await createTestUserWithOrg("pur-b");
    supplierA = await createSupplier(a.client, a.organizationId);
    supplierB = await createSupplier(b.client, b.organizationId);
    materialA = await createMaterial(a.client, a.organizationId, { name: "Mat A", unitId: await getSeedUnitId(a.client, a.organizationId, "u") });
    materialB = await createMaterial(b.client, b.organizationId, { name: "Mat B", unitId: await getSeedUnitId(b.client, b.organizationId, "u") });
    purchaseB = await createPurchaseDraft(b.client, b.organizationId, { supplierId: supplierB, items: [{ materialId: materialB, quantity: 5, unitCost: 10 }] });
    draftA = await createPurchaseDraft(a.client, a.organizationId, { supplierId: supplierA, items: [{ materialId: materialA, quantity: 5, unitCost: 10 }] });
  }, 90_000);

  it("anon no lee ni escribe en compras/valuación y no invoca los RPC", async () => {
    const anon = anonClient();
    for (const table of ["purchases", "purchase_items", "material_inventory_valuation", "material_valuation_events"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    expect((await anon.rpc("receive_purchase", { p_purchase_id: draftA })).error).not.toBeNull();
    expect((await anon.rpc("cancel_purchase", { p_purchase_id: draftA })).error).not.toBeNull();
    expect((await anon.rpc("create_purchase", { p_supplier_id: supplierA, p_purchase_date: "2026-09-20", p_client_request_id: randomUUID() })).error).not.toBeNull();
    expect((await anon.rpc("initialize_material_valuation", { p_material_id: materialA, p_unit_cost: 1 })).error).not.toBeNull();
  });

  it("78: A no puede usar el proveedor de B, leer, recibir ni cancelar la compra de B", async () => {
    expect((await a.client.rpc("create_purchase", { p_supplier_id: supplierB, p_purchase_date: "2026-09-20", p_client_request_id: randomUUID() })).error).not.toBeNull();
    const { data } = await a.client.from("purchases").select("id").eq("id", purchaseB);
    expect(data).toEqual([]);
    expect((await a.client.rpc("receive_purchase", { p_purchase_id: purchaseB })).error).not.toBeNull();
    expect((await a.client.rpc("cancel_purchase", { p_purchase_id: purchaseB })).error).not.toBeNull();
    const { data: items } = await a.client.from("purchase_items").select("id").eq("purchase_id", purchaseB);
    expect(items).toEqual([]);
  });

  it("78: A no puede agregar un material de B a su compra, ni un ítem a la compra de B", async () => {
    const r1 = await a.client.from("purchase_items").insert({ organization_id: a.organizationId, purchase_id: draftA, material_id: materialB, quantity: 1, unit_cost: 1 });
    expect(r1.error).not.toBeNull();
    const r2 = await a.client.from("purchase_items").insert({ organization_id: a.organizationId, purchase_id: purchaseB, material_id: materialA, quantity: 1, unit_cost: 1 });
    expect(r2.error).not.toBeNull();
    const r3 = await a.client.from("purchase_items").insert({ organization_id: b.organizationId, purchase_id: purchaseB, material_id: materialB, quantity: 1, unit_cost: 1 });
    expect(r3.error).not.toBeNull(); // organization_id ajeno: RLS
  });

  it("A no puede inicializar la valoración ni mover stock valorizado de B", async () => {
    await buy(b.client, b.organizationId, supplierB, materialB, 10, 100);
    expect((await a.client.rpc("initialize_material_valuation", { p_material_id: materialB, p_unit_cost: 1 })).error).not.toBeNull();
    const r = await a.client.from("stock_movements").insert({ organization_id: a.organizationId, material_id: materialB, movement_type: "adjustment_out", quantity: 1 });
    expect(r.error).not.toBeNull();
    const { data } = await a.client.from("material_inventory_valuation").select("*").eq("material_id", materialB);
    expect(data).toEqual([]);
    expect((await getMaterialValuation(b.client, materialB)).current_stock).toBe(10);
  });

  it("roles: worker crea/edita borradores pero no recibe ni cancela; viewer solo lee; admin recibe", async () => {
    const worker = await createOrgMember(a.client, a.organizationId, "worker", "pur-worker");
    const viewer = await createOrgMember(a.client, a.organizationId, "viewer", "pur-viewer");
    const admin = await createOrgMember(a.client, a.organizationId, "admin", "pur-admin");

    const wDraft = await createPurchaseDraft(worker.client, a.organizationId, { supplierId: supplierA, items: [{ materialId: materialA, quantity: 2, unitCost: 5 }] });
    expect(wDraft).toBeTruthy();
    expect((await worker.client.rpc("receive_purchase", { p_purchase_id: wDraft })).error).not.toBeNull();
    expect((await worker.client.rpc("cancel_purchase", { p_purchase_id: wDraft })).error).not.toBeNull();
    expect((await worker.client.rpc("initialize_material_valuation", { p_material_id: materialA, p_unit_cost: 1 })).error).not.toBeNull();

    const v = await viewer.client.rpc("create_purchase", { p_supplier_id: supplierA, p_purchase_date: "2026-09-20", p_client_request_id: randomUUID() });
    expect(v.error).not.toBeNull();
    const { data: seen } = await viewer.client.from("purchases").select("id").eq("id", wDraft);
    expect(seen).toHaveLength(1);
    expect((await viewer.client.from("purchase_items").insert({ organization_id: a.organizationId, purchase_id: wDraft, material_id: materialA, quantity: 1, unit_cost: 1 })).error).not.toBeNull();

    expect((await admin.client.rpc("receive_purchase", { p_purchase_id: wDraft })).error).toBeNull();
  });

  it("Storage purchase-documents: dueño sube/firma, otra org y anon bloqueados", async () => {
    const path = `organizations/${a.organizationId}/purchases/${draftA}/factura.pdf`;
    const up = await a.client.storage.from("purchase-documents").upload(path, new Blob([new Uint8Array([1, 2, 3])]), { contentType: "application/pdf", upsert: true });
    expect(up.error).toBeNull();
    expect((await a.client.storage.from("purchase-documents").createSignedUrl(path, 60)).data?.signedUrl).toBeTruthy();
    const other = await b.client.storage.from("purchase-documents").createSignedUrl(path, 60);
    expect(other.data).toBeNull();
    expect(other.error).not.toBeNull();
    const intrusion = await b.client.storage.from("purchase-documents").upload(path, new Blob([new Uint8Array([9])]), { contentType: "application/pdf", upsert: true });
    expect(intrusion.error).not.toBeNull();
    const anon = await anonClient().storage.from("purchase-documents").createSignedUrl(path, 60);
    expect(anon.data).toBeNull();
    // viewer puede leer pero no subir
    const viewer = await createOrgMember(a.client, a.organizationId, "viewer", "pur-doc-viewer");
    expect((await viewer.client.storage.from("purchase-documents").createSignedUrl(path, 60)).data?.signedUrl).toBeTruthy();
    const vUp = await viewer.client.storage.from("purchase-documents").upload(`organizations/${a.organizationId}/purchases/${draftA}/otro.pdf`, new Blob([new Uint8Array([1])]), { contentType: "application/pdf" });
    expect(vUp.error).not.toBeNull();
  });
});
