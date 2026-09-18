import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import type { JobBalanceItem } from "@/lib/data/payments";

function StatusBadge({ statusName, statusIsClosed }: { statusName: string; statusIsClosed: boolean }) {
  return <Badge variant={statusIsClosed ? "destructive" : "outline"}>{statusName}</Badge>;
}

export function OutstandingBalancesTable({
  balances,
  currency,
}: {
  balances: JobBalanceItem[];
  currency: string;
}) {
  return (
    <>
      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {balances.map((b) => (
          <Link
            key={b.jobId}
            href={`/app/trabajos/${b.jobId}`}
            className="block rounded-lg border bg-card p-4 hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{b.clientName}</p>
                <p className="text-sm text-muted-foreground">{b.jobTitle}</p>
              </div>
              <StatusBadge statusName={b.statusName} statusIsClosed={b.statusIsClosed} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendiente</p>
                <p className="text-lg font-semibold text-warning">{formatMoney(b.outstandingAmount, currency)}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Contratado {formatMoney(b.contractedAmount ?? 0, currency)}</p>
                <p>Cobrado {formatMoney(b.collectedAmount, currency)}</p>
              </div>
            </div>
            {b.lastPaymentDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                Último cobro: {formatDateOnly(b.lastPaymentDate)}
              </p>
            )}
          </Link>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Trabajo</TableHead>
              <TableHead className="text-right">Contratado</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último cobro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.map((b) => (
              <TableRow key={b.jobId} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/app/trabajos/${b.jobId}`} className="hover:underline">
                    {b.clientName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/app/trabajos/${b.jobId}`} className="hover:underline">
                    {b.jobTitle}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{formatMoney(b.contractedAmount ?? 0, currency)}</TableCell>
                <TableCell className="text-right">{formatMoney(b.collectedAmount, currency)}</TableCell>
                <TableCell className="text-right font-medium text-warning">
                  {formatMoney(b.outstandingAmount, currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge statusName={b.statusName} statusIsClosed={b.statusIsClosed} />
                </TableCell>
                <TableCell>{b.lastPaymentDate ? formatDateOnly(b.lastPaymentDate) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
