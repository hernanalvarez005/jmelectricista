import { NextResponse } from "next/server";

import { requireCurrentOrg } from "@/lib/data/current-org";
import { getExpenseReceiptSignedUrl } from "@/lib/storage/expense-receipts";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const supabase = await createClient();
  const { data: expense, error } = await supabase
    .from("job_expenses")
    .select("receipt_path")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !expense || !expense.receipt_path) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }

  const signedUrl = await getExpenseReceiptSignedUrl(expense.receipt_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "No se pudo generar el comprobante" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
