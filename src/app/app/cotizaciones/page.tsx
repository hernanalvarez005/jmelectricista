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
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listQuotes } from "@/lib/data/quotes";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { quoteStatusLabels } from "@/lib/validations/quote";

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  rejected: "destructive",
  expired: "secondary",
};

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { organization } = await requireCurrentOrg();
  const quotes = await listQuotes(organization.id, status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Cotizaciones</h2>
        <p className="text-sm text-muted-foreground">
          {quotes.length} cotización{quotes.length === 1 ? "" : "es"} en total.
        </p>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay cotizaciones. Se crean desde la ficha de un trabajo.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Trabajo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">
                    <Link href={`/app/cotizaciones/${q.id}`} className="hover:underline">
                      {q.quote_number}
                    </Link>
                  </TableCell>
                  <TableCell>{q.clientName}</TableCell>
                  <TableCell>{q.jobTitle}</TableCell>
                  <TableCell>{formatDateOnly(q.issue_date)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[q.status] ?? "outline"}>
                      {quoteStatusLabels[q.status] ?? q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(Number(q.total), organization.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
