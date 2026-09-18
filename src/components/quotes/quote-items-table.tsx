"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteQuoteItemAction, importJobMaterialsAction } from "@/app/app/cotizaciones/actions";
import { AddQuoteItemDialog, type MaterialOption } from "@/components/quotes/add-quote-item-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format/money";
import { quoteItemLabels } from "@/lib/validations/quote";
import type { Tables } from "@/lib/supabase/database.types";

export function QuoteItemsTable({
  quoteId,
  jobId,
  items,
  materials,
  currency,
  isDraft,
  hasJobMaterials,
  subtotal,
  discountAmount,
  total,
}: {
  quoteId: string;
  jobId: string;
  items: Tables<"quote_items">[];
  materials: MaterialOption[];
  currency: string;
  isDraft: boolean;
  hasJobMaterials: boolean;
  subtotal: number;
  discountAmount: number;
  total: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(itemId: string) {
    startTransition(async () => {
      const result = await deleteQuoteItemAction(itemId, jobId, quoteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function importMaterials() {
    startTransition(async () => {
      const result = await importJobMaterialsAction(quoteId, jobId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Materiales importados");
      router.refresh();
    });
  }

  const costTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.cost_unit_price ?? 0), 0);
  const saleTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.sale_unit_price), 0);
  const margin = saleTotal - costTotal;

  return (
    <div className="flex flex-col gap-3">
      {isDraft && (
        <div className="flex items-center gap-2">
          <AddQuoteItemDialog
            quoteId={quoteId}
            jobId={jobId}
            materials={materials}
            trigger={<Button size="sm">Agregar ítem</Button>}
          />
          {hasJobMaterials && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={importMaterials}>
              Importar materiales del trabajo
            </Button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ítems en esta cotización.</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {quoteItemLabels[item.item_type as keyof typeof quoteItemLabels] ?? item.item_type}
                    </p>
                  </div>
                  {isDraft && (
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => remove(item.id)}>
                      Quitar
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>
                    {item.quantity} {item.unit} × {formatMoney(Number(item.sale_unit_price), currency)}
                  </span>
                  <span className="font-medium">
                    {formatMoney(Number(item.quantity) * Number(item.sale_unit_price), currency)}
                  </span>
                </div>
              </div>
            ))}
            <QuoteTotalsSummary
              subtotal={subtotal}
              discountAmount={discountAmount}
              total={total}
              costTotal={costTotal}
              margin={margin}
              currency={currency}
            />
          </div>

          <div className="hidden rounded-lg border sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                {isDraft && <TableHead className="w-9" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>{quoteItemLabels[item.item_type as keyof typeof quoteItemLabels] ?? item.item_type}</TableCell>
                  <TableCell className="text-right">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(Number(item.sale_unit_price), currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(Number(item.quantity) * Number(item.sale_unit_price), currency)}
                  </TableCell>
                  {isDraft && (
                    <TableCell>
                      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => remove(item.id)}>
                        Quitar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} className="text-right text-muted-foreground">
                  Subtotal
                </TableCell>
                <TableCell className="text-right">{formatMoney(subtotal, currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} className="text-right text-muted-foreground">
                  Descuento
                </TableCell>
                <TableCell className="text-right">{formatMoney(discountAmount, currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-base font-semibold">
                  {formatMoney(total, currency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} className="text-right text-muted-foreground">
                  Costo estimado
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatMoney(costTotal, currency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={isDraft ? 5 : 4} className="text-right text-muted-foreground">
                  Margen estimado antes de otros costos
                </TableCell>
                <TableCell className="text-right font-medium text-success">
                  {formatMoney(margin, currency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          </div>
        </>
      )}
    </div>
  );
}

function QuoteTotalsSummary({
  subtotal,
  discountAmount,
  total,
  costTotal,
  margin,
  currency,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  costTotal: number;
  margin: number;
  currency: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="flex justify-between py-0.5 text-muted-foreground">
        <span>Subtotal</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between py-0.5 text-muted-foreground">
        <span>Descuento</span>
        <span>{formatMoney(discountAmount, currency)}</span>
      </div>
      <div className="flex justify-between border-t py-1.5 mt-1 font-semibold">
        <span>Total</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
      <div className="flex justify-between py-0.5 text-muted-foreground">
        <span>Costo estimado</span>
        <span>{formatMoney(costTotal, currency)}</span>
      </div>
      <div className="flex justify-between py-0.5 font-medium text-success">
        <span>Margen estimado antes de otros costos</span>
        <span>{formatMoney(margin, currency)}</span>
      </div>
    </div>
  );
}
