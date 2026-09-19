import type { PublicQuote } from "@/lib/data/public-quote";
import { renderQuotePdfBuffer } from "@/lib/pdf/generate-quote-pdf";

/**
 * PDF de la cotización compartida, renderizado ÚNICAMENTE desde el DTO público (nunca desde las tablas
 * internas ni desde Storage). Una cotización enviada es inmutable (triggers), así que el contenido es el
 * mismo que el snapshot ya enviado, y el bucket privado de PDFs no se toca.
 */
export function renderPublicQuotePdf(quote: PublicQuote): Promise<Buffer> {
  return renderQuotePdfBuffer({
    organizationName: quote.organization_name,
    currency: quote.currency,
    quoteNumber: quote.quote_number,
    issueDate: quote.issue_date,
    validUntil: quote.valid_until,
    clientName: quote.client_name,
    clientAddress: quote.client_address,
    jobTitle: quote.job_title,
    jobDescription: quote.job_description,
    items: quote.items.map((item, index) => ({
      key: String(index),
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
    subtotal: quote.subtotal,
    discountAmount: quote.discount_amount,
    total: quote.total,
    terms: quote.terms,
    notes: quote.notes,
  });
}
