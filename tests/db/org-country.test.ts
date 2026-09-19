import { describe, expect, it } from "vitest";

import { adminClient, createOrgMember, createTestUserWithOrg } from "../helpers/supabase";

describe("País por defecto de la organización (teléfonos / WhatsApp)", () => {
  it("las organizaciones nuevas nacen con default_country_code = 'AR' (bootstrap incluido)", async () => {
    const ctx = await createTestUserWithOrg("country");
    const { data } = await ctx.client.from("organizations").select("default_country_code").eq("id", ctx.organizationId).single();
    expect(data?.default_country_code).toBe("AR");
  });

  it("owner/admin pueden cambiarlo; el formato se valida en la DB", async () => {
    const ctx = await createTestUserWithOrg("country-edit");
    const ok = await ctx.client.from("organizations").update({ default_country_code: "UY" }).eq("id", ctx.organizationId).select("default_country_code");
    expect(ok.data?.[0]?.default_country_code).toBe("UY");

    for (const bad of ["ar", "ARG", "A", "1A", ""]) {
      const res = await adminClient().from("organizations").update({ default_country_code: bad }).eq("id", ctx.organizationId);
      expect(res.error, `valor ${JSON.stringify(bad)}`).not.toBeNull();
    }
  });

  it("un worker no puede cambiarlo", async () => {
    const ctx = await createTestUserWithOrg("country-worker");
    const worker = await createOrgMember(ctx.client, ctx.organizationId, "worker", "country-w");
    const res = await worker.client.from("organizations").update({ default_country_code: "CL" }).eq("id", ctx.organizationId).select("id");
    expect(res.data ?? []).toHaveLength(0);
    const { data } = await ctx.client.from("organizations").select("default_country_code").eq("id", ctx.organizationId).single();
    expect(data?.default_country_code).toBe("AR");
  });
});
