import { beforeAll, describe, expect, it } from "vitest";

import {
  createJob,
  createTestClient,
  getAnyStatusId,
  getEconomics,
  getExpenseCategoryId,
  registerExpense,
} from "../helpers/fixtures";
import { adminClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Gastos directos — registro idempotente, anulación e inmutabilidad", () => {
  let owner: Ctx;
  let worker: Awaited<ReturnType<typeof createOrgMember>>;
  let viewer: Awaited<ReturnType<typeof createOrgMember>>;
  let clientId: string;
  let statusOpen: string;
  let categoryId: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("expenses");
    worker = await createOrgMember(owner.client, owner.organizationId, "worker", "exp-worker");
    viewer = await createOrgMember(owner.client, owner.organizationId, "viewer", "exp-viewer");
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente gastos");
    statusOpen = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    categoryId = await getExpenseCategoryId(owner.client, owner.organizationId, "Alquiler");
  }, 90_000);

  async function newJob() {
    counter += 1;
    return createJob(owner.client, owner.organizationId, { clientId, statusId: statusOpen, title: `Trabajo gastos ${counter}` });
  }

  async function expenseTotal(jobId: string) {
    return (await getEconomics(owner.client, jobId)).expenses;
  }

  it("las categorías por defecto se crean con la organización y son configurables", async () => {
    const { data } = await owner.client
      .from("job_expense_categories")
      .select("name, active")
      .eq("organization_id", owner.organizationId)
      .order("sort_order");
    expect((data ?? []).map((c) => c.name)).toEqual([
      "Traslado",
      "Peaje / estacionamiento",
      "Alquiler",
      "Viáticos",
      "Subcontratación",
      "Otro",
    ]);
    const created = await owner.client
      .from("job_expense_categories")
      .insert({ organization_id: owner.organizationId, name: "Flete especial", sort_order: 70 });
    expect(created.error).toBeNull();
    const dup = await owner.client
      .from("job_expense_categories")
      .insert({ organization_id: owner.organizationId, name: "Flete especial", sort_order: 71 });
    expect(dup.error?.code).toBe("23505");
    const asWorker = await worker.client
      .from("job_expense_categories")
      .insert({ organization_id: owner.organizationId, name: "Cat worker", sort_order: 80 });
    expect(asWorker.error).not.toBeNull();
  });

  it("89 — gasto simple: suma al total de gastos directos del trabajo", async () => {
    const jobId = await newJob();
    await registerExpense(owner.client, { jobId, categoryId, amount: 20_000 });
    expect(await expenseTotal(jobId)).toBe(20_000);
  });

  it("90 — mismo client_request_id: un solo gasto (secuencial y concurrente)", async () => {
    const jobId = await newJob();
    const requestId = crypto.randomUUID();
    const first = await registerExpense(owner.client, { jobId, categoryId, amount: 20_000, clientRequestId: requestId });
    const second = await registerExpense(owner.client, { jobId, categoryId, amount: 20_000, clientRequestId: requestId });
    expect(second).toBe(first);

    const concurrentId = crypto.randomUUID();
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => registerExpense(owner.client, { jobId, categoryId, amount: 5_000, clientRequestId: concurrentId }))
    );
    expect(new Set(ids).size).toBe(1);
    expect(await expenseTotal(jobId)).toBe(25_000);
  });

  it("91 — anular: el total baja a 0, el registro sigue existiendo y queda auditado", async () => {
    const jobId = await newJob();
    const id = await registerExpense(owner.client, { jobId, categoryId, amount: 20_000 });
    const { error } = await owner.client.rpc("void_job_expense", { p_expense_id: id, p_void_reason: "Cargado en el trabajo equivocado" });
    expect(error).toBeNull();

    expect(await expenseTotal(jobId)).toBe(0);
    const { data } = await owner.client.from("job_expenses").select("voided_at, voided_by, void_reason, amount").eq("id", id).single();
    expect(data?.voided_at).not.toBeNull();
    expect(data?.voided_by).toBe(owner.userId);
    expect(data?.void_reason).toBe("Cargado en el trabajo equivocado");
    expect(Number(data?.amount)).toBe(20_000);

    const again = await owner.client.rpc("void_job_expense", { p_expense_id: id, p_void_reason: "otra vez" });
    expect(again.error?.message).toMatch(/ya fue anulado/);
  });

  it("anular exige motivo y rol owner/admin", async () => {
    const jobId = await newJob();
    const id = await registerExpense(worker.client, { jobId, categoryId, amount: 1_000 });
    const noReason = await owner.client.rpc("void_job_expense", { p_expense_id: id, p_void_reason: "  " });
    expect(noReason.error?.message).toMatch(/motivo/);
    const asWorker = await worker.client.rpc("void_job_expense", { p_expense_id: id, p_void_reason: "x" });
    expect(asWorker.error?.message).toMatch(/not authorized/);
    const asViewer = await viewer.client.rpc("void_job_expense", { p_expense_id: id, p_void_reason: "x" });
    expect(asViewer.error?.message).toMatch(/not authorized/);
  });

  it("worker puede registrar; viewer no; importe y descripción inválidos se rechazan", async () => {
    const jobId = await newJob();
    await expect(registerExpense(worker.client, { jobId, categoryId, amount: 3_000 })).resolves.toBeTruthy();
    await expect(registerExpense(viewer.client, { jobId, categoryId, amount: 3_000 })).rejects.toThrow(/not authorized/);
    await expect(registerExpense(owner.client, { jobId, categoryId, amount: 0 })).rejects.toThrow(/mayor a 0/);
    await expect(registerExpense(owner.client, { jobId, categoryId, amount: -5 })).rejects.toThrow(/mayor a 0/);
    await expect(registerExpense(owner.client, { jobId, categoryId, amount: 5, description: "   " })).rejects.toThrow(/descripción/);
  });

  it("inmutable: no hay UPDATE/DELETE por la API y el trigger bloquea editar o borrar aun con service role", async () => {
    const jobId = await newJob();
    const id = await registerExpense(owner.client, { jobId, categoryId, amount: 10_000 });

    const viaApi = await owner.client.from("job_expenses").update({ amount: 1 }).eq("id", id).select("id");
    expect(viaApi.data ?? []).toHaveLength(0);
    const delApi = await owner.client.from("job_expenses").delete().eq("id", id).select("id");
    expect(delApi.data ?? []).toHaveLength(0);

    const edit = await adminClient().from("job_expenses").update({ amount: 1 }).eq("id", id);
    expect(edit.error?.message).toMatch(/no se edita/);
    const del = await adminClient().from("job_expenses").delete().eq("id", id);
    expect(del.error?.message).toMatch(/no se elimina/);
    expect(await expenseTotal(jobId)).toBe(10_000);
  });

  it("92 — cross-org: categoría de otra organización, trabajo ajeno y anulación ajena se rechazan", async () => {
    const jobId = await newJob();
    const other = await createTestUserWithOrg("exp-other");
    const otherCategory = await getExpenseCategoryId(other.client, other.organizationId, "Alquiler");
    const otherClient = await createTestClient(other.client, other.organizationId, "Cliente B");
    const otherJob = await createJob(other.client, other.organizationId, {
      clientId: otherClient,
      statusId: await getAnyStatusId(other.client, other.organizationId, { closed: false }),
      title: "Trabajo B",
    });
    const otherExpense = await registerExpense(other.client, { jobId: otherJob, categoryId: otherCategory, amount: 100 });

    await expect(registerExpense(owner.client, { jobId, categoryId: otherCategory, amount: 100 })).rejects.toThrow(/no pertenece/);
    await expect(registerExpense(owner.client, { jobId: otherJob, categoryId, amount: 100 })).rejects.toThrow(/not authorized/);
    const voidOther = await owner.client.rpc("void_job_expense", { p_expense_id: otherExpense, p_void_reason: "x" });
    expect(voidOther.error?.message).toMatch(/not authorized/);
    const read = await owner.client.from("job_expenses").select("id").eq("id", otherExpense);
    expect(read.data ?? []).toHaveLength(0);
  });

  it("integridad DB: el trigger rechaza categoría de otra organización aunque se escriba directo", async () => {
    const jobId = await newJob();
    const other = await createTestUserWithOrg("exp-direct");
    const otherCategory = await getExpenseCategoryId(other.client, other.organizationId, "Alquiler");
    const { error } = await adminClient().from("job_expenses").insert({
      organization_id: owner.organizationId,
      job_id: jobId,
      category_id: otherCategory,
      expense_date: "2026-09-20",
      description: "x",
      amount: 10,
      client_request_id: crypto.randomUUID(),
    });
    expect(error?.message).toMatch(/no pertenece/);
  });
});
