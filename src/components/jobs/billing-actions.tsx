"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markJobInvoicedAction, revertJobBillingAction } from "@/app/app/trabajos/billing-actions";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Acciones de facturación (solo owner/admin; el permiso real está en el RPC). Los botones se crean
 * acá, en el cliente, y los diálogos se controlan por estado (sin asChild sobre elementos del servidor).
 */
export function BillingActions({
  jobId,
  invoiced,
  todayKey,
  current,
}: {
  jobId: string;
  invoiced: boolean;
  todayKey: string;
  current: { invoicedAt: string | null; invoiceNumber: string | null; notes: string | null };
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [invoicedAt, setInvoicedAt] = useState(todayKey);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");

  function openForm() {
    setInvoicedAt(invoiced && current.invoicedAt ? current.invoicedAt : todayKey);
    setInvoiceNumber(invoiced ? (current.invoiceNumber ?? "") : "");
    setNotes(invoiced ? (current.notes ?? "") : "");
    setError(null);
    setFormOpen(true);
  }

  function submit() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await markJobInvoicedAction(jobId, { invoicedAt, invoiceNumber, notes });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFormOpen(false);
      toast.success(invoiced ? "Datos de facturación actualizados" : "Trabajo marcado como facturado");
      router.refresh();
    });
  }

  function revert() {
    if (isPending) return;
    startTransition(async () => {
      const result = await revertJobBillingAction(jobId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setRevertOpen(false);
      toast.success("Facturación vuelta a pendiente");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={invoiced ? "outline" : "default"} onClick={openForm}>
        {invoiced ? "Editar datos de facturación" : "Marcar como facturado"}
      </Button>
      {invoiced && (
        <Button size="sm" variant="outline" onClick={() => setRevertOpen(true)}>
          Marcar nuevamente como pendiente
        </Button>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{invoiced ? "Datos de facturación" : "Marcar como facturado"}</DialogTitle>
            <DialogDescription>
              Es una marca interna: registra que el comprobante ya fue emitido. No cambia el estado del trabajo, los cobros ni la cotización.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="billingDate">Fecha de facturación</Label>
              <Input id="billingDate" type="date" value={invoicedAt} onChange={(e) => setInvoicedAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billingNumber">Número de comprobante (opcional)</Label>
              <Input id="billingNumber" placeholder="Ej: 00003-00001234" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billingNotes">Observaciones (opcional)</Label>
              <Textarea id="billingNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={isPending || !invoicedAt}>
              {isPending ? "Guardando..." : invoiced ? "Guardar" : "Confirmar facturación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar nuevamente como pendiente?</AlertDialogTitle>
            <AlertDialogDescription>
              El trabajo vuelve a &quot;Pendiente de facturar&quot;. El número y la fecha anteriores quedan guardados en el historial de facturación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={revert} disabled={isPending}>
              Volver a pendiente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
