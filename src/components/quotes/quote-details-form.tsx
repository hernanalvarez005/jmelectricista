"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateQuoteDetailsAction } from "@/app/app/cotizaciones/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { quoteDetailsSchema, type QuoteDetailsInput } from "@/lib/validations/quote";
import type { Tables } from "@/lib/supabase/database.types";

export function QuoteDetailsForm({
  quote,
  jobId,
  isDraft,
}: {
  quote: Tables<"quotes">;
  jobId: string;
  isDraft: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { register, handleSubmit } = useForm<QuoteDetailsInput>({
    resolver: zodResolver(quoteDetailsSchema),
    defaultValues: {
      validUntil: quote.valid_until ?? "",
      discountAmount: String(quote.discount_amount ?? 0),
      notes: quote.notes ?? "",
      terms: quote.terms ?? "",
    },
  });

  function onSubmit(values: QuoteDetailsInput) {
    startTransition(async () => {
      const result = await updateQuoteDetailsAction(quote.id, jobId, values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Cotización actualizada");
      router.refresh();
    });
  }

  if (!isDraft) {
    return (
      <div className="grid gap-2 text-sm">
        <Row label="Válida hasta" value={quote.valid_until} />
        <Row label="Descuento" value={String(quote.discount_amount)} />
        <Row label="Notas" value={quote.notes} />
        <Row label="Condiciones" value={quote.terms} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="validUntil">Válida hasta</Label>
          <Input id="validUntil" type="date" {...register("validUntil")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="discountAmount">Descuento</Label>
          <Input id="discountAmount" inputMode="decimal" {...register("discountAmount")} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notas (visibles para el cliente)</Label>
        <Textarea id="notes" rows={2} {...register("notes")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="terms">Condiciones</Label>
        <Textarea id="terms" rows={2} {...register("terms")} />
      </div>
      <Button type="submit" size="sm" className="w-fit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[70%] text-right">{value || "-"}</span>
    </div>
  );
}
