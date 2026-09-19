import { beforeAll, describe, expect, it } from "vitest";

import {
  addJobMaterial,
  addStockMovement,
  buy,
  createAcceptedQuote,
  createJob,
  createMaterial,
  createSession,
  createSupplier,
  createTestClient,
  createTypedJob,
  getAnyStatusId,
  getExpenseCategoryId,
  getJobTypeId,
  getMemberId,
  getSeedUnitId,
  registerConsumption,
  registerExpense,
  setRate,
} from "../helpers/fixtures";
import { createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Análisis — calidad de estimación y carga real", () => {
  let owner: Ctx;
  let clientId: string;
  let statusOpen: string;
  let statusClosed: string;
  let unitId: string;
  let supplierId: string;
  let memberId: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("analysis");
    const worker = await createOrgMember(owner.client, owner.organizationId, "worker", "an-w");
    memberId = await getMemberId(owner.client, owner.organizationId, worker.userId);
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente análisis");
    statusOpen = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    statusClosed = await getAnyStatusId(owner.client, owner.organizationId, { closed: true });
    unitId = await getSeedUnitId(owner.client, owner.organizationId, "m");
    supplierId = await createSupplier(owner.client, owner.organizationId);
  }, 90_000);

  async function newTypedJob(typeName: string, estimatedMinutes: number | undefined, closed = true) {
    counter += 1;
    return createTypedJob(owner.client, owner.organizationId, {
      clientId,
      statusId: closed ? statusClosed : statusOpen,
      title: `Trabajo análisis ${counter}`,
      jobTypeId: await getJobTypeId(owner.client, owner.organizationId, typeName),
      estimatedMinutes,
    });
  }

  async function timeRow(typeName: string) {
    const typeId = await getJobTypeId(owner.client, owner.organizationId, typeName);
    const { data, error } = await owner.client.from("job_type_time_performance").select("*").eq("job_type_id", typeId).maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? {
          closed: Number(data.closed_jobs_count),
          jobs: Number(data.jobs_count),
          estimated: Number(data.estimated_minutes_total),
          actual: Number(data.actual_minutes_total),
        }
      : null;
  }

  it("98 — desvío de tiempo ponderado por tipo: (34 h - 30 h) / 30 h = +13,33% (no el promedio 15%)", async () => {
    const type = "Instalación de tablero";
    const a = await newTypedJob(type, 10 * 60);
    await createSession(owner.client, a, { date: "2026-09-01", memberId, actual: { start: "08:00", end: "20:00" } }); // 12 h
    const b = await newTypedJob(type, 20 * 60);
    await createSession(owner.client, b, { date: "2026-09-02", memberId, actual: { start: "08:00", end: "19:00" } }); // 11 h
    await createSession(owner.client, b, { date: "2026-09-03", memberId, actual: { start: "08:00", end: "19:00" } }); // 11 h -> 22 h

    const row = await timeRow(type);
    expect(row).toEqual({ closed: 2, jobs: 2, estimated: 1_800, actual: 2_040 });
    const variance = ((row!.actual - row!.estimated) / row!.estimated) * 100;
    expect(variance).toBeCloseTo(13.3333, 3);
    const naiveAverage = (20 + 10) / 2;
    expect(variance).not.toBeCloseTo(naiveAverage, 1);
  });

  it("100 — solo trabajos cerrados; 101 — jobs_count refleja la muestra y excluye datos insuficientes", async () => {
    const type = "Reparación";
    const good = await newTypedJob(type, 120);
    await createSession(owner.client, good, { date: "2026-09-01", memberId, actual: { start: "08:00", end: "11:00" } });
    // abierto: no entra
    const open = await newTypedJob(type, 60, false);
    await createSession(owner.client, open, { date: "2026-09-02", memberId, actual: { start: "08:00", end: "18:00" } });
    // cerrado pero sin estimación: cuenta como cerrado, no como muestra
    const noEstimate = await newTypedJob(type, undefined);
    await createSession(owner.client, noEstimate, { date: "2026-09-03", memberId, actual: { start: "08:00", end: "10:00" } });
    // cerrado con sesión completada sin tiempo real: dato incompleto, fuera de la muestra
    const missingTime = await newTypedJob(type, 60);
    await createSession(owner.client, missingTime, { date: "2026-09-04", memberId, status: "completed" });
    // cerrado sin ninguna sesión con tiempo real
    await newTypedJob(type, 90);

    const row = await timeRow(type);
    expect(row).toEqual({ closed: 4, jobs: 1, estimated: 120, actual: 180 });
  });

  async function jobWithMaterialQuote(closed: boolean, opts: { estQty: number; estCost: number; buyQty: number; buyCost: number; consume: number; withHistory?: boolean }) {
    const typeName = "Trabajo de obra";
    const jobId = await newTypedJob(typeName, 60, closed);
    counter += 1;
    const materialId = await createMaterial(owner.client, owner.organizationId, { name: `Mat análisis ${counter}`, unitId });
    if (opts.withHistory) {
      await addStockMovement(owner.client, owner.organizationId, { materialId, movementType: "in", quantity: opts.buyQty });
    } else {
      await buy(owner.client, owner.organizationId, supplierId, materialId, opts.buyQty, opts.buyCost);
    }
    const jm = await addJobMaterial(owner.client, owner.organizationId, { jobId, materialId, estimatedQuantity: opts.estQty });
    const { data: quoteId } = await owner.client.rpc("create_quote", { p_job_id: jobId, p_client_id: clientId });
    await owner.client.from("quote_items").insert({
      organization_id: owner.organizationId,
      quote_id: quoteId!,
      item_type: "material",
      material_id: materialId,
      description: "Material",
      quantity: opts.estQty,
      unit: "m",
      cost_unit_price: opts.estCost,
      sale_unit_price: opts.estCost * 2,
    });
    await owner.client.from("quotes").update({ status: "sent" }).eq("id", quoteId!);
    await owner.client.from("quotes").update({ status: "accepted" }).eq("id", quoteId!);
    await registerConsumption(owner.client, jm, opts.consume);
    return jobId;
  }

  it("99 — desvío de materiales agregado: (52.000 - 46.000) / 46.000, solo cerrados con costo completo", async () => {
    await jobWithMaterialQuote(true, { estQty: 40, estCost: 900, buyQty: 40, buyCost: 1_000, consume: 40 }); // est 36.000 real 40.000
    await jobWithMaterialQuote(true, { estQty: 10, estCost: 1_000, buyQty: 10, buyCost: 1_200, consume: 10 }); // est 10.000 real 12.000
    await jobWithMaterialQuote(false, { estQty: 100, estCost: 1_000, buyQty: 100, buyCost: 5_000, consume: 100 }); // abierto: fuera
    await jobWithMaterialQuote(true, { estQty: 10, estCost: 1_000, buyQty: 10, buyCost: 0, consume: 10, withHistory: true }); // costo incompleto: fuera

    const typeId = await getJobTypeId(owner.client, owner.organizationId, "Trabajo de obra");
    const { data } = await owner.client.from("job_type_material_performance").select("*").eq("job_type_id", typeId).single();
    expect(Number(data?.jobs_count)).toBe(2);
    expect(Number(data?.estimated_material_cost_total)).toBe(46_000);
    expect(Number(data?.actual_material_cost_total)).toBe(52_000);
    const variance = ((52_000 - 46_000) / 46_000) * 100;
    expect(variance).toBeCloseTo(13.0435, 3);
  });

  it("66 — contribución por tipo: solo cerrados con datos completos, sumando contratado y costos", async () => {
    const typeName = "Visita / relevamiento";
    const categoryId = await getExpenseCategoryId(owner.client, owner.organizationId);
    const complete = await newTypedJob(typeName, 60);
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId: complete, clientId, total: 100_000 });
    await registerExpense(owner.client, { jobId: complete, categoryId, amount: 30_000 });
    const noQuote = await newTypedJob(typeName, 60); // sin cotización: no entra
    await registerExpense(owner.client, { jobId: noQuote, categoryId, amount: 5_000 });
    const openJob = await newTypedJob(typeName, 60, false); // abierto: no entra
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId: openJob, clientId, total: 50_000 });

    const typeId = await getJobTypeId(owner.client, owner.organizationId, typeName);
    const { data } = await owner.client.from("job_type_contribution").select("*").eq("job_type_id", typeId).single();
    expect(Number(data?.jobs_count)).toBe(1);
    expect(Number(data?.contracted_total)).toBe(100_000);
    expect(Number(data?.direct_cost_total)).toBe(30_000);
    expect(Number(data?.contribution_total)).toBe(70_000);
  });

  describe("carga real por día de la semana (zona de la organización, no UTC)", () => {
    const FROM = "2026-08-03"; // lunes
    const TO = "2026-09-27"; // domingo -> 56 días: cada día de la semana aparece 8 veces
    let workloadOrg: Ctx;

    beforeAll(async () => {
      workloadOrg = await createTestUserWithOrg("weekday");
      const worker = await createOrgMember(workloadOrg.client, workloadOrg.organizationId, "worker", "wd-w");
      const wm = await getMemberId(workloadOrg.client, workloadOrg.organizationId, worker.userId);
      const cId = await createTestClient(workloadOrg.client, workloadOrg.organizationId, "Cliente wd");
      const st = await getAnyStatusId(workloadOrg.client, workloadOrg.organizationId, { closed: false });
      const job = await createJob(workloadOrg.client, workloadOrg.organizationId, { clientId: cId, statusId: st, title: "Trabajo wd" });
      // viernes 18/09 22:30-23:30 local = sábado 01:30-02:30 UTC: debe contar como VIERNES (1 h)
      await createSession(workloadOrg.client, job, { date: "2026-09-18", memberId: wm, actual: { start: "22:30", end: "23:30" } });
      // viernes 11/09 08:00-17:00 (9 h)
      await createSession(workloadOrg.client, job, { date: "2026-09-11", memberId: wm, actual: { start: "08:00", end: "17:00" } });
      // lunes 14/09 08:00-10:00 (2 h)
      await createSession(workloadOrg.client, job, { date: "2026-09-14", memberId: wm, actual: { start: "08:00", end: "10:00" } });
      // fuera del período (domingo 02/08) y cancelada y sin tiempo real: no cuentan
      await createSession(workloadOrg.client, job, { date: "2026-08-02", memberId: wm, actual: { start: "08:00", end: "12:00" } });
      await createSession(workloadOrg.client, job, { date: "2026-09-15", memberId: wm, status: "cancelled", actual: { start: "08:00", end: "12:00" } });
      await createSession(workloadOrg.client, job, { date: "2026-09-16", memberId: wm });
    }, 90_000);

    async function workload(from: string, to: string) {
      const { data, error } = await workloadOrg.client.rpc("weekday_workload", {
        p_organization_id: workloadOrg.organizationId,
        p_from: from,
        p_to: to,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        weekday: r.weekday,
        total: Number(r.total_minutes),
        days: r.days_in_period,
        avg: Number(r.average_minutes),
      }));
    }

    it("agrupa por día local: la sesión de las 22:30 del viernes NO se cuenta como sábado", async () => {
      const rows = await workload(FROM, TO);
      expect(rows).toHaveLength(7);
      const friday = rows.find((r) => r.weekday === 5)!;
      const saturday = rows.find((r) => r.weekday === 6)!;
      expect(friday.total).toBe(600); // 1 h + 9 h
      expect(saturday.total).toBe(0);
    });

    it("el promedio divide por la cantidad de ese día de la semana en el período (los días sin trabajo cuentan como 0)", async () => {
      const rows = await workload(FROM, TO);
      for (const r of rows) expect(r.days).toBe(8);
      expect(rows.find((r) => r.weekday === 5)!.avg).toBeCloseTo(75, 6); // 600 min / 8 viernes
      expect(rows.find((r) => r.weekday === 1)!).toMatchObject({ total: 120, avg: 15 });
      expect(rows.find((r) => r.weekday === 0)!.total).toBe(0); // el domingo 02/08 queda fuera del período
    });

    it("períodos que no son múltiplos de 7 días usan el conteo real de cada día", async () => {
      const rows = await workload("2026-09-14", "2026-09-19"); // lunes a sábado, 1 vez cada uno
      expect(rows.find((r) => r.weekday === 0)).toBeUndefined();
      expect(rows.find((r) => r.weekday === 5)).toMatchObject({ days: 1, total: 60 });
    });

    it("otra organización no ve estas sesiones", async () => {
      const { data } = await owner.client.rpc("weekday_workload", { p_organization_id: workloadOrg.organizationId, p_from: FROM, p_to: TO });
      expect((data ?? []).every((r) => Number(r.total_minutes) === 0)).toBe(true);
    });
  });
});
