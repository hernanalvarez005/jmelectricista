"use client";

import { Copy, Link2Off, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ensureQuoteShareLinkAction, revokeQuoteShareLinkAction, sendQuoteWhatsAppAction } from "@/app/app/cotizaciones/share-actions";
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
import { Button, buttonVariants } from "@/components/ui/button";

export type QuoteSharePhoneState = "ok" | "missing" | "invalid";

/**
 * Compartir la cotización: enlace público persistente y revocable + WhatsApp. Los botones viven en el
 * cliente; el enlace se crea (o reutiliza) solo cuando el usuario lo pide.
 */
export function QuoteShareCard({
  quoteId,
  isDraft,
  canShare,
  shareUrl,
  openCount,
  lastOpenedLabel,
  phoneState,
  clientHref,
}: {
  quoteId: string;
  isDraft: boolean;
  canShare: boolean;
  shareUrl: string | null;
  openCount: number;
  lastOpenedLabel: string | null;
  phoneState: QuoteSharePhoneState;
  clientHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (isDraft) {
    return <p className="text-sm text-muted-foreground">Marcá la cotización como enviada para poder compartirla por enlace o WhatsApp.</p>;
  }
  if (!canShare) {
    return <p className="text-sm text-muted-foreground">Tu rol no permite compartir cotizaciones.</p>;
  }

  function copy() {
    startTransition(async () => {
      const result = await ensureQuoteShareLinkAction(quoteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        toast.success("Enlace copiado");
      } catch {
        toast.error("No se pudo copiar automáticamente. Copialo manualmente desde el campo.");
      }
      router.refresh();
    });
  }

  function whatsapp() {
    startTransition(async () => {
      const result = await sendQuoteWhatsAppAction(quoteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const opened = window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = result.whatsappUrl;
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeQuoteShareLinkAction(quoteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setRevokeOpen(false);
      toast.success("Enlace revocado: ya no se puede abrir");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Enlace compartido</p>
          {shareUrl ? <Badge variant="outline" className="border-success/50 text-success">Activo</Badge> : <span className="font-medium">Sin enlace</span>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Aperturas</p>
          <p className="font-medium">{shareUrl ? openCount : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Última apertura</p>
          <p className="font-medium">{shareUrl ? (lastOpenedLabel ?? "Todavía no se abrió") : "-"}</p>
        </div>
      </div>

      {shareUrl && (
        <input
          readOnly
          aria-label="Enlace público de la cotización"
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy} disabled={isPending}>
          <Copy /> Copiar enlace
        </Button>
        {phoneState === "ok" ? (
          <Button size="sm" onClick={whatsapp} disabled={isPending}>
            <MessageCircle /> Enviar por WhatsApp
          </Button>
        ) : (
          <div className="flex flex-col items-start gap-1" role="status">
            <p className="text-sm text-warning">
              {phoneState === "missing"
                ? "Agregar teléfono para contactar por WhatsApp"
                : "El teléfono del cliente no tiene un formato válido para WhatsApp."}
            </p>
            <Link href={clientHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {phoneState === "missing" ? "Agregar teléfono" : "Editar cliente"}
            </Link>
          </div>
        )}
        {shareUrl && (
          <Button size="sm" variant="ghost" onClick={() => setRevokeOpen(true)} disabled={isPending}>
            <Link2Off /> Revocar enlace
          </Button>
        )}
      </div>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar el enlace?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace deja de funcionar de inmediato: quien lo tenga ya no podrá ver la cotización. Si volvés a compartirla se crea un enlace nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={revoke} disabled={isPending}>
              Revocar enlace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
