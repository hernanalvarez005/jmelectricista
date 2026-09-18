import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";

import { QuoteDocument } from "@/lib/pdf/quote-document";
import { createClient } from "@/lib/supabase/server";
import type { getQuoteDetail } from "@/lib/data/quotes";

const QUOTES_BUCKET = "quotes";
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "jm-electricista-logo.jpg");

export function quotePdfStoragePath(organizationId: string, quoteId: string): string {
  return `organizations/${organizationId}/quotes/${quoteId}/cotizacion.pdf`;
}

async function renderQuotePdfBuffer(
  organization: { name: string; currency: string },
  detail: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>
): Promise<Buffer> {
  const doc = QuoteDocument({
    organization,
    quote: detail.quote,
    clientName: detail.clientName,
    clientAddress: detail.clientAddress,
    jobTitle: detail.jobTitle,
    jobDescription: detail.jobDescription,
    items: detail.items,
    logoAbsolutePath: LOGO_PATH,
  });
  return renderToBuffer(doc);
}

/**
 * Devuelve una signed URL para el PDF de la cotización. Estrategia de
 * snapshot: mientras está en borrador se regenera siempre (puede seguir
 * cambiando); a partir de "sent" el PDF ya subido se sirve tal cual —
 * nunca se re-renderiza en silencio un documento que el cliente ya recibió.
 */
export async function getOrCreateQuotePdfSignedUrl(
  organization: { id: string; name: string; currency: string },
  detail: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>
): Promise<string> {
  const supabase = await createClient();
  const storagePath = quotePdfStoragePath(organization.id, detail.quote.id);

  const isDraft = detail.quote.status === "draft";

  if (!isDraft) {
    const { data: existing } = await supabase.storage.from(QUOTES_BUCKET).createSignedUrl(storagePath, 300);
    if (existing?.signedUrl) return existing.signedUrl;
  }

  const buffer = await renderQuotePdfBuffer(organization, detail);
  const { error: uploadError } = await supabase.storage.from(QUOTES_BUCKET).upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: signed, error: signError } = await supabase.storage
    .from(QUOTES_BUCKET)
    .createSignedUrl(storagePath, 300);
  if (signError || !signed) throw signError ?? new Error("could not sign quote pdf url");

  return signed.signedUrl;
}
