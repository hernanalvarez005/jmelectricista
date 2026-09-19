import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobCostStatus } from "@/lib/data/job-costs";
import { formatMoney } from "@/lib/format/money";
import { formatPercent, variancePercent } from "@/lib/format/variance";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/** Costo real de materiales (costo congelado de cada consumo) vs el estimado de la cotización aceptada. */
export function MaterialCostCard({
  costStatus,
  hasConsumption,
  materialsPending,
  currency,
}: {
  costStatus: JobCostStatus;
  hasConsumption: boolean;
  materialsPending: number;
  currency: string;
}) {
  const variance = costStatus.materialCostVariance;
  const percent =
    variance !== null && costStatus.estimatedMaterialCost !== null
      ? variancePercent(costStatus.actualMaterialCost, costStatus.estimatedMaterialCost)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costo real de materiales</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:max-w-md">
        <Row
          label="Costo estimado"
          value={costStatus.estimatedMaterialCost === null ? "Sin cotización aceptada" : formatMoney(costStatus.estimatedMaterialCost, currency)}
        />
        <Row
          label="Costo real"
          value={
            !hasConsumption ? (
              <span className="text-muted-foreground">Sin consumos todavía</span>
            ) : costStatus.materialCostComplete ? (
              formatMoney(costStatus.actualMaterialCost, currency)
            ) : (
              <span className="text-warning">Costo real incompleto</span>
            )
          }
        />
        <Row
          label="Desvío"
          value={
            variance === null || !hasConsumption ? (
              "-"
            ) : (
              <span>
                {variance > 0 ? "+" : ""}
                {formatMoney(variance, currency)}
                {percent !== null && ` (${percent > 0 ? "+" : ""}${formatPercent(percent)})`}
                {materialsPending > 0 ? " · parcial" : ""}
              </span>
            )
          }
        />
        {!costStatus.materialCostComplete && (
          <p className="text-xs text-warning">
            Sin valoración histórica completa: hay consumos de stock anterior a la valoración. No se muestra un total parcial como si fuera completo.
          </p>
        )}
        {hasConsumption && materialsPending > 0 && (
          <p className="text-xs text-muted-foreground">
            Desvío parcial: todavía hay materiales pendientes de consumir, así que el real se compara contra el estimado completo.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Solo materiales, con el costo al que se consumió cada uno. La mano de obra y los gastos directos están en la pestaña Costos.
        </p>
      </CardContent>
    </Card>
  );
}
