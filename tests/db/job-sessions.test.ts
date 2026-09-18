import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { createJob, createTestClient, getAnyStatusId } from "../helpers/fixtures";
import { anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

function args(jobId: string, clientRequestId: string, extra: Record<string, unknown> = {}) {
  return {
    p_job_id: jobId,
    p_planned_start_at: "2026-09-18T11:00:00Z",
    p_planned_end_at: "2026-09-18T15:00:00Z",
    p_client_request_id: clientRequestId,
    ...extra,
  };
}

describe("create_job_session — idempotencia y validaciones", () => {
  let owner: Ctx;
  let jobId: string;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("sessions");
    const statusId = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    const clientId = await createTestClient(owner.client, owner.organizationId, "Cliente sesiones");
    jobId = await createJob(owner.client, owner.organizationId, { clientId, statusId, title: "Trabajo sesiones" });
  }, 60_000);

  async function count(id: string) {
    const { data } = await owner.client.from("job_sessions").select("id").eq("job_id", id);
    return data?.length ?? 0;
  }

  it("request simple crea una sesión", async () => {
    const { data, error } = await owner.client.rpc("create_job_session", args(jobId, randomUUID()));
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("el mismo client_request_id dos veces devuelve la misma sesión y no duplica", async () => {
    const job = await newJob();
    const rid = randomUUID();
    const a = await owner.client.rpc("create_job_session", args(job, rid));
    const b = await owner.client.rpc("create_job_session", args(job, rid));
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data).toBe(b.data);
    expect(await count(job)).toBe(1);
  });

  it("concurrencia: 5 requests simultáneos con el mismo id => exactamente 1 sesión y todos resuelven igual", async () => {
    const job = await newJob();
    const rid = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => owner.client.rpc("create_job_session", args(job, rid)))
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(new Set(results.map((r) => r.data)).size).toBe(1);
    expect(await count(job)).toBe(1);
  });

  it("requests con distinto client_request_id y mismo horario SÍ crean sesiones distintas (no hay unique de negocio)", async () => {
    const job = await newJob();
    await owner.client.rpc("create_job_session", args(job, randomUUID()));
    await owner.client.rpc("create_job_session", args(job, randomUUID()));
    expect(await count(job)).toBe(2);
  });

  it("rechaza fin <= inicio", async () => {
    const { error } = await owner.client.rpc(
      "create_job_session",
      args(jobId, randomUUID(), { p_planned_end_at: "2026-09-18T11:00:00Z" })
    );
    expect(error).not.toBeNull();
  });

  it("rechaza un miembro asignado de otra organización", async () => {
    const other = await createTestUserWithOrg("sessions-other");
    const { data: otherMember } = await other.client
      .from("organization_members")
      .select("id")
      .eq("organization_id", other.organizationId)
      .single();
    const { error } = await owner.client.rpc(
      "create_job_session",
      args(jobId, randomUUID(), { p_assigned_member_id: otherMember?.id })
    );
    expect(error).not.toBeNull();
  });

  it("cross-org: otro usuario no puede crear sesiones en mi trabajo", async () => {
    const other = await createTestUserWithOrg("sessions-cross");
    const { error } = await other.client.rpc("create_job_session", args(jobId, randomUUID()));
    expect(error).not.toBeNull();
  });

  it("anon no puede invocar create_job_session", async () => {
    const { error } = await anonClient().rpc("create_job_session", args(jobId, randomUUID()));
    expect(error).not.toBeNull();
  });

  it("viewer no puede crear sesiones; worker sí", async () => {
    const viewer = await createOrgMember(owner.client, owner.organizationId, "viewer", "sess-viewer");
    const worker = await createOrgMember(owner.client, owner.organizationId, "worker", "sess-worker");
    const v = await viewer.client.rpc("create_job_session", args(jobId, randomUUID()));
    expect(v.error).not.toBeNull();
    const w = await worker.client.rpc("create_job_session", args(jobId, randomUUID()));
    expect(w.error).toBeNull();
  });

  it("ya no existe INSERT directo sobre job_sessions (todo pasa por el RPC)", async () => {
    const { error } = await owner.client.from("job_sessions").insert({
      organization_id: owner.organizationId,
      job_id: jobId,
      planned_start_at: "2026-09-18T11:00:00Z",
      planned_end_at: "2026-09-18T12:00:00Z",
    });
    expect(error).not.toBeNull();
  });

  async function newJob() {
    const statusId = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    const clientId = await createTestClient(owner.client, owner.organizationId, `C ${randomUUID().slice(0, 6)}`);
    return createJob(owner.client, owner.organizationId, { clientId, statusId, title: `J ${randomUUID().slice(0, 6)}` });
  }
});
