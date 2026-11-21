/** Store phones without Colombia country code (+57 / 57). */
export function normalizePhone(phone?: string | null): string | null {
  if (phone == null) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length > 10) {
    digits = digits.slice(2);
  }
  return digits || null;
}

export function phoneDigits(phone?: string | null) {
  return (phone || "").replace(/\D/g, "");
}

export function phoneLookupVariants(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const normalized = normalizePhone(trimmed);
  const variants = new Set<string>([trimmed]);
  if (digits) {
    variants.add(digits);
    if (digits.length >= 10) variants.add(digits.slice(-10));
    if (digits.startsWith("57") && digits.length > 10) variants.add(digits.slice(2));
  }
  if (normalized) variants.add(normalized);
  return [...variants].filter(Boolean);
}
