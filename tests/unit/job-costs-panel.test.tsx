import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { JobCostsPanel } from "@/components/jobs/job-costs-panel";

const economics = {
  isClosed: false, contractedAmount: null, collectedAmount: 0, outstandingAmount: null, estimatedMaterialCost: null,
  actualMaterialCost: 0, materialCostComplete: true, actualMinutes: 420, actualLaborCost: 84000, laborCostComplete: true,
  laborSessionsCount: 1, sessionsMissingTime: 0, sessionsMissingMember: 0, sessionsMissingRate: 0, directExpenseTotal: 0,
  directExpenseCount: 0, recordedDirectCost: 84000, directCostDataComplete: true, actualDirectCost: 84000,
  contributionAmount: null, contributionPercentage: null,
};

/** Smoke de render (SSR) de la pestaña Costos: detecta errores de composición (p.ej. asChild sin hijo válido) por rol y estado. */
describe("SSR de JobCostsPanel", () => {
  for (const [name, expenses] of [
    ["sin gastos", []],
    ["con gastos vigentes y anulados", [
      { id: "e1", expenseDate: "2026-09-19", description: "Alquiler", amount: 20000, categoryName: "Alquiler", receiptPath: "x", isVoided: false, voidReason: null },
      { id: "e2", expenseDate: "2026-09-19", description: "Peaje", amount: 500, categoryName: "Peaje", receiptPath: null, isVoided: true, voidReason: "dup" },
    ]],
  ] as const) {
    it(`renderiza ${name} (admin)`, () => {
      const html = renderToString(
        <JobCostsPanel
          jobId="j1" currency="ARS" timezone="America/Argentina/Buenos_Aires" economics={economics}
          laborSessions={[
            { id: "s1", dateKey: "2026-09-15", minutes: 420, memberId: "m1", memberName: "Marcos", hourlyCost: 12000, cost: 84000, issue: "ok" },
            { id: "s2", dateKey: "2026-09-16", minutes: 60, memberId: null, memberName: null, hourlyCost: null, cost: null, issue: "no_member" },
          ]}
          members={[{ id: "m1", fullName: "Marcos" }]} expenses={[...expenses]}
          expenseCategories={[]} costStatus={{ estimatedMaterialCost: null, actualMaterialCost: 0, materialCostComplete: true, materialCostVariance: null }}
          hasMaterialConsumption={false} materialsPending={0} isAdmin canOperate
        />
      );
      expect(html).toContain("Costos directos y contribución");
    });
  }
  it("renderiza como worker (sin economía ni mano de obra)", () => {
    const html = renderToString(
      <JobCostsPanel
        jobId="j1" currency="ARS" timezone="America/Argentina/Buenos_Aires" economics={null} laborSessions={[]} members={[]} expenses={[]}
        expenseCategories={[]} costStatus={{ estimatedMaterialCost: null, actualMaterialCost: 0, materialCostComplete: true, materialCostVariance: null }}
        hasMaterialConsumption={false} materialsPending={0} isAdmin={false} canOperate
      />
    );
    expect(html).not.toContain("Costos directos y contribución");
    expect(html).not.toContain("Mano de obra");
    expect(html).toContain("Gastos directos registrados");
  });
});
