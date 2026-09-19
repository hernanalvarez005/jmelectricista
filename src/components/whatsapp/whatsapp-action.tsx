import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp/messages";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

/**
 * Acción de WhatsApp para una persona (cliente/proveedor). No envía nada: arma el deep link con
 * el mensaje precargado y la persona lo revisa y lo manda a mano. Sin teléfono o con un teléfono
 * que no se puede convertir con confianza a formato internacional, NO abre WhatsApp: explica qué
 * falta y lleva a editar el contacto. Componente de servidor (usa libphonenumber-js).
 */
export function WhatsAppAction({
  phone,
  defaultCountry,
  message,
  label = "Enviar WhatsApp",
  editHref,
  editLabel = "Editar cliente",
  personLabel = "del cliente",
  variant = "outline",
  size = "default",
}: {
  phone: string | null | undefined;
  defaultCountry: string;
  message: string;
  label?: string;
  editHref: string;
  editLabel?: string;
  personLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  const result = normalizeWhatsAppPhone(phone, defaultCountry);

  if (result.status === "ok") {
    return (
      <a
        href={buildWhatsAppUrl(result.digits, message)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant, size })}
      >
        <MessageCircle /> {label}
      </a>
    );
  }

  if (result.status === "missing") {
    return (
      <Link href={editHref} className={buttonVariants({ variant: "outline", size })}>
        <MessageCircle /> Agregar teléfono para contactar por WhatsApp
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5" role="status">
      <p className="text-sm text-warning">El teléfono {personLabel} no tiene un formato válido para WhatsApp.</p>
      <Link href={editHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {editLabel}
      </Link>
    </div>
  );
}
