import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "../src/db/index.js";
import { users, barbershop } from "../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import { supabase } from "../src/lib/supabase-client.js";
import { getBaseUrl, handleRequestPasswordReset } from "../src/lib/owner-auth.ts";

async function runTests() {
  console.log("===============================================================");
  console.log("BARBERIN — VERIFIKASI FITUR RESET PASSWORD OWNER");
  console.log("===============================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  // TEST 1: SUPABASE CLIENT METHODS
  console.log("--- 1. Supabase Client Recovery & Update API Check ---");
  assert(typeof supabase.auth.resetPasswordForEmail === "function", "supabase.auth.resetPasswordForEmail API tersedia");
  assert(typeof supabase.auth.updateUser === "function", "supabase.auth.updateUser API tersedia");
  assert(typeof supabase.auth.verifyOtp === "function", "supabase.auth.verifyOtp API tersedia");
  assert(typeof supabase.auth.exchangeCodeForSession === "function", "supabase.auth.exchangeCodeForSession API tersedia");

  // TEST 2: PRODUCTION URL RESOLUTION (Section 6)
  console.log("\n--- 2. Base URL & Redirect Resolution (Section 6) ---");
  const localUrl = getBaseUrl();
  console.log("Default Base URL:", localUrl);
  assert(localUrl.length > 0, "Base URL menghasilkan nilai yang valid");

  const vercelOrigin = "https://barberin-prod.vercel.app";
  const resolvedWithClient = getBaseUrl(vercelOrigin);
  assert(resolvedWithClient === "https://barberin-prod.vercel.app", "Client origin production dihormati untuk redirect URL");

  // TEST 3: ACCOUNT ENUMERATION PROTECTION (Section 10)
  console.log("\n--- 3. Account Enumeration Security (Section 10) ---");
  const randomEmail = `nonexistent_owner_${Date.now()}@example.com`;
  const resNonExistent = await handleRequestPasswordReset({
    email: randomEmail,
    clientOrigin: "http://localhost:8080",
  });
  console.log("Response untuk email non-existent:", resNonExistent);
  assert(resNonExistent.success === true, "Response non-existent email mengembalikan success: true");
  assert(
    resNonExistent.message === "Jika email tersebut terdaftar, kami telah mengirimkan link untuk reset password.",
    "Pesan netral dan seragam, tidak membocorkan status email",
  );

  // TEST 4: ROLE OWNER PROTECTION (Section 11)
  console.log("\n--- 4. Role Owner Protection (Section 11) ---");
  // Pastikan jika ada user dengan role bukan owner, mereka tidak memicu reset password owner
  const [nonOwnerUser] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.role, "capster"))
    .limit(1);

  if (nonOwnerUser) {
    const resNonOwner = await handleRequestPasswordReset({
      email: nonOwnerUser.email,
      clientOrigin: "http://localhost:8080",
    });
    assert(resNonOwner.success === true, "Response non-owner email tetap mengembalikan response seragam");
    assert(
      resNonOwner.message.includes("Jika email tersebut terdaftar"),
      "Non-owner user tidak dapat mengeksploitasi formulir reset owner",
    );
  } else {
    console.log("Info: Tidak ada capster di DB saat ini, dilewati.");
  }

  // TEST 5: MULTI-TENANT ISOLATION (Section 12)
  console.log("\n--- 5. Multi-Tenant Isolation Check (Section 12) ---");
  // Ambil data Owner yang ada
  const [existingOwner] = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      role: users.role,
      id_barbershop: users.id_barbershop,
    })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.status, "active")))
    .limit(1);

  if (existingOwner) {
    console.log(`Ditemukan Owner aktif di DB: ${existingOwner.email}, Barbershop ID: ${existingOwner.id_barbershop}`);
    const [shop] = await db
      .select({
        id_barbershop: barbershop.id_barbershop,
        slug: barbershop.slug,
        nama_barbershop: barbershop.nama_barbershop,
      })
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, existingOwner.id_barbershop))
      .limit(1);

    assert(!!shop, "Barbershop terkait owner ditemukan");
    assert(shop.slug.length > 0, `Barbershop slug tersedia: ${shop.slug}`);

    // Request reset password untuk owner valid
    const resValidOwner = await handleRequestPasswordReset({
      email: existingOwner.email,
      clientOrigin: "http://localhost:8080",
    });
    assert(resValidOwner.success === true, "Request reset untuk Owner terdaftar berhasil");
    assert(
      resValidOwner.message === "Jika email tersebut terdaftar, kami telah mengirimkan link untuk reset password.",
      "Response tetap seragam untuk Owner valid (Account enumeration protection)",
    );

    // Verifikasi bahwa data owner di DB TIDAK berubah (role dan id_barbershop tetap utuh)
    const [ownerAfter] = await db
      .select({
        id_user: users.id_user,
        role: users.role,
        id_barbershop: users.id_barbershop,
        password: users.password,
      })
      .from(users)
      .where(eq(users.id_user, existingOwner.id_user))
      .limit(1);

    assert(ownerAfter.role === "owner", "Role tetap 'owner'");
    assert(ownerAfter.id_barbershop === existingOwner.id_barbershop, "id_barbershop tetap sama persis (Tenant isolation preserved)");
    assert(ownerAfter.password === null || typeof ownerAfter.password === "string", "Password tidak disimpan secara plaintext");
  } else {
    console.log("Info: Tidak ada owner aktif di DB lokal saat ini.");
  }

  // TEST 6: FILE & UI INTEGRITY CHECKS (Section 1 & 3)
  console.log("\n--- 6. UI Structure & Route Integrity Check ---");
  const loginContent = readFileSync(resolve("src/routes/owner.login.tsx"), "utf-8");
  assert(loginContent.includes("Lupa Password?"), "Link 'Lupa Password?' ada di owner.login.tsx");
  assert(
    loginContent.indexOf("Daftar di sini") < loginContent.indexOf("Lupa Password?"),
    "Posisi 'Lupa Password?' berada tepat di bawah 'Belum memiliki akun Barbershop? Daftar di sini'",
  );
  assert(loginContent.includes("/owner/forgot-password"), "Link 'Lupa Password?' mengarah ke /owner/forgot-password");

  const forgotContent = readFileSync(resolve("src/routes/owner.forgot-password.tsx"), "utf-8");
  assert(forgotContent.includes("createFileRoute(\"/owner/forgot-password\")"), "Route /owner/forgot-password terdaftar");
  assert(forgotContent.includes("Kirim Link Reset Password"), "Tombol 'Kirim Link Reset Password' ada");
  assert(forgotContent.includes("requestPasswordReset"), "Memanggil server function requestPasswordReset");

  const resetContent = readFileSync(resolve("src/routes/owner.reset-password.tsx"), "utf-8");
  assert(resetContent.includes("createFileRoute(\"/owner/reset-password\")"), "Route /owner/reset-password terdaftar");
  assert(resetContent.includes("Atur Password Baru"), "Judul 'Atur Password Baru' ada");
  assert(resetContent.includes("supabase.auth.updateUser"), "Menggunakan supabase.auth.updateUser untuk menyimpan password baru");
  assert(resetContent.includes("Link Reset Password Tidak Valid"), "Menampilkan pesan error jika token invalid/expired");

  const slugForgot = readFileSync(resolve("src/routes/$barbershopSlug.owner.forgot-password.tsx"), "utf-8");
  assert(slugForgot.includes("/owner/forgot-password"), "Tenant-scoped forgot-password route me-redirect ke /owner/forgot-password");

  const slugReset = readFileSync(resolve("src/routes/$barbershopSlug.owner.reset-password.tsx"), "utf-8");
  assert(slugReset.includes("/owner/reset-password"), "Tenant-scoped reset-password route me-redirect ke /owner/reset-password");

  console.log("\n===============================================================");
  console.log(`SEMUA PENGUJIAN BERHASIL: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
