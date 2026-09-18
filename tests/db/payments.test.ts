import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import {
  createAcceptedQuote,
  createJob,
  createTestClient,
  getAnyStatusId,
  getJobFinancialStatus,
  getPaymentAccountId,
  getPaymentMethodId,
  registerPayment,
  voidPayment,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

describe("Cobros — fuente de verdad financiera", () => {
  let orgId: string;
  let client: Awaited<ReturnType<typeof createTestUserWithOrg>>["client"];
  let statusId: string;
  let clientId: string;
  let efectivoId: string;
  let transferenciaId: string;
  let cuentaEfectivoId: string;

  beforeAll(async () => {
    const ctx = await createTestUserWithOrg("payments");
    orgId = ctx.organizationId;
    client = ctx.client;
    statusId = await getAnyStatusId(client, orgId, { closed: false });
    clientId = await createTestClient(client, orgId, "Cliente cobros");
    efectivoId = await getPaymentMethodId(client, orgId, "Efectivo");
    transferenciaId = await getPaymentMethodId(client, orgId, "Transferencia");
    cuentaEfectivoId = await getPaymentAccountId(client, orgId, "Efectivo");
  }, 30_000);

  async function newJobWithContract(title: string, total: number) {
    const jobId = await createJob(client, orgId, { clientId, statusId, title });
    await createAcceptedQuote(client, orgId, { jobId, clientId, total });
    return jobId;
  }

  it("Caso 1 — sin cobros: pendiente = contratado, estado sin cobrar", async () => {
    const jobId = await newJobWithContract("Caso 1", 850_000);
    const fs = await getJobFinancialStatus(client, jobId);
    expect(fs.contracted_amount).toBe(850_000);
    expect(fs.collected_amount).toBe(0);
    expect(fs.outstanding_amount).toBe(850_000);
    expect(fs.payment_status).toBe("unpaid");
  });

  it("Caso 2 — cobro parcial", async () => {
    const jobId = await newJobWithContract("Caso 2", 850_000);
    await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 300_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    const fs = await getJobFinancialStatus(client, jobId);
    expect(fs.collected_amount).toBe(300_000);
    expect(fs.outstanding_amount).toBe(550_000);
    expect(fs.payment_status).toBe("partial");
  });

  it("Caso 3 — cobrado en su totalidad", async () => {
    const jobId = await newJobWithContract("Caso 3", 850_000);
    await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 850_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    const fs = await getJobFinancialStatus(client, jobId);
    expect(fs.outstanding_amount).toBe(0);
    expect(fs.payment_status).toBe("paid");
    expect(fs.overpaid_amount).toBe(0);
  });

  it("Caso 4 — sobrecobro: pendiente 0, excedente visible, nunca saldo negativo", async () => {
    const jobId = await newJobWithContract("Caso 4", 850_000);
    await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 900_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    const fs = await getJobFinancialStatus(client, jobId);
    expect(fs.outstanding_amount).toBe(0);
    expect(fs.overpaid_amount).toBe(50_000);
    expect(fs.payment_status).toBe("paid");
  });

  it("Caso 5 — sin cotización aceptada: contratado y pendiente son null, cobrado sigue siendo visible", async () => {
    const jobId = await createJob(client, orgId, { clientId, statusId, title: "Caso 5 sin quote" });
    await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 100_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    const fs = await getJobFinancialStatus(client, jobId);
    expect(fs.accepted_quote_id).toBeNull();
    expect(fs.contracted_amount).toBeNull();
    expect(fs.outstanding_amount).toBeNull();
    expect(fs.collected_amount).toBe(100_000);
    expect(fs.payment_status).toBe("no_contract");
  });

  it("cobro anulado: no cuenta en el total, sigue existiendo el registro original", async () => {
    const jobId = await newJobWithContract("Caso anulación", 850_000);
    const paymentA = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 300_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    const paymentB = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-21",
      amount: 200_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });

    let fs = await getJobFinancialStatus(client, jobId);
    expect(fs.collected_amount).toBe(500_000);

    await voidPayment(client, paymentB, "Cargado por error");

    fs = await getJobFinancialStatus(client, jobId);
    expect(fs.collected_amount).toBe(300_000);
    expect(fs.outstanding_amount).toBe(550_000);

    const { data: voided } = await client
      .from("job_payments")
      .select("id, voided_at, void_reason")
      .eq("id", paymentB)
      .single();
    expect(voided?.voided_at).not.toBeNull();
    expect(voided?.void_reason).toBe("Cargado por error");

    const { data: stillA } = await client.from("job_payments").select("id, voided_at").eq("id", paymentA).single();
    expect(stillA?.voided_at).toBeNull();
  });

  it("no se puede anular un cobro ya anulado", async () => {
    const jobId = await newJobWithContract("Doble anulación", 100_000);
    const paymentId = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 50_000,
      paymentMethodId: efectivoId,
      clientRequestId: randomUUID(),
    });
    await voidPayment(client, paymentId, "Motivo 1");
    await expect(voidPayment(client, paymentId, "Motivo 2")).rejects.toThrow();
  });

  it("idempotencia: reenviar el mismo client_request_id no duplica el cobro", async () => {
    const jobId = await newJobWithContract("Idempotencia simple", 100_000);
    const requestId = randomUUID();
    const id1 = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 40_000,
      paymentMethodId: efectivoId,
      clientRequestId: requestId,
    });
    const id2 = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 40_000,
      paymentMethodId: efectivoId,
      clientRequestId: requestId,
    });
    expect(id1).toBe(id2);

    const { data: payments } = await client.from("job_payments").select("id").eq("job_id", jobId);
    expect(payments?.length).toBe(1);
  });

  it("idempotencia bajo concurrencia: envíos simultáneos del mismo client_request_id generan un solo cobro", async () => {
    const jobId = await newJobWithContract("Idempotencia concurrente", 100_000);
    const requestId = randomUUID();
    const ids = await Promise.all(
      Array.from({ length: 4 }, () =>
        registerPayment(client, {
          jobId,
          paymentDate: "2026-09-20",
          amount: 15_000,
          paymentMethodId: efectivoId,
          clientRequestId: requestId,
        })
      )
    );
    expect(new Set(ids).size).toBe(1);

    const { data: payments } = await client.from("job_payments").select("amount").eq("job_id", jobId);
    expect(payments?.length).toBe(1);
    expect(Number(payments?.[0].amount)).toBe(15_000);
  });

  it("método que requiere cuenta sin cuenta es rechazado", async () => {
    const jobId = await newJobWithContract("Requiere cuenta", 100_000);
    await expect(
      registerPayment(client, {
        jobId,
        paymentDate: "2026-09-20",
        amount: 10_000,
        paymentMethodId: transferenciaId,
        paymentAccountId: null,
        clientRequestId: randomUUID(),
      })
    ).rejects.toThrow();
  });

  it("método válido + cuenta válida es aceptado", async () => {
    const jobId = await newJobWithContract("Método y cuenta válidos", 100_000);
    const id = await registerPayment(client, {
      jobId,
      paymentDate: "2026-09-20",
      amount: 10_000,
      paymentMethodId: transferenciaId,
      paymentAccountId: cuentaEfectivoId,
      clientRequestId: randomUUID(),
    });
    expect(id).toBeTruthy();
  });

  it("solo una cotización accepted por trabajo: aceptar una segunda falla", async () => {
    const jobId = await createJob(client, orgId, { clientId, statusId, title: "Doble aceptación" });
    await createAcceptedQuote(client, orgId, { jobId, clientId, total: 100_000 });

    // Segunda cotización para el mismo trabajo: crear + ítem + enviar OK,
    // pero aceptar debe fallar por el índice único parcial.
    const { data: quote2IdRaw, error: q2Error } = await client.rpc("create_quote", {
      p_job_id: jobId,
      p_client_id: clientId,
    });
    expect(q2Error).toBeNull();
    if (!quote2IdRaw) throw new Error("create_quote no devolvió id");
    const quote2Id = quote2IdRaw;
    await client.from("quote_items").insert({
      organization_id: orgId,
      quote_id: quote2Id,
      item_type: "service",
      description: "Segunda cotización",
      quantity: 1,
      unit: "trabajo",
      sale_unit_price: 50_000,
    });
    await client.from("quotes").update({ status: "sent" }).eq("id", quote2Id);
    const { error: acceptError } = await client.from("quotes").update({ status: "accepted" }).eq("id", quote2Id);
    expect(acceptError).not.toBeNull();
  });

  it("otro trabajo puede tener su propia cotización aceptada sin conflicto", async () => {
    const jobA = await createJob(client, orgId, { clientId, statusId, title: "Job A aceptación" });
    const jobB = await createJob(client, orgId, { clientId, statusId, title: "Job B aceptación" });
    await expect(createAcceptedQuote(client, orgId, { jobId: jobA, clientId, total: 100_000 })).resolves.toBeTruthy();
    await expect(createAcceptedQuote(client, orgId, { jobId: jobB, clientId, total: 200_000 })).resolves.toBeTruthy();
  });
});
