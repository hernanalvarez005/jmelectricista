import { Plus } from "lucide-react";
import Link from "next/link";

import { EconomicsSummary } from "@/components/jobs/economics-summary";
import { ExpensesList } from "@/components/jobs/expenses-list";
import { LaborBreakdown } from "@/components/jobs/labor-breakdown";
import { MaterialCostCard } from "@/components/jobs/material-cost-card";
import { RegisterExpenseDialog } from "@/components/jobs/register-expense-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobCostStatus } from "@/lib/data/job-costs";
import type { JobEconomics, LaborSessionItem } from "@/lib/data/job-economics";
import type { JobExpenseItem } from "@/lib/data/expenses";
import { formatMinutes } from "@/lib/format/duration";
import { formatMoney } from "@/lib/format/money";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Pestaña Costos: economía (owner/admin), mano de obra (owner/admin), gastos directos (todos los
 * miembros; registrar solo operadores, anular solo owner/admin) y costo real de materiales.
 */
export function JobCostsPanel({
  jobId,
  currency,
  timezone,
  economics,
  laborSessions,
  members,
  expenses,
  expenseCategories,
  costStatus,
  hasMaterialConsumption,
  materialsPending,
  isAdmin,
  canOperate,
}: {
  jobId: string;
  currency: string;
  timezone: string;
  economics: JobEconomics | null;
  laborSessions: LaborSessionItem[];
  members: { id: string; fullName: string }[];
  expenses: JobExpenseItem[];
  expenseCategories: Tables<"job_expense_categories">[];
  costStatus: JobCostStatus;
  hasMaterialConsumption: boolean;
  materialsPending: number;
  isAdmin: boolean;
  canOperate: boolean;
}) {
  const activeExpenses = expenses.filter((e) => !e.isVoided);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && economics && (
        <Card>
          <CardHeader>
            <CardTitle>Costos directos y contribución</CardTitle>
          </CardHeader>
          <CardContent className="sm:max-w-xl">
            <EconomicsSummary economics={economics} currency={currency} />
          </CardContent>
        </Card>
      )}

      {isAdmin && economics && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Mano de obra</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link href="/app/configuracion">Tarifas</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2 text-sm sm:max-w-md">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tiempo real</span>
                <span>{formatMinutes(economics.actualMinutes)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Costo de mano de obra</span>
                <span className="font-medium">
                  {economics.laborCostComplete ? (
                    formatMoney(economics.actualLaborCost, currency)
                  ) : (
                    <span className="text-warning">{formatMoney(economics.actualLaborCost, currency)} (incompleto)</span>
                  )}
                </span>
              </div>
            </div>
            <LaborBreakdown jobId={jobId} sessions={laborSessions} currency={currency} members={members} canReassign />
            <p className="text-xs text-muted-foreground">
              Cada sesión usa el costo hora que su responsable tenía en la fecha del trabajo, congelado al cargar el tiempo real: cambiar una
              tarifa después no modifica estos importes. Fechas y horarios según la zona {timezone}.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Gastos directos registrados</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Total vigente: <span className="font-medium text-foreground">{formatMoney(activeExpenses.reduce((s, e) => s + e.amount, 0), currency)}</span>
            </p>
          </div>
          {canOperate && (
            <RegisterExpenseDialog
              jobId={jobId}
              timezone={timezone}
              categories={expenseCategories}
              trigger={
                <Button size="sm">
                  <Plus /> Registrar gasto
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ExpensesList jobId={jobId} expenses={expenses} currency={currency} canVoid={isAdmin} />
          <p className="text-xs text-muted-foreground">
            Son los gastos cargados en el sistema; no se puede saber si falta alguno. Los anulados quedan visibles y no suman.
          </p>
        </CardContent>
      </Card>

      <MaterialCostCard costStatus={costStatus} hasConsumption={hasMaterialConsumption} materialsPending={materialsPending} currency={currency} />
    </div>
  );
}
