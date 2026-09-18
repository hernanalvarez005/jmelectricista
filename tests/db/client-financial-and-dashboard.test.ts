import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createAcceptedQuote,
  createJob,
  createTestClient,
  getAnyStatusId,
  getPaymentMethodId,
  registerPayment,
  voidPayment,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

describe("client_financial_summary y métricas de dashboard", () => {
  let orgId: string;
  let client: Awaited<ReturnType<typeof createTestUserWithOrg>>["client"];
  let openStatusId: string;
  let closedStatusId: string;
  let efectivoId: string;

  beforeAll(async () => {
    const ctx = await createTestUserWithOrg("client-fin");
    orgId = ctx.organizationId;
    client = ctx.client;
    openStatusId = await getAnyStatusId(client, orgId, { closed: false });
    closedStatusId = await getAnyStatusId(client, orgId, { closed: true });
    efectivoId = await getPaymentMethodId(client, orgId, "Efectivo");
  }, 90_000);

  async function pay(jobId: string, amount: number, date: string) {
    return registerPayment(client, {
      jobId,
      paymentDate: date,
      amount,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
  }

  it("resumen del cliente: A 500k/500k + B 700k/300k => contratado 1.2M, cobrado 800k, pendiente 400k", async () => {
    const clientId = await createTestClient(client, orgId, "Cliente resumen");
    const jobA = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "A" });
    const jobB = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "B" });
    await createAcceptedQuote(client, orgId, { jobId: jobA, clientId, total: 500_000 });
    await createAcceptedQuote(client, orgId, { jobId: jobB, clientId, total: 700_000 });
    await pay(jobA, 500_000, "2026-09-10");
    await pay(jobB, 300_000, "2026-09-11");

    const { data } = await client.from("client_financial_summary").select("*").eq("client_id", clientId).single();
    expect(Number(data?.contracted_amount)).toBe(1_200_000);
    expect(Number(data?.collected_amount)).toBe(800_000);
    expect(Number(data?.outstanding_amount)).toBe(400_000);
    expect(Number(data?.uncontracted_collections)).toBe(0);
  });

  it("cobros de trabajos sin cotización aceptada van a uncontracted_collections y no inflan contratado/pendiente", async () => {
    const clientId = await createTestClient(client, orgId, "Cliente sin quote");
    const jobA = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "Con quote" });
    const jobB = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "Sin quote" });
    await createAcceptedQuote(client, orgId, { jobId: jobA, clientId, total: 100_000 });
    await pay(jobA, 40_000, "2026-09-10");
    await pay(jobB, 25_000, "2026-09-10");

    const { data } = await client.from("client_financial_summary").select("*").eq("client_id", clientId).single();
    expect(Number(data?.contracted_amount)).toBe(100_000);
    expect(Number(data?.outstanding_amount)).toBe(60_000);
    expect(Number(data?.uncontracted_collections)).toBe(25_000);
  });

  it("cobrado del mes excluye anulados y respeta el borde de mes (payment_date es date)", async () => {
    const clientId = await createTestClient(client, orgId, "Cliente mes");
    const job = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "Mes" });
    await createAcceptedQuote(client, orgId, { jobId: job, clientId, total: 1_000_000 });
    await pay(job, 100_000, "2031-03-31"); // fuera del mes (mes anterior)
    await pay(job, 200_000, "2031-04-01"); // primer día del mes
    await pay(job, 300_000, "2031-04-30"); // último día del mes
    const voided = await pay(job, 400_000, "2031-04-15");
    await voidPayment(client, voided, "Error de carga");
    await pay(job, 500_000, "2031-05-01"); // fuera del mes (siguiente)

    // Misma consulta que getPaymentsDashboardStats para el mes 2031-04.
    const { data } = await client
      .from("job_payments")
      .select("amount")
      .eq("organization_id", orgId)
      .eq("job_id", job)
      .is("voided_at", null)
      .gte("payment_date", "2031-04-01")
      .lt("payment_date", "2031-05-01");
    const total = (data ?? []).reduce((s, p) => s + Number(p.amount), 0);
    expect(total).toBe(500_000);
  });

  it("saldo pendiente y finalizados con saldo: ignora trabajos sin cotización y cuenta solo cerrados con saldo", async () => {
    const clientId = await createTestClient(client, orgId, "Cliente saldos");
    const closedWithBalance = await createJob(client, orgId, { clientId, statusId: closedStatusId, title: "Cerrado con saldo" });
    const openWithBalance = await createJob(client, orgId, { clientId, statusId: openStatusId, title: "Abierto con saldo" });
    const closedPaid = await createJob(client, orgId, { clientId, statusId: closedStatusId, title: "Cerrado cobrado" });
    const noQuote = await createJob(client, orgId, { clientId, statusId: closedStatusId, title: "Cerrado sin quote" });
    await createAcceptedQuote(client, orgId, { jobId: closedWithBalance, clientId, total: 100_000 });
    await createAcceptedQuote(client, orgId, { jobId: openWithBalance, clientId, total: 50_000 });
    await createAcceptedQuote(client, orgId, { jobId: closedPaid, clientId, total: 80_000 });
    await pay(closedPaid, 80_000, "2026-09-10");
    await pay(noQuote, 10_000, "2026-09-10");

    const { data: balances } = await client
      .from("job_financial_status")
      .select("job_id, outstanding_amount")
      .in("job_id", [closedWithBalance, openWithBalance, closedPaid, noQuote])
      .gt("outstanding_amount", 0);
    const ids = (balances ?? []).map((b) => b.job_id).sort();
    expect(ids).toEqual([closedWithBalance, openWithBalance].sort());
    expect((balances ?? []).reduce((s, b) => s + Number(b.outstanding_amount), 0)).toBe(150_000);
  });
});
