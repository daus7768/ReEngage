/**
 * The heart of the manual-first send: turn a phone number + message into a
 * wa.me deep link. The owner taps it, WhatsApp opens on their device with the
 * message pre-filled to that parent, and they hit send themselves.
 * No WhatsApp Business API, no Meta approval, zero per-message cost.
 */

/**
 * Normalise a Malaysian (or already-international) phone number to the bare
 * international format wa.me expects (digits only, country code, no +).
 *   "012-345 6789" → "60123456789"
 *   "+60123456789" → "60123456789"
 *   "60123456789"  → "60123456789"
 */
export function normalizeMyPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits; // assume already international
}

/** Build a click-to-chat link with the message pre-filled. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const to = normalizeMyPhone(phone);
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/** Loose sanity check for a usable MY mobile number (8–13 digits). */
export function isLikelyValidPhone(raw: string): boolean {
  const digits = normalizeMyPhone(raw);
  return digits.length >= 10 && digits.length <= 13;
}
