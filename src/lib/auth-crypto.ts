import crypto from "node:crypto";

const SCRYPT_PREFIX = "scrypt";
const KEY_LEN = 64;

/**
 * Hash password menggunakan algoritma scrypt dengan salt acak 16 byte.
 * Output format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
  return `${SCRYPT_PREFIX}:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifikasi password terhadap hash scrypt atau plaintext legacy.
 * Menggunakan timingSafeEqual untuk keamanan terhadap timing attacks.
 */
export function verifyPassword(
  password: string,
  storedHashOrPlain: string | null | undefined,
): { valid: boolean; needsRehash: boolean } {
  if (!storedHashOrPlain) {
    return { valid: false, needsRehash: false };
  }

  // Jika format scrypt:
  if (storedHashOrPlain.startsWith(`${SCRYPT_PREFIX}:`)) {
    const parts = storedHashOrPlain.split(":");
    if (parts.length !== 3) {
      return { valid: false, needsRehash: false };
    }

    const salt = parts[1];
    const keyHex = parts[2];
    if (!salt || !keyHex) {
      return { valid: false, needsRehash: false };
    }

    const expectedBuffer = Buffer.from(keyHex, "hex");
    const actualBuffer = crypto.scryptSync(password, salt, KEY_LEN);

    if (expectedBuffer.length !== actualBuffer.length) {
      return { valid: false, needsRehash: false };
    }

    const valid = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    return { valid, needsRehash: false };
  }

  // Backward-compatibility: jika password tersimpan masih plaintext legacy
  const valid = storedHashOrPlain === password;
  return { valid, needsRehash: valid };
}

/**
 * Membuat token verifikasi kriptografis acak berkeamanan tinggi.
 * Token raw dikirim ke email user (tidak pernah disimpan plaintext di DB).
 * Token hash SHA-256 disimpan di database.
 */
export function generateVerificationToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Menghitung hash SHA-256 dari token raw.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

// Re-export client-safe utilities
export {
  normalizeEmail,
  normalizePhoneNumber,
  detectEmailOrPhone,
} from "./auth-utils";
