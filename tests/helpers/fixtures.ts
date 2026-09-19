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

// ---------------------------------------------------------------------------
// Fase 5: mano de obra, gastos directos, economía y análisis
// ---------------------------------------------------------------------------
export const TEST_TIMEZONE = "America/Argentina/Buenos_Aires";

/** organization_members.id de un usuario dentro de una organización. */
export async function getMemberId(client: Client, organizationId: string, userId: string): Promise<string> {
  const { data, error } = await client
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(`No se encontró el miembro: ${error?.message}`);
  return data.id;
}

export async function setRate(
  client: Client,
  memberId: string,
  hourlyCost: number,
  validFrom: string,
  notes?: string
): Promise<string> {
  const { data, error } = await client.rpc("set_member_labor_rate", {
    p_member_id: memberId,
    p_hourly_cost: hourlyCost,
    p_valid_from: validFrom,
    p_notes: notes,
  });
  if (error || !data) throw new Error(`set_member_labor_rate falló: ${error?.message}`);
  return data as string;
}

export async function listRates(client: Client, memberId: string) {
  const { data, error } = await client
    .from("member_labor_rates")
    .select("id, hourly_cost, valid_from, valid_to, notes")
    .eq("organization_member_id", memberId)
    .order("valid_from", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, hourly_cost: Number(r.hourly_cost) }));
}

/** ISO (UTC) de una fecha+hora de pared en la zona de la organización de test. */
export function localIso(date: string, time: string): string {
  // Buenos Aires es UTC-3 todo el año (sin horario de verano).
  const [h, m] = time.split(":").map(Number);
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCHours(h + 3, m, 0, 0);
  return utc.toISOString();
}

/**
 * Crea una sesión programada (RPC, como la app) y, si se indica `actual`, le carga el
 * tiempo real con un UPDATE directo, igual que el flujo de "completar sesión".
 */
export async function createSession(
  client: Client,
  jobId: string,
  opts: {
    date: string;
    plannedStart?: string;
    plannedEnd?: string;
    memberId?: string;
    actual?: { start: string; end: string; date?: string };
    status?: "scheduled" | "completed" | "cancelled";
  }
): Promise<string> {
  const { data, error } = await client.rpc("create_job_session", {
    p_job_id: jobId,
    p_planned_start_at: localIso(opts.date, opts.plannedStart ?? "08:00"),
    p_planned_end_at: localIso(opts.date, opts.plannedEnd ?? "09:00"),
    p_client_request_id: crypto.randomUUID(),
    p_assigned_member_id: opts.memberId,
  });
  if (error || !data) throw new Error(`create_job_session falló: ${error?.message}`);
  const sessionId = data as string;
  if (opts.actual || opts.status) {
    const patch: { status: "scheduled" | "completed" | "cancelled"; actual_start_at?: string; actual_end_at?: string } = {
      status: opts.status ?? "completed",
    };
    if (opts.actual) {
      patch.actual_start_at = localIso(opts.actual.date ?? opts.date, opts.actual.start);
      patch.actual_end_at = localIso(opts.actual.date ?? opts.date, opts.actual.end);
    }
    const { error: updateError } = await client.from("job_sessions").update(patch).eq("id", sessionId);
    if (updateError) throw new Error(`No se pudo completar la sesión de test: ${updateError.message}`);
  }
  return sessionId;
}

export async function updateActualTime(client: Client, sessionId: string, date: string, start: string, end: string) {
  const { error } = await client
    .from("job_sessions")
    .update({ actual_start_at: localIso(date, start), actual_end_at: localIso(date, end) })
    .eq("id", sessionId);
  if (error) throw new Error(`No se pudo actualizar el tiempo real: ${error.message}`);
}

export async function getSessionSnapshot(client: Client, sessionId: string) {
  const { data, error } = await client
    .from("job_session_labor_costs")
    .select("id, hourly_cost_snapshot, labor_rate_id, organization_member_id")
    .eq("job_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, hourly_cost_snapshot: Number(data.hourly_cost_snapshot) } : null;
}

export async function getLaborCosts(client: Client, jobId: string) {
  const { data, error } = await client.from("job_labor_costs").select("*").eq("job_id", jobId).single();
  if (error || !data) throw new Error(`No se pudo leer job_labor_costs: ${error?.message}`);
  return {
    sessions: Number(data.labor_sessions_count),
    minutes: Number(data.actual_minutes),
    cost: Number(data.actual_labor_cost),
    missingTime: Number(data.sessions_missing_time),
    missingMember: Number(data.sessions_missing_member),
    missingRate: Number(data.sessions_missing_rate),
    complete: Boolean(data.labor_cost_complete),
  };
}

export async function getEconomics(client: Client, jobId: string) {
  const { data, error } = await client.from("job_economics_status").select("*").eq("job_id", jobId).single();
  if (error || !data) throw new Error(`No se pudo leer job_economics_status: ${error?.message}`);
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    isClosed: Boolean(data.job_is_closed),
    contracted: n(data.contracted_amount),
    collected: n(data.collected_amount),
    materialActual: n(data.actual_material_cost),
    materialComplete: Boolean(data.material_cost_complete),
    labor: n(data.actual_labor_cost),
    laborComplete: Boolean(data.labor_cost_complete),
    expenses: n(data.direct_expense_total),
    recorded: n(data.recorded_direct_cost),
    dataComplete: Boolean(data.direct_cost_data_complete),
    directCost: n(data.actual_direct_cost),
    contribution: n(data.contribution_amount),
    contributionPct: n(data.contribution_percentage),
  };
}

export async function getExpenseCategoryId(client: Client, organizationId: string, name = "Alquiler"): Promise<string> {
  const { data, error } = await client
    .from("job_expense_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`No se encontró la categoría '${name}': ${error?.message}`);
  return data.id;
}

export async function registerExpense(
  client: Client,
  opts: {
    jobId: string;
    categoryId: string;
    amount: number;
    date?: string;
    description?: string;
    clientRequestId?: string;
    receiptPath?: string;
  }
): Promise<string> {
  const { data, error } = await client.rpc("register_job_expense", {
    p_job_id: opts.jobId,
    p_category_id: opts.categoryId,
    p_expense_date: opts.date ?? "2026-09-20",
    p_description: opts.description ?? "Gasto de test",
    p_amount: opts.amount,
    p_client_request_id: opts.clientRequestId ?? crypto.randomUUID(),
    p_receipt_path: opts.receiptPath,
  });
  if (error || !data) throw new Error(`register_job_expense falló: ${error?.message}`);
  return data as string;
}

export async function getJobTypeId(client: Client, organizationId: string, name: string): Promise<string> {
  const { data, error } = await client
    .from("job_types")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`No se encontró el tipo de trabajo '${name}': ${error?.message}`);
  return data.id;
}

export async function createTypedJob(
  client: Client,
  organizationId: string,
  opts: { clientId: string; statusId: string; title: string; jobTypeId?: string; estimatedMinutes?: number }
): Promise<string> {
  const { data, error } = await client
    .from("jobs")
    .insert({
      organization_id: organizationId,
      client_id: opts.clientId,
      status_id: opts.statusId,
      title: opts.title,
      job_type_id: opts.jobTypeId,
      estimated_minutes: opts.estimatedMinutes,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear trabajo de test: ${error?.message}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Fase 5.1: cotizaciones compartibles, facturación
// ---------------------------------------------------------------------------
/** Marcadores de datos INTERNOS que nunca deben aparecer en la cotización pública. */
export const INTERNAL_MARKERS = {
  serviceCostPrice: 77777.77,
  materialCostPrice: 4321.12,
  jobNotes: "NOTA-INTERNA-DEL-TRABAJO-XYZ",
  clientEmail: "cliente-interno@privado.test",
  clientTaxId: "20-99999999-9",
  clientNotes: "NOTA-INTERNA-DEL-CLIENTE-XYZ",
  expenseDescription: "GASTO-INTERNO-ALQUILER-XYZ",
  supplierName: "PROVEEDOR-INTERNO-XYZ",
} as const;

/** Cliente con teléfono y datos internos (email, CUIT, notas) para verificar que no se filtran. */
export async function createClientWithDetails(
  client: Client,
  organizationId: string,
  opts: { name: string; phone?: string | null }
): Promise<string> {
  const { data, error } = await client
    .from("clients")
    .insert({
      organization_id: organizationId,
      name: opts.name,
      phone: opts.phone ?? null,
      email: INTERNAL_MARKERS.clientEmail,
      tax_id: INTERNAL_MARKERS.clientTaxId,
      notes: INTERNAL_MARKERS.clientNotes,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear cliente de test: ${error?.message}`);
  return data.id;
}

/**
 * Cotización con un ítem de servicio y uno de material, ambos con costo interno (cost_unit_price), llevada al
 * estado pedido. Devuelve id y número.
 */
export async function createQuoteWithItems(
  client: Client,
  organizationId: string,
  opts: { jobId: string; clientId: string; status?: "draft" | "sent" | "accepted"; total?: number }
): Promise<{ quoteId: string; quoteNumber: string }> {
  const { data: quoteId, error } = await client.rpc("create_quote", { p_job_id: opts.jobId, p_client_id: opts.clientId });
  if (error || !quoteId) throw new Error(`create_quote falló: ${error?.message}`);

  const unitId = await getSeedUnitId(client, organizationId, "m");
  const materialId = await createMaterial(client, organizationId, { name: `Cable ${crypto.randomUUID().slice(0, 6)}`, unitId });
  const total = opts.total ?? 100_000;
  const items = [
    {
      organization_id: organizationId,
      quote_id: quoteId,
      item_type: "service" as const,
      description: "Instalación eléctrica completa",
      quantity: 1,
      unit: "trabajo",
      cost_unit_price: INTERNAL_MARKERS.serviceCostPrice,
      sale_unit_price: total - 9_999 * 2,
    },
    {
      organization_id: organizationId,
      quote_id: quoteId,
      item_type: "material" as const,
      material_id: materialId,
      description: "Cable 2,5 mm",
      quantity: 2,
      unit: "m",
      cost_unit_price: INTERNAL_MARKERS.materialCostPrice,
      sale_unit_price: 9_999,
    },
  ];
  const { error: itemsError } = await client.from("quote_items").insert(items);
  if (itemsError) throw new Error(`No se pudieron agregar ítems: ${itemsError.message}`);

  const status = opts.status ?? "draft";
  if (status !== "draft") {
    const { error: sent } = await client.from("quotes").update({ status: "sent" }).eq("id", quoteId);
    if (sent) throw new Error(`No se pudo enviar la cotización: ${sent.message}`);
  }
  if (status === "accepted") {
    const { error: accepted } = await client.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
    if (accepted) throw new Error(`No se pudo aceptar la cotización: ${accepted.message}`);
  }

  const { data: row } = await client.from("quotes").select("quote_number").eq("id", quoteId).single();
  return { quoteId: quoteId as string, quoteNumber: row?.quote_number ?? "" };
}

export async function getOrCreateShareLink(client: Client, quoteId: string) {
  const { data, error } = await client.rpc("get_or_create_quote_share_link", { p_quote_id: quoteId });
  if (error || !data) throw new Error(`get_or_create_quote_share_link falló: ${error?.message}`);
  return data;
}

export async function markInvoiced(
  client: Client,
  jobId: string,
  opts: { date?: string; number?: string; notes?: string } = {}
): Promise<void> {
  const { error } = await client.rpc("mark_job_invoiced", {
    p_job_id: jobId,
    p_invoiced_at: opts.date ?? "2026-09-19",
    p_invoice_number: opts.number,
    p_notes: opts.notes,
  });
  if (error) throw new Error(`mark_job_invoiced falló: ${error.message}`);
}

type LooseClient = { from: (t: string) => { select: (q: string) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string; code?: string } | null }> } } };

/** select * ... limit sobre una tabla/vista elegida en runtime (los tipos generados no aceptan uniones de relaciones). */
export function selectSome(client: unknown, table: string, limit = 5) {
  return (client as LooseClient).from(table).select("*").limit(limit);
}
