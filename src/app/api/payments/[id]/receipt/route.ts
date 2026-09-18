import { NextResponse } from "next/server";

import { requireCurrentOrg } from "@/lib/data/current-org";
import { createClient } from "@/lib/supabase/server";
import { getPaymentReceiptSignedUrl } from "@/lib/storage/payment-receipts";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("job_payments")
    .select("receipt_path")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !payment || !payment.receipt_path) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }

  const signedUrl = await getPaymentReceiptSignedUrl(payment.receipt_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "No se pudo generar el comprobante" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
