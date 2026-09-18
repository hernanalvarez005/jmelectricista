import { NextResponse } from "next/server";

import { getQuoteDetail } from "@/lib/data/quotes";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getOrCreateQuotePdfSignedUrl } from "@/lib/pdf/generate-quote-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const detail = await getQuoteDetail(organization.id, id);
  if (!detail) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  try {
    const signedUrl = await getOrCreateQuotePdfSignedUrl(organization, detail);
    return NextResponse.redirect(signedUrl);
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }
}
