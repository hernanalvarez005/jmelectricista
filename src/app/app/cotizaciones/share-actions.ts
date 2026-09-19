"use server";

import { revalidatePath } from "next/cache";

import { buildPublicQuoteUrl, getAppBaseUrl } from "@/lib/app-url";
import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getQuoteDetail } from "@/lib/data/quotes";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { buildQuoteWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp/messages";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

function friendlyShareError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes("cotizacion_borrador")) return "Marcá la cotización como enviada antes de compartirla.";
  if (message.includes("not authorized")) return "No tenés permiso para compartir esta cotización.";
  return fallback;
}

async function getOrCreateShareUrl(quoteId: string): Promise<{ error: string } | { shareUrl: string }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("get_or_create_quote_share_link", { p_quote_id: quoteId });
  if (error || !data) return { error: friendlyShareError(error?.message, "No se pudo generar el enlace.") };
  return { shareUrl: buildPublicQuoteUrl(await getAppBaseUrl(), data.token) };
}

/** Devuelve la URL pública del enlace activo, creándolo solo si todavía no existe (no crea uno nuevo en cada click). */
export async function ensureQuoteShareLinkAction(quoteId: string): Promise<{ error: string } | { shareUrl: string }> {
  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para compartir cotizaciones." };
  const result = await getOrCreateShareUrl(quoteId);
  if ("shareUrl" in result) revalidatePath(`/app/cotizaciones/${quoteId}`);
  return result;
}

/**
 * Prepara el mensaje de WhatsApp: 1) valida el teléfono del cliente, 2) obtiene o crea el enlace activo,
 * 3) arma la URL pública y el mensaje, 4) devuelve el deep link (el usuario revisa y envía a mano).
 */
export async function sendQuoteWhatsAppAction(
  quoteId: string
): Promise<{ error: string } | { whatsappUrl: string; shareUrl: string }> {
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para compartir cotizaciones." };

  const detail = await getQuoteDetail(organization.id, quoteId);
  if (!detail) return { error: "Cotización no encontrada." };

  const supabase = await createSupabaseClient();
  const { data: client } = await supabase.from("clients").select("phone").eq("id", detail.quote.client_id).maybeSingle();
  const phone = normalizeWhatsAppPhone(client?.phone, organization.default_country_code);
  if (phone.status === "missing") return { error: "Agregá el teléfono del cliente para contactarlo por WhatsApp." };
  if (phone.status === "invalid") return { error: "El teléfono del cliente no tiene un formato válido para WhatsApp." };

  const share = await getOrCreateShareUrl(quoteId);
  if ("error" in share) return share;

  const message = buildQuoteWhatsAppMessage({
    clientName: detail.clientName,
    quoteNumber: detail.quote.quote_number,
    jobTitle: detail.jobTitle,
    url: share.shareUrl,
  });
  revalidatePath(`/app/cotizaciones/${quoteId}`);
  return { whatsappUrl: buildWhatsAppUrl(phone.digits, message), shareUrl: share.shareUrl };
}

/** Revoca el enlace activo: el token deja de funcionar de inmediato. Si se vuelve a compartir, se crea uno nuevo. */
export async function revokeQuoteShareLinkAction(quoteId: string): Promise<{ error: string } | { ok: true }> {
  const { role } = await requireCurrentOrg();
  if (!canOperate(role)) return { error: "No tenés permiso para revocar enlaces." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("revoke_quote_share_link", { p_quote_id: quoteId });
  if (error) return { error: friendlyShareError(error.message, "No se pudo revocar el enlace.") };

  revalidatePath(`/app/cotizaciones/${quoteId}`);
  return { ok: true };
}
