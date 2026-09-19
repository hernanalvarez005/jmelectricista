import { describe, expect, it } from "vitest";

import { parseWeeks } from "@/lib/data/analysis";
import type { JobEconomics } from "@/lib/data/job-economics";
import { CONTRIBUTION_DISCLAIMER, contributionView, costDataGaps } from "@/lib/economics/presentation";
import { describeVariancePercent, formatHoursDecimal, formatPercent, variancePercent } from "@/lib/format/variance";
import { friendlyExpenseError, jobExpenseSchema, voidExpenseSchema } from "@/lib/validations/expense";
import { friendlyLaborError, laborRateSchema } from "@/lib/validations/labor";

const uuid = "8a9d1c62-3f0e-4b6a-9d2e-5a1b2c3d4e5f";

function economics(overrides: Partial<JobEconomics> = {}): JobEconomics {
  return {
    isClosed: true,
    contractedAmount: 850_000,
    collectedAmount: 850_000,
    outstandingAmount: 0,
    estimatedMaterialCost: 280_000,
    actualMaterialCost: 315_000,
    materialCostComplete: true,
    actualMinutes: 900,
    actualLaborCost: 180_000,
    laborCostComplete: true,
    laborSessionsCount: 2,
    sessionsMissingTime: 0,
    sessionsMissingMember: 0,
    sessionsMissingRate: 0,
    directExpenseTotal: 40_000,
    directExpenseCount: 2,
    recordedDirectCost: 535_000,
    directCostDataComplete: true,
    actualDirectCost: 535_000,
    contributionAmount: 315_000,
    contributionPercentage: 37.0588,
    ...overrides,
  };
}

describe("variancePercent (agregación ponderada)", () => {
  it("(34 h - 30 h) / 30 h = +13,33%, no el promedio de 20% y 10%", () => {
    expect(variancePercent(34, 30)).toBeCloseTo(13.3333, 3);
    expect(variancePercent(34, 30)).not.toBeCloseTo((20 + 10) / 2, 1);
  });

  it("no calcula con estimado 0 o inválido", () => {
    expect(variancePercent(10, 0)).toBeNull();
    expect(variancePercent(10, -5)).toBeNull();
    expect(variancePercent(Number.NaN, 10)).toBeNull();
  });

  it("puede ser negativo", () => {
    expect(variancePercent(90, 100)).toBeCloseTo(-10, 6);
  });
});

describe("formato de desvíos y horas", () => {
  it("formatea porcentajes en es-AR con una decimal", () => {
    expect(formatPercent(37.0588)).toBe("37,1%");
    expect(formatPercent(25)).toBe("25%");
  });

  it("describe el desvío con texto (no depende del color) y sin juicios", () => {
    expect(describeVariancePercent(25)).toBe("+25% sobre lo estimado");
    expect(describeVariancePercent(-10)).toBe("-10% bajo lo estimado");
    expect(describeVariancePercent(0.02)).toBe("Sin desvío");
    expect(describeVariancePercent(null)).toBe("-");
    expect(describeVariancePercent(13.3333)).toBe("+13,3% sobre lo estimado");
  });

  it("horas decimales: 93,6 h", () => {
    expect(formatHoursDecimal(5616)).toBe("93,6 h");
    expect(formatHoursDecimal(0)).toBe("0 h");
  });
});

describe("contributionView", () => {
  it("trabajo cerrado y completo: 'Contribución del trabajo' final", () => {
    expect(contributionView(economics())).toMatchObject({ kind: "available", label: "Contribución del trabajo", final: true, amount: 315_000 });
  });

  it("trabajo abierto y completo: 'Contribución acumulada', no final", () => {
    expect(contributionView(economics({ isClosed: false }))).toMatchObject({ kind: "available", label: "Contribución acumulada", final: false });
  });

  it("costos incompletos: no calculable y con los motivos (aunque exista un monto contratado)", () => {
    const view = contributionView(
      economics({ directCostDataComplete: false, laborCostComplete: false, sessionsMissingRate: 1, contributionAmount: null, actualDirectCost: null })
    );
    expect(view.kind).toBe("incomplete");
    if (view.kind === "incomplete") expect(view.gaps).toEqual(["1 sesión sin tarifa configurada para su fecha: costo laboral no configurado."]);
  });

  it("sin cotización aceptada: 'no_contract' (los costos igual se muestran)", () => {
    expect(contributionView(economics({ contractedAmount: null, contributionAmount: null, contributionPercentage: null }))).toEqual({ kind: "no_contract" });
  });

  it("nunca usa el vocabulario de utilidad/ganancia neta", () => {
    expect(CONTRIBUTION_DISCLAIMER).toBe("Antes de costos indirectos e impuestos.");
    expect(JSON.stringify(contributionView(economics()))).not.toMatch(/neta|ganancia|utilidad|rentabilidad/i);
  });
});

describe("costDataGaps", () => {
  const complete = { materialCostComplete: true, sessionsMissingRate: 0, sessionsMissingMember: 0, sessionsMissingTime: 0 };

  it("sin faltantes -> lista vacía", () => {
    expect(costDataGaps(complete)).toEqual([]);
  });

  it("enumera cada faltante con singular/plural correctos", () => {
    const gaps = costDataGaps({ materialCostComplete: false, sessionsMissingRate: 2, sessionsMissingMember: 1, sessionsMissingTime: 3 });
    expect(gaps).toHaveLength(4);
    expect(gaps[1]).toContain("2 sesiones sin tarifa");
    expect(gaps[2]).toContain("1 sesión con tiempo real y sin responsable");
    expect(gaps[3]).toContain("3 sesiones completadas sin tiempo real");
  });
});

describe("validaciones de mano de obra y gastos", () => {
  it("la tarifa exige miembro, costo y fecha; acepta 0 como texto", () => {
    expect(laborRateSchema.safeParse({ memberId: uuid, hourlyCost: "0", validFrom: "2026-10-01" }).success).toBe(true);
    expect(laborRateSchema.safeParse({ memberId: "", hourlyCost: "1", validFrom: "2026-10-01" }).success).toBe(false);
    expect(laborRateSchema.safeParse({ memberId: uuid, hourlyCost: "", validFrom: "2026-10-01" }).success).toBe(false);
    expect(laborRateSchema.safeParse({ memberId: uuid, hourlyCost: "1", validFrom: "" }).success).toBe(false);
  });

  it("el gasto exige categoría, fecha, descripción e importe; la anulación exige motivo", () => {
    const ok = { categoryId: uuid, expenseDate: "2026-09-20", description: "Alquiler", amount: "20000" };
    expect(jobExpenseSchema.safeParse(ok).success).toBe(true);
    expect(jobExpenseSchema.safeParse({ ...ok, description: "  " }).success).toBe(false);
    expect(jobExpenseSchema.safeParse({ ...ok, categoryId: "" }).success).toBe(false);
    expect(voidExpenseSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(voidExpenseSchema.safeParse({ reason: "Duplicado" }).success).toBe(true);
  });

  it("traduce los errores de tarifas y gastos sin filtrar detalles internos", () => {
    expect(friendlyLaborError("tarifa_superpuesta: la fecha cae dentro de una tarifa ya cerrada (a b)", "x")).toMatch(/ya cerrada/);
    expect(friendlyLaborError("tarifa_superpuesta: ya existe una tarifa que empieza en esa fecha", "x")).toMatch(/empieza en esa fecha/);
    expect(friendlyLaborError("tarifa_en_uso: ...", "x")).toMatch(/ya se usó/);
    expect(friendlyLaborError("responsable_bloqueado: ...", "x")).toMatch(/administrador/);
    expect(friendlyLaborError('duplicate key value violates "x"', "No se pudo.")).toBe("No se pudo.");
    expect(friendlyExpenseError("ya fue anulado", "x")).toMatch(/anulado/);
    expect(friendlyExpenseError("internal error 500", "No se pudo registrar.")).toBe("No se pudo registrar.");
  });
});

describe("parseWeeks", () => {
  it("solo acepta 4, 8 o 12 semanas; cualquier otro valor cae en 8", () => {
    expect(parseWeeks("4")).toBe(4);
    expect(parseWeeks("12")).toBe(12);
    expect(parseWeeks("8")).toBe(8);
    expect(parseWeeks("99")).toBe(8);
    expect(parseWeeks(undefined)).toBe(8);
  });
});
