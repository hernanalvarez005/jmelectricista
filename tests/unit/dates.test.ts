import { describe, expect, it } from "vitest";

import { formatDate, formatDateOnly } from "@/lib/format/dates";

describe("formatDateOnly", () => {
  it("formatea YYYY-MM-DD como DD/MM/YYYY", () => {
    expect(formatDateOnly("2026-09-18")).toBe("18/09/2026");
  });

  it("no corre el día en timezones de offset negativo (Argentina, UTC-3)", () => {
    // Regresión: formatDate(`${dateKey}T00:00:00Z`, tz) mostraba el día anterior.
    expect(formatDate("2026-09-18T00:00:00Z", "America/Argentina/Buenos_Aires")).toBe("17/09/2026");
    expect(formatDateOnly("2026-09-18")).toBe("18/09/2026");
  });

  it("respeta cambios de mes y año", () => {
    expect(formatDateOnly("2026-01-01")).toBe("01/01/2026");
    expect(formatDateOnly("2026-12-31")).toBe("31/12/2026");
  });

  it("año bisiesto", () => {
    expect(formatDateOnly("2024-02-29")).toBe("29/02/2024");
  });
});
