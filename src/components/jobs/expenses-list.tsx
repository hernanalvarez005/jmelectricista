"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { voidExpenseAction } from "@/app/app/trabajos/expenses-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { JobExpenseItem } from "@/lib/data/expenses";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

function VoidExpenseButton({ expenseId, jobId }: { expenseId: string; jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  function confirm() {
    if (!reason.trim() || isPending) return;
    startTransition(async () => {
      const result = await voidExpenseAction(expenseId, jobId, { reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Gasto anulado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Anular
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular este gasto?</AlertDialogTitle>
          <AlertDialogDescription>
            El gasto queda visible en el historial marcado como ANULADO y deja de sumar a los gastos directos del trabajo. No se puede
            deshacer ni editar: para corregirlo, cargá uno nuevo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="void-expense-reason">Motivo (obligatorio)</Label>
          <Textarea id="void-expense-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={isPending || !reason.trim()}>
            Anular gasto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReceiptLink({ expenseId }: { expenseId: string }) {
  return (
    <a
      href={`/api/expenses/${expenseId}/receipt`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      <FileText className="size-3.5" /> Comprobante
    </a>
  );
}

export function ExpensesList({
  jobId,
  expenses,
  currency,
  canVoid,
}: {
  jobId: string;
  expenses: JobExpenseItem[];
  currency: string;
  canVoid: boolean;
}) {
  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay gastos directos registrados para este trabajo.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {expenses.map((e) => (
          <div key={e.id} className={`rounded-lg border bg-card p-4 ${e.isVoided ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">{formatDateOnly(e.expenseDate)}</p>
                <p className={`text-lg font-semibold ${e.isVoided ? "line-through" : ""}`}>{formatMoney(e.amount, currency)}</p>
              </div>
              {e.isVoided ? <Badge variant="destructive">ANULADO</Badge> : canVoid && <VoidExpenseButton expenseId={e.id} jobId={jobId} />}
            </div>
            <p className="mt-1 text-sm font-medium">{e.categoryName}</p>
            <p className="text-sm text-muted-foreground">{e.description}</p>
            {e.isVoided && e.voidReason && <p className="mt-1 text-sm text-destructive">Motivo: {e.voidReason}</p>}
            {e.receiptPath && (
              <div className="mt-2">
                <ReceiptLink expenseId={e.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id} className={e.isVoided ? "opacity-60" : undefined}>
                <TableCell>{formatDateOnly(e.expenseDate)}</TableCell>
                <TableCell>{e.categoryName}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className={`text-right font-medium ${e.isVoided ? "line-through" : ""}`}>{formatMoney(e.amount, currency)}</TableCell>
                <TableCell>{e.receiptPath ? <ReceiptLink expenseId={e.id} /> : "-"}</TableCell>
                <TableCell>
                  {e.isVoided ? (
                    <span title={e.voidReason ?? undefined}>
                      <Badge variant="destructive">ANULADO</Badge>
                    </span>
                  ) : (
                    <Badge variant="outline">Vigente</Badge>
                  )}
                </TableCell>
                <TableCell>{!e.isVoided && canVoid && <VoidExpenseButton expenseId={e.id} jobId={jobId} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
