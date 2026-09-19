import { CONTRIBUTION_DISCLAIMER, contributionView } from "@/lib/economics/presentation";
import type { JobEconomics } from "@/lib/data/job-economics";
import { formatMoney } from "@/lib/format/money";
import { formatPercent } from "@/lib/format/variance";

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * Contratado -> costos directos (materiales + mano de obra + gastos registrados) -> contribución.
 * Solo se renderiza para owner/admin (la vista de la que sale ya devuelve vacío al resto).
 */
export function EconomicsSummary({ economics: e, currency }: { economics: JobEconomics; currency: string }) {
  const view = contributionView(e);
  const money = (v: number) => formatMoney(v, currency);
  const partial = !e.directCostDataComplete;

  return (
    <div className="grid gap-3 text-sm">
      <Line label="Monto contratado" value={e.contractedAmount === null ? "Sin cotización aceptada" : money(e.contractedAmount)} />
      <div className="grid gap-1.5 rounded-lg border p-3">
        <Line
          label="Costo real de materiales"
          value={e.materialCostComplete ? money(e.actualMaterialCost) : <span className="text-warning">{money(e.actualMaterialCost)} (incompleto)</span>}
        />
        <Line
          label="Costo de mano de obra"
          value={e.laborCostComplete ? money(e.actualLaborCost) : <span className="text-warning">{money(e.actualLaborCost)} (incompleto)</span>}
        />
        <Line label="Gastos directos registrados" value={money(e.directExpenseTotal)} />
        <div className="border-t pt-1.5">
          <Line
            strong
            label={e.isClosed ? "Costos directos" : "Costos directos acumulados"}
            value={
              partial ? (
                <span>
                  {money(e.recordedDirectCost)} <span className="font-normal text-warning">(parcial)</span>
                </span>
              ) : (
                money(e.recordedDirectCost)
              )
            }
          />
        </div>
      </div>

      {view.kind === "available" && (
        <div className="rounded-lg border-2 p-3" data-testid="contribution-available">
          <Line
            strong
            label={view.label}
            value={
              <span>
                {money(view.amount)}
                {view.percentage !== null && <span className="ml-2 font-normal text-muted-foreground">{formatPercent(view.percentage)}</span>}
              </span>
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {CONTRIBUTION_DISCLAIMER}
            {!view.final && " Trabajo en curso: es un valor acumulado, no el resultado final."}
          </p>
          {e.laborSessionsCount === 0 && e.isClosed && (
            <p className="mt-1 text-xs text-warning">No hay horas reales registradas en este trabajo: el costo laboral es $0 por falta de datos.</p>
          )}
        </div>
      )}

      {view.kind === "no_contract" && (
        <div className="rounded-lg border border-dashed p-3" data-testid="contribution-no-contract">
          <p className="font-medium">Contribución no calculable</p>
          <p className="text-xs text-muted-foreground">Sin cotización aceptada no hay monto contratado. Los costos directos registrados igual se muestran arriba.</p>
        </div>
      )}

      {view.kind === "incomplete" && (
        <div className="rounded-lg border border-warning/50 bg-warning/5 p-3" data-testid="contribution-incomplete">
          <p className="font-medium text-warning">Contribución no calculable — faltan costos</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {view.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Los costos directos mostrados son lo registrado hasta ahora (parcial).</p>
        </div>
      )}
    </div>
  );
}
