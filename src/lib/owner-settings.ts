import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { barbershop, users } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/auth-session";

export type OwnerSettingsData = {
  barbershop: {
    id_barbershop: string;
    nama_barbershop: string;
    slug?: string | undefined;
    alamat: string;
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
  no_hp_barbershop: string;
  jam_buka: string;
  jam_tutup: string;
  id_user?: string | undefined;
  nama_lengkap: string;
  email: string;
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

export const updateOwnerSettings = createServerFn({
  method: "POST",
})
  .validator((input: UpdateOwnerSettingsInput) => input)
  .handler(async ({ data }): Promise<{ success: boolean; message: string; data: OwnerSettingsData }> => {
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

    const email = (data.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Format email tidak valid.");
    }

    const alamat = (data.alamat || "").trim();
    const noHpBarbershop = (data.no_hp_barbershop || "").trim();
    const noHpOwner = (data.no_hp_owner || "").trim();
    const jamBuka = (data.jam_buka || "08:00").trim();
    const jamTutup = (data.jam_tutup || "21:00").trim();
    const newPassword = (data.new_password || "").trim();

    if (newPassword && newPassword.length < 4) {
      throw new Error("Password baru minimal 4 karakter.");
    }

    // 1. Update Barbershop strictly for this tenant
    const [updatedShop] = await db
      .update(barbershop)
      .set({
        nama_barbershop: namaBarbershop,
        alamat,
        no_hp: noHpBarbershop,
        jam_buka: jamBuka,
        jam_tutup: jamTutup,
        updated_at: new Date(),
      })
      .where(eq(barbershop.id_barbershop, barbershopId))
      .returning();

    if (!updatedShop) {
      throw new Error("Gagal memperbarui profil toko Anda.");
    }

    // 2. Update Akun User Owner strictly for this tenant
    const userPayload: any = {
      nama_lengkap: namaLengkap,
      email,
      no_hp: noHpOwner,
      updated_at: new Date(),
    };

    if (newPassword) {
      userPayload.password = newPassword;
    }

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
  });

