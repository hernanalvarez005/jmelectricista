import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import {
  createAcceptedQuote,
  createJob,
  createTestClient,
  getAnyStatusId,
  getPaymentMethodId,
  registerPayment,
} from "../helpers/fixtures";
import { anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

describe("RLS — cobros, medios de pago y cuentas", () => {
  let owner: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let worker: Awaited<ReturnType<typeof createOrgMember>>;
  let viewer: Awaited<ReturnType<typeof createOrgMember>>;
  let statusId: string;
  let clientId: string;
  let efectivoId: string;
  let jobId: string;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("pay-roles");
    worker = await createOrgMember(owner.client, owner.organizationId, "worker", "pay-worker");
    viewer = await createOrgMember(owner.client, owner.organizationId, "viewer", "pay-viewer");

    statusId = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
    clientId = await createTestClient(owner.client, owner.organizationId, "Cliente roles");
    efectivoId = await getPaymentMethodId(owner.client, owner.organizationId, "Efectivo");
    jobId = await createJob(owner.client, owner.organizationId, { clientId, statusId, title: "Trabajo roles" });
    await createAcceptedQuote(owner.client, owner.organizationId, { jobId, clientId, total: 100_000 });
  }, 90_000);

  it("anon no puede leer ni insertar en payment_methods/payment_accounts/job_payments", async () => {
    const anon = anonClient();
    for (const table of ["payment_methods", "payment_accounts", "job_payments"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const { error: insertError } = await anon
      .from("payment_methods")
      .insert({ organization_id: owner.organizationId, name: "x" } as never);
    expect(insertError).not.toBeNull();
  });

  it("anon no puede invocar register_job_payment ni void_job_payment", async () => {
    const anon = anonClient();
    const { error: registerError } = await anon.rpc("register_job_payment", {
      p_job_id: jobId,
      p_payment_date: "2026-09-20",
      p_amount: 1000,
      p_payment_method_id: efectivoId,
      p_client_request_id: randomUUID(),
    });
    expect(registerError).not.toBeNull();

    const { error: voidError } = await anon.rpc("void_job_payment", {
      p_payment_id: "00000000-0000-0000-0000-000000000000",
      p_void_reason: "x",
    });
    expect(voidError).not.toBeNull();
  });

  it("viewer no puede registrar un cobro", async () => {
    await expect(
      registerPayment(viewer.client, {
        jobId,
        paymentDate: "2026-09-20",
        amount: 1000,
        paymentMethodId: efectivoId,
        clientRequestId: randomUUID(),
      })
    ).rejects.toThrow();
  });

  it("viewer no puede crear medios de pago ni cuentas (solo admin/owner configura)", async () => {
    const { error: methodError } = await viewer.client
      .from("payment_methods")
      .insert({ organization_id: owner.organizationId, name: "Método de viewer" });
    expect(methodError).not.toBeNull();

    const { error: accountError } = await viewer.client
      .from("payment_accounts")
      .insert({ organization_id: owner.organizationId, name: "Cuenta de viewer", account_type: "other" });
    expect(accountError).not.toBeNull();
  });

  it("worker puede registrar un cobro pero no puede anularlo", async () => {
    const paymentId = await registerPayment(worker.client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 5000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    expect(paymentId).toBeTruthy();

    const { error: voidError } = await worker.client.rpc("void_job_payment", {
      p_payment_id: paymentId,
      p_void_reason: "Intento de worker",
    });
    expect(voidError).not.toBeNull();
  });

  it("worker tampoco puede crear medios de pago ni cuentas", async () => {
    const { error } = await worker.client
      .from("payment_methods")
      .insert({ organization_id: owner.organizationId, name: "Método de worker" });
    expect(error).not.toBeNull();
  });

  it("owner/admin puede registrar, anular y configurar medios y cuentas", async () => {
    const paymentId = await registerPayment(owner.client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 7000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });

    const { error: voidError } = await owner.client.rpc("void_job_payment", {
      p_payment_id: paymentId,
      p_void_reason: "Corrección de owner",
    });
    expect(voidError).toBeNull();

    const { error: methodError } = await owner.client
      .from("payment_methods")
      .insert({ organization_id: owner.organizationId, name: "Método de owner" });
    expect(methodError).toBeNull();
  });
});

describe("RLS — cobros, aislamiento cross-org", () => {
  let a: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let b: Awaited<ReturnType<typeof createTestUserWithOrg>>;
  let jobA: string;
  let jobB: string;
  let methodB: string;
  let paymentB: string;

  beforeAll(async () => {
    a = await createTestUserWithOrg("pay-org-a");
    b = await createTestUserWithOrg("pay-org-b");

    const statusA = await getAnyStatusId(a.client, a.organizationId, { closed: false });
    const clientA = await createTestClient(a.client, a.organizationId, "Cliente A");
    jobA = await createJob(a.client, a.organizationId, { clientId: clientA, statusId: statusA, title: "Job A" });
    await createAcceptedQuote(a.client, a.organizationId, { jobId: jobA, clientId: clientA, total: 100_000 });

    const statusB = await getAnyStatusId(b.client, b.organizationId, { closed: false });
    const clientB = await createTestClient(b.client, b.organizationId, "Cliente B");
    jobB = await createJob(b.client, b.organizationId, { clientId: clientB, statusId: statusB, title: "Job B" });
    await createAcceptedQuote(b.client, b.organizationId, { jobId: jobB, clientId: clientB, total: 100_000 });
    methodB = await getPaymentMethodId(b.client, b.organizationId, "Efectivo");
    paymentB = await registerPayment(b.client, {
      jobId: jobB,
      paymentDate: "2026-09-20",
      amount: 10_000,
      paymentMethodId: methodB,
      clientRequestId: randomUUID(),
    });
  }, 90_000);

  it("A no puede registrar un cobro para el trabajo de B", async () => {
    await expect(
      registerPayment(a.client, {
        jobId: jobB,
        paymentDate: "2026-09-20",
        amount: 1000,
        paymentMethodId: methodB,
        clientRequestId: randomUUID(),
      })
    ).rejects.toThrow();
  });

  it("A no puede usar el método de pago de B en su propio trabajo", async () => {
    await expect(
      registerPayment(a.client, {
        jobId: jobA,
        paymentDate: "2026-09-20",
        amount: 1000,
        paymentMethodId: methodB,
        clientRequestId: randomUUID(),
      })
    ).rejects.toThrow();
  });

  it("A no puede leer el cobro de B", async () => {
    const { data } = await a.client.from("job_payments").select("*").eq("id", paymentB);
    expect(data).toEqual([]);
  });

  it("A no puede anular el cobro de B", async () => {
    const { error } = await a.client.rpc("void_job_payment", { p_payment_id: paymentB, p_void_reason: "intento" });
    expect(error).not.toBeNull();
  });
});
