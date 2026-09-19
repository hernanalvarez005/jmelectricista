import { beforeAll, describe, expect, it } from "vitest";

import {
  createJob,
  createSession,
  createTestClient,
  getAnyStatusId,
  getLaborCosts,
  getMemberId,
  getSessionSnapshot,
  listRates,
  setRate,
  updateActualTime,
} from "../helpers/fixtures";
import { adminClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Costo laboral por sesión — tarifa vigente, snapshot y completitud", () => {
  let owner: Ctx;
  let clientId: string;
  let statusOpen: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("labor");
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente labor");
    statusOpen = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
  }, 90_000);

  async function newJob() {
    counter += 1;
    return createJob(owner.client, owner.organizationId, { clientId, statusId: statusOpen, title: `Trabajo labor ${counter}` });
  }

  async function newMember(role: "worker" | "admin" = "worker") {
    counter += 1;
    const m = await createOrgMember(owner.client, owner.organizationId, role, `labor-${counter}`);
    return { ...m, memberId: await getMemberId(owner.client, owner.organizationId, m.userId) };
  }

  it("82 — tarifa simple: 7 h reales a $12.000/h = $84.000", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 12_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "15:00" } });

    expect(await getSessionSnapshot(owner.client, sessionId)).toMatchObject({ hourly_cost_snapshot: 12_000 });
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ minutes: 420, cost: 84_000, complete: true, sessions: 1 });
  });

  it("83 — cambio de tarifa: 20/09 a $10.000/h y 10/10 a $12.000/h", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    await setRate(owner.client, memberId, 12_000, "2026-10-01");
    const s1 = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "10:00" } });
    const s2 = await createSession(owner.client, jobId, { date: "2026-10-10", memberId, actual: { start: "08:00", end: "10:00" } });

    expect((await getSessionSnapshot(owner.client, s1))?.hourly_cost_snapshot).toBe(10_000);
    expect((await getSessionSnapshot(owner.client, s2))?.hourly_cost_snapshot).toBe(12_000);
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ cost: 44_000, minutes: 240, complete: true });
  });

  it("84 — snapshot histórico: una tarifa posterior no reprecifica una sesión ya valorizada", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "10:00" } });
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(20_000);

    await setRate(owner.client, memberId, 15_000, "2026-09-25");
    await setRate(owner.client, memberId, 18_000, "2026-11-01");

    expect((await getSessionSnapshot(owner.client, sessionId))?.hourly_cost_snapshot).toBe(10_000);
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(20_000);
    // la tarifa histórica sigue existiendo con su vigencia original recortada, no modificada en su valor
    expect((await listRates(owner.client, memberId))[0]).toMatchObject({ hourly_cost: 10_000, valid_to: "2026-09-24" });
  });

  it("85 — corregir el tiempo real recalcula con el MISMO snapshot", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 12_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "15:00" } });
    const before = await getSessionSnapshot(owner.client, sessionId);
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(84_000);

    await updateActualTime(owner.client, sessionId, "2026-09-20", "08:00", "16:00");
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(96_000);

    // aunque cambie la tarifa vigente, la corrección sigue usando el snapshot
    await setRate(owner.client, memberId, 20_000, "2026-09-01");
    await updateActualTime(owner.client, sessionId, "2026-09-20", "08:00", "17:00");
    const after = await getSessionSnapshot(owner.client, sessionId);
    expect(after).toMatchObject({ id: before?.id, hourly_cost_snapshot: 12_000 });
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(108_000);
  });

  it("guardar/corregir el tiempo varias veces no crea más de un snapshot por sesión", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 12_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "09:00" } });
    await Promise.all([
      updateActualTime(owner.client, sessionId, "2026-09-20", "08:00", "10:00"),
      updateActualTime(owner.client, sessionId, "2026-09-20", "08:00", "11:00"),
      updateActualTime(owner.client, sessionId, "2026-09-20", "08:00", "12:00"),
    ]);
    const { count } = await adminClient()
      .from("job_session_labor_costs")
      .select("id", { count: "exact", head: true })
      .eq("job_session_id", sessionId);
    expect(count).toBe(1);
  });

  it("86 — sin tarifa vigente: costo incompleto, no $0 ni tarifa futura/actual", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    // solo existe una tarifa FUTURA: no debe usarse para una sesión anterior
    await setRate(owner.client, memberId, 12_000, "2026-11-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "10:00" } });

    expect(await getSessionSnapshot(owner.client, sessionId)).toBeNull();
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ complete: false, missingRate: 1, missingMember: 0, missingTime: 0, minutes: 120, cost: 0 });
  });

  it("87 — tarifa 0 explícita: costo 0 pero COMPLETO (distinto de tarifa desconocida)", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 0, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "12:00" } });

    expect(await getSessionSnapshot(owner.client, sessionId)).toMatchObject({ hourly_cost_snapshot: 0 });
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ cost: 0, complete: true, minutes: 240 });
  });

  it("sin responsable: no se puede determinar el costo -> incompleto (no $0)", async () => {
    const jobId = await newJob();
    await createSession(owner.client, jobId, { date: "2026-09-20", actual: { start: "08:00", end: "10:00" } });
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ complete: false, missingMember: 1, cost: 0 });
  });

  it("sesión completada sin tiempo real: incompleto; programada o cancelada no cuentan", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 12_000, "2026-01-01");
    await createSession(owner.client, jobId, { date: "2026-09-21", memberId }); // programada, sin tiempo
    await createSession(owner.client, jobId, { date: "2026-09-22", memberId, status: "cancelled", actual: { start: "08:00", end: "10:00" } });
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ sessions: 0, complete: true, cost: 0, minutes: 0 });

    await createSession(owner.client, jobId, { date: "2026-09-20", memberId, status: "completed" }); // completada sin tiempo
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ complete: false, missingTime: 1, sessions: 1 });
  });

  it("la fecha efectiva es la LOCAL de la organización (22:00 del 30/09 local = 01:00Z del 01/10)", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    await setRate(owner.client, memberId, 12_000, "2026-10-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-30", memberId, actual: { start: "22:00", end: "23:00" } });
    expect((await getSessionSnapshot(owner.client, sessionId))?.hourly_cost_snapshot).toBe(10_000);
  });

  it("asignar responsable a una sesión que no tenía crea el snapshot; cambiarlo después queda bloqueado", async () => {
    const jobId = await newJob();
    const a = await newMember();
    const b = await newMember();
    await setRate(owner.client, a.memberId, 12_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", actual: { start: "08:00", end: "10:00" } });
    expect(await getSessionSnapshot(owner.client, sessionId)).toBeNull();

    const assign = await owner.client.from("job_sessions").update({ assigned_member_id: a.memberId }).eq("id", sessionId);
    expect(assign.error).toBeNull();
    expect((await getSessionSnapshot(owner.client, sessionId))?.hourly_cost_snapshot).toBe(12_000);

    const change = await owner.client.from("job_sessions").update({ assigned_member_id: b.memberId }).eq("id", sessionId);
    expect(change.error?.message).toMatch(/responsable_bloqueado/);
    expect((await getSessionSnapshot(owner.client, sessionId))?.organization_member_id).toBe(a.memberId);
  });

  it("una sesión programada sin tiempo real sí permite cambiar de responsable", async () => {
    const jobId = await newJob();
    const a = await newMember();
    const b = await newMember();
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-25", memberId: a.memberId });
    const change = await owner.client.from("job_sessions").update({ assigned_member_id: b.memberId }).eq("id", sessionId);
    expect(change.error).toBeNull();
  });

  it("reassign_session_member (admin): reemplaza el snapshot con la tarifa histórica del nuevo responsable", async () => {
    const jobId = await newJob();
    const a = await newMember();
    const b = await newMember();
    const worker = await newMember();
    await setRate(owner.client, a.memberId, 10_000, "2026-01-01");
    await setRate(owner.client, b.memberId, 15_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId: a.memberId, actual: { start: "08:00", end: "10:00" } });
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(20_000);

    const denied = await worker.client.rpc("reassign_session_member", { p_session_id: sessionId, p_member_id: b.memberId });
    expect(denied.error?.message).toMatch(/not authorized/);

    const { data, error } = await owner.client.rpc("reassign_session_member", { p_session_id: sessionId, p_member_id: b.memberId });
    expect(error).toBeNull();
    expect(data).toBe("costed");
    expect(await getSessionSnapshot(owner.client, sessionId)).toMatchObject({ hourly_cost_snapshot: 15_000, organization_member_id: b.memberId });
    expect((await getLaborCosts(owner.client, jobId)).cost).toBe(30_000);
  });

  it("reassign a alguien sin tarifa deja la sesión sin costo (no reutiliza el snapshot anterior)", async () => {
    const jobId = await newJob();
    const a = await newMember();
    const noRate = await newMember();
    await setRate(owner.client, a.memberId, 10_000, "2026-01-01");
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20", memberId: a.memberId, actual: { start: "08:00", end: "10:00" } });
    const { data } = await owner.client.rpc("reassign_session_member", { p_session_id: sessionId, p_member_id: noRate.memberId });
    expect(data).toBe("no_rate");
    expect(await getSessionSnapshot(owner.client, sessionId)).toBeNull();
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ complete: false, missingRate: 1 });
  });

  it("107 — backfill: valoriza sesiones históricas sin snapshot y nunca toca los existentes", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    const old = await createSession(owner.client, jobId, { date: "2026-03-10", memberId, actual: { start: "08:00", end: "10:00" } });
    expect(await getSessionSnapshot(owner.client, old)).toBeNull();
    expect((await getLaborCosts(owner.client, jobId)).complete).toBe(false);

    await setRate(owner.client, memberId, 9_000, "2026-01-01");
    // cargar la tarifa NO valoriza solo: hace falta la acción explícita
    expect(await getSessionSnapshot(owner.client, old)).toBeNull();

    const first = await owner.client.rpc("backfill_session_labor_costs", { p_organization_id: owner.organizationId, p_member_id: memberId });
    expect(first.data).toBe(1);
    expect(await getSessionSnapshot(owner.client, old)).toMatchObject({ hourly_cost_snapshot: 9_000 });
    expect(await getLaborCosts(owner.client, jobId)).toMatchObject({ complete: true, cost: 18_000 });

    // una tarifa distinta posterior + segunda ejecución: 0 sesiones, snapshot intacto
    await setRate(owner.client, memberId, 20_000, "2026-03-01");
    const second = await owner.client.rpc("backfill_session_labor_costs", { p_organization_id: owner.organizationId, p_member_id: memberId });
    expect(second.data).toBe(0);
    expect((await getSessionSnapshot(owner.client, old))?.hourly_cost_snapshot).toBe(9_000);
  });

  it("backfill solo lo ejecuta owner/admin", async () => {
    const worker = await newMember();
    const { error } = await worker.client.rpc("backfill_session_labor_costs", { p_organization_id: owner.organizationId });
    expect(error?.message).toMatch(/not authorized/);
  });

  it("no se elimina una tarifa ya usada en un snapshot", async () => {
    const jobId = await newJob();
    const { memberId } = await newMember();
    const rateId = await setRate(owner.client, memberId, 12_000, "2026-01-01");
    await createSession(owner.client, jobId, { date: "2026-09-20", memberId, actual: { start: "08:00", end: "10:00" } });
    const { error } = await owner.client.rpc("delete_member_labor_rate", { p_rate_id: rateId });
    expect(error?.message).toMatch(/tarifa_en_uso/);
  });

  it("integridad cross-org del snapshot: miembro de otra organización rechazado", async () => {
    const jobId = await newJob();
    const other = await createTestUserWithOrg("labor-x");
    const otherMember = await getMemberId(other.client, other.organizationId, other.userId);
    const sessionId = await createSession(owner.client, jobId, { date: "2026-09-20" });
    const { error } = await adminClient().from("job_session_labor_costs").insert({
      organization_id: owner.organizationId,
      job_session_id: sessionId,
      organization_member_id: otherMember,
      hourly_cost_snapshot: 100,
    });
    expect(error?.message).toMatch(/no pertenece/);
  });
});
