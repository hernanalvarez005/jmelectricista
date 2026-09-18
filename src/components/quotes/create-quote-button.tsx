"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createQuoteAction } from "@/app/app/cotizaciones/actions";
import { Button } from "@/components/ui/button";

export function CreateQuoteButton({ jobId, clientId }: { jobId: string; clientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await createQuoteAction(jobId, clientId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/app/cotizaciones/${result.id}`);
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending}>
      {isPending ? "Creando..." : "Crear cotización"}
    </Button>
  );
}
