"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { removePurchaseItemAction } from "@/app/app/compras/actions";
import { Button } from "@/components/ui/button";

export function PurchaseRemoveItemButton({ purchaseId, itemId, label }: { purchaseId: string; itemId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Quitar ${label}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await removePurchaseItemAction(purchaseId, itemId);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          router.refresh();
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
