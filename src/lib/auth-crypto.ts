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

function getPendingPasswordKey(): Buffer {
  const secret =
    process.env["SESSION_SECRET"] ||
    process.env["DATABASE_URL"] ||
    "barberin_secure_pending_password_key_32bytes_secret";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Enkripsi password pending menggunakan AES-256-GCM.
 * Digunakan untuk staging password sementara selama verifikasi email berlangsung.
 * Output: base64url(iv[12] + authTag[16] + ciphertext)
 */
export function encryptPendingPassword(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getPendingPasswordKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/**
 * Dekripsi password pending menggunakan AES-256-GCM.
 * Mengembalikan string password jika valid, atau null jika gagal/tampered.
 */
export function decryptPendingPassword(ciphertext: string): string | null {
  try {
    const data = Buffer.from(ciphertext, "base64url");
    if (data.length < 28) return null; // 12 bytes IV + 16 bytes Tag
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getPendingPasswordKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// Re-export client-safe utilities
export { normalizeEmail, normalizePhoneNumber, detectEmailOrPhone } from "./auth-utils";
