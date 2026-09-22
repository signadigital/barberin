import { createServerFn } from "@tanstack/react-start";
import { eq, desc, asc, count, and } from "drizzle-orm";
import { db } from "@/db";
import { layanan, barbershop, detailBooking, booking } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/auth-session";
import { resolveBarbershopBySlug } from "./tenant-resolver";

export type OwnerServiceItem = {
  id: string;
  id_layanan: string;
  name: string;
  nama_layanan: string;
  description: string | null;
  deskripsi: string | null;
  durasi_menit: number;
  price: number;
  harga: number;
  status: "active" | "inactive";
  usageCount: number;
  createdAt: string;
};

export type CreateServiceInput = {
  nama_layanan: string;
  deskripsi?: string | null | undefined;
  durasi_menit: number;
  harga: number;
  status?: "active" | "inactive" | undefined;
};

export type UpdateServiceInput = {
  id_layanan: string;
  nama_layanan: string;
  deskripsi?: string | null | undefined;
  durasi_menit: number;
  harga: number;
  status?: "active" | "inactive" | undefined;
};

export type DeleteServiceInput = {
  id_layanan: string;
};

export type ToggleServiceStatusInput = {
  id_layanan: string;
};

// 1. READ: For Customer & Capster (active only, strictly scoped to target barbershop)
export const getServices = createServerFn({
  method: "GET",
})
  .validator(
    (data: { barbershopId?: string | undefined; slug?: string | undefined } | undefined) =>
      data,
  )
  .handler(async ({ data }) => {
    let targetShopId = data?.barbershopId;

    if (targetShopId) {
      const [shop] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(
          and(
            eq(barbershop.id_barbershop, targetShopId),
            eq(barbershop.status, "active"),
          ),
        )
        .limit(1);
      if (!shop) return [];
      targetShopId = shop.id_barbershop;
    } else if (data?.slug) {
      const shop = await resolveBarbershopBySlug({ data: data.slug });
      if (!shop || shop.status !== "active") return [];
      targetShopId = shop.id_barbershop;
    } else {
      // Tidak ada tenant context yang diberikan: jangan tampilkan data barbershop lain
      return [];
    }

    const result = await db
      .select({
        id: layanan.id_layanan,
        id_layanan: layanan.id_layanan,
        id_barbershop: layanan.id_barbershop,
        name: layanan.nama_layanan,
        nama_layanan: layanan.nama_layanan,
        description: layanan.deskripsi,
        deskripsi: layanan.deskripsi,
        durasi_menit: layanan.durasi_menit,
        price: layanan.harga,
        harga: layanan.harga,
        status: layanan.status,
      })
      .from(layanan)
      .where(
        and(
          eq(layanan.status, "active"),
          eq(layanan.id_barbershop, targetShopId),
        ),
      )
      .orderBy(asc(layanan.nama_layanan));

    return result.map((s) => ({
      ...s,
      price: Number(s.price),
    }));
  });

// 2. READ: For Owner Management (all services with usage count, strictly scoped to current owner's barbershop)
export const getOwnerServices = createServerFn({
  method: "GET",
}).handler(async (): Promise<OwnerServiceItem[]> => {
  const tenant = requireOwnerTenant();
  const barbershopId = tenant.barbershopId;

  const allServices = await db
    .select({
      id_layanan: layanan.id_layanan,
      nama_layanan: layanan.nama_layanan,
      deskripsi: layanan.deskripsi,
      durasi_menit: layanan.durasi_menit,
      harga: layanan.harga,
      status: layanan.status,
      created_at: layanan.created_at,
    })
    .from(layanan)
    .where(eq(layanan.id_barbershop, barbershopId))
    .orderBy(asc(layanan.created_at));

  // Get usage count per service strictly for this barbershop's bookings
  const usageCounts = await db
    .select({
      id_layanan: detailBooking.id_layanan,
      count: count(),
    })
    .from(detailBooking)
    .innerJoin(booking, eq(detailBooking.id_booking, booking.id_booking))
    .where(eq(booking.id_barbershop, barbershopId))
    .groupBy(detailBooking.id_layanan);

  const usageMap = new Map<string, number>();
  for (const u of usageCounts) {
    if (u.id_layanan) {
      usageMap.set(u.id_layanan, Number(u.count));
    }
  }

  return allServices.map((s) => ({
    id: s.id_layanan,
    id_layanan: s.id_layanan,
    name: s.nama_layanan,
    nama_layanan: s.nama_layanan,
    description: s.deskripsi,
    deskripsi: s.deskripsi,
    durasi_menit: s.durasi_menit ?? 30,
    price: Number(s.harga),
    harga: Number(s.harga),
    status: s.status as "active" | "inactive",
    usageCount: usageMap.get(s.id_layanan) ?? 0,
    createdAt: s.created_at ? s.created_at.toISOString() : new Date().toISOString(),
  }));
});

// 3. CREATE: Add new service (scoped strictly to current owner's barbershop)
export const createOwnerService = createServerFn({
  method: "POST",
})
  .validator((data: CreateServiceInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    const nama = data.nama_layanan?.trim();
    if (!nama) {
      throw new Error("Nama layanan wajib diisi.");
    }
    const harga = Number(data.harga);
    if (isNaN(harga) || harga < 0) {
      throw new Error("Tarif layanan tidak valid.");
    }
    const durasi = Number(data.durasi_menit);
    if (isNaN(durasi) || !Number.isInteger(durasi) || durasi <= 0) {
      throw new Error("Waktu pelayanan wajib diisi dengan bilangan bulat positif lebih dari 0 menit.");
    }

    const [created] = await db
      .insert(layanan)
      .values({
        id_barbershop: barbershopId,
        nama_layanan: nama,
        deskripsi: data.deskripsi?.trim() || null,
        durasi_menit: durasi,
        harga: String(harga),
        status: data.status || "active",
      })
      .returning();

    if (!created) {
      throw new Error("Gagal menyimpan layanan baru ke database.");
    }

    return {
      success: true,
      service: {
        id: created.id_layanan,
        id_layanan: created.id_layanan,
        nama_layanan: created.nama_layanan,
        deskripsi: created.deskripsi,
        durasi_menit: created.durasi_menit,
        harga: Number(created.harga),
        status: created.status,
      },
    };
  });

// 4. UPDATE: Modify service details (isolated by id_barbershop)
export const updateOwnerService = createServerFn({
  method: "POST",
})
  .validator((data: UpdateServiceInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_layanan) {
      throw new Error("ID layanan tidak valid.");
    }
    const nama = data.nama_layanan?.trim();
    if (!nama) {
      throw new Error("Nama layanan wajib diisi.");
    }
    const harga = Number(data.harga);
    if (isNaN(harga) || harga < 0) {
      throw new Error("Tarif layanan tidak valid.");
    }
    const durasi = Number(data.durasi_menit);
    if (isNaN(durasi) || !Number.isInteger(durasi) || durasi <= 0) {
      throw new Error("Waktu pelayanan wajib diisi dengan bilangan bulat positif lebih dari 0 menit.");
    }

    const [updated] = await db
      .update(layanan)
      .set({
        nama_layanan: nama,
        deskripsi: data.deskripsi !== undefined ? (data.deskripsi?.trim() || null) : undefined,
        durasi_menit: durasi,
        harga: String(harga),
        status: data.status,
        updated_at: new Date(),
      })
      .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)))
      .returning();

    if (!updated) {
      throw new Error("Layanan tidak ditemukan atau Anda tidak memiliki akses untuk mengubahnya.");
    }

    return {
      success: true,
      service: {
        id: updated.id_layanan,
        id_layanan: updated.id_layanan,
        nama_layanan: updated.nama_layanan,
        deskripsi: updated.deskripsi,
        durasi_menit: updated.durasi_menit,
        harga: Number(updated.harga),
        status: updated.status,
      },
    };
  });

// 5. TOGGLE: Fast switch status active <-> inactive (isolated by id_barbershop)
export const toggleOwnerServiceStatus = createServerFn({
  method: "POST",
})
  .validator((data: ToggleServiceStatusInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_layanan) {
      throw new Error("ID layanan tidak valid.");
    }

    const [current] = await db
      .select({ status: layanan.status })
      .from(layanan)
      .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)))
      .limit(1);

    if (!current) {
      throw new Error("Layanan tidak ditemukan atau Anda tidak memiliki akses.");
    }

    const newStatus = current.status === "active" ? "inactive" : "active";

    await db
      .update(layanan)
      .set({
        status: newStatus,
        updated_at: new Date(),
      })
      .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)));

    return {
      success: true,
      newStatus,
      message:
        newStatus === "active"
          ? "Layanan berhasil diaktifkan kembali."
          : "Layanan berhasil dinonaktifkan dari katalog.",
    };
  });

// 6. DELETE: Delete or soft-deactivate if referenced (isolated by id_barbershop)
export const deleteOwnerService = createServerFn({
  method: "POST",
})
  .validator((data: DeleteServiceInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_layanan) {
      throw new Error("ID layanan tidak valid.");
    }

    // Verify service belongs to this tenant
    const [existing] = await db
      .select({ id: layanan.id_layanan })
      .from(layanan)
      .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)))
      .limit(1);

    if (!existing) {
      throw new Error("Layanan tidak ditemukan atau Anda tidak memiliki akses.");
    }

    // Check if this service has been used in detail_booking
    const [usage] = await db
      .select({ count: count() })
      .from(detailBooking)
      .where(eq(detailBooking.id_layanan, data.id_layanan));

    const usageCount = Number(usage?.count || 0);

    if (usageCount > 0) {
      // Cannot hard-delete due to FK restrict constraint; soft-delete instead
      await db
        .update(layanan)
        .set({
          status: "inactive",
          updated_at: new Date(),
        })
        .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)));

      return {
        success: true,
        softDeleted: true,
        message: `Layanan memiliki ${usageCount} riwayat transaksi sehingga dinonaktifkan dari katalog pemesanan agar data historis tetap aman.`,
      };
    }

    // Unreferenced: perform hard delete
    const [deleted] = await db
      .delete(layanan)
      .where(and(eq(layanan.id_layanan, data.id_layanan), eq(layanan.id_barbershop, barbershopId)))
      .returning();

    if (!deleted) {
      throw new Error("Layanan tidak ditemukan atau gagal dihapus.");
    }

    return {
      success: true,
      softDeleted: false,
      message: "Layanan berhasil dihapus secara permanen dari katalog.",
    };
  });