"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptQuoteAction, markQuoteSentAction, rejectQuoteAction } from "@/app/app/cotizaciones/actions";
import { updateJobStatusAction } from "@/app/app/trabajos/actions";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuoteStatusActions({
  quoteId,
  jobId,
  status,
  jobStatuses,
}: {
  quoteId: string;
  jobId: string;
  status: string;
  jobStatuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showJobStatusPrompt, setShowJobStatusPrompt] = useState(false);
  const [selectedJobStatus, setSelectedJobStatus] = useState("");

  function run(action: () => Promise<{ error: string } | { ok: true }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      onSuccess?.();
    });
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

  return (
    <div className="flex items-center gap-2">
      {status === "draft" && (
        <Button disabled={isPending} onClick={() => run(() => markQuoteSentAction(quoteId, jobId))}>
          Marcar como enviada
        </Button>
      )}

      {status === "sent" && (
        <>
          <Button
            disabled={isPending}
            onClick={() => run(() => acceptQuoteAction(quoteId, jobId), () => setShowJobStatusPrompt(true))}
          >
            Aceptar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                Rechazar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Rechazar esta cotización?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. El trabajo no cambia de estado automáticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => rejectQuoteAction(quoteId, jobId))}>
                  Rechazar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Montado siempre (no solo cuando status === "sent"): el estado pasa a
          "accepted" apenas se confirma la aceptación, y este diálogo debe
          seguir visible para ofrecer actualizar el estado del trabajo. */}
      <AlertDialog open={showJobStatusPrompt} onOpenChange={setShowJobStatusPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cotización aceptada.</AlertDialogTitle>
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
