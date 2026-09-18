import { beforeAll, describe, expect, it } from "vitest";

import {
  addJobMaterial,
  addStockMovement,
  createJob,
  createMaterial,
  createTestClient,
  getAnyStatusId,
  getJobMaterialStatus,
  getSeedUnitId,
  registerConsumption,
} from "../helpers/fixtures";
import { createTestUserWithOrg } from "../helpers/supabase";

/**
 * Contra Supabase local real (npx supabase start && npx supabase db reset).
 * Cubre el bug reportado en Fase 2.1: el faltante debía considerar el
 * consumo ya registrado en el trabajo, no solo estimated - stock.
 */
describe("job_material_status — faltante considera consumo real", () => {
  let orgId: string;
  let client: Awaited<ReturnType<typeof createTestUserWithOrg>>["client"];
  let unitId: string;
  let statusOpenId: string;

  beforeAll(async () => {
    const ctx = await createTestUserWithOrg("stock");
    orgId = ctx.organizationId;
    client = ctx.client;
    unitId = await getSeedUnitId(client, orgId, "m");
    statusOpenId = await getAnyStatusId(client, orgId, { closed: false });
  }, 90_000);

  async function setup(materialName: string, estimatedQuantity: number, initialStock: number) {
    const materialId = await createMaterial(client, orgId, { name: materialName, unitId });
    const clientId = await createTestClient(client, orgId, `Cliente ${materialName}`);
    const jobId = await createJob(client, orgId, { clientId, statusId: statusOpenId, title: `Trabajo ${materialName}` });
    const jobMaterialId = await addJobMaterial(client, orgId, { jobId, materialId, estimatedQuantity });
    if (initialStock > 0) {
      await addStockMovement(client, orgId, { materialId, movementType: "in", quantity: initialStock });
    }
    return { materialId, jobId, jobMaterialId };
  }

  it("Caso A — faltante inicial sin consumo: 200 estimado, 150 stock -> faltan 50", async () => {
    const { jobMaterialId } = await setup("Cable Caso A", 200, 150);
    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.remaining_quantity).toBe(200);
    expect(status.current_stock).toBe(150);
    expect(status.missing_quantity).toBe(50);
  });

  it("Caso B (bug original) — 200 estimado, 150 stock, se consumen 130 -> pendiente 70, faltan 50 (NO 180)", async () => {
    const { jobMaterialId } = await setup("Cable Caso B", 200, 150);

    await registerConsumption(client, jobMaterialId, 130);

    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.consumed_quantity).toBe(130);
    expect(status.current_stock).toBe(20); // 150 - 130
    expect(status.remaining_quantity).toBe(70); // 200 - 130
    expect(status.missing_quantity).toBe(50); // max(70 - 20, 0), nunca 180
    expect(status.missing_quantity).not.toBe(180);
  });

  it("Caso C — consumo completo: 200 estimado, 220 stock, se consumen 200 -> pendiente 0, faltan 0", async () => {
    const { jobMaterialId } = await setup("Cable Caso C", 200, 220);
    await registerConsumption(client, jobMaterialId, 200);
    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.remaining_quantity).toBe(0);
    expect(status.missing_quantity).toBe(0);
    expect(status.current_stock).toBe(20);
  });

  it("Caso D — sobreconsumo: 200 estimado, 250 stock, se consumen 215 -> pendiente 0, faltan 0, desvío +15", async () => {
    const { jobMaterialId } = await setup("Cable Caso D", 200, 250);
    await registerConsumption(client, jobMaterialId, 215);
    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.remaining_quantity).toBe(0);
    expect(status.missing_quantity).toBe(0);
    expect(status.variance_quantity).toBe(15);
    expect(status.current_stock).toBe(35);
  });

  it("Caso E — stock superior a lo pendiente nunca da faltante negativo", async () => {
    // Stock inicial 120: tras consumir 40 queda en 80, como plantea el caso
    // del spec ("Stock actual: 80" ya es el valor posterior al consumo).
    const { jobMaterialId } = await setup("Cable Caso E", 100, 120);
    await registerConsumption(client, jobMaterialId, 40);
    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.current_stock).toBe(80);
    expect(status.remaining_quantity).toBe(60);
    expect(status.missing_quantity).toBe(0);
  });

  it("Caso F — sin consumo, stock parcial", async () => {
    const { jobMaterialId } = await setup("Cable Caso F", 100, 30);
    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.consumed_quantity).toBe(0);
    expect(status.missing_quantity).toBe(70);
  });

  it("recorrido completo del bug (sección 36): reposiciones sucesivas de stock bajan el faltante hasta 0", async () => {
    const { jobMaterialId, materialId } = await setup("Cable test recorrido", 200, 150);

    await registerConsumption(client, jobMaterialId, 130);
    let status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.missing_quantity).toBe(50);

    await addStockMovement(client, orgId, { materialId, movementType: "in", quantity: 20 });
    status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.current_stock).toBe(40);
    expect(status.remaining_quantity).toBe(70);
    expect(status.missing_quantity).toBe(30);

    await addStockMovement(client, orgId, { materialId, movementType: "in", quantity: 30 });
    status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.current_stock).toBe(70);
    expect(status.missing_quantity).toBe(0);

    await registerConsumption(client, jobMaterialId, 200);
    status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.remaining_quantity).toBe(0);
    expect(status.missing_quantity).toBe(0);
    expect(status.current_stock).toBe(0);
  });

  it("devolución (return) vinculada al trabajo reduce el consumo neto", async () => {
    // Semántica confirmada en register_job_material_consumption: si el
    // usuario corrige actual_quantity hacia abajo, el delta negativo genera
    // un movimiento 'return' y actual_quantity queda en el nuevo valor neto
    // (consumption - return), nunca en dos fuentes divergentes.
    const { jobMaterialId, materialId } = await setup("Cable devolución", 100, 200);

    await registerConsumption(client, jobMaterialId, 80);
    await registerConsumption(client, jobMaterialId, 60); // corrige hacia abajo -> return de 20

    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.consumed_quantity).toBe(60);
    expect(status.remaining_quantity).toBe(40);

    const { data: movements } = await client
      .from("stock_movements")
      .select("movement_type, quantity")
      .eq("material_id", materialId)
      .not("job_id", "is", null);
    const consumptionTotal = (movements ?? [])
      .filter((m) => m.movement_type === "consumption")
      .reduce((sum, m) => sum + Number(m.quantity), 0);
    const returnTotal = (movements ?? [])
      .filter((m) => m.movement_type === "return")
      .reduce((sum, m) => sum + Number(m.quantity), 0);
    expect(consumptionTotal - returnTotal).toBe(60);
  });

  it("idempotencia: reenviar el mismo consumo no duplica el movimiento ni el descuento de stock", async () => {
    const { jobMaterialId, materialId } = await setup("Cable idempotencia", 100, 100);

    await registerConsumption(client, jobMaterialId, 30);
    await registerConsumption(client, jobMaterialId, 30); // reenvío del mismo formulario
    await registerConsumption(client, jobMaterialId, 30); // tercer reenvío

    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.consumed_quantity).toBe(30);
    expect(status.current_stock).toBe(70);

    const { data: movements } = await client
      .from("stock_movements")
      .select("id")
      .eq("material_id", materialId)
      .eq("movement_type", "consumption");
    expect(movements?.length).toBe(1);
  });

  it("idempotencia bajo concurrencia: envíos simultáneos del mismo valor no duplican el consumo", async () => {
    const { jobMaterialId, materialId } = await setup("Cable concurrencia", 100, 100);

    await Promise.all([
      registerConsumption(client, jobMaterialId, 25),
      registerConsumption(client, jobMaterialId, 25),
      registerConsumption(client, jobMaterialId, 25),
    ]);

    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.consumed_quantity).toBe(25);
    expect(status.current_stock).toBe(75);

    const { data: movements } = await client
      .from("stock_movements")
      .select("quantity")
      .eq("material_id", materialId)
      .eq("movement_type", "consumption");
    const total = (movements ?? []).reduce((sum, m) => sum + Number(m.quantity), 0);
    expect(total).toBe(25);
  });

  it("política de stock (Fase 4): consumir más que el stock físico se rechaza y no altera nada", async () => {
    // Antes de Fase 4 el stock negativo estaba permitido; con stock valorizado un
    // saldo negativo haría imposible el costo promedio, así que se bloquea.
    const { jobMaterialId, materialId } = await setup("Cable stock negativo", 50, 10);

    await expect(registerConsumption(client, jobMaterialId, 50)).rejects.toThrow(/stock_insuficiente/);

    const status = await getJobMaterialStatus(client, jobMaterialId);
    expect(status.current_stock).toBe(10);
    expect(status.consumed_quantity).toBe(0);

    const { data: balance } = await client
      .from("material_stock_balances")
      .select("current_stock")
      .eq("material_id", materialId)
      .single();
    expect(Number(balance?.current_stock)).toBe(10);
  });
});
