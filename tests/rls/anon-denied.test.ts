import { describe, expect, it } from "vitest";

import { anonClient } from "../helpers/supabase";

/**
 * anon nunca debe poder leer ni escribir ninguna tabla de negocio de
 * Fase 2. Sin policy para el rol anon en ninguna de estas tablas, RLS
 * deniega por defecto: select debe volver un array vacío (no un error, ni
 * datos), insert debe fallar.
 */
const TABLES = [
  "materials",
  "material_categories",
  "material_units",
  "stock_movements",
  "job_materials",
  "suppliers",
  "supplier_material_prices",
  "quotes",
  "quote_items",
] as const;

describe("RLS — anon no accede a ninguna tabla de Fase 2", () => {
  const anon = anonClient();

  it.each(TABLES)("select en %s vuelve vacío para anon", async (table) => {
    const { data, error } = await anon.from(table).select("*").limit(1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(TABLES)("insert en %s es denegado para anon", async (table) => {
    const { error } = await anon.from(table).insert({ organization_id: "00000000-0000-0000-0000-000000000000" } as never);
    expect(error).not.toBeNull();
  });

  it("anon no puede invocar register_job_material_consumption", async () => {
    const { error } = await anon.rpc("register_job_material_consumption", {
      p_job_material_id: "00000000-0000-0000-0000-000000000000",
      p_actual_quantity: 1,
    });
    expect(error).not.toBeNull();
  });

  it("anon no puede invocar create_quote", async () => {
    const { error } = await anon.rpc("create_quote", {
      p_job_id: "00000000-0000-0000-0000-000000000000",
      p_client_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });
});
