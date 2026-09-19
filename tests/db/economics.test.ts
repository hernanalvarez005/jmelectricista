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
  getAnyStatusId,
  getEconomics,
  getExpenseCategoryId,
  getMemberId,
  getPaymentMethodId,
  getSeedUnitId,
  registerConsumption,
  registerExpense,
  registerPayment,
  setRate,
} from "../helpers/fixtures";
import { createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Economía del trabajo — costo directo y contribución", () => {
  let owner: Ctx;
  let clientId: string;
  let statusOpen: string;
  let statusClosed: string;
  let unitId: string;
  let supplierId: string;
  let categoryId: string;
  let memberId: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("econ");
    const worker = await createOrgMember(owner.client, owner.organizationId, "worker", "econ-w");
    memberId = await getMemberId(owner.client, owner.organizationId, worker.userId);
    await setRate(owner.client, memberId, 12_000, "2026-01-01");
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente econ");
    statusOpen = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    statusClosed = await getAnyStatusId(owner.client, owner.organizationId, { closed: true });
    unitId = await getSeedUnitId(owner.client, owner.organizationId, "m");
    supplierId = await createSupplier(owner.client, owner.organizationId);
    categoryId = await getExpenseCategoryId(owner.client, owner.organizationId);
  }, 90_000);

  async function newJob(closed = false) {
    counter += 1;
    return createJob(owner.client, owner.organizationId, {
      clientId,
      statusId: closed ? statusClosed : statusOpen,
      title: `Trabajo econ ${counter}`,
    });
  }

  /** Consume `qty` de un material recién comprado a `unitCost`: costo real de materiales = qty * unitCost. */
  async function consumeMaterial(jobId: string, qty: number, unitCost: number) {
    counter += 1;
    const materialId = await createMaterial(owner.client, owner.organizationId, { name: `Cable econ ${counter}`, unitId });
    await buy(owner.client, owner.organizationId, supplierId, materialId, qty, unitCost);
    const jobMaterialId = await addJobMaterial(owner.client, owner.organizationId, { jobId, materialId, estimatedQuantity: qty });
    await registerConsumption(owner.client, jobMaterialId, qty);
  }

  it("93 — caso completo: 850.000 - (315.000 + 180.000 + 40.000) = 315.000 (37,06%)", async () => {
    const jobId = await newJob(true);
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 850_000 });
    await consumeMaterial(jobId, 315, 1_000); // materiales reales 315.000
    await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "16:00" } }); // 8 h
    await createSession(owner.client, jobId, { date: "2026-09-21", memberId, actual: { start: "08:00", end: "15:00" } }); // 7 h -> 15 h = 180.000
    await registerExpense(owner.client, { jobId, categoryId, amount: 25_000 });
    await registerExpense(owner.client, { jobId, categoryId, amount: 15_000 });

    const e = await getEconomics(owner.client, jobId);
    expect(e).toMatchObject({
      isClosed: true,
      contracted: 850_000,
      materialActual: 315_000,
      materialComplete: true,
      labor: 180_000,
      laborComplete: true,
      expenses: 40_000,
      recorded: 535_000,
      dataComplete: true,
      directCost: 535_000,
      contribution: 315_000,
    });
    expect(e.contributionPct).toBeCloseTo(37.0588, 3);
  });

  it("los gastos anulados no entran en el costo directo ni en la contribución", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 100_000 });
    await registerExpense(owner.client, { jobId, categoryId, amount: 10_000 });
    const voided = await registerExpense(owner.client, { jobId, categoryId, amount: 30_000 });
    await owner.client.rpc("void_job_expense", { p_expense_id: voided, p_void_reason: "duplicado" });
    expect(await getEconomics(owner.client, jobId)).toMatchObject({ expenses: 10_000, directCost: 10_000, contribution: 90_000 });
  });

  it("94 — costo de materiales incompleto: no hay contribución definitiva", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 500_000 });
    // stock histórico sin valoración: el consumo queda sin costo
    counter += 1;
    const materialId = await createMaterial(owner.client, owner.organizationId, { name: `Histórico ${counter}`, unitId });
    await addStockMovement(owner.client, owner.organizationId, { materialId, movementType: "in", quantity: 50 });
    const jm = await addJobMaterial(owner.client, owner.organizationId, { jobId, materialId, estimatedQuantity: 20 });
    await registerConsumption(owner.client, jm, 20);
    await registerExpense(owner.client, { jobId, categoryId, amount: 10_000 });

    const e = await getEconomics(owner.client, jobId);
    expect(e).toMatchObject({ materialComplete: false, dataComplete: false, directCost: null, contribution: null, contributionPct: null });
    expect(e.recorded).toBe(10_000); // lo registrado hasta ahora sigue visible, marcado como parcial
  });

  it("95 — costo laboral incompleto (sesión sin tarifa): contribución no calculable", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 500_000 });
    const noRate = await createOrgMember(owner.client, owner.organizationId, "worker", "econ-norate");
    const noRateMember = await getMemberId(owner.client, owner.organizationId, noRate.userId);
    await createSession(owner.client, jobId, { date: "2026-09-20", memberId: noRateMember, actual: { start: "08:00", end: "10:00" } });

    const e = await getEconomics(owner.client, jobId);
    expect(e).toMatchObject({ laborComplete: false, dataComplete: false, contribution: null, directCost: null });
  });

  it("96 — sin cotización aceptada: los costos se ven pero no hay contribución", async () => {
    const jobId = await newJob();
    await registerExpense(owner.client, { jobId, categoryId, amount: 12_000 });
    const e = await getEconomics(owner.client, jobId);
    expect(e).toMatchObject({ contracted: null, expenses: 12_000, recorded: 12_000, dataComplete: true, directCost: 12_000, contribution: null, contributionPct: null });
  });

  it("97 — sobrecobro: la contribución se calcula sobre lo contratado, no sobre lo cobrado", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 100_000 });
    await registerExpense(owner.client, { jobId, categoryId, amount: 40_000 });
    await registerPayment(owner.client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 150_000,
      paymentMethodId: await getPaymentMethodId(owner.client, owner.organizationId),
      clientRequestId: crypto.randomUUID(),
    });
    const e = await getEconomics(owner.client, jobId);
    expect(e.collected).toBe(150_000);
    expect(e).toMatchObject({ contracted: 100_000, contribution: 60_000 });
    expect(e.contributionPct).toBeCloseTo(60, 6);
  });

  it("sin costos: contribución = contratado (100%) y trabajo abierto igual se calcula como acumulada", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 80_000 });
    const e = await getEconomics(owner.client, jobId);
    expect(e).toMatchObject({ isClosed: false, dataComplete: true, directCost: 0, contribution: 80_000 });
    expect(e.contributionPct).toBeCloseTo(100, 6);
  });

  it("contribución negativa cuando los costos superan lo contratado", async () => {
    const jobId = await newJob();
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 10_000 });
    await registerExpense(owner.client, { jobId, categoryId, amount: 25_000 });
    const e = await getEconomics(owner.client, jobId);
    expect(e.contribution).toBe(-15_000);
    expect(e.contributionPct).toBeCloseTo(-150, 6);
  });
});
