"use server";

import { revalidatePath } from "next/cache";

import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  businessHoursDaySchema,
  jobStatusSchema,
  jobTypeSchema,
  organizationSettingsSchema,
  type BusinessHoursDayInput,
  type JobStatusInput,
  type JobTypeInput,
  type OrganizationSettingsInput,
} from "@/lib/validations/settings";
import {
  paymentAccountSchema,
  paymentMethodSchema,
  type PaymentAccountInput,
  type PaymentMethodInput,
} from "@/lib/validations/payment";

type ActionResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

function requireAdmin(role: string) {
  return canAdminister(role);
}

function parseOptionalMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function updateOrganizationAction(
  input: OrganizationSettingsInput
): Promise<SimpleResult> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del negocio." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar esta configuración." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency.toUpperCase(),
    })
    .eq("id", organization.id);

  if (error) return { error: "No se pudo actualizar el negocio." };

  revalidatePath("/app/configuracion");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function createJobTypeAction(input: JobTypeInput): Promise<ActionResult> {
  const parsed = jobTypeSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del tipo de trabajo." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para crear tipos de trabajo." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("job_types")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      default_estimated_minutes: parseOptionalMinutes(parsed.data.defaultEstimatedMinutes),
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el tipo de trabajo." };

  revalidatePath("/app/configuracion");
  return { id: data.id };
}

export async function updateJobTypeAction(
  id: string,
  input: JobTypeInput
): Promise<ActionResult> {
  const parsed = jobTypeSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del tipo de trabajo." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar tipos de trabajo." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("job_types")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      default_estimated_minutes: parseOptionalMinutes(parsed.data.defaultEstimatedMinutes),
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el tipo de trabajo." };

  revalidatePath("/app/configuracion");
  return { id };
}

export async function createJobStatusAction(input: JobStatusInput): Promise<ActionResult> {
  const parsed = jobStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del estado." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para crear estados." };

  const supabase = await createSupabaseClient();
  const slug = parsed.data.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: maxSort } = await supabase
    .from("job_statuses")
    .select("sort_order")
    .eq("organization_id", organization.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("job_statuses")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      slug: slug || `estado-${Date.now()}`,
      sort_order: (maxSort?.sort_order ?? 0) + 10,
      is_closed: parsed.data.isClosed,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el estado." };

  revalidatePath("/app/configuracion");
  return { id: data.id };
}

export async function updateJobStatusDefinitionAction(
  id: string,
  input: JobStatusInput
): Promise<ActionResult> {
  const parsed = jobStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del estado." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar estados." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("job_statuses")
    .update({
      name: parsed.data.name,
      is_closed: parsed.data.isClosed,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el estado." };

  revalidatePath("/app/configuracion");
  return { id };
}

export async function updateBusinessHoursDayAction(
  id: string,
  input: BusinessHoursDayInput
): Promise<SimpleResult> {
  const parsed = businessHoursDaySchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá el horario ingresado." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar horarios." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("business_hours")
    .update({
      is_working_day: parsed.data.isWorkingDay,
      start_time: parsed.data.isWorkingDay ? parsed.data.startTime || null : null,
      end_time: parsed.data.isWorkingDay ? parsed.data.endTime || null : null,
      break_start: parsed.data.isWorkingDay ? parsed.data.breakStart || null : null,
      break_end: parsed.data.isWorkingDay ? parsed.data.breakEnd || null : null,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el horario." };

  revalidatePath("/app/configuracion");
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}

export async function createPaymentMethodAction(input: PaymentMethodInput): Promise<ActionResult> {
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del medio de pago." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para crear medios de pago." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      requires_account: parsed.data.requiresAccount,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { error: "Ya existe un medio de pago con ese nombre." };
    return { error: "No se pudo crear el medio de pago." };
  }

  revalidatePath("/app/configuracion");
  return { id: data.id };
}

export async function updatePaymentMethodAction(id: string, input: PaymentMethodInput): Promise<ActionResult> {
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del medio de pago." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar medios de pago." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({
      name: parsed.data.name,
      requires_account: parsed.data.requiresAccount,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un medio de pago con ese nombre." };
    return { error: "No se pudo actualizar el medio de pago." };
  }

  revalidatePath("/app/configuracion");
  return { id };
}

export async function createPaymentAccountAction(input: PaymentAccountInput): Promise<ActionResult> {
  const parsed = paymentAccountSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la cuenta." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para crear cuentas de cobro." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("payment_accounts")
    .insert({
      organization_id: organization.id,
      name: parsed.data.name,
      account_type: parsed.data.accountType,
      bank_name: parsed.data.bankName || null,
      alias: parsed.data.alias || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { error: "Ya existe una cuenta con ese nombre." };
    return { error: "No se pudo crear la cuenta." };
  }

  revalidatePath("/app/configuracion");
  return { id: data.id };
}

export async function updatePaymentAccountAction(id: string, input: PaymentAccountInput): Promise<ActionResult> {
  const parsed = paymentAccountSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la cuenta." };

  const { organization, role } = await requireCurrentOrg();
  if (!requireAdmin(role)) return { error: "No tenés permiso para editar cuentas de cobro." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("payment_accounts")
    .update({
      name: parsed.data.name,
      account_type: parsed.data.accountType,
      bank_name: parsed.data.bankName || null,
      alias: parsed.data.alias || null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe una cuenta con ese nombre." };
    return { error: "No se pudo actualizar la cuenta." };
  }

  revalidatePath("/app/configuracion");
  return { id };
}
