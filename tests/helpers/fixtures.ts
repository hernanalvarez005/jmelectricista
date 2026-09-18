import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getSeedUnitId(client: Client, organizationId: string, symbol = "m"): Promise<string> {
  const { data, error } = await client
    .from("material_units")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("symbol", symbol)
    .single();
  if (error || !data) throw new Error(`No se encontró la unidad semilla '${symbol}': ${error?.message}`);
  return data.id;
}

export async function createMaterial(
  client: Client,
  organizationId: string,
  opts: { name: string; unitId: string }
): Promise<string> {
  const { data, error } = await client
    .from("materials")
    .insert({ organization_id: organizationId, unit_id: opts.unitId, name: opts.name })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear material de test: ${error?.message}`);
  return data.id;
}

export async function createTestClient(client: Client, organizationId: string, name: string): Promise<string> {
  const { data, error } = await client
    .from("clients")
    .insert({ organization_id: organizationId, name })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear cliente de test: ${error?.message}`);
  return data.id;
}

export async function getAnyStatusId(
  client: Client,
  organizationId: string,
  opts: { closed?: boolean } = {}
): Promise<string> {
  let query = client.from("job_statuses").select("id, is_closed").eq("organization_id", organizationId);
  if (opts.closed !== undefined) query = query.eq("is_closed", opts.closed);
  const { data, error } = await query.limit(1).single();
  if (error || !data) throw new Error(`No se encontró job_status: ${error?.message}`);
  return data.id;
}

export async function createJob(
  client: Client,
  organizationId: string,
  opts: { clientId: string; statusId: string; title: string }
): Promise<string> {
  const { data, error } = await client
    .from("jobs")
    .insert({
      organization_id: organizationId,
      client_id: opts.clientId,
      status_id: opts.statusId,
      title: opts.title,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear trabajo de test: ${error?.message}`);
  return data.id;
}

export async function addJobMaterial(
  client: Client,
  organizationId: string,
  opts: { jobId: string; materialId: string; estimatedQuantity: number }
): Promise<string> {
  const { data, error } = await client
    .from("job_materials")
    .insert({
      organization_id: organizationId,
      job_id: opts.jobId,
      material_id: opts.materialId,
      estimated_quantity: opts.estimatedQuantity,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo agregar job_material de test: ${error?.message}`);
  return data.id;
}

export async function addStockMovement(
  client: Client,
  organizationId: string,
  opts: {
    materialId: string;
    movementType: "in" | "consumption" | "return" | "adjustment_in" | "adjustment_out";
    quantity: number;
    jobId?: string;
  }
): Promise<void> {
  const { error } = await client.from("stock_movements").insert({
    organization_id: organizationId,
    material_id: opts.materialId,
    movement_type: opts.movementType,
    quantity: opts.quantity,
    job_id: opts.jobId ?? null,
  });
  if (error) throw new Error(`No se pudo insertar movimiento de stock de test: ${error.message}`);
}

export async function registerConsumption(client: Client, jobMaterialId: string, actualQuantity: number) {
  const { error } = await client.rpc("register_job_material_consumption", {
    p_job_material_id: jobMaterialId,
    p_actual_quantity: actualQuantity,
  });
  if (error) throw new Error(`register_job_material_consumption falló: ${error.message}`);
}

export type JobMaterialStatusRow = {
  job_material_id: string;
  organization_id: string;
  job_id: string;
  material_id: string;
  estimated_quantity: number;
  consumed_quantity: number;
  remaining_quantity: number;
  current_stock: number;
  missing_quantity: number;
  variance_quantity: number;
};

export async function getJobMaterialStatus(client: Client, jobMaterialId: string): Promise<JobMaterialStatusRow> {
  const { data, error } = await client
    .from("job_material_status")
    .select("*")
    .eq("job_material_id", jobMaterialId)
    .single();
  if (error || !data) throw new Error(`No se pudo leer job_material_status: ${error?.message}`);
  return data as unknown as JobMaterialStatusRow;
}

export async function getPaymentMethodId(
  client: Client,
  organizationId: string,
  name: "Efectivo" | "Transferencia" | "Tarjeta" | "Otro" = "Efectivo"
): Promise<string> {
  const { data, error } = await client
    .from("payment_methods")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`No se encontró el medio de pago semilla '${name}': ${error?.message}`);
  return data.id;
}

export async function getPaymentAccountId(client: Client, organizationId: string, name = "Efectivo"): Promise<string> {
  const { data, error } = await client
    .from("payment_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`No se encontró la cuenta semilla '${name}': ${error?.message}`);
  return data.id;
}

/** Crea una cotización, un ítem de servicio por `total`, y la transiciona hasta 'accepted'. */
export async function createAcceptedQuote(
  client: Client,
  organizationId: string,
  opts: { jobId: string; clientId: string; total: number }
): Promise<string> {
  const { data: quoteId, error: quoteError } = await client.rpc("create_quote", {
    p_job_id: opts.jobId,
    p_client_id: opts.clientId,
  });
  if (quoteError || !quoteId) throw new Error(`create_quote falló: ${quoteError?.message}`);

  const { error: itemError } = await client.from("quote_items").insert({
    organization_id: organizationId,
    quote_id: quoteId,
    item_type: "service",
    description: "Servicio de test",
    quantity: 1,
    unit: "trabajo",
    sale_unit_price: opts.total,
  });
  if (itemError) throw new Error(`No se pudo agregar ítem de cotización de test: ${itemError.message}`);

  const { error: sentError } = await client.from("quotes").update({ status: "sent" }).eq("id", quoteId);
  if (sentError) throw new Error(`No se pudo marcar la cotización como enviada: ${sentError.message}`);

  const { error: acceptError } = await client.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
  if (acceptError) throw new Error(`No se pudo aceptar la cotización: ${acceptError.message}`);

  return quoteId as string;
}

export async function registerPayment(
  client: Client,
  opts: {
    jobId: string;
    paymentDate: string;
    amount: number;
    paymentMethodId: string;
    paymentAccountId?: string | null;
    reference?: string;
    notes?: string;
    receiptPath?: string;
    clientRequestId: string;
  }
): Promise<string> {
  const { data, error } = await client.rpc("register_job_payment", {
    p_job_id: opts.jobId,
    p_payment_date: opts.paymentDate,
    p_amount: opts.amount,
    p_payment_method_id: opts.paymentMethodId,
    p_client_request_id: opts.clientRequestId,
    p_payment_account_id: opts.paymentAccountId ?? undefined,
    p_reference: opts.reference ?? undefined,
    p_notes: opts.notes ?? undefined,
    p_receipt_path: opts.receiptPath ?? undefined,
  });
  if (error || !data) throw new Error(`register_job_payment falló: ${error?.message}`);
  return data as string;
}

export async function voidPayment(client: Client, paymentId: string, reason: string): Promise<void> {
  const { error } = await client.rpc("void_job_payment", { p_payment_id: paymentId, p_void_reason: reason });
  if (error) throw new Error(`void_job_payment falló: ${error.message}`);
}

export type JobFinancialStatusRow = {
  organization_id: string;
  job_id: string;
  accepted_quote_id: string | null;
  contracted_amount: number | null;
  collected_amount: number;
  outstanding_amount: number | null;
  overpaid_amount: number;
  payment_status: "no_contract" | "unpaid" | "partial" | "paid";
  last_payment_date: string | null;
};

export async function getJobFinancialStatus(client: Client, jobId: string): Promise<JobFinancialStatusRow> {
  const { data, error } = await client.from("job_financial_status").select("*").eq("job_id", jobId).single();
  if (error || !data) throw new Error(`No se pudo leer job_financial_status: ${error?.message}`);
  return data as unknown as JobFinancialStatusRow;
}

// ---------------------------------------------------------------------------
// Fase 4: compras y valuación
// ---------------------------------------------------------------------------
export async function createSupplier(client: Client, organizationId: string, name = "Proveedor test"): Promise<string> {
  const { data, error } = await client
    .from("suppliers")
    .insert({ organization_id: organizationId, name })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear proveedor de test: ${error?.message}`);
  return data.id;
}

export async function createPurchaseDraft(
  client: Client,
  organizationId: string,
  opts: {
    supplierId: string;
    items: { materialId: string; quantity: number; unitCost: number }[];
    purchaseDate?: string;
    clientRequestId?: string;
    sourceJobId?: string;
  }
): Promise<string> {
  const { data, error } = await client.rpc("create_purchase", {
    p_supplier_id: opts.supplierId,
    p_purchase_date: opts.purchaseDate ?? "2026-09-20",
    p_client_request_id: opts.clientRequestId ?? crypto.randomUUID(),
    p_source_job_id: opts.sourceJobId,
  });
  if (error || !data) throw new Error(`create_purchase falló: ${error?.message}`);
  for (const [i, item] of opts.items.entries()) {
    const { error: itemError } = await client.from("purchase_items").insert({
      organization_id: organizationId,
      purchase_id: data,
      material_id: item.materialId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      sort_order: i,
    });
    if (itemError) throw new Error(`No se pudo agregar ítem de compra: ${itemError.message}`);
  }
  return data as string;
}

export async function receivePurchase(client: Client, purchaseId: string): Promise<string> {
  const { data, error } = await client.rpc("receive_purchase", { p_purchase_id: purchaseId });
  if (error) throw new Error(`receive_purchase falló: ${error.message}`);
  return data as string;
}

/** Crea una compra en borrador y la recibe (el caso más común en los tests de valuación). */
export async function buy(
  client: Client,
  organizationId: string,
  supplierId: string,
  materialId: string,
  quantity: number,
  unitCost: number
): Promise<string> {
  const id = await createPurchaseDraft(client, organizationId, {
    supplierId,
    items: [{ materialId, quantity, unitCost }],
  });
  await receivePurchase(client, id);
  return id;
}

export type MaterialValuationRow = {
  current_stock: number;
  valuation_initialized: boolean;
  inventory_value: number | null;
  average_cost: number | null;
  needs_initialization: boolean;
};

export async function getMaterialValuation(client: Client, materialId: string): Promise<MaterialValuationRow> {
  const { data, error } = await client.from("material_valuation").select("*").eq("material_id", materialId).single();
  if (error || !data) throw new Error(`No se pudo leer material_valuation: ${error?.message}`);
  return {
    current_stock: Number(data.current_stock),
    valuation_initialized: Boolean(data.valuation_initialized),
    inventory_value: data.inventory_value != null ? Number(data.inventory_value) : null,
    average_cost: data.average_cost != null ? Number(data.average_cost) : null,
    needs_initialization: Boolean(data.needs_initialization),
  };
}

export async function getJobCostStatus(client: Client, jobId: string) {
  const { data, error } = await client.from("job_cost_status").select("*").eq("job_id", jobId).single();
  if (error || !data) throw new Error(`No se pudo leer job_cost_status: ${error?.message}`);
  return {
    estimated: data.estimated_material_cost != null ? Number(data.estimated_material_cost) : null,
    actual: Number(data.actual_material_cost),
    complete: Boolean(data.material_cost_complete),
    variance: data.material_cost_variance != null ? Number(data.material_cost_variance) : null,
  };
}

export async function getMovements(client: Client, materialId: string) {
  const { data, error } = await client
    .from("stock_movements")
    .select("id, movement_type, quantity, unit_cost, total_cost, job_id, purchase_id, reversal_of_movement_id, created_at")
    .eq("material_id", materialId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    ...m,
    quantity: Number(m.quantity),
    unit_cost: m.unit_cost != null ? Number(m.unit_cost) : null,
    total_cost: m.total_cost != null ? Number(m.total_cost) : null,
  }));
}
