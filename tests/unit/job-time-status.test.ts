import { describe, expect, it } from "vitest";

import { calculateJobTimeStatus, type SessionForTimeStatus } from "@/lib/time/job-time-status";

function session(overrides: Partial<SessionForTimeStatus>): SessionForTimeStatus {
  return {
    status: "completed",
    planned_start_at: "2026-09-20T08:00:00Z",
    planned_end_at: "2026-09-20T12:00:00Z",
    actual_start_at: "2026-09-20T08:00:00Z",
    actual_end_at: "2026-09-20T12:00:00Z",
    ...overrides,
  };
}

describe("calculateJobTimeStatus", () => {
  it("desvío positivo: real por encima de lo estimado", () => {
    const s = calculateJobTimeStatus(600, [
      session({ actual_start_at: "2026-09-20T08:00:00Z", actual_end_at: "2026-09-20T20:00:00Z" }), // 720 min
    ]);
    expect(s.actualMinutes).toBe(720);
    expect(s.varianceMinutes).toBe(120);
    expect(s.variancePercentage).toBe(20);
  });

  it("desvío negativo: real por debajo de lo estimado", () => {
    const s = calculateJobTimeStatus(600, [
      session({ actual_start_at: "2026-09-20T08:00:00Z", actual_end_at: "2026-09-20T17:00:00Z" }), // 540 min
    ]);
    expect(s.actualMinutes).toBe(540);
    expect(s.varianceMinutes).toBe(-60);
    expect(s.variancePercentage).toBe(-10);
  });

  it("sin estimación: variancePercentage es null (no 0 ni Infinity)", () => {
    const s = calculateJobTimeStatus(null, [session({})]);
    expect(s.varianceMinutes).toBeNull();
    expect(s.variancePercentage).toBeNull();
  });

  it("estimación en 0: variancePercentage es null (evita división por cero)", () => {
    const s = calculateJobTimeStatus(0, [session({})]);
    expect(s.variancePercentage).toBeNull();
  });

  it("sesión completada sin actual_start_at/actual_end_at: actualTimeComplete = false", () => {
    const s = calculateJobTimeStatus(600, [session({ actual_start_at: null, actual_end_at: null })]);
    expect(s.completedSessionsWithoutActualTime).toBe(1);
    expect(s.actualTimeComplete).toBe(false);
  });

  it("REGRESIÓN: sesión completada sin tiempo real NUNCA usa planned como sustituto", () => {
    // Planificado: 08:00-12:00 (240 min). Completada. Sin actual_start_at/end_at.
    const s = calculateJobTimeStatus(600, [
      session({
        planned_start_at: "2026-09-20T08:00:00Z",
        planned_end_at: "2026-09-20T12:00:00Z",
        actual_start_at: null,
        actual_end_at: null,
      }),
    ]);
    expect(s.actualMinutes).toBe(0); // NUNCA 240
    expect(s.plannedMinutes).toBe(240); // planned sí se agrega, pero por separado
  });

  it("mezcla de sesiones: solo las completadas con ambos timestamps suman tiempo real", () => {
    const s = calculateJobTimeStatus(120, [
      session({ actual_start_at: "2026-09-20T08:00:00Z", actual_end_at: "2026-09-20T09:00:00Z" }), // 60 min real
      session({ actual_start_at: null, actual_end_at: null }), // completada sin real
      session({ status: "scheduled", actual_start_at: null, actual_end_at: null }), // aún no ejecutada
      session({ status: "cancelled", actual_start_at: null, actual_end_at: null }),
    ]);
    expect(s.actualMinutes).toBe(60);
    expect(s.completedSessions).toBe(2);
    expect(s.completedSessionsWithoutActualTime).toBe(1);
    expect(s.actualTimeComplete).toBe(false);
    // plannedMinutes solo cuenta scheduled+completed, no cancelled
    expect(s.plannedMinutes).toBe(240 * 3);
  });
});
