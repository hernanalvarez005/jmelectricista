"use client";

import { FileText, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { voidPaymentAction } from "@/app/app/trabajos/payments-actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import type { JobPaymentItem } from "@/lib/data/payments";

function VoidPaymentButton({
  paymentId,
  jobId,
  disabled,
}: {
  paymentId: string;
  jobId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  function confirm() {
    if (!reason.trim()) return;
    startTransition(async () => {
      const result = await voidPaymentAction(paymentId, jobId, { reason });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Cobro anulado");
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
        <Button size="sm" variant="ghost" disabled={disabled}>
          Anular
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular este cobro?</AlertDialogTitle>
          <AlertDialogDescription>
            El cobro queda visible en el historial marcado como anulado y deja de contar en el total
            cobrado. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="void-reason">Motivo (obligatorio)</Label>
          <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={isPending || !reason.trim()}>
            Anular cobro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReceiptLink({ paymentId }: { paymentId: string }) {
  return (
    <a
      href={`/api/payments/${paymentId}/receipt`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      <FileText className="size-3.5" /> Comprobante
    </a>
  );
}

function ConfirmationLink({ url, hint }: { url: string | undefined; hint: string | null }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <MessageCircle className="size-3.5" /> Enviar confirmación
      </a>
    );
  }
  return hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null;
}

export function PaymentHistoryList({
  jobId,
  payments,
  currency,
  canVoid,
  confirmationUrls = {},
  confirmationHint = null,
}: {
  jobId: string;
  payments: JobPaymentItem[];
  currency: string;
  canVoid: boolean;
  /** paymentId -> enlace de WhatsApp con la confirmación (solo si el teléfono del cliente es válido). */
  confirmationUrls?: Record<string, string>;
  /** Por qué no hay enlace de confirmación (sin teléfono / formato inválido). */
  confirmationHint?: string | null;
}) {
  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay cobros registrados para este trabajo.</p>;
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {payments.map((p) => (
          <div key={p.id} className={`rounded-lg border bg-card p-4 ${p.isVoided ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">{formatDateOnly(p.paymentDate)}</p>
                <p className={`text-lg font-semibold ${p.isVoided ? "line-through" : ""}`}>
                  {formatMoney(p.amount, currency)}
                </p>
              </div>
              {p.isVoided ? (
                <Badge variant="destructive">ANULADO</Badge>
              ) : (
                canVoid && <VoidPaymentButton paymentId={p.id} jobId={jobId} disabled={false} />
              )}
            </div>
            <p className="mt-1 text-sm">
              {p.methodName}
              {p.accountName ? ` · ${p.accountName}` : ""}
            </p>
            {p.reference && <p className="text-sm text-muted-foreground">Ref. {p.reference}</p>}
            {p.isVoided && p.voidReason && (
              <p className="mt-1 text-sm text-destructive">Motivo: {p.voidReason}</p>
            )}
            {p.receiptPath && (
              <div className="mt-2">
                <ReceiptLink paymentId={p.id} />
              </div>
            )}
            {!p.isVoided && (
              <div className="mt-2">
                <ConfirmationLink url={confirmationUrls[p.id]} hint={confirmationHint} />
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
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className={p.isVoided ? "opacity-60" : undefined}>
                <TableCell>{formatDateOnly(p.paymentDate)}</TableCell>
                <TableCell className={`text-right font-medium ${p.isVoided ? "line-through" : ""}`}>
                  {formatMoney(p.amount, currency)}
                </TableCell>
                <TableCell>{p.methodName}</TableCell>
                <TableCell>{p.accountName ?? "-"}</TableCell>
                <TableCell>{p.reference ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {p.receiptPath && <ReceiptLink paymentId={p.id} />}
                    {!p.isVoided && <ConfirmationLink url={confirmationUrls[p.id]} hint={confirmationHint} />}
                    {!p.receiptPath && p.isVoided && "-"}
                  </div>
                </TableCell>
                <TableCell>
                  {p.isVoided ? (
                    <span title={p.voidReason ?? undefined}>
                      <Badge variant="destructive">ANULADO</Badge>
                    </span>
                  ) : (
                    <Badge variant="outline">Vigente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!p.isVoided && canVoid && <VoidPaymentButton paymentId={p.id} jobId={jobId} disabled={false} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
