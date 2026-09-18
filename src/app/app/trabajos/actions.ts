"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { toMinutes } from "@/lib/format/duration";
import { jobSchema, type JobInput } from "@/lib/validations/job";
import { actualTimeSchema, jobSessionSchema, type ActualTimeInput, type JobSessionInput } from "@/lib/validations/session";

type ActionResult = { error: string } | { id: string };
type SimpleResult = { error: string } | { ok: true };

function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export async function createJobAction(input: JobInput): Promise<ActionResult> {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del trabajo." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para crear trabajos." };

  const supabase = await createSupabaseClient();
  const estimatedMinutes = toMinutes(parsed.data.estimatedHours, parsed.data.estimatedMinutesPart);

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: organization.id,
      client_id: parsed.data.clientId,
      client_address_id: parsed.data.clientAddressId || null,
      job_type_id: parsed.data.jobTypeId || null,
      status_id: parsed.data.statusId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      estimated_minutes: estimatedMinutes > 0 ? estimatedMinutes : null,
      target_date: parsed.data.targetDate || null,
      assigned_member_id: parsed.data.assignedMemberId || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el trabajo." };

  revalidatePath("/app/trabajos");
  revalidatePath("/app");
  return { id: data.id };
}

export async function updateJobAction(jobId: string, input: JobInput): Promise<ActionResult> {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del trabajo." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para editar trabajos." };

  const supabase = await createSupabaseClient();
  const estimatedMinutes = toMinutes(parsed.data.estimatedHours, parsed.data.estimatedMinutesPart);

  const { error } = await supabase
    .from("jobs")
    .update({
      client_id: parsed.data.clientId,
      client_address_id: parsed.data.clientAddressId || null,
      job_type_id: parsed.data.jobTypeId || null,
      status_id: parsed.data.statusId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      estimated_minutes: estimatedMinutes > 0 ? estimatedMinutes : null,
      target_date: parsed.data.targetDate || null,
      assigned_member_id: parsed.data.assignedMemberId || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", jobId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el trabajo." };

  revalidatePath("/app/trabajos");
  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app");
  return { id: jobId };
}

export async function updateJobStatusAction(
  jobId: string,
  statusId: string
): Promise<ActionResult> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para cambiar el estado." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status_id: statusId })
    .eq("id", jobId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo cambiar el estado." };

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/trabajos");
  revalidatePath("/app");
  return { id: jobId };
}

export async function createJobSessionAction(
  jobId: string,
  input: JobSessionInput
): Promise<ActionResult> {
  const parsed = jobSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de la sesión." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para programar sesiones." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("job_sessions")
    .insert({
      organization_id: organization.id,
      job_id: jobId,
      assigned_member_id: parsed.data.assignedMemberId || null,
      planned_start_at: combineDateAndTime(parsed.data.date, parsed.data.startTime),
      planned_end_at: combineDateAndTime(parsed.data.date, parsed.data.endTime),
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo programar la sesión." };

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { id: data.id };
}

export async function updateJobSessionStatusAction(
  jobId: string,
  sessionId: string,
  status: "completed" | "cancelled",
  actualTime?: ActualTimeInput
): Promise<ActionResult> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para modificar sesiones." };

  let actualStartAt: string | undefined;
  let actualEndAt: string | undefined;
  if (status === "completed" && actualTime) {
    const parsed = actualTimeSchema.safeParse(actualTime);
    if (!parsed.success) return { error: "Revisá el tiempo real ingresado." };
    actualStartAt = combineDateAndTime(parsed.data.date, parsed.data.startTime);
    actualEndAt = combineDateAndTime(parsed.data.date, parsed.data.endTime);
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("job_sessions")
    .update({ status, actual_start_at: actualStartAt, actual_end_at: actualEndAt })
    .eq("id", sessionId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar la sesión." };

  revalidatePath(`/app/trabajos/${jobId}`);
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { id: sessionId };
}

/** Corrige el tiempo real de una sesión ya completada (cargado mal, o completada sin tiempo real). */
export async function updateSessionActualTimeAction(
  jobId: string,
  sessionId: string,
  actualTime: ActualTimeInput
): Promise<SimpleResult> {
  const parsed = actualTimeSchema.safeParse(actualTime);
  if (!parsed.success) return { error: "Revisá el tiempo real ingresado." };

  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para modificar sesiones." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("job_sessions")
    .update({
      actual_start_at: combineDateAndTime(parsed.data.date, parsed.data.startTime),
      actual_end_at: combineDateAndTime(parsed.data.date, parsed.data.endTime),
    })
    .eq("id", sessionId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el tiempo real." };

  revalidatePath(`/app/trabajos/${jobId}`);
  return { ok: true };
}
