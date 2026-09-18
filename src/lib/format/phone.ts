/** Keeps only digits, for building a wa.me link or comparing numbers. */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/** Builds a wa.me link from a raw phone string, or null if there are no digits. */
export function buildWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = sanitizePhone(phone);
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}`;
}
