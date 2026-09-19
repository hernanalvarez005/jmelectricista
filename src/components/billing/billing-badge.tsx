import { CircleCheck, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { billingStatusLabels, billingStatusShortLabels, type BillingStatus } from "@/lib/validations/billing";

/**
 * Estado de facturación como texto + ícono (nunca solo color). "Pendiente de facturar" no es un
 * error: usa tono de advertencia, no destructivo.
 */
export function BillingBadge({ status, compact = false }: { status: BillingStatus; compact?: boolean }) {
  const label = (compact ? billingStatusShortLabels : billingStatusLabels)[status];
  if (status === "invoiced") {
    return (
      <Badge variant="outline" className="border-success/50 text-success">
        <CircleCheck aria-hidden /> {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-warning/60 text-warning">
      <Clock aria-hidden /> {label}
    </Badge>
  );
}
