"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateJobStatusAction } from "@/app/app/trabajos/actions";
import { PaymentHistoryList } from "@/components/jobs/payment-history-list";
import { RegisterPaymentDialog } from "@/components/jobs/register-payment-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobFinancialStatus, JobPaymentItem } from "@/lib/data/payments";
import { formatMoney } from "@/lib/format/money";
import { paymentStatusLabels } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

function statusBadgeVariant(status: JobFinancialStatus["paymentStatus"]) {
  if (status === "paid") return "default" as const;
  if (status === "partial") return "outline" as const;
  if (status === "no_contract") return "secondary" as const;
  return "secondary" as const;
}

export function JobPaymentsPanel({
  jobId,
  currency,
  timezone,
  financialStatus,
  payments,
  paymentMethods,
  paymentAccounts,
  jobStatuses,
  canVoid,
}: {
  jobId: string;
  currency: string;
  timezone: string;
  financialStatus: JobFinancialStatus;
  payments: JobPaymentItem[];
  paymentMethods: Tables<"payment_methods">[];
  paymentAccounts: Tables<"payment_accounts">[];
  jobStatuses: { id: string; name: string }[];
  canVoid: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showJobStatusPrompt, setShowJobStatusPrompt] = useState(false);
  const [selectedJobStatus, setSelectedJobStatus] = useState("");

  function handleRegistered(outstandingAmount: number | null) {
    if (outstandingAmount === 0) {
      setShowJobStatusPrompt(true);
    }
  }

  function confirmJobStatusUpdate() {
    if (!selectedJobStatus) {
      setShowJobStatusPrompt(false);
      return;
    }
    startTransition(async () => {
      const result = await updateJobStatusAction(jobId, selectedJobStatus);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Estado del trabajo actualizado");
      setShowJobStatusPrompt(false);
      router.refresh();
    });
  }

  const { contractedAmount, collectedAmount, outstandingAmount, overpaidAmount, paymentStatus } = financialStatus;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {contractedAmount === null ? (
          <div>
            <p className="font-medium">Sin cotización aceptada</p>
            <p className="text-sm text-muted-foreground">
              Cobrado: {formatMoney(collectedAmount, currency)} · Saldo: no calculable
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Contratado</p>
              <p className="text-lg font-semibold sm:text-xl">{formatMoney(contractedAmount, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-lg font-semibold sm:text-xl">{formatMoney(collectedAmount, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className={`text-lg font-semibold sm:text-xl ${outstandingAmount! > 0 ? "text-warning" : "text-success"}`}>
                {formatMoney(outstandingAmount ?? 0, currency)}
              </p>
            </div>
          </div>
        )}
        <RegisterPaymentDialog
          jobId={jobId}
          timezone={timezone}
          paymentMethods={paymentMethods}
          paymentAccounts={paymentAccounts}
          onRegistered={handleRegistered}
          trigger={<Button size="sm">Registrar cobro</Button>}
        />
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={statusBadgeVariant(paymentStatus)}>{paymentStatusLabels[paymentStatus]}</Badge>
        {overpaidAmount > 0 && (
          <Badge variant="outline" className="text-info">
            Excedente cobrado: {formatMoney(overpaidAmount, currency)}
          </Badge>
        )}
      </div>

      <PaymentHistoryList jobId={jobId} payments={payments} currency={currency} canVoid={canVoid} />

      <AlertDialog open={showJobStatusPrompt} onOpenChange={setShowJobStatusPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldo completo.</AlertDialogTitle>
            <AlertDialogDescription>¿Querés actualizar el estado del trabajo?</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={selectedJobStatus} onValueChange={setSelectedJobStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná un estado" />
            </SelectTrigger>
            <SelectContent>
              {jobStatuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Ahora no</AlertDialogCancel>
            <AlertDialogAction onClick={confirmJobStatusUpdate} disabled={isPending || !selectedJobStatus}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
