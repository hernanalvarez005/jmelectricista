"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelPurchaseAction, receivePurchaseAction } from "@/app/app/compras/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Mode = "receive" | "cancel" | null;

export function PurchaseActions({ purchaseId, hasItems, totalLabel }: { purchaseId: string; hasItems: boolean; totalLabel: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  function confirm() {
    if (isPending || !mode) return;
    setServerError(null);
    startTransition(async () => {
      const result = mode === "receive" ? await receivePurchaseAction(purchaseId) : await cancelPurchaseAction(purchaseId);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setMode(null);
      toast.success(mode === "receive" ? "Compra recibida: el stock fue actualizado" : "Compra cancelada");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!hasItems} onClick={() => setMode("receive")}>
          Recibir compra
        </Button>
        <Button variant="outline" onClick={() => setMode("cancel")}>
          Cancelar compra
        </Button>
      </div>
      <AlertDialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setMode(null);
            setServerError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === "receive" ? "¿Recibir esta compra?" : "¿Cancelar esta compra?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "receive"
                ? `Se ingresará el stock de todos los ítems valorizado al costo de la compra (${totalLabel}) y la compra ya no podrá editarse. Esta acción no se puede deshacer.`
                : "La compra quedará cancelada, sin efecto sobre el stock. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
            <Button onClick={confirm} disabled={isPending} variant={mode === "cancel" ? "destructive" : "default"}>
              {isPending ? "Procesando..." : mode === "receive" ? "Confirmar recepción" : "Confirmar cancelación"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
