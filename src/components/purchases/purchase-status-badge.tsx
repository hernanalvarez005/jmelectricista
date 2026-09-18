import { Badge } from "@/components/ui/badge";
import { purchaseStatusLabels, type PurchaseStatus } from "@/lib/validations/purchase";

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const variant = status === "received" ? "default" : status === "cancelled" ? "destructive" : "secondary";
  return <Badge variant={variant}>{purchaseStatusLabels[status]}</Badge>;
}
