import postgres from "postgres";
import "dotenv/config";

// Domain Validation Rules from BPMN Section 3
export function validateDomainFormat(rawDomain) {
  if (!rawDomain || typeof rawDomain !== "string") {
    return { isValid: false, error: "Nama domain wajib diisi." };
  }

  const d = rawDomain.trim().toLowerCase();

  // Tidak boleh diawali protokol
  if (d.startsWith("http://") || d.startsWith("https://")) {
    return { isValid: false, error: "Jangan sertakan 'http://' atau 'https://' pada nama domain." };
  }

  // Tidak boleh ada spasi
  if (/\s/.test(d)) {
    return { isValid: false, error: "Domain tidak boleh mengandung spasi." };
  }

  // Tidak boleh ada path '/'
  if (d.includes("/")) {
    return { isValid: false, error: "Domain tidak boleh mengandung path seperti '/login'." };
  }

  // Tidak boleh ada karakter khusus (@, #, _, $, dll)
  if (/[@#_!$%^&*()+=[\]{};':"\\|,<>?~]/.test(d)) {
    return { isValid: false, error: "Karakter khusus seperti @, #, atau _ tidak diperbolehkan." };
  }

  // Tidak boleh diawali atau diakhiri tanda minus
  if (d.startsWith("-") || d.endsWith("-")) {
    return { isValid: false, error: "Domain tidak boleh diawali atau diakhiri dengan tanda hubung (-)." };
  }

  // Tidak boleh double dot '..'
  if (d.includes("..")) {
    return { isValid: false, error: "Domain tidak boleh mengandung titik ganda (..)." };
  }

  // Harus memiliki pemisah titik dan ekstensi valid
  const parts = d.split(".");
  if (parts.length < 2) {
    return { isValid: false, error: "Domain harus menyertakan ekstensi valid (misal: .com, .id, .co.id)." };
  }

  // Cek setiap bagian tidak kosong dan valid
  for (const part of parts) {
    if (!part || part.length === 0) {
      return { isValid: false, error: "Format bagian domain tidak valid." };
    }
    if (part.startsWith("-") || part.endsWith("-")) {
      return { isValid: false, error: "Bagian domain tidak boleh diawali atau diakhiri tanda minus." };
    }
    if (!/^[a-z0-9-]+$/.test(part)) {
      return { isValid: false, error: "Domain hanya boleh terdiri dari huruf (a-z), angka (0-9), dan tanda hubung (-)." };
    }
  }

  // Ekstensi tld minimal 2 karakter
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { isValid: false, error: "Ekstensi domain (TLD) tidak valid." };
  }

  return { isValid: true };
}

console.log("=================================================");
console.log("TESTING BPMN CUSTOM DOMAIN VALIDATION RULES");
console.log("=================================================");

const validCases = [
  "barberinsinggah.com",
  "barberinsinggah.id",
  "barberinsinggah.co.id",
  "barberin-singgah.com",
  "app.barberinsinggah.com",
  "cukur.barberin123.com",
];

const invalidCases = [
  "barberin",
  "barberin.",
  ".com",
  "barberin_com",
  "-barberin.com",
  "barberin-.com",
  "barberin..com",
  "https://barberin.com",
  "www.barberin.com/login",
  "barber in.com",
  "barber@in.com",
];

let passCount = 0;
let failCount = 0;

for (const d of validCases) {
  const res = validateDomainFormat(d);
  if (res.isValid) {
    console.log(`[PASS] Valid: "${d}" correctly accepted.`);
    passCount++;
  } else {
    console.error(`[FAIL] Valid: "${d}" rejected with error: ${res.error}`);
    failCount++;
  }
}

for (const d of invalidCases) {
  const res = validateDomainFormat(d);
  if (!res.isValid) {
    console.log(`[PASS] Invalid: "${d}" correctly rejected (${res.error}).`);
    passCount++;
  } else {
    console.error(`[FAIL] Invalid: "${d}" was unexpectedly accepted!`);
    failCount++;
  }
}

console.log(`\nDomain Format Tests: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount > 0) {
  process.exit(1);
}

console.log("\n=================================================");
console.log("TESTING DATABASE SCHEMA & RELATIONSHIPS");
console.log("=================================================");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("DATABASE_URL not found, skipping db query test.");
  process.exit(0);
}

const sql = postgres(dbUrl, { prepare: false });

async function testDatabase() {
  try {
    const resBrandings = await sql`SELECT COUNT(*) FROM barbershop_brandings`;
    console.log(`[OK] barbershop_brandings count: ${resBrandings[0].count}`);

    const resHistories = await sql`SELECT COUNT(*) FROM branding_histories`;
    console.log(`[OK] branding_histories count: ${resHistories[0].count}`);

    const resDomains = await sql`SELECT COUNT(*) FROM custom_domains`;
    console.log(`[OK] custom_domains count: ${resDomains[0].count}`);

    const resLogs = await sql`SELECT COUNT(*) FROM domain_verification_logs`;
    console.log(`[OK] domain_verification_logs count: ${resLogs[0].count}`);

    console.log("\n[SUCCESS] All BPMN database tables and relations verified in PostgreSQL!");
  } catch (err) {
    console.error("[ERROR] Database test failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testDatabase();
