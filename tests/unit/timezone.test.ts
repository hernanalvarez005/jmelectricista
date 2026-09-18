import { describe, expect, it } from "vitest";

import { dateKeyInTZ, zonedDateTimeToIso, zonedParts } from "@/lib/scheduling/timezone";

const AR = "America/Argentina/Buenos_Aires";

describe("zonedDateTimeToIso / zonedParts", () => {
  it("08:00 en Buenos Aires es 11:00Z, sin importar la zona del proceso", () => {
    expect(zonedDateTimeToIso("2026-09-18", "08:00", AR)).toBe("2026-09-18T11:00:00.000Z");
  });

  it("cruza medianoche UTC sin correr el día local", () => {
    // 22:30 AR = 01:30Z del día siguiente
    const iso = zonedDateTimeToIso("2026-09-18", "22:30", AR);
    expect(iso).toBe("2026-09-19T01:30:00.000Z");
    expect(zonedParts(iso, AR)).toEqual({ date: "2026-09-18", time: "22:30" });
  });

  it("round-trip exacto para varias fechas, incluido 29/02 y fin de año", () => {
    for (const [d, t] of [["2024-02-29", "00:00"], ["2026-12-31", "23:59"], ["2026-01-01", "12:00"]]) {
      expect(zonedParts(zonedDateTimeToIso(d, t, AR), AR)).toEqual({ date: d, time: t });
    }
  });

  it("funciona en una zona con offset positivo", () => {
    const iso = zonedDateTimeToIso("2026-09-18", "08:00", "Europe/Madrid");
    expect(iso).toBe("2026-09-18T06:00:00.000Z"); // CEST, UTC+2
    expect(dateKeyInTZ(iso, "Europe/Madrid")).toBe("2026-09-18");
  });
});
