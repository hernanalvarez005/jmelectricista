import Link from "next/link";

import { BillingBadge } from "@/components/billing/billing-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { BillingOverviewItem } from "@/lib/data/billing";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import type { BillingFilter } from "@/lib/validations/billing";
import { paymentStatusLabels } from "@/lib/validations/payment";

const FILTERS: { value: BillingFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendiente" },
  { value: "invoiced", label: "Realizada" },
];

/** Filtro por enlaces (sin estado del cliente): conserva el resto de los filtros de la página. */
export function BillingFilterLinks({ current, searchParams }: { current: BillingFilter; searchParams: Record<string, string | undefined> }) {
  const hrefFor = (value: BillingFilter) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(searchParams)) if (v && key !== "billing") params.set(key, v);
    if (value !== "all") params.set("billing", value);
    const qs = params.toString();
    return qs ? `/app/cobros?${qs}` : "/app/cobros";
  };
  return (
    <nav aria-label="Filtrar por facturación" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Facturación:</span>
      {FILTERS.map((f) => (
        <Link
          key={f.value}
          href={hrefFor(f.value)}
          aria-current={f.value === current ? "true" : undefined}
          className={buttonVariants({ size: "sm", variant: f.value === current ? "default" : "outline" })}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

/** "Cobrado · pendiente de facturar" (advertencia, no error) o el estado de cobro + facturación por separado. */
function PaymentAndBilling({ item }: { item: BillingOverviewItem }) {
  if (item.paymentStatus === "paid" && item.billing.status === "pending") {
    return (
      <Badge variant="outline" className="border-warning/60 text-warning">
        Cobrado · pendiente de facturar
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline">{paymentStatusLabels[item.paymentStatus]}</Badge>
      <BillingBadge status={item.billing.status} compact />
    </div>
  );
}

export function BillingOverview({ items, currency }: { items: BillingOverviewItem[]; currency: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay trabajos para este filtro.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.jobId}>
          <Link href={`/app/trabajos/${item.jobId}`} className="flex flex-col gap-2 p-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.clientName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {item.jobTitle} · {item.statusName}
              </p>
              {item.billing.status === "invoiced" && (
                <p className="text-xs text-muted-foreground">
                  Facturado{item.billing.invoicedAt ? ` el ${formatDateOnly(item.billing.invoicedAt)}` : ""}
                  {item.billing.invoiceNumber ? ` · ${item.billing.invoiceNumber}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <PaymentAndBilling item={item} />
              <p className="text-sm">
                {item.contractedAmount !== null ? `${formatMoney(item.collectedAmount, currency)} de ${formatMoney(item.contractedAmount, currency)}` : formatMoney(item.collectedAmount, currency)}
                {item.outstandingAmount !== null && item.outstandingAmount > 0 && (
                  <span className="ml-2 font-medium text-warning">Saldo pendiente {formatMoney(item.outstandingAmount, currency)}</span>
                )}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
