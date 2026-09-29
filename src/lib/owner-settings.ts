import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { barbershop, users } from "@/db/schema";
import { requireOwnerTenant, setOwnerSessionCookie } from "@/lib/auth-session";
import { invalidatePublicShopCache } from "@/lib/barbershop-operating";
import { invalidateTenantCache } from "@/lib/tenant-resolver";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { encryptPendingPassword, decryptPendingPassword } from "@/lib/auth-crypto";
import { getBaseUrl } from "@/lib/owner-auth";
import { supabase } from "@/lib/supabase-client";
import { logAudit } from "@/lib/audit";

export type OwnerSettingsData = {
  barbershop: {
    id_barbershop: string;
    nama_barbershop: string;
    slug?: string | undefined;
    alamat: string;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    no_hp: string;
    jam_buka: string;
    jam_tutup: string;
  };
  owner: {
    id_user: string;
    email: string;
    nama_lengkap: string;
    no_hp: string;
    role: string;
  };
};

export type UpdateOwnerSettingsInput = {
  id_barbershop?: string | undefined;
  nama_barbershop: string;
  alamat: string;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  no_hp_barbershop: string;
  jam_buka: string;
  jam_tutup: string;
  id_user?: string | undefined;
  nama_lengkap: string;
  email?: string | undefined;
  no_hp_owner: string;
  new_password?: string | undefined;
};

export const getOwnerSettings = createServerFn({
  method: "GET",
}).handler(async (): Promise<OwnerSettingsData> => {
  const tenant = requireOwnerTenant();

  // 1. Ambil Barbershop milik owner yang sedang login
  const [shop] = await db
    .select()
    .from(barbershop)
    .where(eq(barbershop.id_barbershop, tenant.barbershopId))
    .limit(1);

  if (!shop) {
    throw new Error("Data Barbershop milik Anda tidak ditemukan.");
  }

  // 2. Ambil Akun User Owner yang sedang login
  const [ownerUser] = await db
    .select({
      id_user: users.id_user,
      email: users.email,
      nama_lengkap: users.nama_lengkap,
      no_hp: users.no_hp,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id_user, tenant.userId))
    .limit(1);

  if (!ownerUser) {
    throw new Error("Data akun Owner tidak ditemukan.");
  }

  return {
    barbershop: {
      id_barbershop: shop.id_barbershop,
      nama_barbershop: shop.nama_barbershop,
      slug: shop.slug || undefined,
      alamat: shop.alamat || "",
      latitude: shop.latitude ? Number(shop.latitude) : null,
      longitude: shop.longitude ? Number(shop.longitude) : null,
      no_hp: shop.no_hp || "",
      jam_buka: shop.jam_buka || "08:00",
      jam_tutup: shop.jam_tutup || "21:00",
    },
    owner: {
      id_user: ownerUser.id_user,
      email: ownerUser.email,
      nama_lengkap: ownerUser.nama_lengkap,
      no_hp: ownerUser.no_hp || "",
      role: ownerUser.role,
    },
  };
});

/**
 * Memperbarui profil profil toko dan data non-kredensial owner (nama, no_hp).
 * Sesuai aturan keamanan: EMAIL dan PASSWORD TIDAK diubah langsung melalui fungsi ini.
 */
export const updateOwnerSettings = createServerFn({
  method: "POST",
})
  .validator((input: UpdateOwnerSettingsInput) => input)
  .handler(
    async ({ data }): Promise<{ success: boolean; message: string; data: OwnerSettingsData }> => {
      const tenant = requireOwnerTenant();
      const barbershopId = tenant.barbershopId;
      const userId = tenant.userId;

      const namaBarbershop = (data.nama_barbershop || "").trim();
      if (!namaBarbershop || namaBarbershop.length < 2) {
        throw new Error("Nama Barbershop minimal 2 karakter.");
      }

      const namaLengkap = (data.nama_lengkap || "").trim();
      if (!namaLengkap || namaLengkap.length < 2) {
        throw new Error("Nama Lengkap Pemilik minimal 2 karakter.");
      }

      const alamat = (data.alamat || "").trim();
      const noHpBarbershop = (data.no_hp_barbershop || "").trim();
      const noHpOwner = (data.no_hp_owner || "").trim();
      const jamBuka = (data.jam_buka || "08:00").trim();
      const jamTutup = (data.jam_tutup || "21:00").trim();

      const rawLat =
        data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null;
      const rawLng =
        data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null;

      if (rawLat !== null && (isNaN(rawLat) || rawLat < -90 || rawLat > 90)) {
        throw new Error("Latitude tidak valid. Rentang yang diperbolehkan adalah -90 hingga 90.");
      }
      if (rawLng !== null && (isNaN(rawLng) || rawLng < -180 || rawLng > 180)) {
        throw new Error(
          "Longitude tidak valid. Rentang yang diperbolehkan adalah -180 hingga 180.",
        );
      }

      // 1. Update Barbershop strictly for this tenant
      const shopUpdatePayload: any = {
        nama_barbershop: namaBarbershop,
        alamat,
        no_hp: noHpBarbershop,
        jam_buka: jamBuka,
        jam_tutup: jamTutup,
        updated_at: new Date(),
      };

      if (rawLat !== null && rawLng !== null) {
        shopUpdatePayload.latitude = rawLat.toFixed(7);
        shopUpdatePayload.longitude = rawLng.toFixed(7);
      }

      const [updatedShop] = await db
        .update(barbershop)
        .set(shopUpdatePayload)
        .where(eq(barbershop.id_barbershop, barbershopId))
        .returning();

      if (!updatedShop) {
        throw new Error("Gagal memperbarui profil toko Anda.");
      }

      // Invalidate caches so customer immediately sees updated location and profile
      invalidatePublicShopCache();
      invalidateTenantCache();

      // 2. Update Akun User Owner (HANYA Nama Lengkap & No HP - Email & Password TIDAK boleh langsung di-update)
      const userPayload: any = {
        nama_lengkap: namaLengkap,
        no_hp: noHpOwner,
        updated_at: new Date(),
      };

      const [updatedUser] = await db
        .update(users)
        .set(userPayload)
        .where(eq(users.id_user, userId))
        .returning({
          id_user: users.id_user,
          email: users.email,
          nama_lengkap: users.nama_lengkap,
          no_hp: users.no_hp,
          role: users.role,
        });

      if (!updatedUser) {
        throw new Error("Gagal memperbarui profil akun Anda.");
      }

      return {
        success: true,
        message: "Setelan operasional dan profil owner berhasil diperbarui!",
        data: {
          barbershop: {
            id_barbershop: updatedShop.id_barbershop,
            nama_barbershop: updatedShop.nama_barbershop,
            slug: updatedShop.slug || undefined,
            alamat: updatedShop.alamat || "",
            latitude: updatedShop.latitude ? Number(updatedShop.latitude) : null,
            longitude: updatedShop.longitude ? Number(updatedShop.longitude) : null,
            no_hp: updatedShop.no_hp || "",
            jam_buka: updatedShop.jam_buka || "08:00",
            jam_tutup: updatedShop.jam_tutup || "21:00",
          },
          owner: {
            id_user: updatedUser.id_user,
            email: updatedUser.email,
            nama_lengkap: updatedUser.nama_lengkap,
            no_hp: updatedUser.no_hp || "",
            role: updatedUser.role,
          },
        },
      };
    },
  );

// ============================================================================
// 3. VALIDASI EMAIL BARU OWNER SEBELUM SUPABASE UPDATEUSER
// ============================================================================
export type ValidateNewEmailInput = {
  newEmail: string;
};

export const validateNewOwnerEmail = createServerFn({
  method: "POST",
})
  .validator((input: ValidateNewEmailInput) => input)
  .handler(
    async ({ data }): Promise<{ valid: boolean; currentEmail: string; newEmail: string }> => {
      const tenant = requireOwnerTenant();
      const rawNewEmail = (data.newEmail || "").trim().toLowerCase();

      if (!rawNewEmail) {
        throw new Error("Email baru wajib diisi.");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawNewEmail)) {
        throw new Error("Format email tidak valid.");
      }

      // 1. Ambil user saat ini
      const [currentUser] = await db
        .select({ id_user: users.id_user, email: users.email })
        .from(users)
        .where(eq(users.id_user, tenant.userId))
        .limit(1);

      if (!currentUser) {
        throw new Error("Akun Owner tidak ditemukan.");
      }

      if (currentUser.email.toLowerCase() === rawNewEmail) {
        throw new Error("Email baru tidak boleh sama dengan email saat ini.");
      }

      // 2. Cek apakah email baru sudah digunakan akun lain di database
      const [existing] = await db
        .select({ id_user: users.id_user })
        .from(users)
        .where(eq(users.email, rawNewEmail))
        .limit(1);

      if (existing) {
        throw new Error("Email tersebut sudah digunakan oleh akun lain.");
      }

      // 3. Log audit non-sensitif
      await logAudit({
        barbershopId: tenant.barbershopId,
        userId: tenant.userId,
        aksi: "request_change_email",
        entityType: "keamanan_akun",
        alasan: "Owner meminta perubahan email",
      });

      return {
        valid: true,
        currentEmail: currentUser.email,
        newEmail: rawNewEmail,
      };
    },
  );

// ============================================================================
// 4. SINKRONISASI EMAIL OWNER SETELAH VERIFIKASI SUPABASE BERHASIL
// ============================================================================
export type SyncOwnerEmailChangeInput = {
  userId: string;
  email: string;
};

export const syncOwnerEmailChange = createServerFn({
  method: "POST",
})
  .validator((input: SyncOwnerEmailChangeInput) => input)
  .handler(async ({ data }): Promise<{ success: boolean; message: string; email: string }> => {
    const tenant = requireOwnerTenant();
    const userId = (data.userId || "").trim();
    const newEmail = (data.email || "").trim().toLowerCase();

    if (!userId || !newEmail) {
      throw new Error("Data verifikasi email tidak lengkap.");
    }

    // Keamanan: Validasi kepemilikan akun strictly berdasarkan authenticated session
    if (userId !== tenant.userId) {
      throw new Error("Akses ditolak: User ID tidak cocok dengan sesi login aktif.");
    }

    // Update email di tabel public.users
    const [updatedUser] = await db
      .update(users)
      .set({
        email: newEmail,
        updated_at: new Date(),
      })
      .where(eq(users.id_user, tenant.userId))
      .returning({
        id_user: users.id_user,
        email: users.email,
        nama_lengkap: users.nama_lengkap,
      });

    if (!updatedUser) {
      throw new Error("Gagal memperbarui email akun di database.");
    }

    // Refresh server session cookie dengan email baru
    setOwnerSessionCookie({
      userId: tenant.userId,
      email: newEmail,
      role: "owner",
      barbershopId: tenant.barbershopId,
      barbershopName: tenant.barbershopName,
      namaLengkap: tenant.namaLengkap,
    });

    // Catat aktivitas keamanan di audit log (non-sensitif)
    await logAudit({
      barbershopId: tenant.barbershopId,
      userId: tenant.userId,
      aksi: "verify_change_email",
      entityType: "keamanan_akun",
      alasan: "Email berhasil diverifikasi",
    });

    return {
      success: true,
      message: "Email berhasil diperbarui.",
      email: updatedUser.email,
    };
  });

// ============================================================================
// 5. REQUEST PERUBAHAN PASSWORD OWNER (DENGAN VERIFIKASI KE EMAIL TERDAFTAR)
// ============================================================================
export type RequestOwnerPasswordChangeInput = {
  newPassword: string;
  clientOrigin?: string;
};

export const requestOwnerPasswordChange = createServerFn({
  method: "POST",
})
  .validator((input: RequestOwnerPasswordChangeInput) => input)
  .handler(async ({ data }): Promise<{ success: boolean; message: string; email: string }> => {
    const tenant = requireOwnerTenant();
    const newPassword = (data.newPassword || "").trim();

    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password baru minimal 6 karakter.");
    }

    // 1. Ambil data akun Owner saat ini dari database
    const [ownerUser] = await db
      .select({
        id_user: users.id_user,
        email: users.email,
        id_barbershop: users.id_barbershop,
      })
      .from(users)
      .where(eq(users.id_user, tenant.userId))
      .limit(1);

    if (!ownerUser) {
      throw new Error("Data akun Owner tidak ditemukan.");
    }

    // 2. Ambil slug barbershop untuk redirect URL
    const [shop] = await db
      .select({ slug: barbershop.slug })
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, tenant.barbershopId))
      .limit(1);

    const slug = shop?.slug || "barberin";
    const baseUrl = getBaseUrl(data.clientOrigin);
    const redirectTo = `${baseUrl}/${slug}/owner/verify-password-change`;

    // 3. Enkripsi password baru (AES-256-GCM) dan simpan dalam HTTP-only secure cookie
    // Tidak disimpan dalam database aplikasi dan tidak pernah berbentuk plaintext
    const encryptedPwd = encryptPendingPassword(newPassword);
    try {
      setCookie("barberin_pending_pwd_change", encryptedPwd, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 900, // 15 menit
      });
    } catch (e) {
      console.warn("Could not set pending password cookie:", e);
    }

    // 4. Panggil Supabase Auth resetPasswordForEmail ke EMAIL OWNER YANG SAAT INI TERDAFTAR
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(ownerUser.email, {
      redirectTo,
    });

    if (resetError) {
      console.error(
        "[SUPABASE PASSWORD CHANGE REQUEST ERROR]",
        resetError.status,
        resetError.message,
      );
      if (
        resetError.status === 429 ||
        resetError.message.toLowerCase().includes("rate limit") ||
        resetError.message.toLowerCase().includes("too many requests")
      ) {
        throw new Error(
          "Terlalu banyak permintaan verifikasi. Silakan tunggu beberapa saat sebelum mencoba kembali.",
        );
      }
      throw new Error("Gagal mengirim link verifikasi password. Silakan coba lagi.");
    }

    // 5. Log audit non-sensitif (tanpa password/token)
    await logAudit({
      barbershopId: tenant.barbershopId,
      userId: tenant.userId,
      aksi: "request_change_password",
      entityType: "keamanan_akun",
      alasan: "Owner meminta perubahan password",
    });

    return {
      success: true,
      message: `Link verifikasi telah dikirim ke email terdaftar Anda (${ownerUser.email}). Password baru belum aktif sampai verifikasi selesai.`,
      email: ownerUser.email,
    };
  });

// ============================================================================
// 6. AMBIL PASSWORD PENDING DARI ENCRYPTED COOKIE SAAT CALLBACK
// ============================================================================
export const getPendingPasswordState = createServerFn({
  method: "POST",
})
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ hasPending: boolean; pendingPassword: string | null }> => {
    try {
      const raw = getCookie("barberin_pending_pwd_change");
      if (!raw) {
        return { hasPending: false, pendingPassword: null };
      }
      const decrypted = decryptPendingPassword(raw);
      return {
        hasPending: Boolean(decrypted),
        pendingPassword: decrypted,
      };
    } catch {
      return { hasPending: false, pendingPassword: null };
    }
  });

// ============================================================================
// 7. FINALIZE PASSWORD CHANGE (CLEANUP & AUDIT LOG)
// ============================================================================
export type FinalizePasswordChangeInput = {
  userId: string;
};

export const finalizePasswordChange = createServerFn({
  method: "POST",
})
  .validator((input: FinalizePasswordChangeInput) => input)
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    const userId = (data.userId || "").trim();
    if (!userId) {
      throw new Error("User ID tidak valid.");
    }

    // Clear pending cookie
    try {
      deleteCookie("barberin_pending_pwd_change", { path: "/" });
    } catch (err) {
      console.warn("Could not delete pending password cookie:", err);
    }

    // Update updated_at di public.users & catat audit
    const [u] = await db
      .select({ id_user: users.id_user, id_barbershop: users.id_barbershop })
      .from(users)
      .where(eq(users.id_user, userId))
      .limit(1);

    if (u) {
      await db.update(users).set({ updated_at: new Date() }).where(eq(users.id_user, userId));

      if (u.id_barbershop) {
        await logAudit({
          barbershopId: u.id_barbershop,
          userId: u.id_user,
          aksi: "verify_change_password",
          entityType: "keamanan_akun",
          alasan: "Password berhasil diperbarui",
        });
      }
    }

    return {
      success: true,
      message: "Password berhasil diperbarui.",
    };
  });
