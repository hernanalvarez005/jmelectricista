import { beforeAll, describe, expect, it } from "vitest";

import { PUBLIC_QUOTE_ITEM_KEYS, PUBLIC_QUOTE_KEYS } from "@/lib/data/public-quote";

import {
  INTERNAL_MARKERS,
  createClientWithDetails,
  createJob,
  createQuoteWithItems,
  getAnyStatusId,
  getExpenseCategoryId,
  getMemberId,
  getOrCreateShareLink,
  registerExpense,
  selectSome,
  setRate,
} from "../helpers/fixtures";
import { adminClient, anonClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

type Ctx = Awaited<ReturnType<typeof createTestUserWithOrg>>;
type Member = Awaited<ReturnType<typeof createOrgMember>>;

describe("Cotizaciones compartidas — enlace, revocación, DTO público y apertura", () => {
  let owner: Ctx;
  let worker: Member;
  let viewer: Member;
  let clientId: string;
  let statusId: string;
  let counter = 0;

  beforeAll(async () => {
    owner = await createTestUserWithOrg("share");
    worker = await createOrgMember(owner.client, owner.organizationId, "worker", "share-w");
    viewer = await createOrgMember(owner.client, owner.organizationId, "viewer", "share-v");
    clientId = await createClientWithDetails(owner.client, owner.organizationId, { name: "Juan Pérez", phone: "011 15-5123-4567" });
    statusId = await getAnyStatusId(owner.client, owner.organizationId, { closed: false });
  }, 90_000);

  async function newQuote(status: "draft" | "sent" | "accepted" = "sent") {
    counter += 1;
    const { data: job } = await owner.client
      .from("jobs")
      .insert({
        organization_id: owner.organizationId,
        client_id: clientId,
        status_id: statusId,
        title: `Instalación cocina ${counter}`,
        description: "Instalación de tomas y luces",
        notes: INTERNAL_MARKERS.jobNotes,
      })
      .select("id")
      .single();
    const jobId = job!.id;
    const q = await createQuoteWithItems(owner.client, owner.organizationId, { jobId, clientId, status });
    return { jobId, ...q };
  }

  const resolve = async (token: string) => {
    const { data, error } = await anonClient().rpc("get_public_quote", { p_token: token });
    expect(error).toBeNull();
    return data as Record<string, unknown> | null;
  };

  it("68 — crea un enlace activo con token largo y único", async () => {
    const a = await newQuote();
    const b = await newQuote();
    const linkA = await getOrCreateShareLink(owner.client, a.quoteId);
    const linkB = await getOrCreateShareLink(owner.client, b.quoteId);
    expect(linkA.active).toBe(true);
    expect(linkA.open_count).toBe(0);
    expect(linkA.token.length).toBeGreaterThanOrEqual(40);
    expect(linkA.token).toMatch(/^[0-9a-f]+$/);
    expect(linkA.token).not.toBe(linkB.token);
    // no deriva de ids visibles ni del número de cotización
    expect(linkA.token).not.toContain(a.quoteNumber);
    expect(linkA.token).not.toContain(a.quoteId.replaceAll("-", ""));
  });

  it("no se puede compartir un borrador", async () => {
    const { quoteId } = await newQuote("draft");
    await expect(getOrCreateShareLink(owner.client, quoteId)).rejects.toThrow(/cotizacion_borrador/);
  });

  it("69 — reutilización: llamar de nuevo (también en paralelo) devuelve el mismo enlace activo", async () => {
    const { quoteId } = await newQuote();
    const first = await getOrCreateShareLink(owner.client, quoteId);
    const second = await getOrCreateShareLink(owner.client, quoteId);
    expect(second.id).toBe(first.id);
    expect(second.token).toBe(first.token);

    const { quoteId: other } = await newQuote();
    const parallel = await Promise.all(Array.from({ length: 5 }, () => getOrCreateShareLink(owner.client, other)));
    expect(new Set(parallel.map((l) => l.token)).size).toBe(1);
    const { count } = await adminClient().from("quote_share_links").select("id", { count: "exact", head: true }).eq("quote_id", other).eq("active", true);
    expect(count).toBe(1);
  });

  it("70 — revocar: el token deja de resolver de inmediato; compartir de nuevo crea un token distinto", async () => {
    const { quoteId } = await newQuote();
    const first = await getOrCreateShareLink(owner.client, quoteId);
    expect(await resolve(first.token)).not.toBeNull();

    const { data: revoked } = await owner.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId });
    expect(revoked).toBe(true);
    expect(await resolve(first.token)).toBeNull();
    const again = await owner.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId });
    expect(again.data).toBe(false);

    const second = await getOrCreateShareLink(owner.client, quoteId);
    expect(second.token).not.toBe(first.token);
    expect(await resolve(second.token)).not.toBeNull();
    expect(await resolve(first.token)).toBeNull(); // el anterior sigue inválido
  });

  it("71 — el DTO público contiene exactamente las claves comerciales y ningún dato interno", async () => {
    const { jobId, quoteId } = await newQuote();
    // datos internos alrededor de la cotización
    const workerMember = await getMemberId(owner.client, owner.organizationId, worker.userId);
    await setRate(owner.client, workerMember, 12_345, "2026-01-01");
    await registerExpense(owner.client, {
      jobId,
      categoryId: await getExpenseCategoryId(owner.client, owner.organizationId),
      amount: 4_242,
      description: INTERNAL_MARKERS.expenseDescription,
    });
    const link = await getOrCreateShareLink(owner.client, quoteId);
    const dto = await resolve(link.token);

    expect(dto).not.toBeNull();
    expect(Object.keys(dto!).sort()).toEqual([...PUBLIC_QUOTE_KEYS].sort());
    const items = dto!.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    for (const item of items) expect(Object.keys(item).sort()).toEqual([...PUBLIC_QUOTE_ITEM_KEYS].sort());

    const serialized = JSON.stringify(dto);
    const forbiddenKeys = ["cost_unit_price", "cost", "margin", "contribution", "labor", "expense", "purchase", "supplier", "stock", "hourly", "notes_internal", "organization_id", "job_id", "client_id", "quote_id", "created_by", "token"];
    for (const key of forbiddenKeys) expect(serialized, `clave ${key}`).not.toMatch(new RegExp(`"[a-z_]*${key}[a-z_]*":`));
    const forbiddenValues = [
      String(INTERNAL_MARKERS.serviceCostPrice),
      String(INTERNAL_MARKERS.materialCostPrice),
      INTERNAL_MARKERS.jobNotes,
      INTERNAL_MARKERS.clientEmail,
      INTERNAL_MARKERS.clientTaxId,
      INTERNAL_MARKERS.clientNotes,
      INTERNAL_MARKERS.expenseDescription,
      "12345",
      owner.organizationId,
      quoteId,
      jobId,
      clientId,
      owner.userId,
      link.token,
    ];
    for (const value of forbiddenValues) expect(serialized, `valor ${value}`).not.toContain(value);

    // lo comercial sí está
    expect(dto).toMatchObject({ client_name: "Juan Pérez", quote_number: expect.stringMatching(/^COT-/), total: 100_000 });
    expect(items.map((i) => i.description)).toEqual(["Instalación eléctrica completa", "Cable 2,5 mm"]);
    expect(items[1]).toMatchObject({ quantity: 2, unit: "m", unit_price: 9_999, subtotal: 19_998 });
  });

  it("72 — anon resuelve un token válido pero no puede listar quotes, enlaces, trabajos, clientes ni economía", async () => {
    const { quoteId } = await newQuote();
    const link = await getOrCreateShareLink(owner.client, quoteId);
    const anon = anonClient();
    expect(await resolve(link.token)).not.toBeNull();

    for (const table of ["quotes", "quote_items", "quote_share_links", "jobs", "clients", "job_economics_status", "job_labor_costs", "job_billing", "job_billing_history"]) {
      const { data, error } = await selectSome(anon, table);
      // Sin filas: RLS devuelve vacío o el grant de tabla está revocado (42501); cualquier otro error es un bug.
      if (error) expect(error.code, table).toBe("42501");
      expect(data ?? [], table).toEqual([]);
    }
    expect((await anon.rpc("get_or_create_quote_share_link", { p_quote_id: quoteId })).error).not.toBeNull();
    expect((await anon.rpc("revoke_quote_share_link", { p_quote_id: quoteId })).error).not.toBeNull();
    // tokens inválidos, vacíos o cortos
    for (const bad of ["", "abc", "0".repeat(48), `${link.token}x`, link.token.toUpperCase()]) expect(await resolve(bad)).toBeNull();
  });

  it("una cotización con enlace activo no puede volver a ser borrador ni se comparte si es borrador", async () => {
    const { quoteId } = await newQuote();
    const link = await getOrCreateShareLink(owner.client, quoteId);
    const back = await owner.client.from("quotes").update({ status: "draft" }).eq("id", quoteId);
    expect(back.error).not.toBeNull();
    expect(await resolve(link.token)).not.toBeNull();
  });

  it("74 — contador y última apertura: N aperturas suman N; los tokens revocados no cuentan", async () => {
    const { quoteId } = await newQuote();
    const link = await getOrCreateShareLink(owner.client, quoteId);
    const anon = anonClient();
    for (let i = 0; i < 4; i++) {
      const { data } = await anon.rpc("record_quote_share_open", { p_token: link.token });
      expect(data).toBe(true);
    }
    const refreshed = await getOrCreateShareLink(owner.client, quoteId);
    expect(refreshed.open_count).toBe(4);
    expect(new Date(refreshed.last_opened_at as string).getTime()).toBeGreaterThan(Date.now() - 60_000);

    await Promise.all(Array.from({ length: 5 }, () => anon.rpc("record_quote_share_open", { p_token: link.token })));
    expect((await getOrCreateShareLink(owner.client, quoteId)).open_count).toBe(9); // operación atómica en la DB

    await owner.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId });
    expect((await anon.rpc("record_quote_share_open", { p_token: link.token })).data).toBe(false);
    const { data: row } = await owner.client.from("quote_share_links").select("open_count").eq("token", link.token).single();
    expect(row?.open_count).toBe(9);
  });

  it("roles: worker crea/reutiliza/revoca; viewer no; otra organización no", async () => {
    const { quoteId } = await newQuote();
    const byWorker = await getOrCreateShareLink(worker.client, quoteId);
    expect(byWorker.created_by).toBe(worker.userId);
    expect((await viewer.client.rpc("get_or_create_quote_share_link", { p_quote_id: quoteId })).error?.message).toMatch(/not authorized/);
    expect((await viewer.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId })).error?.message).toMatch(/not authorized/);

    const other = await createTestUserWithOrg("share-other");
    expect((await other.client.rpc("get_or_create_quote_share_link", { p_quote_id: quoteId })).error?.message).toMatch(/not authorized/);
    expect((await other.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId })).error?.message).toMatch(/not authorized/);

    // lectura de la tabla: operadores sí; viewer y otra organización no
    expect((await worker.client.from("quote_share_links").select("id").eq("quote_id", quoteId)).data).toHaveLength(1);
    expect((await viewer.client.from("quote_share_links").select("id").eq("quote_id", quoteId)).data ?? []).toHaveLength(0);
    expect((await other.client.from("quote_share_links").select("id").eq("quote_id", quoteId)).data ?? []).toHaveLength(0);
    expect((await worker.client.rpc("revoke_quote_share_link", { p_quote_id: quoteId })).data).toBe(true);
  });

  it("no hay escritura directa sobre los enlaces (ni aun con sesión de owner)", async () => {
    const { quoteId } = await newQuote();
    const link = await getOrCreateShareLink(owner.client, quoteId);
    const upd = await owner.client.from("quote_share_links").update({ open_count: 999 }).eq("id", link.id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const ins = await owner.client.from("quote_share_links").insert({ organization_id: owner.organizationId, quote_id: quoteId, token: "a".repeat(48) });
    expect(ins.error).not.toBeNull();
  });

  it("integridad DB: no se puede asociar una cotización de otra organización", async () => {
    const other = await createTestUserWithOrg("share-int");
    const { quoteId } = await newQuote();
    const { error } = await adminClient().from("quote_share_links").insert({ organization_id: other.organizationId, quote_id: quoteId, token: "b".repeat(48) });
    expect(error?.message).toMatch(/no pertenece/);
  });

  it("el bucket de PDFs sigue privado: anon no puede leer objetos del bucket quotes", async () => {
    const { data } = await anonClient().storage.from("quotes").list("organizations");
    expect(data ?? []).toEqual([]); // RLS de storage.objects: anon no ve ningún objeto
    const { data: bucket } = await adminClient().storage.getBucket("quotes");
    expect(bucket?.public).toBe(false);
  });

  it("createJob helper sigue disponible (sanidad de fixtures)", async () => {
    expect(typeof createJob).toBe("function");
  });
});
