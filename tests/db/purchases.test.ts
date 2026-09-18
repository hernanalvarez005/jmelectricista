import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createMaterial,
  createPurchaseDraft,
  createSupplier,
  getMaterialValuation,
  getMovements,
  getSeedUnitId,
  receivePurchase,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Compras — borrador, recepción idempotente y numeración", () => {
  let ctx: Ctx;
  let orgId: string;
  let client: Ctx["client"];
  let unitId: string;
  let supplierId: string;

  beforeAll(async () => {
    ctx = await createTestUserWithOrg("purchases");
    orgId = ctx.organizationId;
    client = ctx.client;
    unitId = await getSeedUnitId(client, orgId, "m");
    supplierId = await createSupplier(client, orgId);
  }, 60_000);

  async function material(name: string) {
    return createMaterial(client, orgId, { name: `${name} ${randomUUID().slice(0, 6)}`, unitId });
  }

  it("numeración atómica COM-000001…: 5 altas concurrentes => 5 números distintos", async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => createPurchaseDraft(client, orgId, { supplierId, items: [] }))
    );
    const { data } = await client.from("purchases").select("purchase_number").in("id", ids);
    const numbers = (data ?? []).map((p) => p.purchase_number);
    expect(new Set(numbers).size).toBe(5);
    for (const n of numbers) expect(n).toMatch(/^COM-\d{6}$/);
  });

  it("create_purchase es idempotente por client_request_id (no consume otro número)", async () => {
    const rid = randomUUID();
    const a = await createPurchaseDraft(client, orgId, { supplierId, items: [], clientRequestId: rid });
    const b = await createPurchaseDraft(client, orgId, { supplierId, items: [], clientRequestId: rid });
    expect(a).toBe(b);
    const results = await Promise.all(Array.from({ length: 4 }, () => createPurchaseDraft(client, orgId, { supplierId, items: [], clientRequestId: rid })));
    expect(new Set(results).size).toBe(1);
  });

  it("borrador NO afecta el stock; subtotal/total se calculan en el servidor", async () => {
    const m = await material("Cable borrador");
    const id = await createPurchaseDraft(client, orgId, {
      supplierId,
      items: [{ materialId: m, quantity: 100, unitCost: 1000 }, { materialId: await material("Otro"), quantity: 2.5, unitCost: 400 }],
    });
    const { data: p } = await client.from("purchases").select("status, subtotal, total").eq("id", id).single();
    expect(p?.status).toBe("draft");
    expect(Number(p?.total)).toBe(101_000);
    expect((await getMaterialValuation(client, m)).current_stock).toBe(0);
    expect(await getMovements(client, m)).toEqual([]);
  });

  it("recibir genera un movimiento por ítem vinculado a la compra, con el costo real, y valoriza", async () => {
    const m = await material("Cable recibir");
    const id = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 100, unitCost: 1000 }] });
    expect(await receivePurchase(client, id)).toBe("received");
    const movements = await getMovements(client, m);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movement_type: "in", quantity: 100, unit_cost: 1000, total_cost: 100_000, purchase_id: id });
    expect(await getMaterialValuation(client, m)).toMatchObject({ current_stock: 100, inventory_value: 100_000, average_cost: 1000 });
    const { data: p } = await client.from("purchases").select("status, received_at").eq("id", id).single();
    expect(p?.status).toBe("received");
    expect(p?.received_at).not.toBeNull();
  });

  it("77: recibir dos veces (secuencial) suma el stock una sola vez", async () => {
    const m = await material("Cable idempotente");
    const id = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 40, unitCost: 500 }] });
    expect(await receivePurchase(client, id)).toBe("received");
    expect(await receivePurchase(client, id)).toBe("already_received");
    expect((await getMaterialValuation(client, m)).current_stock).toBe(40);
    expect(await getMovements(client, m)).toHaveLength(1);
  });

  it("77: 5 recepciones concurrentes de la misma compra => un solo set de movimientos", async () => {
    const m = await material("Cable concurrente");
    const id = await createPurchaseDraft(client, orgId, {
      supplierId,
      items: [{ materialId: m, quantity: 40, unitCost: 500 }, { materialId: m, quantity: 10, unitCost: 700 }],
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => client.rpc("receive_purchase", { p_purchase_id: id })));
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => r.data === "received")).toHaveLength(1);
    expect(await getMovements(client, m)).toHaveLength(2);
    expect(await getMaterialValuation(client, m)).toMatchObject({ current_stock: 50, inventory_value: 27_000 });
  });

  it("no se puede recibir una compra sin ítems ni una cancelada", async () => {
    const empty = await createPurchaseDraft(client, orgId, { supplierId, items: [] });
    await expect(receivePurchase(client, empty)).rejects.toThrow(/no tiene ítems/);
    const m = await material("Cable cancelada");
    const cancelled = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 1, unitCost: 1 }] });
    expect((await client.rpc("cancel_purchase", { p_purchase_id: cancelled })).error).toBeNull();
    await expect(receivePurchase(client, cancelled)).rejects.toThrow(/cancelada/);
  });

  it("una compra recibida no se puede cancelar, editar ni tocar sus ítems", async () => {
    const m = await material("Cable congelada");
    const id = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 10, unitCost: 100 }] });
    await receivePurchase(client, id);

    expect((await client.rpc("cancel_purchase", { p_purchase_id: id })).error?.message).toMatch(/recibida/);
    expect((await client.from("purchases").update({ purchase_date: "2026-01-01" }).eq("id", id)).error).not.toBeNull();
    const { data: items } = await client.from("purchase_items").select("id").eq("purchase_id", id);
    expect((await client.from("purchase_items").update({ unit_cost: 1 }).eq("id", items![0].id)).error).not.toBeNull();
    expect((await client.from("purchase_items").delete().eq("id", items![0].id)).error).not.toBeNull();
    // notas y documento sí se pueden actualizar
    expect((await client.from("purchases").update({ notes: "Remito 0001" }).eq("id", id)).error).toBeNull();
    // stock intacto
    expect((await getMaterialValuation(client, m)).current_stock).toBe(10);
  });

  it("el borrador se puede editar y cancelar; no se cambia el estado por UPDATE directo", async () => {
    const m = await material("Cable editable");
    const id = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 10, unitCost: 100 }] });
    const { data: items } = await client.from("purchase_items").select("id").eq("purchase_id", id);
    expect((await client.from("purchase_items").update({ quantity: 20 }).eq("id", items![0].id)).error).toBeNull();
    const { data: p } = await client.from("purchases").select("total").eq("id", id).single();
    expect(Number(p?.total)).toBe(2_000);

    // Saltearse receive_purchase marcando "received" a mano debe fallar (no generaría movimientos).
    const forged = await client.from("purchases").update({ status: "received", received_at: new Date().toISOString() }).eq("id", id);
    expect(forged.error).not.toBeNull();
    expect((await getMovements(client, m))).toEqual([]);

    expect((await client.rpc("cancel_purchase", { p_purchase_id: id })).error).toBeNull();
  });

  it("no se pueden fabricar movimientos de compra por INSERT directo", async () => {
    const m = await material("Cable forjado");
    const id = await createPurchaseDraft(client, orgId, { supplierId, items: [{ materialId: m, quantity: 10, unitCost: 100 }] });
    const { error } = await client.from("stock_movements").insert({
      organization_id: orgId, material_id: m, movement_type: "in", quantity: 999, unit_cost: 1, purchase_id: id,
    });
    expect(error?.message).toMatch(/compra_solo_por_recepcion/);
  });
});
