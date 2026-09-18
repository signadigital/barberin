/**
 * Client-safe string normalizer and validator utilities.
 * Completely free of Node.js dependencies (no node:crypto, no fs, no dotenv).
 * Can be safely imported in both client-side browser components and server functions.
 */

/**
 * Normalisasi format email: trim dan lowercase
 */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Normalisasi format nomor telepon Indonesia / Internasional:
 * - Menghilangkan spasi, tanda hubung, tanda kurung.
 * - Mengubah awalan +62 atau 62 menjadi 0.
 * - Memastikan hanya berisi karakter digit.
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = (phone || "").trim().replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+62")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("62")) {
    cleaned = "0" + cleaned.slice(2);
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Validasi dan deteksi tipe input apakah email atau nomor telepon sesuai BPMN 02.
 */
export function detectEmailOrPhone(input: string): {
  type: "email" | "phone" | "invalid";
  normalized: string;
} {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { type: "invalid", normalized: "" };
  }

  if (trimmed.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return { type: "email", normalized: normalizeEmail(trimmed) };
    }
    return { type: "invalid", normalized: trimmed };
  }

  // Cek nomor telepon
  const cleanedPhone = normalizePhoneNumber(trimmed);
  const digitsOnlyRegex = /^[0-9]+$/;
  if (
    digitsOnlyRegex.test(cleanedPhone) &&
    cleanedPhone.length >= 8 &&
    cleanedPhone.length <= 15
  ) {
    return { type: "phone", normalized: cleanedPhone };
  }

  return { type: "invalid", normalized: trimmed };
}
