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
import type { RecentPaymentItem } from "@/lib/data/payments";

export function RecentPaymentsList({ payments, currency }: { payments: RecentPaymentItem[]; currency: string }) {
  return (
    <>
      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {payments.map((p) => (
          <Link
            key={p.id}
            href={`/app/trabajos/${p.jobId}`}
            className={`block rounded-lg border bg-card p-4 hover:bg-muted/40 ${p.isVoided ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">{formatDateOnly(p.paymentDate)}</p>
                <p className="font-medium">{p.clientName}</p>
                <p className="text-sm text-muted-foreground">{p.jobTitle}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${p.isVoided ? "line-through" : ""}`}>
                  {formatMoney(p.amount, currency)}
                </p>
                {p.isVoided && <Badge variant="destructive">ANULADO</Badge>}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.methodName}
              {p.accountName ? ` · ${p.accountName}` : ""}
            </p>
          </Link>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Trabajo</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className={p.isVoided ? "opacity-60" : undefined}>
                <TableCell>{formatDateOnly(p.paymentDate)}</TableCell>
                <TableCell>
                  <Link href={`/app/trabajos/${p.jobId}`} className="hover:underline">
                    {p.clientName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/app/trabajos/${p.jobId}`} className="hover:underline">
                    {p.jobTitle}
                  </Link>
                </TableCell>
                <TableCell className={`text-right font-medium ${p.isVoided ? "line-through" : ""}`}>
                  {formatMoney(p.amount, currency)}
                </TableCell>
                <TableCell>{p.methodName}</TableCell>
                <TableCell>{p.accountName ?? "-"}</TableCell>
                <TableCell>{p.isVoided ? <Badge variant="destructive">ANULADO</Badge> : <Badge variant="outline">Vigente</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
