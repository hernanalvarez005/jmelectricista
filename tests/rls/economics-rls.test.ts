import { beforeAll, describe, expect, it } from "vitest";

import {
  createAcceptedQuote,
  createJob,
  createSession,
  createTestClient,
  getAnyStatusId,
  getExpenseCategoryId,
  getMemberId,
  registerExpense,
  setRate,
} from "../helpers/fixtures";
import { anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;
type Member = Awaited<ReturnType<typeof createOrgMember>>;

type Loose = { from: (t: string) => { select: (q: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } };

/** select * sobre una tabla/vista elegida en runtime (los tipos generados no aceptan uniones de relaciones). */
function selectAll(client: unknown, table: string) {
  return (client as Loose).from(table).select("*");
}

const SENSITIVE = [
  "member_labor_rates",
  "job_session_labor_costs",
  "job_labor_costs",
  "job_economics_status",
  "job_type_material_performance",
  "job_type_contribution",
] as const;

describe("RLS — mano de obra, costos y economía: solo owner/admin", () => {
  let a: Ctx;
  let admin: Member;
  let worker: Member;
  let viewer: Member;
  let b: Ctx;
  let jobA: string;
  let workerMemberId: string;
  let sessionA: string;
  let expenseA: string;

  beforeAll(async () => {
    a = await createTestUserWithOrg("econrls-a");
    b = await createTestUserWithOrg("econrls-b");
    admin = await createOrgMember(a.client, a.organizationId, "admin", "econrls-admin");
    worker = await createOrgMember(a.client, a.organizationId, "worker", "econrls-worker");
    viewer = await createOrgMember(a.client, a.organizationId, "viewer", "econrls-viewer");

    const clientId = await createTestClient(a.client, a.organizationId, "Cliente RLS");
    const statusId = await getAnyStatusId(a.client, a.organizationId, { closed: false });
    jobA = await createJob(a.client, a.organizationId, { clientId, statusId, title: "Trabajo RLS" });
    await createAcceptedQuote(a.client, a.organizationId, { jobId: jobA, clientId, total: 100_000 });
    workerMemberId = await getMemberId(a.client, a.organizationId, worker.userId);
    await setRate(a.client, workerMemberId, 12_000, "2026-01-01");
    sessionA = await createSession(a.client, jobA, { date: "2026-09-20", memberId: workerMemberId, actual: { start: "08:00", end: "10:00" } });
    expenseA = await registerExpense(a.client, { jobId: jobA, categoryId: await getExpenseCategoryId(a.client, a.organizationId), amount: 5_000 });
  }, 90_000);

  it("anon no ve nada de esto ni invoca los RPC de Fase 5", async () => {
    const anon = anonClient();
    for (const table of [...SENSITIVE, "job_expenses", "job_expense_categories", "job_type_time_performance"] as const) {
      const { data, error } = await selectAll(anon, table);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    const nil = "00000000-0000-0000-0000-000000000000";
    expect((await anon.rpc("set_member_labor_rate", { p_member_id: nil, p_hourly_cost: 1, p_valid_from: "2026-01-01" })).error).not.toBeNull();
    expect((await anon.rpc("register_job_expense", { p_job_id: nil, p_category_id: nil, p_expense_date: "2026-01-01", p_description: "x", p_amount: 1, p_client_request_id: nil })).error).not.toBeNull();
    expect((await anon.rpc("weekday_workload", { p_organization_id: nil, p_from: "2026-01-01", p_to: "2026-01-07" })).error).not.toBeNull();
    expect((await anon.rpc("backfill_session_labor_costs", { p_organization_id: nil })).error).not.toBeNull();
  });

  it("owner y admin leen tarifas, snapshots y vistas económicas", async () => {
    for (const who of [a, admin]) {
      const rates = await who.client.from("member_labor_rates").select("hourly_cost").eq("organization_member_id", workerMemberId);
      expect(rates.data?.map((r) => Number(r.hourly_cost))).toEqual([12_000]);
      const snap = await who.client.from("job_session_labor_costs").select("hourly_cost_snapshot").eq("job_session_id", sessionA);
      expect(snap.data?.map((r) => Number(r.hourly_cost_snapshot))).toEqual([12_000]);
      const econ = await who.client.from("job_economics_status").select("actual_labor_cost, contribution_amount").eq("job_id", jobA).single();
      expect(Number(econ.data?.actual_labor_cost)).toBe(24_000);
      expect(Number(econ.data?.contribution_amount)).toBe(71_000);
      const labor = await who.client.from("job_labor_costs").select("actual_labor_cost").eq("job_id", jobA).single();
      expect(Number(labor.data?.actual_labor_cost)).toBe(24_000);
    }
  });

  it("worker y viewer NO ven tarifas, snapshots, costo laboral, contribución ni análisis económico", async () => {
    for (const who of [worker, viewer]) {
      for (const table of SENSITIVE) {
        const { data, error } = await selectAll(who.client, table);
        expect(error, table).toBeNull();
        expect(data ?? [], `${table} (${who === worker ? "worker" : "viewer"})`).toHaveLength(0);
      }
    }
  });

  it("worker y viewer siguen viendo las sesiones y el tiempo, sin ningún campo de costo", async () => {
    for (const who of [worker, viewer]) {
      const { data } = await who.client.from("job_sessions").select("*").eq("id", sessionA).single();
      expect(data?.actual_start_at).not.toBeNull();
      expect(Object.keys(data ?? {}).some((k) => /cost|rate|hourly/i.test(k))).toBe(false);
    }
  });

  it("worker y viewer pueden leer el análisis operativo (tiempo y carga semanal), que no contiene costos", async () => {
    for (const who of [worker, viewer]) {
      const perf = await who.client.from("job_type_time_performance").select("*");
      expect(perf.error).toBeNull();
      const load = await who.client.rpc("weekday_workload", { p_organization_id: a.organizationId, p_from: "2026-09-14", p_to: "2026-09-20" });
      expect(load.error).toBeNull();
      expect(load.data?.length).toBe(7);
    }
  });

  it("worker y viewer no pueden ejecutar ninguna acción de administración laboral", async () => {
    for (const who of [worker, viewer]) {
      expect((await who.client.rpc("set_member_labor_rate", { p_member_id: workerMemberId, p_hourly_cost: 1, p_valid_from: "2027-01-01" })).error?.message).toMatch(/not authorized/);
      expect((await who.client.rpc("backfill_session_labor_costs", { p_organization_id: a.organizationId })).error?.message).toMatch(/not authorized/);
      expect((await who.client.rpc("reassign_session_member", { p_session_id: sessionA, p_member_id: workerMemberId })).error?.message).toMatch(/not authorized/);
      expect((await who.client.rpc("void_job_expense", { p_expense_id: expenseA, p_void_reason: "x" })).error?.message).toMatch(/not authorized/);
    }
  });

  it("no hay escritura directa sobre tarifas ni snapshots, ni siquiera para owner/admin", async () => {
    for (const who of [a, admin]) {
      const ins = await who.client.from("member_labor_rates").insert({
        organization_id: a.organizationId,
        organization_member_id: workerMemberId,
        hourly_cost: 1,
        valid_from: "2030-01-01",
      });
      expect(ins.error).not.toBeNull();
      const upd = await who.client.from("member_labor_rates").update({ hourly_cost: 1 }).eq("organization_member_id", workerMemberId).select("id");
      expect(upd.data ?? []).toHaveLength(0);
      const snapIns = await who.client.from("job_session_labor_costs").insert({
        organization_id: a.organizationId,
        job_session_id: sessionA,
        organization_member_id: workerMemberId,
        hourly_cost_snapshot: 1,
      });
      expect(snapIns.error).not.toBeNull();
      const snapUpd = await who.client.from("job_session_labor_costs").update({ hourly_cost_snapshot: 1 }).eq("job_session_id", sessionA).select("id");
      expect(snapUpd.data ?? []).toHaveLength(0);
    }
  });

  it("los gastos y categorías son visibles para todos los miembros (viewer solo lectura)", async () => {
    for (const who of [a, admin, worker, viewer]) {
      const exp = await who.client.from("job_expenses").select("id").eq("id", expenseA);
      expect(exp.data).toHaveLength(1);
      const cats = await who.client.from("job_expense_categories").select("id");
      expect((cats.data ?? []).length).toBeGreaterThanOrEqual(6);
    }
  });

  it("otra organización no ve nada de A (tarifas, snapshots, economía, gastos) ni puede administrarlo", async () => {
    for (const table of [...SENSITIVE, "job_expenses"] as const) {
      const { data } = await selectAll(b.client, table);
      const rows = (data ?? []) as { organization_id?: string }[];
      expect(rows.every((r) => r.organization_id !== a.organizationId), table).toBe(true);
    }
    expect((await b.client.rpc("set_member_labor_rate", { p_member_id: workerMemberId, p_hourly_cost: 1, p_valid_from: "2027-01-01" })).error?.message).toMatch(/not authorized/);
    expect((await b.client.rpc("backfill_session_labor_costs", { p_organization_id: a.organizationId })).error?.message).toMatch(/not authorized/);
    expect((await b.client.rpc("reassign_session_member", { p_session_id: sessionA, p_member_id: workerMemberId })).error?.message).toMatch(/not authorized/);
    const load = await b.client.rpc("weekday_workload", { p_organization_id: a.organizationId, p_from: "2026-09-14", p_to: "2026-09-20" });
    expect((load.data ?? []).every((r) => Number(r.total_minutes) === 0)).toBe(true);
  });
});

/**
 * Bucket privado `job-expense-receipts`, path
 * organizations/{org_id}/jobs/{job_id}/expenses/{client_request_id}/{filename}.
 */
describe("RLS — Storage del bucket de comprobantes de gastos", () => {
  let a: Ctx;
  let worker: Member;
  let viewer: Member;
  let outsider: Ctx;
  let path: string;
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71])]);

  beforeAll(async () => {
    a = await createTestUserWithOrg("expstorage-a");
    outsider = await createTestUserWithOrg("expstorage-b");
    worker = await createOrgMember(a.client, a.organizationId, "worker", "expstorage-w");
    viewer = await createOrgMember(a.client, a.organizationId, "viewer", "expstorage-v");
    path = `organizations/${a.organizationId}/jobs/test-job/expenses/${crypto.randomUUID()}/ticket.png`;
    const { error } = await a.client.storage.from("job-expense-receipts").upload(path, png(), { contentType: "image/png" });
    if (error) throw new Error(`No se pudo subir el comprobante: ${error.message}`);
  }, 90_000);

  it("owner y worker pueden subir; viewer no", async () => {
    const owner = await a.client.storage
      .from("job-expense-receipts")
      .upload(`organizations/${a.organizationId}/jobs/test-job/expenses/${crypto.randomUUID()}/o.png`, png(), { contentType: "image/png" });
    expect(owner.error).toBeNull();
    const w = await worker.client.storage
      .from("job-expense-receipts")
      .upload(`organizations/${a.organizationId}/jobs/test-job/expenses/${crypto.randomUUID()}/w.png`, png(), { contentType: "image/png" });
    expect(w.error).toBeNull();
    const v = await viewer.client.storage
      .from("job-expense-receipts")
      .upload(`organizations/${a.organizationId}/jobs/test-job/expenses/${crypto.randomUUID()}/v.png`, png(), { contentType: "image/png" });
    expect(v.error).not.toBeNull();
  });

  it("los miembros de la organización pueden generar una signed URL (incluido viewer)", async () => {
    for (const who of [a, worker, viewer]) {
      const { data, error } = await who.client.storage.from("job-expense-receipts").createSignedUrl(path, 60);
      expect(error).toBeNull();
      expect(data?.signedUrl).toBeTruthy();
    }
  });

  it("otra organización no puede leer, listar ni subir bajo el path ajeno", async () => {
    const signed = await outsider.client.storage.from("job-expense-receipts").createSignedUrl(path, 60);
    expect(signed.data).toBeNull();
    expect(signed.error).not.toBeNull();
    const list = await outsider.client.storage.from("job-expense-receipts").list(`organizations/${a.organizationId}/jobs/test-job/expenses`);
    expect(list.data ?? []).toEqual([]);
    const upload = await outsider.client.storage
      .from("job-expense-receipts")
      .upload(`organizations/${a.organizationId}/jobs/test-job/expenses/${crypto.randomUUID()}/x.png`, png(), { contentType: "image/png" });
    expect(upload.error).not.toBeNull();
  });

  it("anon no puede leer ni subir", async () => {
    const anon = anonClient();
    const signed = await anon.storage.from("job-expense-receipts").createSignedUrl(path, 60);
    expect(signed.data).toBeNull();
    expect(signed.error).not.toBeNull();
    const upload = await anon.storage.from("job-expense-receipts").upload(`organizations/${a.organizationId}/jobs/x/expenses/${crypto.randomUUID()}/a.png`, png(), { contentType: "image/png" });
    expect(upload.error).not.toBeNull();
  });
});
