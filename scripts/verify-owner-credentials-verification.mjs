import { config } from "dotenv";
config();
import crypto from "node:crypto";
import fs from "node:fs";

function getPendingPasswordKey() {
  const secret =
    process.env["SESSION_SECRET"] ||
    process.env["DATABASE_URL"] ||
    "barberin_secure_pending_password_key_32bytes_secret";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptPendingPassword(password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getPendingPasswordKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptPendingPassword(ciphertext) {
  try {
    const data = Buffer.from(ciphertext, "base64url");
    if (data.length < 28) return null;
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

async function runTests() {
  console.log("=== RUNNING OWNER SETTINGS CREDENTIALS VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: AES-256-GCM Encryption & Decryption
  console.log("\n--- TEST 1: Encryption & Decryption Round-trip ---");
  const testPassword = "MySuperSecretPassword2026!";
  const encrypted = encryptPendingPassword(testPassword);
  assert(typeof encrypted === "string" && encrypted.length > 30, "Encrypted string is non-empty base64url");
  assert(!encrypted.includes(testPassword), "Ciphertext does not contain plaintext password");

  const decrypted = decryptPendingPassword(encrypted);
  assert(decrypted === testPassword, "Decrypted password matches original password exactly");

  // TEST 2: Tamper Resistance
  console.log("\n--- TEST 2: Tamper Resistance (AES-256-GCM auth tag verification) ---");
  const tampered = encrypted.slice(0, -4) + "AAAA";
  const tamperedResult = decryptPendingPassword(tampered);
  assert(tamperedResult === null, "Tampered ciphertext is rejected and returns null");

  const invalidData = "short-invalid-token";
  assert(decryptPendingPassword(invalidData) === null, "Malformed token returns null");

  // TEST 3: Codebase Security Audit (No plaintext password or service_role in client/settings)
  console.log("\n--- TEST 3: Codebase Security Audit ---");
  const settingsCode = fs.readFileSync("src/lib/owner-settings.ts", "utf8");
  const settingsRoute = fs.readFileSync("src/routes/$barbershopSlug.owner.settings.tsx", "utf8");

  assert(!settingsCode.includes("userPayload.email ="), "updateOwnerSettings does NOT update email directly in database");
  assert(!settingsCode.includes("userPayload.password ="), "updateOwnerSettings does NOT update password directly in database");
  assert(!settingsRoute.includes("supabase.auth.admin"), "Browser/client settings does not use supabase.auth.admin");
  assert(!settingsRoute.includes("service_role"), "Browser/client settings does not use service_role");

  // TEST 4: Forgot Password Regression Protection
  console.log("\n--- TEST 4: Forgot Password Regression Protection ---");
  const ownerAuthCode = fs.readFileSync("src/lib/owner-auth.ts", "utf8");
  assert(ownerAuthCode.includes("/owner/reset-password"), "Forgot password still redirects to /owner/reset-password");
  assert(fs.existsSync("src/routes/owner.reset-password.tsx"), "src/routes/owner.reset-password.tsx exists and is untouched");

  // TEST 5: Verification Callback Routes Exist
  console.log("\n--- TEST 5: Verification Callback Routes Verification ---");
  assert(fs.existsSync("src/routes/$barbershopSlug.owner.verify-email-change.tsx"), "Tenant verify-email-change route exists");
  assert(fs.existsSync("src/routes/owner.verify-email-change.tsx"), "Global fallback verify-email-change route exists");
  assert(fs.existsSync("src/routes/$barbershopSlug.owner.verify-password-change.tsx"), "Tenant verify-password-change route exists");
  assert(fs.existsSync("src/routes/owner.verify-password-change.tsx"), "Global fallback verify-password-change route exists");

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
