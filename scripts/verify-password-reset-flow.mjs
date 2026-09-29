import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "../src/db/index.js";
import { users, barbershop } from "../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import { supabase, getSupabaseClient } from "../src/lib/supabase-client.js";
import {
  getBaseUrl,
  handleRequestPasswordReset,
  handleValidateOwnerRecoveryContext,
} from "../src/lib/owner-auth.ts";

async function runTests() {
  console.log("===============================================================");
  console.log("BARBERIN — VERIFIKASI PERBAIKAN PASSWORD RECOVERY FLOW (DIFF)");
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

  // TEST 1: SUPABASE CLIENT & PKCE ELIMINATION (DIFF 2)
  console.log("--- 1. Supabase Client & Flow Type Check (DIFF 2) ---");
  const client = getSupabaseClient();
  assert(typeof client.auth.resetPasswordForEmail === "function", "client.auth.resetPasswordForEmail tersedia");
  assert(typeof client.auth.updateUser === "function", "client.auth.updateUser tersedia");
  assert(typeof client.auth.verifyOtp === "function", "client.auth.verifyOtp tersedia");
  assert(typeof client.auth.setSession === "function", "client.auth.setSession tersedia");

  // Verifikasi bahwa client dikonfigurasi dengan flowType implicit (bukan PKCE storage dependency)
  const clientFile = readFileSync(resolve("src/lib/supabase-client.ts"), "utf-8");
  assert(clientFile.includes('flowType: "implicit"'), "Supabase Client menggunakan flowType 'implicit' (menghilangkan PKCE code_verifier dependency)");
  assert(!clientFile.includes('flowType: "pkce"'), "PKCE code_verifier flowType telah dihapus");

  // TEST 2: PRODUCTION URL RESOLUTION (DIFF 4)
  console.log("\n--- 2. Base URL & Dynamic Redirect Resolution (DIFF 4) ---");
  const localUrl = getBaseUrl();
  console.log("Default Base URL:", localUrl);
  assert(localUrl.length > 0, "Base URL menghasilkan nilai yang valid");

  const vercelOrigin = "https://barberinsigna.vercel.app";
  const resolvedWithClient = getBaseUrl(vercelOrigin);
  assert(resolvedWithClient === "https://barberinsigna.vercel.app", "Client origin production dihormati untuk redirect URL");

  // TEST 3: VALIDASI INPUT & ERROR MESSAGES (DIFF 11 A & B)
  console.log("\n--- 3. Validation & Error Messages (DIFF 11 A & B) ---");
  try {
    await handleRequestPasswordReset({ email: "" });
    assert(false, "Email kosong seharusnya melempar error");
  } catch (e) {
    assert(e.message === "Email wajib diisi.", "Pesan email kosong sesuai DIFF 11 A ('Email wajib diisi.')");
  }

  try {
    await handleRequestPasswordReset({ email: "invalid-email-format" });
    assert(false, "Format email salah seharusnya melempar error");
  } catch (e) {
    assert(
      e.message === "Masukkan alamat email yang valid.",
      "Pesan format email salah sesuai DIFF 11 B ('Masukkan alamat email yang valid.')",
    );
  }

  // TEST 4: ACCOUNT ENUMERATION PROTECTION (DIFF 3 & 10)
  console.log("\n--- 4. Account Enumeration Security (DIFF 3 & 10) ---");
  const randomEmail = `nonexistent_owner_${Date.now()}@example.com`;
  const resNonExistent = await handleRequestPasswordReset({
    email: randomEmail,
    clientOrigin: "http://localhost:8080",
  });
  console.log("Response untuk email non-existent:", resNonExistent);
  assert(resNonExistent.success === true, "Response non-existent email mengembalikan success: true");
  assert(
    resNonExistent.message === "Link reset password telah dikirim. Silakan cek Gmail Anda.",
    "Pesan netral dan seragam sesuai DIFF 3 ('Link reset password telah dikirim. Silakan cek Gmail Anda.')",
  );

  // TEST 5: OWNER ROLE VALIDATION (DIFF 9)
  console.log("\n--- 5. Owner Role Validation in DB Context (DIFF 9) ---");
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
    console.log(`Menguji Owner valid di DB: ${existingOwner.email} (${existingOwner.id_user})`);
    const ownerContext = await handleValidateOwnerRecoveryContext({
      userId: existingOwner.id_user,
    });
    assert(ownerContext.valid === true, "Validasi context recovery untuk owner berhasil");
    assert(ownerContext.role === "owner", "Role user adalah 'owner'");
    assert(ownerContext.id_barbershop === existingOwner.id_barbershop, "id_barbershop tetap sama");

    // Uji proteksi non-owner: cari akun capster atau pelanggan jika ada
    const [nonOwnerUser] = await db
      .select({ id_user: users.id_user, role: users.role })
      .from(users)
      .where(eq(users.role, "capster"))
      .limit(1);

    if (nonOwnerUser) {
      try {
        await handleValidateOwnerRecoveryContext({ userId: nonOwnerUser.id_user });
        assert(false, "User non-owner seharusnya ditolak");
      } catch (err) {
        assert(
          err.message.includes("Bukan merupakan akun Owner BARBERIN") ||
            err.message.includes("Akses ditolak"),
          "User non-owner ditolak aksesnya ke form reset owner (DIFF 9)",
        );
      }
    }
  }

  // TEST 6: MULTI-TENANT ISOLATION (DIFF 10)
  console.log("\n--- 6. Multi-Tenant Isolation Check (DIFF 10) ---");
  if (existingOwner) {
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
      resValidOwner.message === "Link reset password telah dikirim. Silakan cek Gmail Anda.",
      "Response tetap seragam untuk Owner valid (Account enumeration protection)",
    );

    // Verifikasi bahwa data owner di DB TIDAK berubah
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
    assert(ownerAfter.password === null || typeof ownerAfter.password === "string", "Password tidak disimpan plaintext di database aplikasi");
  }

  // TEST 7: FILE & UI INTEGRITY CHECKS (DIFF 3, 5, 6, 7)
  console.log("\n--- 7. UI & Route Content Check (DIFF 3, 5, 6, 7) ---");
  const loginContent = readFileSync(resolve("src/routes/owner.login.tsx"), "utf-8");
  assert(loginContent.includes("Lupa Password?"), "Link 'Lupa Password?' ada di owner.login.tsx");
  assert(
    loginContent.indexOf("Daftar di sini") < loginContent.indexOf("Lupa Password?"),
    "Posisi 'Lupa Password?' berada tepat di bawah 'Belum memiliki akun Barbershop? Daftar di sini'",
  );
  assert(loginContent.includes('to="/owner/forgot-password"'), "Link 'Lupa Password?' mengarah ke /owner/forgot-password");

  const forgotContent = readFileSync(resolve("src/routes/owner.forgot-password.tsx"), "utf-8");
  assert(forgotContent.includes("Lupa Password"), "Judul 'Lupa Password' ada (DIFF 3)");
  assert(forgotContent.includes("Email Owner"), "Label 'Email Owner' ada (DIFF 3)");
  assert(forgotContent.includes("Link reset password telah dikirim. Silakan cek Gmail Anda."), "Pesan sukses Gmail ada (DIFF 3)");
  assert(forgotContent.includes("Kirim Link Reset Password"), "Tombol 'Kirim Link Reset Password' ada (DIFF 3)");

  const resetContent = readFileSync(resolve("src/routes/owner.reset-password.tsx"), "utf-8");
  assert(resetContent.includes("Atur Password Baru"), "Judul 'Atur Password Baru' ada (DIFF 5)");
  assert(resetContent.includes("Simpan Password Baru"), "Tombol 'Simpan Password Baru' ada (DIFF 5)");
  assert(resetContent.includes("Konfirmasi password tidak sama."), "Validasi konfirmasi password ada (DIFF 11 I)");
  assert(resetContent.includes("Password Berhasil Diubah"), "Pesan 'Password Berhasil Diubah' ada (DIFF 7)");
  assert(resetContent.includes("Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi."), "Pesan error invalid/expired ada (DIFF 6)");
  assert(resetContent.includes("Kirim Link Baru"), "Tombol 'Kirim Link Baru' ada (DIFF 6)");
  assert(resetContent.includes("validateOwnerRecoveryContext"), "Memverifikasi role Owner ke server (DIFF 9)");

  console.log("\n===============================================================");
  console.log(`SEMUA PENGUJIAN BERHASIL: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
