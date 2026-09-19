import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.resolve(import.meta.dirname, "../../", rel), "utf8");

/**
 * Regresión del "Algo salió mal" intermitente al abrir la pestaña Costos en `next dev`:
 * un `trigger` (elemento) armado por un server component llega al cliente como elemento
 * `react.lazy` y el `Slot` de Radix (asChild) lanza "failed to slot onto its children".
 * Dentro del contenido de una pestaña, los triggers/botones asChild se crean en el cliente.
 */
describe("pestaña Costos: sin asChild alimentado desde el servidor", () => {
  it("JobCostsPanel (server component) no usa asChild ni pasa `trigger=` a diálogos", () => {
    const src = read("src/components/jobs/job-costs-panel.tsx");
    expect(src).not.toMatch(/asChild/);
    expect(src).not.toMatch(/trigger=/);
  });

  it("RegisterExpenseDialog crea su propio botón (no recibe `trigger`)", () => {
    const src = read("src/components/jobs/register-expense-dialog.tsx");
    expect(src).not.toMatch(/trigger\s*:\s*React\.ReactNode/);
    expect(src).toMatch(/<DialogTrigger asChild>\s*<Button/);
  });
});
