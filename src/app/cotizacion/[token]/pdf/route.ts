import { NextResponse } from "next/server";

import { getPublicQuote } from "@/lib/data/public-quote";
import { renderPublicQuotePdf } from "@/lib/pdf/public-quote-pdf";

export const dynamic = "force-dynamic";

/** PDF público de una cotización compartida. Sin sesión; autorizado solo por el token vigente. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) {
    return NextResponse.json({ error: "Este enlace ya no está disponible" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const pdf = await renderPublicQuotePdf(quote);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
