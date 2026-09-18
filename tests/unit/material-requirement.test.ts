import { describe, expect, it } from "vitest";

import { calculateMaterialRequirement } from "@/lib/materials/requirement";

describe("calculateMaterialRequirement", () => {
  it("Caso A — faltante inicial, sin consumo", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 200, consumedQuantity: 0, currentStock: 150 });
    expect(r.remainingQuantity).toBe(200);
    expect(r.missingQuantity).toBe(50);
    expect(r.varianceQuantity).toBe(-200);
  });

  it("Caso B — consumo parcial (reproduce el bug 200/150/130: antes daba 180, debe dar 50)", () => {
    // Stock inicial 150, se consumen 130 -> stock físico actual 20.
    const r = calculateMaterialRequirement({ estimatedQuantity: 200, consumedQuantity: 130, currentStock: 20 });
    expect(r.remainingQuantity).toBe(70);
    expect(r.missingQuantity).toBe(50);
    expect(r.missingQuantity).not.toBe(180);
    expect(r.varianceQuantity).toBe(-70);
  });

  it("Caso C — consumo completo", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 200, consumedQuantity: 200, currentStock: 20 });
    expect(r.remainingQuantity).toBe(0);
    expect(r.missingQuantity).toBe(0);
    expect(r.varianceQuantity).toBe(0);
  });

  it("Caso D — sobreconsumo: pendiente y faltante nunca negativos, desvío positivo", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 200, consumedQuantity: 215, currentStock: 35 });
    expect(r.remainingQuantity).toBe(0);
    expect(r.missingQuantity).toBe(0);
    expect(r.varianceQuantity).toBe(15);
  });

  it("Caso E — stock superior a lo pendiente: faltante nunca negativo", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 100, consumedQuantity: 40, currentStock: 80 });
    expect(r.remainingQuantity).toBe(60);
    expect(r.missingQuantity).toBe(0);
  });

  it("Caso F — sin consumo, stock parcial", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 100, consumedQuantity: 0, currentStock: 30 });
    expect(r.remainingQuantity).toBe(100);
    expect(r.missingQuantity).toBe(70);
  });

  it("devolución neteada: consumo 80 - devolución 20 = consumo neto 60", () => {
    // La devolución vinculada a un trabajo se modela como consumo neto más
    // bajo (ver register_job_material_consumption): esto solo verifica que
    // la fórmula, alimentada con el neto, da el pendiente esperado.
    const consumoNeto = 80 - 20;
    const r = calculateMaterialRequirement({ estimatedQuantity: 100, consumedQuantity: consumoNeto, currentStock: 200 });
    expect(r.consumedQuantity).toBe(60);
    expect(r.remainingQuantity).toBe(40);
  });

  it("nunca devuelve remainingQuantity ni missingQuantity negativos para consumos absurdamente altos", () => {
    const r = calculateMaterialRequirement({ estimatedQuantity: 10, consumedQuantity: 10_000, currentStock: 0 });
    expect(r.remainingQuantity).toBe(0);
    expect(r.missingQuantity).toBe(0);
    expect(r.varianceQuantity).toBe(9990);
  });
});
