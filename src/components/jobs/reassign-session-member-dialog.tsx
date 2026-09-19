"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reassignSessionMemberAction } from "@/app/app/trabajos/expenses-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReassignSessionMemberDialog({
  jobId,
  sessionId,
  currentMemberId,
  members,
  hasCost,
}: {
  jobId: string;
  sessionId: string;
  currentMemberId: string | null;
  members: { id: string; fullName: string }[];
  hasCost: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(currentMemberId ?? "");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  function confirm() {
    if (!memberId || isPending) return;
    setServerError(null);
    startTransition(async () => {
      const result = await reassignSessionMemberAction(jobId, sessionId, memberId);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      toast.success(
        result.result === "costed"
          ? "Responsable actualizado y sesión valorizada con su tarifa."
          : result.result === "no_rate"
            ? "Responsable actualizado. Esa persona no tiene tarifa para la fecha: costo laboral no configurado."
            : "Responsable actualizado."
      );
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMemberId(currentMemberId ?? "");
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {currentMemberId ? "Cambiar responsable" : "Asignar responsable"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentMemberId ? "Cambiar responsable de la sesión" : "Asignar responsable de la sesión"}</DialogTitle>
          <DialogDescription>
            {hasCost
              ? "La sesión ya tiene el costo de la persona anterior. Al cambiarla se descarta esa tarifa congelada y se busca la tarifa histórica del nuevo responsable para la fecha de la sesión."
              : "Con el responsable asignado, la sesión se valoriza con la tarifa que esa persona tenía en la fecha del trabajo."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Responsable</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="w-full" aria-label="Responsable">
              <SelectValue placeholder="Elegí una persona" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button onClick={confirm} disabled={isPending || !memberId || memberId === currentMemberId}>
            {isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
