import { beforeAll, describe, expect, it } from "vitest";

import { getMemberId, listRates, setRate } from "../helpers/fixtures";
import { adminClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;

describe("Tarifas de mano de obra — vigencias y superposición", () => {
  let owner: Ctx;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("rates");
  }, 90_000);

  async function newMember(role: "worker" | "admin" | "viewer" = "worker") {
    counter += 1;
    const m = await createOrgMember(owner.client, owner.organizationId, role, `rates-${role}-${counter}`);
    return { ...m, memberId: await getMemberId(owner.client, owner.organizationId, m.userId) };
  }

  it("la primera tarifa queda abierta (valid_to null) y guarda nota", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01", "Tarifa inicial");
    expect(await listRates(owner.client, memberId)).toMatchObject([
      { hourly_cost: 10_000, valid_from: "2026-01-01", valid_to: null, notes: "Tarifa inicial" },
    ]);
  });

  it("una tarifa nueva cierra la abierta el día anterior, sin superposición", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    await setRate(owner.client, memberId, 12_000, "2026-10-01");
    expect(await listRates(owner.client, memberId)).toMatchObject([
      { hourly_cost: 10_000, valid_from: "2026-01-01", valid_to: "2026-09-30" },
      { hourly_cost: 12_000, valid_from: "2026-10-01", valid_to: null },
    ]);
  });

  it("una tarifa anterior a la primera se cierra contra la siguiente", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 12_000, "2026-06-01");
    await setRate(owner.client, memberId, 9_000, "2026-01-01");
    expect(await listRates(owner.client, memberId)).toMatchObject([
      { hourly_cost: 9_000, valid_from: "2026-01-01", valid_to: "2026-05-31" },
      { hourly_cost: 12_000, valid_from: "2026-06-01", valid_to: null },
    ]);
  });

  it("rechaza otra tarifa que empiece en la misma fecha", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-03-01");
    await expect(setRate(owner.client, memberId, 11_000, "2026-03-01")).rejects.toThrow(/tarifa_superpuesta/);
    expect(await listRates(owner.client, memberId)).toHaveLength(1);
  });

  it("rechaza una fecha que cae dentro de un período ya cerrado", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    await setRate(owner.client, memberId, 12_000, "2026-10-01");
    await expect(setRate(owner.client, memberId, 11_000, "2026-05-01")).rejects.toThrow(/ya cerrada/);
    expect(await listRates(owner.client, memberId)).toHaveLength(2);
  });

  it("tarifa 0 es válida (explícita); una negativa se rechaza", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 0, "2026-01-01", "Sin costo laboral para el dueño");
    expect((await listRates(owner.client, memberId))[0].hourly_cost).toBe(0);
    const other = await newMember();
    await expect(setRate(owner.client, other.memberId, -1, "2026-01-01")).rejects.toThrow(/mayor o igual a 0/);
  });

  it("el trigger rechaza superposiciones aunque se escriba directo (service role)", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    const { error } = await adminClient().from("member_labor_rates").insert({
      organization_id: owner.organizationId,
      organization_member_id: memberId,
      hourly_cost: 5_000,
      valid_from: "2026-06-01",
      valid_to: "2026-06-30",
    });
    expect(error?.message).toMatch(/tarifa_superpuesta/);
  });

  it("el trigger rechaza un miembro de otra organización", async () => {
    const other = await createTestUserWithOrg("rates-x");
    const otherMemberId = await getMemberId(other.client, other.organizationId, other.userId);
    const { error } = await adminClient().from("member_labor_rates").insert({
      organization_id: owner.organizationId,
      organization_member_id: otherMemberId,
      hourly_cost: 5_000,
      valid_from: "2026-06-01",
    });
    expect(error?.message).toMatch(/no pertenece/);
  });

  it("altas concurrentes para la misma persona se serializan: nunca quedan períodos superpuestos", async () => {
    const { memberId } = await newMember();
    const results = await Promise.allSettled([
      setRate(owner.client, memberId, 10_000, "2026-01-01"),
      setRate(owner.client, memberId, 12_000, "2026-03-01"),
      setRate(owner.client, memberId, 14_000, "2026-06-01"),
    ]);
    // Según el orden de llegada alguna fecha puede caer dentro de un período que otra ya cerró:
    // esas se rechazan con un error de negocio, jamás con un estado inconsistente.
    for (const r of results) {
      if (r.status === "rejected") expect(String(r.reason)).toMatch(/tarifa_superpuesta/);
    }
    const rates = await listRates(owner.client, memberId);
    expect(rates.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < rates.length - 1; i++) {
      expect(rates[i].valid_to).not.toBeNull();
      expect(new Date(rates[i].valid_to as string).getTime()).toBeLessThan(new Date(rates[i + 1].valid_from).getTime());
    }
  });

  it("dos altas simultáneas con la misma fecha de inicio: gana exactamente una", async () => {
    const { memberId } = await newMember();
    const results = await Promise.allSettled([
      setRate(owner.client, memberId, 10_000, "2026-05-01"),
      setRate(owner.client, memberId, 11_000, "2026-05-01"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listRates(owner.client, memberId)).toHaveLength(1);
  });

  it("solo owner/admin administran tarifas; worker y viewer no", async () => {
    const { memberId } = await newMember();
    const worker = await newMember("worker");
    const viewer = await newMember("viewer");
    const admin = await newMember("admin");
    await expect(setRate(worker.client, memberId, 1_000, "2026-01-01")).rejects.toThrow(/not authorized/);
    await expect(setRate(viewer.client, memberId, 1_000, "2026-01-01")).rejects.toThrow(/not authorized/);
    await expect(setRate(admin.client, memberId, 1_000, "2026-01-01")).resolves.toBeTruthy();
  });

  it("un owner de otra organización no puede fijar tarifas de este miembro", async () => {
    const { memberId } = await newMember();
    const other = await createTestUserWithOrg("rates-y");
    await expect(setRate(other.client, memberId, 1_000, "2026-01-01")).rejects.toThrow(/not authorized/);
  });

  it("eliminar una tarifa sin uso reabre el período anterior", async () => {
    const { memberId } = await newMember();
    await setRate(owner.client, memberId, 10_000, "2026-01-01");
    const second = await setRate(owner.client, memberId, 12_000, "2026-10-01");
    const { error } = await owner.client.rpc("delete_member_labor_rate", { p_rate_id: second });
    expect(error).toBeNull();
    expect(await listRates(owner.client, memberId)).toMatchObject([
      { hourly_cost: 10_000, valid_from: "2026-01-01", valid_to: null },
    ]);
  });

  it("resolve_labor_rate y capture_session_labor_cost no son invocables desde la API", async () => {
    const { memberId } = await newMember();
    const r1 = await owner.client.rpc("resolve_labor_rate" as never, { p_member_id: memberId, p_date: "2026-01-01" } as never);
    expect(r1.error).not.toBeNull();
    const r2 = await owner.client.rpc("capture_session_labor_cost" as never, { p_session_id: memberId } as never);
    expect(r2.error).not.toBeNull();
  });
});
