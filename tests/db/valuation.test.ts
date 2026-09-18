import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  addJobMaterial,
  addStockMovement,
  buy,
  createJob,
  createMaterial,
  createSupplier,
  createTestClient,
  getAnyStatusId,
  getJobCostStatus,
  getMaterialValuation,
  getMovements,
  getSeedUnitId,
  registerConsumption,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Valuación de inventario — costo promedio ponderado móvil", () => {
  let ctx: Ctx;
  let orgId: string;
  let client: Ctx["client"];
  let unitId: string;
  let statusId: string;
  let clientId: string;
  let supplierId: string;

  beforeAll(async () => {
    ctx = await createTestUserWithOrg("valuation");
    orgId = ctx.organizationId;
    client = ctx.client;
    unitId = await getSeedUnitId(client, orgId, "m");
    statusId = await getAnyStatusId(client, orgId, { closed: false });
    clientId = await createTestClient(client, orgId, "Cliente valuación");
    supplierId = await createSupplier(client, orgId);
  }, 60_000);

  async function newMaterial(name: string) {
    return createMaterial(client, orgId, { name: `${name} ${randomUUID().slice(0, 6)}`, unitId });
  }
  async function newJobWithMaterial(materialId: string, estimated = 500) {
    const jobId = await createJob(client, orgId, { clientId, statusId, title: `Job ${randomUUID().slice(0, 6)}` });
    const jobMaterialId = await addJobMaterial(client, orgId, { jobId, materialId, estimatedQuantity: estimated });
    return { jobId, jobMaterialId };
  }

  it("69: 100@1000 + 100@1200 => stock 200, valor 220000, promedio 1100", async () => {
    const m = await newMaterial("Cable 69");
    await buy(client, orgId, supplierId, m, 100, 1000);
    let v = await getMaterialValuation(client, m);
    expect(v).toMatchObject({ current_stock: 100, inventory_value: 100_000, average_cost: 1000, valuation_initialized: true });
    await buy(client, orgId, supplierId, m, 100, 1200);
    v = await getMaterialValuation(client, m);
    expect(v).toMatchObject({ current_stock: 200, inventory_value: 220_000, average_cost: 1100 });
  });

  it("70–72: consumo 50 @1100 congela costo; 2ª compra 50@1400 => promedio 1175 y el consumo sigue en 1100", async () => {
    const m = await newMaterial("Cable 70");
    await buy(client, orgId, supplierId, m, 100, 1000);
    await buy(client, orgId, supplierId, m, 100, 1200);
    const { jobId, jobMaterialId } = await newJobWithMaterial(m);

    await registerConsumption(client, jobMaterialId, 50);
    let v = await getMaterialValuation(client, m);
    expect(v).toMatchObject({ current_stock: 150, inventory_value: 165_000, average_cost: 1100 });
    let consumption = (await getMovements(client, m)).find((x) => x.movement_type === "consumption")!;
    expect(consumption).toMatchObject({ unit_cost: 1100, total_cost: 55_000, job_id: jobId });

    await buy(client, orgId, supplierId, m, 50, 1400);
    v = await getMaterialValuation(client, m);
    expect(v).toMatchObject({ current_stock: 200, inventory_value: 235_000, average_cost: 1175 });

    consumption = (await getMovements(client, m)).find((x) => x.movement_type === "consumption")!;
    expect(consumption.unit_cost).toBe(1100); // NO 1175
    expect(consumption.total_cost).toBe(55_000);
  });

  it("73: devolución vinculada restaura 10 × 1100 (costo histórico), no el promedio actual", async () => {
    const m = await newMaterial("Cable 73");
    await buy(client, orgId, supplierId, m, 100, 1000);
    await buy(client, orgId, supplierId, m, 100, 1200);
    const { jobMaterialId } = await newJobWithMaterial(m);
    await registerConsumption(client, jobMaterialId, 50);
    await buy(client, orgId, supplierId, m, 50, 1400); // promedio pasa a 1175

    await registerConsumption(client, jobMaterialId, 40); // corrige a la baja: devuelve 10
    const ret = (await getMovements(client, m)).find((x) => x.movement_type === "return")!;
    expect(ret).toMatchObject({ quantity: 10, unit_cost: 1100, total_cost: 11_000 });
    expect(ret.reversal_of_movement_id).toBeTruthy();
    const v = await getMaterialValuation(client, m);
    expect(v.current_stock).toBe(210);
    expect(v.inventory_value).toBe(235_000 + 11_000);
  });

  it("74: adjustment_out retira 10 × promedio vigente (1175 => 11750)", async () => {
    const m = await newMaterial("Cable 74");
    await buy(client, orgId, supplierId, m, 100, 1000);
    await buy(client, orgId, supplierId, m, 100, 1200);
    await buy(client, orgId, supplierId, m, 100, 1325); // (220000+132500)/300 = 1175
    expect((await getMaterialValuation(client, m)).average_cost).toBe(1175);
    await addStockMovement(client, orgId, { materialId: m, movementType: "adjustment_out", quantity: 10 });
    const adj = (await getMovements(client, m)).find((x) => x.movement_type === "adjustment_out")!;
    expect(adj).toMatchObject({ unit_cost: 1175, total_cost: 11_750 });
    const v = await getMaterialValuation(client, m);
    expect(v.inventory_value).toBe(352_500 - 11_750);
    expect(v.average_cost).toBe(1175);
  });

  it("75: adjustment_in sobre material valorizado exige costo y recalcula el promedio", async () => {
    const m = await newMaterial("Cable 75");
    await buy(client, orgId, supplierId, m, 100, 1000);
    await expect(addStockMovement(client, orgId, { materialId: m, movementType: "adjustment_in", quantity: 10 })).rejects.toThrow(/costo_requerido/);
    const { error } = await client.from("stock_movements").insert({
      organization_id: orgId, material_id: m, movement_type: "adjustment_in", quantity: 100, unit_cost: 1200,
    });
    expect(error).toBeNull();
    expect(await getMaterialValuation(client, m)).toMatchObject({ current_stock: 200, inventory_value: 220_000, average_cost: 1100 });
  });

  it("76: stock negativo bloqueado (consumo y adjustment_out) con mensaje reconocible", async () => {
    const m = await newMaterial("Cable 76");
    await buy(client, orgId, supplierId, m, 10, 1000);
    const { jobMaterialId } = await newJobWithMaterial(m);
    await expect(registerConsumption(client, jobMaterialId, 11)).rejects.toThrow(/stock_insuficiente/);
    await expect(addStockMovement(client, orgId, { materialId: m, movementType: "adjustment_out", quantity: 11 })).rejects.toThrow(/stock_insuficiente/);
    expect((await getMaterialValuation(client, m)).current_stock).toBe(10);
  });

  it("vaciar el stock deja el valor de inventario exactamente en 0 (sin residuo de redondeo)", async () => {
    const m = await newMaterial("Cable residuo");
    await buy(client, orgId, supplierId, m, 3, 1000);
    await buy(client, orgId, supplierId, m, 4, 1111.111111);
    const before = await getMaterialValuation(client, m);
    await addStockMovement(client, orgId, { materialId: m, movementType: "adjustment_out", quantity: 1 });
    await addStockMovement(client, orgId, { materialId: m, movementType: "adjustment_out", quantity: before.current_stock - 1 });
    const after = await getMaterialValuation(client, m);
    expect(after.current_stock).toBe(0);
    expect(after.inventory_value).toBe(0);
  });

  it("79–80: costo real del trabajo = 50@1100 + 20@1175 = 78500; con devolución de 10@1100 => 67500", async () => {
    const m = await newMaterial("Cable 79");
    await buy(client, orgId, supplierId, m, 100, 1000);
    await buy(client, orgId, supplierId, m, 100, 1200);
    const { jobId, jobMaterialId } = await newJobWithMaterial(m);
    await registerConsumption(client, jobMaterialId, 50);
    await buy(client, orgId, supplierId, m, 50, 1400);
    await registerConsumption(client, jobMaterialId, 70); // +20 @ 1175

    let cost = await getJobCostStatus(client, jobId);
    expect(cost.actual).toBe(78_500);
    expect(cost.complete).toBe(true);

    // Devolución de 10 asociada explícitamente al primer consumo (@1100).
    const first = (await getMovements(client, m)).find((x) => x.movement_type === "consumption")!;
    const { error } = await client.from("stock_movements").insert({
      organization_id: orgId, material_id: m, job_id: jobId, movement_type: "return", quantity: 10, reversal_of_movement_id: first.id,
    });
    expect(error).toBeNull();
    cost = await getJobCostStatus(client, jobId);
    expect(cost.actual).toBe(67_500);
  });

  it("costo estimado vs real: usa cost_unit_price de la cotización aceptada y calcula el desvío", async () => {
    const m = await newMaterial("Cable estimado");
    await buy(client, orgId, supplierId, m, 100, 1000);
    const { jobId, jobMaterialId } = await newJobWithMaterial(m);
    const { data: quoteId } = await client.rpc("create_quote", { p_job_id: jobId, p_client_id: clientId });
    await client.from("quote_items").insert({
      organization_id: orgId, quote_id: quoteId!, item_type: "material", material_id: m,
      description: "Cable", quantity: 40, unit: "m", cost_unit_price: 900, sale_unit_price: 1500,
    });
    await client.from("quotes").update({ status: "sent" }).eq("id", quoteId!);
    await client.from("quotes").update({ status: "accepted" }).eq("id", quoteId!);
    await registerConsumption(client, jobMaterialId, 40);
    const cost = await getJobCostStatus(client, jobId);
    expect(cost.estimated).toBe(36_000);
    expect(cost.actual).toBe(40_000);
    expect(cost.variance).toBe(4_000);
  });

  it("stock histórico sin valoración: no se inventa costo; consumo sin costo => costo real incompleto", async () => {
    const m = await newMaterial("Cable histórico");
    await addStockMovement(client, orgId, { materialId: m, movementType: "in", quantity: 120 }); // sin costo (histórico)
    const v = await getMaterialValuation(client, m);
    expect(v).toMatchObject({ current_stock: 120, valuation_initialized: false, needs_initialization: true, inventory_value: null });

    const { jobId, jobMaterialId } = await newJobWithMaterial(m);
    await registerConsumption(client, jobMaterialId, 20);
    expect((await getMovements(client, m)).find((x) => x.movement_type === "consumption")!.unit_cost).toBeNull();
    const cost = await getJobCostStatus(client, jobId);
    expect(cost.complete).toBe(false);
    expect(cost.variance).toBeNull();

    // Comprar sobre stock sin valoración exige inicializar primero.
    await expect(buy(client, orgId, supplierId, m, 10, 1000)).rejects.toThrow(/valoracion_no_inicializada/);
  });

  it("37: inicializar valoración (admin) fija valor = stock × costo y queda auditado", async () => {
    const m = await newMaterial("Cable init");
    await addStockMovement(client, orgId, { materialId: m, movementType: "in", quantity: 120 });
    const { error } = await client.rpc("initialize_material_valuation", { p_material_id: m, p_unit_cost: 1050, p_notes: "Apertura" });
    expect(error).toBeNull();
    expect(await getMaterialValuation(client, m)).toMatchObject({ valuation_initialized: true, inventory_value: 126_000, average_cost: 1050, needs_initialization: false });

    const { data: events } = await client.from("material_valuation_events").select("*").eq("material_id", m);
    expect(events?.length).toBe(1);
    expect(Number(events?.[0].total_value)).toBe(126_000);

    const again = await client.rpc("initialize_material_valuation", { p_material_id: m, p_unit_cost: 1, p_notes: null as never });
    expect(again.error).not.toBeNull(); // no se puede reinicializar

    // A partir de acá el material compra normalmente: (126000 + 100*1200)/220
    await buy(client, orgId, supplierId, m, 100, 1200);
    const v = await getMaterialValuation(client, m);
    expect(v.inventory_value).toBe(246_000);
  });

  it("38: material sin stock no necesita costo inicial (se valoriza con la primera compra) y no se puede inicializar", async () => {
    const m = await newMaterial("Cable vacío");
    const { error } = await client.rpc("initialize_material_valuation", { p_material_id: m, p_unit_cost: 100 });
    expect(error?.message).toMatch(/sin_stock/);
    await buy(client, orgId, supplierId, m, 5, 200);
    expect((await getMaterialValuation(client, m)).inventory_value).toBe(1000);
  });

  it("los movimientos históricos no se modifican: no existe UPDATE/DELETE sobre stock_movements", async () => {
    const m = await newMaterial("Cable inmutable");
    await buy(client, orgId, supplierId, m, 10, 100);
    const mv = (await getMovements(client, m))[0];
    const upd = await client.from("stock_movements").update({ unit_cost: 1 }).eq("id", mv.id).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await client.from("stock_movements").delete().eq("id", mv.id).select();
    expect(del.data ?? []).toEqual([]);
  });

  it("concurrencia: 5 retiros simultáneos de 10 sobre stock 30 => 3 pasan, 2 se rechazan y el valor queda en 0", async () => {
    const m = await newMaterial("Cable concurrente");
    await buy(client, orgId, supplierId, m, 30, 1000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        client.from("stock_movements").insert({ organization_id: orgId, material_id: m, movement_type: "adjustment_out", quantity: 10 })
      )
    );
    expect(results.filter((r) => r.error === null).length).toBe(3);
    expect(results.filter((r) => r.error !== null).length).toBe(2);
    const v = await getMaterialValuation(client, m);
    expect(v.current_stock).toBe(0);
    expect(v.inventory_value).toBe(0);
    const outs = (await getMovements(client, m)).filter((x) => x.movement_type === "adjustment_out");
    expect(outs.reduce((s, x) => s + (x.total_cost ?? 0), 0)).toBe(30_000);
  });

  it("concurrencia: compras recibidas en paralelo del mismo material no corrompen cantidad, valor ni promedio", async () => {
    const m = await newMaterial("Cable compras paralelas");
    await Promise.all([
      buy(client, orgId, supplierId, m, 100, 1000),
      buy(client, orgId, supplierId, m, 100, 1200),
      buy(client, orgId, supplierId, m, 100, 1400),
    ]);
    const v = await getMaterialValuation(client, m);
    expect(v.current_stock).toBe(300);
    expect(v.inventory_value).toBe(360_000);
    expect(v.average_cost).toBe(1200);
  });
});
