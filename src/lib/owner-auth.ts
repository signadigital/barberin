import { createServerFn } from "@tanstack/react-start";
import { and, eq, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { barbershop, business, layanan, owner, ownerVerificationTokens, users } from "@/db/schema";
import {
  detectEmailOrPhone,
  generateVerificationToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  normalizePhoneNumber,
  verifyPassword,
} from "@/lib/auth-crypto";
import {
  clearOwnerSessionCookie,
  getOwnerSession,
  setOwnerSessionCookie,
} from "@/lib/auth-session";
import { supabase } from "@/lib/supabase-client";
import { generateUniqueBarbershopSlug } from "./slug";

export type OwnerRegisterInput = {
  nama_lengkap: string;
  email: string;
  no_hp: string;
  password: string;
  nama_barbershop: string;
  alamat?: string | undefined;
  latitude: number;
  longitude: number;
};

export type OwnerLoginInput = {
  identifier: string; // Email ATAU Nomor Telepon
  password: string;
  barbershopSlug?: string | undefined;
};

function getBaseUrl(): string {
  if (process.env["APP_URL"]) {
    return process.env["APP_URL"].replace(/\/$/, "");
  }
  return "http://localhost:8080";
}

// ============================================================================
// 1. REGISTRASI OWNER (BPMN 01)
// ============================================================================
async function handleRegisterOwner(data: OwnerRegisterInput) {
  // 1. Validasi Kelengkapan Data
    const namaLengkap = (data.nama_lengkap || "").trim();
    const namaBarbershop = (data.nama_barbershop || "").trim();
    const rawEmail = (data.email || "").trim();
    const rawPhone = (data.no_hp || "").trim();
    const rawPassword = data.password || "";
    const alamat = (data.alamat || "").trim() || "Alamat belum diatur";
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);

    if (!namaLengkap) {
      throw new Error("Nama lengkap pemilik wajib diisi.");
    }

    if (!namaBarbershop) {
      throw new Error("Nama barbershop wajib diisi.");
    }

    if (!rawEmail) {
      throw new Error("Email wajib diisi.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
      throw new Error("Format email tidak valid.");
    }

    if (!rawPhone) {
      throw new Error("Nomor telepon wajib diisi.");
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (
      !/^[0-9]+$/.test(normalizedPhone) ||
      normalizedPhone.length < 8 ||
      normalizedPhone.length > 15
    ) {
      throw new Error("Nomor telepon tidak valid. Minimal 8 digit dan maksimal 15 digit angka.");
    }

    if (!rawPassword) {
      throw new Error("Password wajib diisi.");
    }

    if (rawPassword.length < 6) {
      throw new Error("Password minimal 6 karakter.");
    }

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Koordinat lokasi barbershop tidak valid. Harap pilih titik pada peta.");
    }

    const normalizedEmail = normalizeEmail(rawEmail);

    // 2. Validasi Duplikasi
    const [existingEmail] = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingEmail) {
      throw new Error("Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.");
    }

    const [existingPhone] = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.no_hp, normalizedPhone))
      .limit(1);

    if (existingPhone) {
      throw new Error("Nomor telepon sudah terdaftar.");
    }

    // 3. Daftarkan User ke Supabase Auth
    const redirectUrl = `${getBaseUrl()}/owner/verify-email`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: rawPassword,
      options: {
        data: {
          role: "owner",
          nama_lengkap: namaLengkap,
          no_hp: normalizedPhone,
          nama_barbershop: namaBarbershop,
        },
        emailRedirectTo: redirectUrl,
      },
    });

    if (authError) {
      console.error("[SUPABASE SIGNUP ERROR]", authError.status, authError.message);
      let msg = authError.message;
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("User already registered")
      ) {
        msg = "Email sudah terdaftar di sistem autentikasi. Silakan masuk ke akun Anda.";
      } else if (
        msg.toLowerCase().includes("invalid api key") ||
        msg.toLowerCase().includes("jwt") ||
        msg.toLowerCase().includes("api key")
      ) {
        msg = "Supabase environment variables belum dikonfigurasi.";
      }
      throw new Error(msg);
    }

    if (!authData.user?.id) {
      throw new Error("Gagal memperoleh User ID dari Supabase Auth.");
    }

    const authUserId = authData.user.id;

    // 4. Eksekusi Atomic DB Transaction (Sync ke public.users, owner, business, barbershop)
    let createdSlug = "";
    const executeRegistrationTransaction = async () => {
      await db.transaction(async (tx) => {
        // Step A: Buat Barbershop (Status awal inactive sampai terverifikasi)
        const finalSlug = await generateUniqueBarbershopSlug(tx, namaBarbershop);
        createdSlug = finalSlug;
        const [shop] = await tx
          .insert(barbershop)
          .values({
            nama_barbershop: namaBarbershop,
            slug: finalSlug,
            alamat,
            no_hp: normalizedPhone,
            jam_buka: "08:00",
            jam_tutup: "21:00",
            latitude: lat.toFixed(7),
            longitude: lng.toFixed(7),
            status: "inactive",
          })
          .returning();

        if (!shop) {
          throw new Error("Gagal membuat data barbershop.");
        }

        // Step B: Buat Akun Owner di tabel public.users (Sinkron ID 1-to-1 dengan Supabase Auth)
        const [u] = await tx
          .insert(users)
          .values({
            id_user: authUserId,
            email: normalizedEmail,
            password: null, // Password dikelola secara aman oleh Supabase Auth
            nama_lengkap: namaLengkap,
            no_hp: normalizedPhone,
            role: "owner",
            status: "inactive",
            email_verified: false,
            verification_status: "pending",
            id_barbershop: shop.id_barbershop,
          })
          .returning();

        if (!u) {
          throw new Error("Gagal membuat akun owner di database.");
        }

        // Step C: Sinkronisasi ke model SaaS (owner & business)
        const [saasOwner] = await tx
          .insert(owner)
          .values({
            name: namaLengkap,
            email: normalizedEmail,
            phone: normalizedPhone,
            password_hash: "supabase_auth",
            status: "inactive",
          })
          .returning();

        if (saasOwner) {
          await tx.insert(business).values({
            owner_id: saasOwner.owner_id,
            business_name: namaBarbershop,
            status: "inactive",
          });
        }

        // Step D: Zero State - Toko baru dimulai bersih tanpa layanan bawaan
      });
    };

    const isTransientConnectionError = (err: unknown): boolean => {
      if (!err) return false;
      const str = String(err).toLowerCase();
      return (
        str.includes("econnreset") ||
        str.includes("connection closed") ||
        str.includes("connection terminated") ||
        str.includes("etimedout") ||
        str.includes("econnrefused") ||
        str.includes("57p01") ||
        str.includes("closed connection")
      );
    };

    try {
      await executeRegistrationTransaction();
    } catch (firstErr: unknown) {
      if (isTransientConnectionError(firstErr)) {
        console.warn(
          "[DATABASE REGISTRATION] Terdeteksi transient connection reset, mencoba ulang 1x dengan transaksi baru...",
        );
        try {
          await executeRegistrationTransaction();
        } catch (retryErr: unknown) {
          console.error("[DATABASE REGISTRATION ERROR AFTER RETRY]", retryErr);
          const dbErrMsg =
            retryErr instanceof Error ? retryErr.message : "Gagal menyimpan data akun ke database.";
          throw new Error(`Pendaftaran gagal disimpan: ${dbErrMsg}`);
        }
      } else {
        console.error("[DATABASE REGISTRATION ERROR]", firstErr);
        const dbErrMsg =
          firstErr instanceof Error ? firstErr.message : "Gagal menyimpan data akun ke database.";
        throw new Error(`Pendaftaran gagal disimpan: ${dbErrMsg}`);
      }
    }

    return {
      success: true,
      email: normalizedEmail,
      ownerName: namaLengkap,
      businessName: namaBarbershop,
      slug: createdSlug,
      emailSent: true,
      message:
        "Registrasi berhasil. Link konfirmasi email telah dikirimkan ke alamat Gmail Anda oleh Supabase Auth.",
    };
}

export const registerOwner = createServerFn({
  method: "POST",
})
  .validator((data: OwnerRegisterInput) => data)
  .handler(async ({ data }) => handleRegisterOwner(data));

// ============================================================================
// 2. VERIFIKASI EMAIL OWNER (BPMN 01 — SUPABASE AUTH VERIFY OTP)
// ============================================================================
export type VerifyEmailInput = {
  token_hash?: string | undefined;
  type?: string | undefined;
  code?: string | undefined;
  token?: string | undefined;
};

// In-memory cache for in-flight requests and recently verified tokens (prevents double consumption & race conditions)
const inFlightVerifications = new Map<string, Promise<any>>();
const recentVerifications = new Map<string, { result: any; timestamp: number }>();

async function handleVerifyOwnerEmail(data: VerifyEmailInput) {
  const rawTokenHash = data.token_hash?.trim();
  const rawCode = data.code?.trim();
  const rawToken = data.token?.trim();
  const cacheKey = rawTokenHash
    ? `hash:${rawTokenHash}`
    : rawCode
      ? `code:${rawCode}`
      : rawToken
        ? `token:${rawToken}`
        : null;

  // 1. Cek cache jika verifikasi ini baru saja berhasil diproses (misal akibat double click / React StrictMode)
  if (cacheKey) {
    const cached = recentVerifications.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      console.log("[SERVER VERIFY-EMAIL] Mengembalikan hasil verifikasi dari cache aman (deduplikasi aktif).");
      return cached.result;
    }

    const inFlight = inFlightVerifications.get(cacheKey);
    if (inFlight) {
      console.log("[SERVER VERIFY-EMAIL] Proses verifikasi sedang berjalan, menunggu in-flight promise...");
      return await inFlight;
    }
  }

  const executeVerification = async () => {
    let authenticatedUserId: string | null = null;
    let userEmail: string | null = null;
    let legacyRecordId: string | null = null;

    // Flow A: Supabase Auth Token Hash (verifyOtp)
    if (rawTokenHash) {
      const requestedType = (data.type || "email").trim().toLowerCase();
      const tokenPreview = `${rawTokenHash.slice(0, 4)}...${rawTokenHash.slice(-4)}`;

      console.log("[SERVER VERIFY-EMAIL START]", {
        token_hash_present: true,
        token_hash_len: rawTokenHash.length,
        token_preview: tokenPreview,
        requested_type: requestedType,
        is_type_email: requestedType === "email",
      });

      let otpData: any = null;
      let otpError: any = null;

      // Supabase GoTrue expects 'signup' for signup confirmation links,
      // but email templates or query parameters often send 'type=email' or 'type=signup'.
      // We attempt the requested type first, and if that fails with 'Email link is invalid or has expired',
      // we immediately attempt the alternative type.
      const primaryType: "signup" | "email" = requestedType === "signup" ? "signup" : "email";
      const fallbackType: "signup" | "email" = primaryType === "email" ? "signup" : "email";

      console.log(`[SUPABASE VERIFY OTP] Percobaan 1: Memverifikasi dengan type '${primaryType}'...`);
      const res1 = await supabase.auth.verifyOtp({
        token_hash: rawTokenHash,
        type: primaryType,
      });

      if (res1.data?.user && !res1.error) {
        otpData = res1.data;
        console.log(`[SUPABASE VERIFY OTP SUCCESS] Berhasil diverifikasi menggunakan type '${primaryType}'.`);
      } else {
        console.warn(
          `[SUPABASE VERIFY OTP] Percobaan 1 dengan type '${primaryType}' gagal (${res1.error?.status}: ${res1.error?.message}). Mencoba otomatis dengan fallback type '${fallbackType}'...`,
        );

        const res2 = await supabase.auth.verifyOtp({
          token_hash: rawTokenHash,
          type: fallbackType,
        });

        if (res2.data?.user && !res2.error) {
          otpData = res2.data;
          console.log(`[SUPABASE VERIFY OTP SUCCESS] Berhasil diverifikasi menggunakan fallback type '${fallbackType}'.`);
        } else {
          otpError = res2.error || res1.error;
          console.error(`[SUPABASE VERIFY OTP FAILED] Fallback dengan type '${fallbackType}' juga gagal (${res2.error?.status}: ${res2.error?.message}).`);
        }
      }

      if (otpError || !otpData?.user) {
        let msg =
          otpError?.message ||
          "Link verifikasi tidak valid, sudah kedaluwarsa, atau sudah pernah digunakan.";
        if (
          msg.toLowerCase().includes("invalid api key") ||
          msg.toLowerCase().includes("jwt") ||
          msg.toLowerCase().includes("api key")
        ) {
          msg = "Supabase environment variables belum dikonfigurasi.";
        }
        throw new Error(msg);
      }

      authenticatedUserId = otpData.user.id;
      userEmail = otpData.user.email || null;
    }
    // Flow B: PKCE Code Exchange (exchangeCodeForSession)
    else if (rawCode) {
      console.log("[SERVER VERIFY-EMAIL START PKCE]", {
        code_present: true,
        code_len: rawCode.length,
      });

      const { data: exchangeData, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(rawCode);

      if (exchangeError || !exchangeData.user) {
        console.error("[SUPABASE CODE EXCHANGE ERROR]", exchangeError);
        throw new Error(
          exchangeError?.message || "Kode verifikasi tidak valid atau sudah kedaluwarsa.",
        );
      }

      authenticatedUserId = exchangeData.user.id;
      userEmail = exchangeData.user.email || null;
    }
    // Flow C: Legacy custom token fallback (dari tabel owner_verification_tokens)
    else if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const [record] = await db
        .select({
          id: ownerVerificationTokens.id,
          id_user: ownerVerificationTokens.id_user,
          expires_at: ownerVerificationTokens.expires_at,
          used_at: ownerVerificationTokens.used_at,
          user_email: users.email,
        })
        .from(ownerVerificationTokens)
        .innerJoin(users, eq(ownerVerificationTokens.id_user, users.id_user))
        .where(eq(ownerVerificationTokens.token_hash, tokenHash))
        .limit(1);

      if (!record) {
        throw new Error("Token verifikasi tidak ditemukan.");
      }
      if (record.used_at) {
        throw new Error("Link verifikasi tidak valid atau sudah pernah digunakan.");
      }
      if (record.expires_at < new Date()) {
        throw new Error("Link verifikasi sudah kedaluwarsa.");
      }

      authenticatedUserId = record.id_user;
      userEmail = record.user_email;
      legacyRecordId = record.id;
    } else {
      throw new Error("Parameter verifikasi (token_hash atau code) tidak ditemukan dalam URL.");
    }

    if (!authenticatedUserId) {
      throw new Error("Gagal mengidentifikasi pengguna dari proses verifikasi.");
    }

    // 2. Ambil data akun Owner dari tabel public.users

  const [record] = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      nama_lengkap: users.nama_lengkap,
      role: users.role,
      status: users.status,
      id_barbershop: users.id_barbershop,
      email_verified: users.email_verified,
    })
    .from(users)
    .where(
      userEmail
        ? or(eq(users.id_user, authenticatedUserId), eq(users.email, userEmail))
        : eq(users.id_user, authenticatedUserId),
    )
    .limit(1);

  if (!record) {
    throw new Error("Data akun Owner tidak ditemukan di database BARBERIN.");
  }

  if (record.role !== "owner") {
    throw new Error("Akun ini bukan merupakan akun Owner BARBERIN.");
  }

  if (!record.id_barbershop) {
    throw new Error("Data barbershop terkait akun tidak ditemukan.");
  }

  const [shop] = await db
    .select({
      id_barbershop: barbershop.id_barbershop,
      nama_barbershop: barbershop.nama_barbershop,
      slug: barbershop.slug,
      alamat: barbershop.alamat,
      status: barbershop.status,
    })
    .from(barbershop)
    .where(eq(barbershop.id_barbershop, record.id_barbershop))
    .limit(1);

  if (!shop) {
    throw new Error("Data barbershop tidak ditemukan.");
  }

  const now = new Date();

  // 3. Update status menjadi Active / Verified secara atomic
  await db.transaction(async (tx) => {
    // A. Jika ada token legacy, tandai used_at
    if (legacyRecordId) {
      await tx
        .update(ownerVerificationTokens)
        .set({ used_at: now })
        .where(eq(ownerVerificationTokens.id, legacyRecordId));
    }

    // B. Update status user menjadi active dan email_verified
    await tx
      .update(users)
      .set({
        status: "active",
        email_verified: true,
        verification_status: "verified",
        email_verified_at: now,
        updated_at: now,
      })
      .where(eq(users.id_user, record.id_user));

    // C. Update status barbershop menjadi active
    await tx
      .update(barbershop)
      .set({
        status: "active",
        updated_at: now,
      })
      .where(eq(barbershop.id_barbershop, shop.id_barbershop));

    // D. Update status di tabel SaaS (owner & business)
    await tx
      .update(owner)
      .set({ status: "active", updated_at: now })
      .where(eq(owner.email, record.email));

    const [saasOwner] = await tx
      .select({ owner_id: owner.owner_id })
      .from(owner)
      .where(eq(owner.email, record.email))
      .limit(1);

    if (saasOwner) {
      await tx
        .update(business)
        .set({ status: "active", updated_at: now })
        .where(eq(business.owner_id, saasOwner.owner_id));
    }
  });

  // 4. Ambil data SaaS owner_id & business_id
  const [saasOwnerFinal] = await db
    .select({ owner_id: owner.owner_id })
    .from(owner)
    .where(eq(owner.email, record.email))
    .limit(1);

  let businessId: number | null = null;
  if (saasOwnerFinal) {
    const [biz] = await db
      .select({ business_id: business.business_id })
      .from(business)
      .where(eq(business.owner_id, saasOwnerFinal.owner_id))
      .limit(1);
    if (biz) businessId = Number(biz.business_id);
  }

  // 5. Buat signed session cookie BARBERIN Owner
  setOwnerSessionCookie({
    userId: record.id_user,
    email: record.email,
    role: "owner",
    barbershopId: shop.id_barbershop,
    barbershopName: shop.nama_barbershop,
    namaLengkap: record.nama_lengkap,
  });

    const result = {
      success: true,
      user: {
        id_user: record.id_user,
        email: record.email,
        nama_lengkap: record.nama_lengkap,
        role: record.role,
        id_barbershop: shop.id_barbershop,
        barbershopSlug: shop.slug,
        barbershopName: shop.nama_barbershop,
      },
      owner_id: saasOwnerFinal ? Number(saasOwnerFinal.owner_id) : null,
      business_id: businessId,
      barbershop_id: shop.id_barbershop,
    };

    if (cacheKey) {
      recentVerifications.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;
  };

  if (cacheKey) {
    const promise = executeVerification().finally(() => {
      inFlightVerifications.delete(cacheKey);
    });
    inFlightVerifications.set(cacheKey, promise);
    return await promise;
  }

  return await executeVerification();
}

export const verifyOwnerEmail = createServerFn({
  method: "POST",
})
  .validator((data: VerifyEmailInput) => data)
  .handler(async ({ data }) => handleVerifyOwnerEmail(data));

// ============================================================================
// 3. OWNER LOGIN (BPMN 02 — SUPABASE AUTH + BARBERIN SESSION)
// ============================================================================
async function handleLoginOwnerBpmn(data: OwnerLoginInput) {
  const rawIdentifier = (data.identifier || "").trim();
  const rawPassword = data.password || "";

  // 1. Validasi Format Input
  if (!rawIdentifier) {
    throw new Error("Email atau nomor telepon wajib diisi.");
  }

  if (!rawPassword) {
    throw new Error("Password tidak boleh kosong.");
  }

  if (rawPassword.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const detected = detectEmailOrPhone(rawIdentifier);
  if (detected.type === "invalid") {
    if (rawIdentifier.includes("@")) {
      throw new Error("Format email tidak valid.");
    }
    throw new Error("Format nomor telepon tidak valid. Gunakan format angka minimal 8 digit.");
  }

  // 2. Tentukan Email Target (Jika input Nomor HP, cari email di public.users)
  let targetEmail = detected.normalized;
  if (detected.type === "phone") {
    const [userByPhone] = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.no_hp, detected.normalized)))
      .limit(1);

    if (!userByPhone) {
      throw new Error("Email/nomor telepon atau password salah.");
    }
    targetEmail = userByPhone.email;
  }

  // 3. Autentikasi Kredensial via Supabase Auth
  let authUserId: string | null = null;
  const { data: authResult, error: authError } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: rawPassword,
  });

  if (authError) {
    if (
      authError.message.toLowerCase().includes("invalid api key") ||
      authError.message.toLowerCase().includes("jwt") ||
      authError.message.toLowerCase().includes("api key")
    ) {
      throw new Error("Supabase environment variables belum dikonfigurasi.");
    }

    // Jika email belum dikonfirmasi di Supabase Auth
    if (
      authError.message.toLowerCase().includes("email not confirmed") ||
      (authError.status === 400 && authError.message.toLowerCase().includes("confirm"))
    ) {
      throw new Error(
        "Email akun Anda belum diverifikasi. Silakan periksa inbox Gmail Anda dan klik tombol verifikasi.",
      );
    }

    // Fallback: Dukungan bagi legacy user yang masih memiliki custom scrypt password
    const [legacyUser] = await db
      .select({ id_user: users.id_user, password: users.password })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.email, targetEmail)))
      .limit(1);

    if (legacyUser?.password) {
      const { valid: legacyValid } = verifyPassword(rawPassword, legacyUser.password);
      if (legacyValid) {
        authUserId = legacyUser.id_user;
      } else {
        throw new Error("Email/nomor telepon atau password salah.");
      }
    } else {
      throw new Error("Email/nomor telepon atau password salah.");
    }
  } else {
    authUserId = authResult.user?.id || null;
  }

  if (!authUserId) {
    throw new Error("Email/nomor telepon atau password salah.");
  }

  // 4. Ambil data profil Owner dari public.users
  const [foundUser] = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      nama_lengkap: users.nama_lengkap,
      no_hp: users.no_hp,
      role: users.role,
      status: users.status,
      id_barbershop: users.id_barbershop,
      email_verified: users.email_verified,
      verification_status: users.verification_status,
    })
    .from(users)
    .where(or(eq(users.id_user, authUserId), eq(users.email, targetEmail)))
    .limit(1);

  if (!foundUser || foundUser.role !== "owner") {
    throw new Error("Akun Owner tidak ditemukan.");
  }

  // 5. Cek Status Verifikasi Email
  const isVerified =
    foundUser.email_verified === true || foundUser.verification_status === "verified";
  if (!isVerified) {
    throw new Error(
      "Akun belum terverifikasi. Silakan periksa email Anda dan klik link verifikasi.",
    );
  }

  // 6. Cek Status Akun
  if (foundUser.status !== "active") {
    throw new Error("Akun Anda sedang dinonaktifkan. Silakan hubungi administrator BARBERIN.");
  }

  // 7. Identifikasi Barbershop Spesifik Milik Owner Ini & Validasi Slug
  if (!foundUser.id_barbershop) {
    throw new Error("Akun Owner tidak memiliki barbershop yang terkait.");
  }

  if (data.barbershopSlug) {
    const [targetShop] = await db
      .select({
        id_barbershop: barbershop.id_barbershop,
        slug: barbershop.slug,
        status: barbershop.status,
      })
      .from(barbershop)
      .where(eq(barbershop.slug, data.barbershopSlug))
      .limit(1);

    if (!targetShop) {
      throw new Error("Barbershop tidak ditemukan.");
    }

    if (targetShop.status === "suspended" || targetShop.status === "inactive") {
      throw new Error("Akun toko sedang dinonaktifkan. Silakan hubungi administrator BARBERIN.");
    }

    if (foundUser.id_barbershop !== targetShop.id_barbershop) {
      throw new Error("Anda tidak memiliki akses ke barbershop ini.");
    }
  }

  const [shop] = await db
    .select({
      id_barbershop: barbershop.id_barbershop,
      slug: barbershop.slug,
      nama_barbershop: barbershop.nama_barbershop,
      alamat: barbershop.alamat,
      status: barbershop.status,
    })
    .from(barbershop)
    .where(eq(barbershop.id_barbershop, foundUser.id_barbershop))
    .limit(1);

  if (!shop) {
    throw new Error("Barbershop milik Owner tidak ditemukan.");
  }

  if (shop.status === "suspended" || shop.status === "inactive") {
    throw new Error(
      "Akun toko Anda sedang dinonaktifkan. Silakan hubungi administrator BARBERIN.",
    );
  }

  // 8. Buat Signed Session Cookie BARBERIN Existing
  setOwnerSessionCookie({
    userId: foundUser.id_user,
    email: foundUser.email,
    role: "owner",
    barbershopId: shop.id_barbershop,
    barbershopName: shop.nama_barbershop,
    namaLengkap: foundUser.nama_lengkap,
  });

  return {
    success: true,
    id_user: foundUser.id_user,
    email: foundUser.email,
    nama_lengkap: foundUser.nama_lengkap,
    role: foundUser.role,
    barbershop: {
      id_barbershop: shop.id_barbershop,
      slug: shop.slug,
      nama_barbershop: shop.nama_barbershop,
      alamat: shop.alamat || "",
    },
  };
}

export const loginOwnerBpmn = createServerFn({
  method: "POST",
})
  .validator((data: OwnerLoginInput) => data)
  .handler(async ({ data }) => handleLoginOwnerBpmn(data));

// ============================================================================
// 4. KIRIM ULANG EMAIL VERIFIKASI (SUPABASE AUTH RESEND)
// ============================================================================
export const resendVerificationEmail = createServerFn({
  method: "POST",
})
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const rawEmail = (data.email || "").trim().toLowerCase();
    if (!rawEmail) {
      throw new Error("Email wajib diisi.");
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: rawEmail,
      options: {
        emailRedirectTo: `${getBaseUrl()}/owner/verify-email`,
      },
    });

    if (error) {
      console.error("[SUPABASE RESEND ERROR]", error.status, error.message);
      if (
        error.message.toLowerCase().includes("invalid api key") ||
        error.message.toLowerCase().includes("jwt") ||
        error.message.toLowerCase().includes("api key")
      ) {
        throw new Error("Supabase environment variables belum dikonfigurasi.");
      }
      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("too many requests")
      ) {
        throw new Error(
          "Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba kembali.",
        );
      }
      throw new Error(error.message || "Gagal mengirim ulang email verifikasi.");
    }

    return {
      success: true,
      message: "Link verifikasi berhasil dikirim. Silakan cek email Anda.",
    };
  });

// ============================================================================
// 5. CEK STATUS SESI OWNER SERVER-SIDE
// ============================================================================
export const getOwnerServerSession = createServerFn({
  method: "GET",
}).handler(async () => {
  const session = getOwnerSession();
  if (!session) {
    return null;
  }

  // Validasi user di database
  const [u] = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      nama_lengkap: users.nama_lengkap,
      role: users.role,
      status: users.status,
      id_barbershop: users.id_barbershop,
      email_verified: users.email_verified,
    })
    .from(users)
    .where(eq(users.id_user, session.userId))
    .limit(1);

  if (!u || u.role !== "owner" || u.status !== "active" || !u.email_verified) {
    clearOwnerSessionCookie();
    return null;
  }

  return {
    userId: u.id_user,
    email: u.email,
    role: u.role,
    namaLengkap: u.nama_lengkap,
    barbershopId: session.barbershopId,
    barbershopName: session.barbershopName,
  };
});

// ============================================================================
// 6. LOGOUT OWNER
// ============================================================================
export const logoutOwnerAction = createServerFn({
  method: "POST",
}).handler(async () => {
  clearOwnerSessionCookie();
  return { success: true };
});
