import { beforeAll, describe, expect, it } from "vitest";

import {
  createAcceptedQuote,
  createJob,
  createTestClient,
  getAnyStatusId,
  getJobFinancialStatus,
  getPaymentMethodId,
  markInvoiced,
  registerPayment,
  selectSome,
} from "../helpers/fixtures";
import { adminClient, anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;
type Member = Awaited<ReturnType<typeof createOrgMember>>;

describe("Facturación — estado independiente del trabajo y del cobro", () => {
  let owner: Ctx;
  let admin: Member;
  let worker: Member;
  let viewer: Member;
  let clientId: string;
  let statusOpen: string;
  let methodId: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("billing");
    admin = await createOrgMember(owner.client, owner.organizationId, "admin", "bill-admin");
    worker = await createOrgMember(owner.client, owner.organizationId, "worker", "bill-worker");
    viewer = await createOrgMember(owner.client, owner.organizationId, "viewer", "bill-viewer");
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente facturación");
    statusOpen = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    methodId = await getPaymentMethodId(owner.client, owner.organizationId);
  }, 90_000);

  async function newJob(opts: { contracted?: number; paid?: number } = {}) {
    counter += 1;
    const jobId = await createJob(owner.client, owner.organizationId, { clientId, statusId: statusOpen, title: `Trabajo facturación ${counter}` });
    if (opts.contracted) await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: opts.contracted });
    if (opts.paid) {
      await registerPayment(owner.client, {
        jobId,
        paymentDate: "2026-09-19",
        amount: opts.paid,
        paymentMethodId: methodId,
        clientRequestId: crypto.randomUUID(),
      });
    }
    return jobId;
  }

  async function billing(jobId: string, client = owner.client) {
    const { data, error } = await client.from("job_billing_status").select("*").eq("job_id", jobId).single();
    if (error || !data) throw new Error(`job_billing_status: ${error?.message}`);
    return data;
  }

  async function jobStatusId(jobId: string) {
    const { data } = await owner.client.from("jobs").select("status_id").eq("id", jobId).single();
    return data?.status_id;
  }

  async function quoteStatus(jobId: string) {
    const { data } = await owner.client.from("quotes").select("status").eq("job_id", jobId);
    return (data ?? []).map((q) => q.status);
  }

  it("75 — un trabajo sin registro de facturación es 'pending' (no se crea fila hasta facturar)", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    expect(await billing(jobId)).toMatchObject({ billing_status: "pending", invoiced_at: null, invoice_number: null });
    const { count } = await adminClient().from("job_billing").select("id", { count: "exact", head: true }).eq("job_id", jobId);
    expect(count).toBe(0);
  });

  it("76 — marcar como facturado: estado, fecha, número y observaciones", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    await markInvoiced(owner.client, jobId, { date: "2026-09-19", number: "00003-00001234", notes: "Factura C" });
    expect(await billing(jobId)).toMatchObject({
      billing_status: "invoiced",
      invoiced_at: "2026-09-19", // date-only: sin corrimiento por zona horaria
      invoice_number: "00003-00001234",
      billing_notes: "Factura C",
    });
  });

  it("77 — independencia: cobrado completo + pendiente de facturar es válido, y facturar no cambia trabajo/cobro/cotización", async () => {
    const jobId = await newJob({ contracted: 850_000, paid: 850_000 });
    const before = { status: await jobStatusId(jobId), fin: await getJobFinancialStatus(owner.client, jobId), quotes: await quoteStatus(jobId) };
    expect(before.fin.payment_status).toBe("paid");
    expect(await billing(jobId)).toMatchObject({ billing_status: "pending", is_billable: true }); // Caso A

    await markInvoiced(owner.client, jobId, { number: "0001-00000001" });
    const after = { status: await jobStatusId(jobId), fin: await getJobFinancialStatus(owner.client, jobId), quotes: await quoteStatus(jobId) };
    expect(after).toEqual(before);
    expect(after.fin.outstanding_amount).toBe(0);
  });

  it("77 — Caso B: cobro parcial + facturado, con saldo pendiente (no es una inconsistencia)", async () => {
    const jobId = await newJob({ contracted: 850_000, paid: 300_000 });
    await markInvoiced(owner.client, jobId);
    const fin = await getJobFinancialStatus(owner.client, jobId);
    expect(fin).toMatchObject({ payment_status: "partial", outstanding_amount: 550_000 });
    expect(await billing(jobId)).toMatchObject({ billing_status: "invoiced" });
  });

  it("77 — Caso C: sin cobros + facturado también es válido", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    await markInvoiced(owner.client, jobId);
    expect(await getJobFinancialStatus(owner.client, jobId)).toMatchObject({ payment_status: "unpaid" });
    expect(await billing(jobId)).toMatchObject({ billing_status: "invoiced" });
  });

  it("78 — historial: facturar, corregir y revertir quedan registrados y el historial es inmutable", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    await markInvoiced(owner.client, jobId, { date: "2026-09-19", number: "0001-00000010" });
    await markInvoiced(owner.client, jobId, { date: "2026-09-20", number: "0001-00000011", notes: "Número corregido" });
    const { error } = await owner.client.rpc("revert_job_billing", { p_job_id: jobId, p_notes: "Se anuló la factura" });
    expect(error).toBeNull();

    const { data: history } = await owner.client
      .from("job_billing_history")
      .select("from_status, to_status, invoice_number, invoiced_at, notes, changed_by")
      .eq("job_id", jobId)
      .order("changed_at", { ascending: true });
    expect(history?.map((h) => `${h.from_status}->${h.to_status}`)).toEqual(["pending->invoiced", "invoiced->invoiced", "invoiced->pending"]);
    expect(history?.[2]).toMatchObject({ invoice_number: "0001-00000011", invoiced_at: "2026-09-20", notes: "Se anuló la factura", changed_by: owner.userId });

    expect(await billing(jobId)).toMatchObject({ billing_status: "pending", invoiced_at: null, invoice_number: null });

    // auditoría: ni con service role se edita o borra
    const upd = await adminClient().from("job_billing_history").update({ notes: "x" }).eq("job_id", jobId);
    expect(upd.error?.message).toMatch(/no se edita ni se elimina/);
    const del = await adminClient().from("job_billing_history").delete().eq("job_id", jobId);
    expect(del.error?.message).toMatch(/no se edita ni se elimina/);
  });

  it("revertir exige que esté facturado; facturar exige fecha", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    expect((await owner.client.rpc("revert_job_billing", { p_job_id: jobId })).error?.message).toMatch(/no está marcado como facturado/);
    const noDate = await owner.client.rpc("mark_job_invoiced", { p_job_id: jobId, p_invoiced_at: null as unknown as string });
    expect(noDate.error?.message).toMatch(/fecha de facturación/);
  });

  it("79 — roles: owner y admin modifican; worker y viewer no; otra organización y anon tampoco", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    await expect(markInvoiced(admin.client, jobId)).resolves.toBeUndefined();
    await expect(markInvoiced(worker.client, jobId)).rejects.toThrow(/not authorized/);
    await expect(markInvoiced(viewer.client, jobId)).rejects.toThrow(/not authorized/);
    expect((await worker.client.rpc("revert_job_billing", { p_job_id: jobId })).error?.message).toMatch(/not authorized/);
    expect((await viewer.client.rpc("revert_job_billing", { p_job_id: jobId })).error?.message).toMatch(/not authorized/);

    const other = await createTestUserWithOrg("billing-other");
    await expect(markInvoiced(other.client, jobId)).rejects.toThrow(/not authorized/);
    expect((await other.client.rpc("revert_job_billing", { p_job_id: jobId })).error?.message).toMatch(/not authorized/);
    expect((await anonClient().rpc("mark_job_invoiced", { p_job_id: jobId, p_invoiced_at: "2026-09-19" })).error).not.toBeNull();
  });

  it("79 — lectura: el estado lo ve todo miembro; el historial solo owner/admin; anon y otra organización nada", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    await markInvoiced(owner.client, jobId, { number: "0001-00000099" });

    for (const who of [owner, admin, worker, viewer]) {
      expect((await billing(jobId, who.client)).billing_status).toBe("invoiced");
      const rows = await who.client.from("job_billing").select("id").eq("job_id", jobId);
      expect(rows.data).toHaveLength(1);
    }
    expect((await owner.client.from("job_billing_history").select("id").eq("job_id", jobId)).data?.length).toBeGreaterThan(0);
    expect((await admin.client.from("job_billing_history").select("id").eq("job_id", jobId)).data?.length).toBeGreaterThan(0);
    expect((await worker.client.from("job_billing_history").select("id").eq("job_id", jobId)).data ?? []).toHaveLength(0);
    expect((await viewer.client.from("job_billing_history").select("id").eq("job_id", jobId)).data ?? []).toHaveLength(0);

    const other = await createTestUserWithOrg("billing-read");
    expect((await other.client.from("job_billing").select("id").eq("job_id", jobId)).data ?? []).toHaveLength(0);
    for (const table of ["job_billing", "job_billing_history", "job_billing_status", "billing_pending_summary"]) {
      const { data, error } = await selectSome(anonClient(), table);
      // Sin filas: RLS devuelve vacío o el grant de tabla está revocado (42501); cualquier otro error es un bug.
      if (error) expect(error.code, table).toBe("42501");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("no hay escritura directa sobre job_billing (solo por RPC)", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    const ins = await owner.client.from("job_billing").insert({ organization_id: owner.organizationId, job_id: jobId, status: "invoiced", invoiced_at: "2026-09-19" });
    expect(ins.error).not.toBeNull();
    await markInvoiced(owner.client, jobId);
    const upd = await owner.client.from("job_billing").update({ status: "pending" }).eq("job_id", jobId).select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("45 — integridad cross-org: la fila de facturación debe pertenecer a la organización del trabajo", async () => {
    const jobId = await newJob({ contracted: 100_000 });
    const other = await createTestUserWithOrg("billing-int");
    const bad = await adminClient().from("job_billing").insert({ organization_id: other.organizationId, job_id: jobId, status: "pending" });
    expect(bad.error?.message).toMatch(/no pertenece/);
    const badHist = await adminClient().from("job_billing_history").insert({ organization_id: other.organizationId, job_id: jobId, to_status: "pending" });
    expect(badHist.error?.message).toMatch(/no pertenece/);
    // un invoiced sin fecha viola el constraint aunque se escriba directo
    const noDate = await adminClient().from("job_billing").insert({ organization_id: owner.organizationId, job_id: jobId, status: "invoiced" });
    expect(noDate.error).not.toBeNull();
  });

  it("is_billable: solo cuenta trabajos con cotización aceptada, cobros vigentes o ya facturados", async () => {
    const consulting = await newJob();
    const withQuote = await newJob({ contracted: 50_000 });
    const withPayment = await newJob({ paid: 1_000 });
    expect((await billing(consulting)).is_billable).toBe(false);
    expect((await billing(withQuote)).is_billable).toBe(true);
    expect((await billing(withPayment)).is_billable).toBe(true);
    await markInvoiced(owner.client, consulting);
    expect((await billing(consulting)).is_billable).toBe(true);
  });

  it("80 — resumen del dashboard: 5 trabajos, 3 pendientes (2 cobrados por completo), 2 facturados", async () => {
    const isolated = await createTestUserWithOrg("billing-dash");
    const c = await createTestClient(isolated.client, isolated.organizationId, "Cliente dash");
    const st = await getAnyStatusId(isolated.client, isolated.organizationId, { closed: false });
    const method = await getPaymentMethodId(isolated.client, isolated.organizationId);

    const make = async (opts: { paid?: number; invoiced?: boolean }) => {
      const jobId = await createJob(isolated.client, isolated.organizationId, { clientId: c, statusId: st, title: `dash ${crypto.randomUUID().slice(0, 4)}` });
      await createAcceptedQuote(isolated.client, isolated.organizationId, { jobId, clientId: c, total: 100_000 });
      if (opts.paid) {
        await registerPayment(isolated.client, { jobId, paymentDate: "2026-09-19", amount: opts.paid, paymentMethodId: method, clientRequestId: crypto.randomUUID() });
      }
      if (opts.invoiced) await markInvoiced(isolated.client, jobId);
    };
    await make({ paid: 100_000 }); // pendiente y cobrado
    await make({ paid: 100_000 }); // pendiente y cobrado
    await make({ paid: 20_000 }); // pendiente, parcial
    await make({ paid: 100_000, invoiced: true });
    await make({ invoiced: true });

    const { data } = await isolated.client.from("billing_pending_summary").select("*").eq("organization_id", isolated.organizationId).single();
    expect(Number(data?.billing_pending_count)).toBe(3);
    expect(Number(data?.paid_and_billing_pending_count)).toBe(2);

    // cualquier miembro puede leerlo; otra organización ve el suyo, nunca este
    const other = await createTestUserWithOrg("billing-dash-other");
    const { data: otherRows } = await other.client.from("billing_pending_summary").select("organization_id");
    expect((otherRows ?? []).every((r) => r.organization_id !== isolated.organizationId)).toBe(true);
  });
});
