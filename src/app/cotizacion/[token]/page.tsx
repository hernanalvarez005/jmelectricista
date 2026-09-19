import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { getPublicQuote, recordPublicQuoteOpen } from "@/lib/data/public-quote";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";

// Sin caché: una cotización revocada tiene que dejar de verse en el mismo instante.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cotización",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Página pública de una cotización. Sin login: el token autoriza únicamente esta cotización y la página
 * solo usa el DTO público (get_public_quote): datos comerciales para el cliente, nada interno.
 */
export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();

  await recordPublicQuoteOpen(token);
  const money = (amount: number) => formatMoney(amount, quote.currency);

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Image src={brand.logoPath} alt={brand.name} width={44} height={44} className="rounded-md" priority />
          <div className="min-w-0">
            <p className="truncate font-semibold">{quote.organization_name}</p>
            <p className="text-sm opacity-80">Cotización</p>
          </div>
        </div>
        <div className="h-1 bg-accent" />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{quote.quote_number}</h1>
            <p className="text-sm text-muted-foreground">Emitida el {formatDateOnly(quote.issue_date)}</p>
            {quote.valid_until && <p className="text-sm text-muted-foreground">Válida hasta el {formatDateOnly(quote.valid_until)}</p>}
          </div>
          <a href={`/cotizacion/${token}/pdf`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "default" })}>
            <FileDown /> Ver / Descargar PDF
          </a>
        </section>

        <section className="grid gap-1 rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</p>
          <p className="font-medium">{quote.client_name}</p>
          {quote.client_address && <p className="text-muted-foreground">{quote.client_address}</p>}
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trabajo</p>
          <p className="font-medium">{quote.job_title}</p>
          {quote.job_description && <p className="text-muted-foreground">{quote.job_description}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Detalle</h2>
          <ul className="flex flex-col divide-y rounded-lg border bg-card" aria-label="Ítems de la cotización">
            {quote.items.map((item, index) => (
              <li key={index} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-4 text-sm">
                <p className="font-medium">{item.description}</p>
                <p className="text-right font-medium">{money(item.subtotal)}</p>
                <p className="text-muted-foreground">
                  {formatQuantity(item.quantity, item.unit)} × {money(item.unit_price)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{money(quote.subtotal)}</dd>
            </div>
            {quote.discount_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Descuento</dt>
                <dd>-{money(quote.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(quote.total)}</dd>
            </div>
          </dl>
        </section>

        {(quote.terms || quote.notes) && (
          <section className="grid gap-2 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            {quote.terms && <p className="whitespace-pre-line">{quote.terms}</p>}
            {quote.notes && <p className="whitespace-pre-line">{quote.notes}</p>}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-muted-foreground">{quote.organization_name}</footer>
    </div>
  );
}
