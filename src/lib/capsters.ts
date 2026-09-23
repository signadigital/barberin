import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne, count } from "drizzle-orm";
import { db } from "@/db";
import { capster, shiftCapster, users, barbershop, booking, transaksi } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/auth-session";
import { resolveBarbershopBySlug } from "./tenant-resolver";

export type CapsterView = {
  id: string;
  id_capster: string;
  id_user: string;
  id_barbershop: string;
  name: string;
  role: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  phone?: string | null;
  no_pegawai?: string | null;
};

export const getCapsters = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            barbershopId?: string | undefined;
            slug?: string | undefined;
            onlyCheckedIn?: boolean | undefined;
          }
        | undefined,
    ) => data,
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
      // Tidak ada tenant context yang diberikan: jangan tampilkan data capster barbershop lain
      return [];
    }

    const capsterRows = await db
      .select({
        id_capster: capster.id_capster,
        id_user: capster.id_user,
        id_barbershop: capster.id_barbershop,
        nama_lengkap: users.nama_lengkap,
        no_hp: users.no_hp,
        status: capster.status,
        no_pegawai: capster.no_pegawai,
      })
      .from(capster)
      .innerJoin(users, eq(capster.id_user, users.id_user))
      .where(
        and(
          eq(users.role, "capster"),
          eq(capster.status, "active"),
          targetShopId ? eq(capster.id_barbershop, targetShopId) : undefined,
        ),
      );

    const shiftRows = await db
      .select()
      .from(shiftCapster)
      .where(eq(shiftCapster.status, "ongoing"));

    return capsterRows.map((c) => {
      const activeShift = shiftRows.find((s) => s.id_capster === c.id_capster);
      const isAvailable = !!activeShift;

      return {
        id: c.id_capster,
        id_capster: c.id_capster,
        id_user: c.id_user,
        id_barbershop: c.id_barbershop,
        name: c.nama_lengkap,
        nama_lengkap: c.nama_lengkap,
        role: c.no_pegawai === "CAP-001" ? "Senior Barber" : "Barber",
        status: (isAvailable ? "AVAILABLE" : "BUSY") as "AVAILABLE" | "BUSY" | "OFFLINE",
        no_pegawai: c.no_pegawai,
        phone: c.no_hp,
      };
    });
  });

export const loginCapster = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      emailOrName: string;
      password?: string;
      barbershopSlug?: string;
      barbershopId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const term = (data.emailOrName || "").trim().toLowerCase();
    const inputPassword = data.password || "";

    if (!term) {
      throw new Error("Email atau username wajib diisi.");
    }
    if (!inputPassword) {
      throw new Error("Password wajib diisi.");
    }

    let targetShop: { id_barbershop: string; slug: string; status: string } | null = null;
    if (data.barbershopSlug) {
      const [shop] = await db
        .select({
          id_barbershop: barbershop.id_barbershop,
          slug: barbershop.slug,
          status: barbershop.status,
        })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);

      if (!shop) {
        throw new Error("Barbershop tidak ditemukan.");
      }
      targetShop = shop;
    } else if (data.barbershopId) {
      const [shop] = await db
        .select({
          id_barbershop: barbershop.id_barbershop,
          slug: barbershop.slug,
          status: barbershop.status,
        })
        .from(barbershop)
        .where(eq(barbershop.id_barbershop, data.barbershopId))
        .limit(1);

      if (!shop) {
        throw new Error("Barbershop tidak ditemukan.");
      }
      targetShop = shop;
    }

    if (targetShop && (targetShop.status === "suspended" || targetShop.status === "inactive")) {
      throw new Error("Akun toko Anda sedang dinonaktifkan, hubungi admin.");
    }

    // Query active capsters
    const all = await db
      .select({
        id_capster: capster.id_capster,
        id_user: capster.id_user,
        id_barbershop: capster.id_barbershop,
        nama_lengkap: users.nama_lengkap,
        email: users.email,
        password: users.password,
        no_pegawai: capster.no_pegawai,
      })
      .from(capster)
      .innerJoin(users, eq(capster.id_user, users.id_user))
      .where(and(eq(users.role, "capster"), eq(capster.status, "active")));

    if (!targetShop) {
      throw new Error("Barbershop tidak ditemukan.");
    }

    const activeShopId = targetShop.id_barbershop;
    // Cari capster yang terdaftar di barbershop ini saja (Strict Tenant Isolation)
    const matched = all.find(
      (c) =>
        c.id_barbershop === activeShopId &&
        (c.email.toLowerCase() === term ||
          c.nama_lengkap.toLowerCase() === term ||
          (c.no_pegawai && c.no_pegawai.toLowerCase() === term)),
    );

    if (!matched) {
      throw new Error("Akun capster tidak terdaftar di barbershop ini.");
    }

    const expectedPassword = matched.password || "password";
    if (inputPassword !== expectedPassword) {
      throw new Error("Password yang Anda masukkan salah.");
    }

    // Cek apakah toko capster sedang dinonaktifkan (suspended) jika belum dicek
    if (matched.id_barbershop && !targetShop) {
      const [shop] = await db
        .select({ status: barbershop.status, slug: barbershop.slug })
        .from(barbershop)
        .where(eq(barbershop.id_barbershop, matched.id_barbershop))
        .limit(1);

      if (shop && (shop.status === "suspended" || shop.status === "inactive")) {
        throw new Error("Akun toko Anda sedang dinonaktifkan, hubungi admin.");
      }
      if (shop) {
        targetShop = { id_barbershop: matched.id_barbershop, slug: shop.slug, status: shop.status };
      }
    }

    return {
      id_capster: matched.id_capster,
      id_user: matched.id_user,
      id_barbershop: matched.id_barbershop,
      barbershopSlug: targetShop?.slug ?? "",
      nama_lengkap: matched.nama_lengkap,
      role: matched.no_pegawai === "CAP-001" ? "Senior Barber" : "Barber",
    };
  });

// ============================================================================
// OWNER CAPSTER CRUD SERVER FUNCTIONS
// ============================================================================

export type OwnerCapsterItem = {
  id: string;
  id_capster: string;
  id_user: string;
  id_barbershop: string;
  name: string;
  email: string;
  phone: string | null;
  no_pegawai: string | null;
  role: string;
  status: "active" | "inactive";
  isShiftActive: boolean;
  shiftStatus: "AVAILABLE" | "OFFLINE";
  shiftTime: string | null;
  totalTransactions: number;
  totalRevenue: number;
  joinedDate: string | null;
};

export type CreateCapsterInput = {
  nama_lengkap: string;
  email: string;
  no_hp?: string | null | undefined;
  no_pegawai?: string | null | undefined;
  password?: string | null | undefined;
  status?: "active" | "inactive" | undefined;
};

export type UpdateCapsterInput = {
  id_capster: string;
  nama_lengkap: string;
  email: string;
  no_hp?: string | null | undefined;
  no_pegawai?: string | null | undefined;
  password?: string | null | undefined;
  status?: "active" | "inactive" | undefined;
};

export type ToggleCapsterStatusInput = {
  id_capster: string;
};

export type DeleteCapsterInput = {
  id_capster: string;
};

// 1. READ: Get all capsters for Owner Management (strictly scoped to current owner's barbershop)
export const getOwnerCapsters = createServerFn({
  method: "GET",
}).handler(async (): Promise<OwnerCapsterItem[]> => {
  const tenant = requireOwnerTenant();
  const barbershopId = tenant.barbershopId;

  const capsterRows = await db
    .select({
      id_capster: capster.id_capster,
      id_user: capster.id_user,
      id_barbershop: capster.id_barbershop,
      nama_lengkap: users.nama_lengkap,
      email: users.email,
      no_hp: users.no_hp,
      no_pegawai: capster.no_pegawai,
      status: capster.status,
      tanggal_bergabung: capster.tanggal_bergabung,
    })
    .from(capster)
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(eq(capster.id_barbershop, barbershopId))
    .orderBy(capster.no_pegawai);

  const results: OwnerCapsterItem[] = [];

  for (const c of capsterRows) {
    // Check ongoing shift
    const shifts = await db
      .select({
        id_shift: shiftCapster.id_shift,
        status: shiftCapster.status,
        waktu_mulai: shiftCapster.waktu_mulai,
      })
      .from(shiftCapster)
      .where(
        and(
          eq(shiftCapster.id_capster, c.id_capster),
          eq(shiftCapster.status, "ongoing"),
        ),
      )
      .limit(1);

    const isShiftActive = shifts.length > 0;
    const shiftTime = isShiftActive && shifts[0] ? shifts[0].waktu_mulai : null;

    // Calculate transaction stats for this capster (strictly isolated to this barbershop)
    const capsterTxs = await db
      .select({
        total: transaksi.total,
      })
      .from(transaksi)
      .innerJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(
        and(
          eq(shiftCapster.id_capster, c.id_capster),
          eq(transaksi.status_transaksi, "paid"),
          eq(transaksi.id_barbershop, barbershopId),
        ),
      );

    const totalTransactions = capsterTxs.length;
    const totalRevenue = capsterTxs.reduce((acc, t) => acc + Number(t.total || 0), 0);

    const joinedFormatted = c.tanggal_bergabung
      ? new Date(c.tanggal_bergabung).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

    results.push({
      id: c.id_capster,
      id_capster: c.id_capster,
      id_user: c.id_user,
      id_barbershop: c.id_barbershop,
      name: c.nama_lengkap,
      email: c.email,
      phone: c.no_hp,
      no_pegawai: c.no_pegawai,
      role: c.no_pegawai === "CAP-001" ? "Senior Barber" : "Barber",
      status: c.status as "active" | "inactive",
      isShiftActive,
      shiftStatus: isShiftActive ? "AVAILABLE" : "OFFLINE",
      shiftTime,
      totalTransactions,
      totalRevenue,
      joinedDate: joinedFormatted,
    });
  }

  return results;
});

// 2. CREATE: Add new Capster account
export const createOwnerCapster = createServerFn({
  method: "POST",
})
  .validator((data: CreateCapsterInput) => data)
  .handler(async ({ data }) => {
    const nama = data.nama_lengkap?.trim();
    if (!nama) {
      throw new Error("Nama lengkap capster wajib diisi.");
    }

    const email = data.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Email akun wajib diisi.");
    }

    // Check if email already exists
    const [existingUser] = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new Error("Email sudah digunakan oleh akun lain. Silakan gunakan email berbeda.");
    }

    // Resolve no_pegawai (auto generate if empty e.g. CAP-001 within this barbershop)
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    let noPegawai = data.no_pegawai?.trim().toUpperCase();
    if (!noPegawai) {
      const shopCapsters = await db
        .select({ no_pegawai: capster.no_pegawai })
        .from(capster)
        .where(eq(capster.id_barbershop, barbershopId));
      const nextNum = shopCapsters.length + 1;
      noPegawai = `CAP-${String(nextNum).padStart(3, "0")}`;
    } else {
      // Check if no_pegawai is duplicate in this barbershop
      const [existingNo] = await db
        .select({ id_capster: capster.id_capster })
        .from(capster)
        .where(
          and(
            eq(capster.no_pegawai, noPegawai),
            eq(capster.id_barbershop, barbershopId),
          ),
        )
        .limit(1);
      if (existingNo) {
        throw new Error(`Nomor pegawai "${noPegawai}" sudah digunakan oleh capster lain di toko ini.`);
      }
    }

    const password = data.password?.trim() || "password123";
    const status = data.status || "active";

    // 1. Create User
    const [newUser] = await db
      .insert(users)
      .values({
        nama_lengkap: nama,
        email,
        password,
        no_hp: data.no_hp?.trim() || null,
        role: "capster",
        status,
        id_barbershop: barbershopId,
      })
      .returning();

    if (!newUser) {
      throw new Error("Gagal membuat data pengguna untuk capster.");
    }

    // 2. Create Capster linked to current tenant
    const [newCapster] = await db
      .insert(capster)
      .values({
        id_user: newUser.id_user,
        id_barbershop: barbershopId,
        no_pegawai: noPegawai,
        tanggal_bergabung: new Date(),
        status,
      })
      .returning();

    if (!newCapster) {
      throw new Error("Gagal membuat profil staf capster.");
    }

    return {
      success: true,
      capster: {
        id_capster: newCapster.id_capster,
        nama_lengkap: newUser.nama_lengkap,
        no_pegawai: newCapster.no_pegawai,
        email: newUser.email,
        status: newCapster.status,
      },
    };
  });

// 3. UPDATE: Edit Capster account
export const updateOwnerCapster = createServerFn({
  method: "POST",
})
  .validator((data: UpdateCapsterInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_capster) {
      throw new Error("ID capster tidak valid.");
    }
    const nama = data.nama_lengkap?.trim();
    if (!nama) {
      throw new Error("Nama lengkap capster wajib diisi.");
    }
    const email = data.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Email wajib diisi.");
    }

    // Find capster strictly within current owner's barbershop
    const [target] = await db
      .select({
        id_capster: capster.id_capster,
        id_user: capster.id_user,
        no_pegawai: capster.no_pegawai,
      })
      .from(capster)
      .where(
        and(
          eq(capster.id_capster, data.id_capster),
          eq(capster.id_barbershop, barbershopId),
        ),
      )
      .limit(1);

    if (!target) {
      throw new Error("Data capster tidak ditemukan atau Anda tidak memiliki akses.");
    }

    // Check if email taken by another user
    const [emailCollision] = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id_user, target.id_user)))
      .limit(1);

    if (emailCollision) {
      throw new Error("Email sudah digunakan oleh akun lain.");
    }

    // Check if no_pegawai taken by another capster
    const noPegawai = data.no_pegawai?.trim().toUpperCase() || target.no_pegawai;
    if (noPegawai) {
      const [noCollision] = await db
        .select({ id_capster: capster.id_capster })
        .from(capster)
        .where(
          and(
            eq(capster.no_pegawai, noPegawai),
            ne(capster.id_capster, target.id_capster),
          ),
        )
        .limit(1);

      if (noCollision) {
        throw new Error(`Nomor pegawai "${noPegawai}" sudah digunakan oleh capster lain.`);
      }
    }

    const status = data.status || "active";

    // Update users
    const userUpdateData: any = {
      nama_lengkap: nama,
      email,
      no_hp: data.no_hp !== undefined ? (data.no_hp?.trim() || null) : undefined,
      status,
      updated_at: new Date(),
    };

    if (data.password && data.password.trim()) {
      userUpdateData.password = data.password.trim();
    }

    await db
      .update(users)
      .set(userUpdateData)
      .where(eq(users.id_user, target.id_user));

    // Update capster
    await db
      .update(capster)
      .set({
        no_pegawai: noPegawai,
        status,
        updated_at: new Date(),
      })
      .where(eq(capster.id_capster, target.id_capster));

    // If deactivated, close ongoing shifts
    if (status === "inactive") {
      await db
        .update(shiftCapster)
        .set({ status: "completed", waktu_selesai: "Nonaktif oleh Owner" })
        .where(
          and(
            eq(shiftCapster.id_capster, target.id_capster),
            eq(shiftCapster.status, "ongoing"),
          ),
        );
    }

    return {
      success: true,
      message: "Data capster berhasil diperbarui.",
    };
  });

// 4. TOGGLE: Fast switch status active <-> inactive
export const toggleOwnerCapsterStatus = createServerFn({
  method: "POST",
})
  .validator((data: ToggleCapsterStatusInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_capster) {
      throw new Error("ID capster tidak valid.");
    }

    const [target] = await db
      .select({
        id_capster: capster.id_capster,
        id_user: capster.id_user,
        status: capster.status,
      })
      .from(capster)
      .where(
        and(
          eq(capster.id_capster, data.id_capster),
          eq(capster.id_barbershop, barbershopId),
        ),
      )
      .limit(1);

    if (!target) {
      throw new Error("Data capster tidak ditemukan atau Anda tidak memiliki akses.");
    }

    const newStatus = target.status === "active" ? "inactive" : "active";

    await db
      .update(capster)
      .set({ status: newStatus, updated_at: new Date() })
      .where(eq(capster.id_capster, target.id_capster));

    await db
      .update(users)
      .set({ status: newStatus, updated_at: new Date() })
      .where(eq(users.id_user, target.id_user));

    if (newStatus === "inactive") {
      await db
        .update(shiftCapster)
        .set({ status: "completed", waktu_selesai: "Dinonaktifkan oleh Owner" })
        .where(
          and(
            eq(shiftCapster.id_capster, target.id_capster),
            eq(shiftCapster.status, "ongoing"),
          ),
        );
    }

    return {
      success: true,
      newStatus,
      message:
        newStatus === "active"
          ? "Akun capster berhasil diaktifkan kembali."
          : "Akun capster berhasil dinonaktifkan.",
    };
  });

// 5. DELETE: Safe delete capster (or deactivate if historical data exists)
export const deleteOwnerCapster = createServerFn({
  method: "POST",
})
  .validator((data: DeleteCapsterInput) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;

    if (!data.id_capster) {
      throw new Error("ID capster tidak valid.");
    }

    const [target] = await db
      .select({
        id_capster: capster.id_capster,
        id_user: capster.id_user,
        nama_lengkap: users.nama_lengkap,
      })
      .from(capster)
      .innerJoin(users, eq(capster.id_user, users.id_user))
      .where(
        and(
          eq(capster.id_capster, data.id_capster),
          eq(capster.id_barbershop, barbershopId),
        ),
      )
      .limit(1);

    if (!target) {
      throw new Error("Data capster tidak ditemukan atau Anda tidak memiliki akses.");
    }

    // Check if capster has shifts or bookings
    const [shiftsCount] = await db
      .select({ count: count() })
      .from(shiftCapster)
      .where(eq(shiftCapster.id_capster, target.id_capster));

    const [bookingsCount] = await db
      .select({ count: count() })
      .from(booking)
      .where(eq(booking.id_capster, target.id_capster));

    const totalUsage = Number(shiftsCount?.count || 0) + Number(bookingsCount?.count || 0);

    if (totalUsage > 0) {
      // Historical data exists: soft-delete to protect financial & payroll integrity
      await db
        .update(capster)
        .set({ status: "inactive", updated_at: new Date() })
        .where(eq(capster.id_capster, target.id_capster));

      await db
        .update(users)
        .set({ status: "inactive", updated_at: new Date() })
        .where(eq(users.id_user, target.id_user));

      // Close ongoing shifts
      await db
        .update(shiftCapster)
        .set({ status: "completed", waktu_selesai: "Akun dinonaktifkan" })
        .where(
          and(
            eq(shiftCapster.id_capster, target.id_capster),
            eq(shiftCapster.status, "ongoing"),
          ),
        );

      return {
        success: true,
        softDeleted: true,
        message: `Capster "${target.nama_lengkap}" memiliki ${totalUsage} riwayat shift/booking sehingga akun dinonaktifkan agar rekap transaksi & komisi tetap aman.`,
      };
    }

    // No historical data: hard delete
    await db.delete(capster).where(eq(capster.id_capster, target.id_capster));
    await db.delete(users).where(eq(users.id_user, target.id_user));

    return {
      success: true,
      softDeleted: false,
      message: `Akun capster "${target.nama_lengkap}" berhasil dihapus secara permanen.`,
    };
  });

export const updateCapsterCommissionPercentage = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      capsterId: string;
      percentage: number;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const validPercent = Math.max(0, Math.min(100, Math.round(data.percentage)));
    await db
      .update(capster)
      .set({
        persentase_komisi: String(validPercent),
        updated_at: new Date(),
      })
      .where(eq(capster.id_capster, data.capsterId));
    return { success: true, percentage: validPercent };
  });
