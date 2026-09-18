"use client";

import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadPurchaseDocumentAction } from "@/app/app/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PurchaseDocumentPanel({
  purchaseId,
  hasDocument,
  canEdit,
}: {
  purchaseId: string;
  hasDocument: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const router = useRouter();

  function upload() {
    if (!file || isPending) return;
    const formData = new FormData();
    formData.set("document", file);
    startTransition(async () => {
      const result = await uploadPurchaseDocumentAction(purchaseId, formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setFile(null);
      setInputKey((k) => k + 1);
      toast.success("Documento adjuntado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {hasDocument ? (
        <a
          href={`/api/purchases/${purchaseId}/document`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
        >
          <FileText className="size-4" /> Ver factura / remito
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">Sin documento adjunto.</p>
      )}
      {canEdit && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            key={inputKey}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label="Documento del proveedor"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" disabled={!file || isPending} onClick={upload}>
            <Upload /> {isPending ? "Subiendo..." : hasDocument ? "Reemplazar" : "Adjuntar"}
          </Button>
        </div>
      )}
    </div>
  );
}
