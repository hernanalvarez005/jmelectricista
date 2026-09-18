import { NextResponse } from "next/server";

import { requireCurrentOrg } from "@/lib/data/current-org";
import { getPurchaseDocumentSignedUrl } from "@/lib/storage/purchase-documents";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("document_path")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !purchase || !purchase.document_path) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const signedUrl = await getPurchaseDocumentSignedUrl(purchase.document_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "No se pudo generar el documento" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
