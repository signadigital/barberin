import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  barbershop,
  capster,
  layanan,
  superadminAuditLogs,
  users,
} from "@/db/schema";
import { generateUniqueBarbershopSlug } from "./slug";

// ============================================================================
// TYPES
// ============================================================================

export type SuperadminTenantItem = {
  id_barbershop: string;
  slug: string;
  nama_barbershop: string;
  alamat: string | null;
  no_hp: string | null;
  status: "active" | "suspended" | "inactive";
  created_at: string;
  owner: {
    id_user: string;
    nama_lengkap: string;
    email: string;
    no_hp: string | null;
    status: string;
  } | null;
  capsterCount: number;
  serviceCount: number;
};

export type SuperadminStats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalOwners: number;
};

export type SuperadminTenantsResult = {
  tenants: SuperadminTenantItem[];
  stats: SuperadminStats;
};

// ============================================================================
// 1. LOGIN SUPERADMIN
// ============================================================================

export const loginSuperadmin = createServerFn({
  method: "POST",
})
  .validator((data: { email: string; password?: string }) => data)
  .handler(async ({ data }) => {
    const email = (data.email || "").trim().toLowerCase();
    const password = data.password || "";

    if (!email) {
      throw new Error("Email wajib diisi.");
    }
    if (!password) {
      throw new Error("Password wajib diisi.");
    }

    // Cari user dengan role superadmin atau admin_platform
    const [superadminUser] = await db
      .select({
        id_user: users.id_user,
        email: users.email,
        nama_lengkap: users.nama_lengkap,
        role: users.role,
        status: users.status,
        password: users.password,
      })
      .from(users)
      .where(
        and(
          eq(users.email, email),
          or(eq(users.role, "superadmin"), eq(users.role, "admin_platform")),
        ),
      )
      .limit(1);

    if (!superadminUser) {
      // Cek apakah ada akun dengan role lain
      const [anyUser] = await db
        .select({ id_user: users.id_user, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (anyUser) {
        throw new Error("Anda tidak memiliki akses ke halaman Superadmin.");
      }

      throw new Error("Email atau password salah.");
    }

    if (superadminUser.status !== "active") {
      throw new Error("Akun Superadmin Anda sedang nonaktif.");
    }

    if (superadminUser.password && superadminUser.password !== password) {
      throw new Error("Email atau password salah.");
    }

    // Catat log audit aktivitas login
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "login",
        actor_email: superadminUser.email,
        details: "Superadmin berhasil masuk ke platform.",
      })
      .catch((err) => console.error("Gagal mencatat audit login:", err));

    return {
      id_user: superadminUser.id_user,
      email: superadminUser.email,
      nama_lengkap: superadminUser.nama_lengkap,
      role: superadminUser.role,
    };
  });

// ============================================================================
// 2. GET DAFTAR TENANT / BARBERSHOP DENGAN FILTER & STATISTIK
// ============================================================================

export const getSuperadminTenants = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            search?: string;
            status?: "all" | "active" | "suspended";
            sort?: "terbaru" | "terlama" | "name_asc" | "name_desc";
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<SuperadminTenantsResult> => {
    const search = (data?.search || "").trim().toLowerCase();
    const statusFilter = data?.status || "all";
    const sort = data?.sort || "terbaru";

    // 1. Ambil seluruh barbershop
    const allShops = await db
      .select({
        id_barbershop: barbershop.id_barbershop,
        slug: barbershop.slug,
        nama_barbershop: barbershop.nama_barbershop,
        alamat: barbershop.alamat,
        no_hp: barbershop.no_hp,
        status: barbershop.status,
        created_at: barbershop.created_at,
      })
      .from(barbershop)
      .orderBy(
        sort === "terlama"
          ? barbershop.created_at
          : sort === "name_asc"
            ? barbershop.nama_barbershop
            : sort === "name_desc"
              ? desc(barbershop.nama_barbershop)
              : desc(barbershop.created_at),
      );

    // 2. Ambil seluruh owner
    const allOwners = await db
      .select({
        id_user: users.id_user,
        nama_lengkap: users.nama_lengkap,
        email: users.email,
        no_hp: users.no_hp,
        status: users.status,
        id_barbershop: users.id_barbershop,
      })
      .from(users)
      .where(eq(users.role, "owner"));

    // 3. Ambil total capster & layanan per shop
    const [allCapsters, allServices] = await Promise.all([
      db.select({ id_barbershop: capster.id_barbershop }).from(capster),
      db.select({ id_barbershop: layanan.id_barbershop }).from(layanan),
    ]);

    const capsterCountMap = new Map<string, number>();
    for (const c of allCapsters) {
      if (c.id_barbershop) {
        capsterCountMap.set(
          c.id_barbershop,
          (capsterCountMap.get(c.id_barbershop) || 0) + 1,
        );
      }
    }

    const serviceCountMap = new Map<string, number>();
    for (const s of allServices) {
      if (s.id_barbershop) {
        serviceCountMap.set(
          s.id_barbershop,
          (serviceCountMap.get(s.id_barbershop) || 0) + 1,
        );
      }
    }

    // 4. Petakan setiap barbershop dengan Owner-nya (hanya match ID barbershop)
    let mappedTenants: SuperadminTenantItem[] = allShops.map((shop) => {
      const ownerUser = allOwners.find((o) => o.id_barbershop === shop.id_barbershop);

      return {
        id_barbershop: shop.id_barbershop,
        slug: shop.slug,
        nama_barbershop: shop.nama_barbershop,
        alamat: shop.alamat,
        no_hp: shop.no_hp,
        status: (shop.status as any) || "active",
        created_at: shop.created_at ? shop.created_at.toISOString() : new Date().toISOString(),
        owner: ownerUser
          ? {
              id_user: ownerUser.id_user,
              nama_lengkap: ownerUser.nama_lengkap,
              email: ownerUser.email,
              no_hp: ownerUser.no_hp,
              status: ownerUser.status,
            }
          : null,
        capsterCount: capsterCountMap.get(shop.id_barbershop) || 0,
        serviceCount: serviceCountMap.get(shop.id_barbershop) || 0,
      };
    });

    // 5. Hitung Statistik Riil dari Database
    const totalTenants = mappedTenants.length;
    const activeTenants = mappedTenants.filter((t) => t.status === "active").length;
    const suspendedTenants = mappedTenants.filter((t) => t.status === "suspended").length;
    const totalOwners = allOwners.length;

    // 6. Terapkan Filter Status
    if (statusFilter !== "all") {
      mappedTenants = mappedTenants.filter((t) => t.status === statusFilter);
    }

    // 7. Terapkan Pencarian
    if (search) {
      mappedTenants = mappedTenants.filter((t) => {
        const matchShop = t.nama_barbershop.toLowerCase().includes(search);
        const matchId = t.id_barbershop.toLowerCase().includes(search);
        const matchOwnerName = t.owner?.nama_lengkap.toLowerCase().includes(search) || false;
        const matchOwnerEmail = t.owner?.email.toLowerCase().includes(search) || false;
        return matchShop || matchId || matchOwnerName || matchOwnerEmail;
      });
    }

    return {
      tenants: mappedTenants,
      stats: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        totalOwners,
      },
    };
  });

// ============================================================================
// 3. TAMBAH TOKO & OWNER BARU (DATABASE TRANSACTION)
// ============================================================================

export type CreateTenantInput = {
  nama_barbershop: string;
  nama_owner: string;
  email_owner: string;
  password_awal: string;
  alamat?: string;
  no_hp_barbershop?: string;
  no_hp_owner?: string;
  actor_email?: string;
};

export const createTenantWithTransaction = createServerFn({
  method: "POST",
})
  .validator((data: CreateTenantInput) => data)
  .handler(async ({ data }) => {
    const namaBarbershop = (data.nama_barbershop || "").trim();
    const namaOwner = (data.nama_owner || "").trim();
    const emailOwner = (data.email_owner || "").trim().toLowerCase();
    const passwordAwal = data.password_awal || "";
    const alamat = (data.alamat || "").trim();
    const noHpBarbershop = (data.no_hp_barbershop || "").trim();
    const noHpOwner = (data.no_hp_owner || noHpBarbershop).trim();
    const actorEmail = data.actor_email || "superadmin@barberin.test";

    // Validasi Form
    if (!namaBarbershop) {
      throw new Error("Nama Barbershop wajib diisi.");
    }
    if (!namaOwner) {
      throw new Error("Nama Owner wajib diisi.");
    }
    if (!emailOwner) {
      throw new Error("Email Owner wajib diisi.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailOwner)) {
      throw new Error("Format email Owner tidak valid.");
    }
    if (!passwordAwal || passwordAwal.length < 6) {
      throw new Error("Password awal minimal 6 karakter.");
    }

    // Cek duplikasi email
    const [existingUser] = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.email, emailOwner))
      .limit(1);

    if (existingUser) {
      throw new Error("Email Owner sudah terdaftar dalam sistem.");
    }

    // JALANKAN DATABASE TRANSACTION
    try {
      const result = await db.transaction(async (tx) => {
        // STEP 1: Generate slug unik dan Simpan Tenant ke tabel barbershop (status = Active)
        const finalSlug = await generateUniqueBarbershopSlug(tx, namaBarbershop);

        const [newShop] = await tx
          .insert(barbershop)
          .values({
            nama_barbershop: namaBarbershop,
            slug: finalSlug,
            alamat: alamat || "Alamat belum diatur",
            no_hp: noHpBarbershop || "0812-0000-0000",
            status: "active",
            jam_buka: "08:00",
            jam_tutup: "21:00",
          })
          .returning();

        if (!newShop) {
          throw new Error("Gagal membuat record toko baru.");
        }

        // STEP 2: Simpan Akun Owner ke tabel users (role = Owner, link id_barbershop)
        const [newOwner] = await tx
          .insert(users)
          .values({
            email: emailOwner,
            password: passwordAwal,
            nama_lengkap: namaOwner,
            no_hp: noHpOwner,
            role: "owner",
            status: "active",
            id_barbershop: newShop.id_barbershop,
          })
          .returning();

        if (!newOwner) {
          throw new Error("Gagal membuat akun Owner untuk toko.");
        }

        // STEP 3: Toko baru dimulai dalam kondisi bersih (0 layanan, 0 capster, 0 transaksi)
        // Jangan menyalin data apa pun dari owner lain!

        // STEP 4: Catat ke audit log platform
        await tx.insert(superadminAuditLogs).values({
          action: "create_tenant",
          actor_email: actorEmail,
          target_tenant_id: newShop.id_barbershop,
          target_tenant_name: newShop.nama_barbershop,
          details: `Toko '${newShop.nama_barbershop}' (slug: '${newShop.slug}') dan akun Owner '${newOwner.nama_lengkap}' (${newOwner.email}) berhasil dibuat via DB Transaction. Toko baru dimulai bersih/kosong.`,
        });

        return {
          barbershop: newShop,
          owner: newOwner,
        };
      });

      return {
        success: true,
        message: "Toko berhasil ditambahkan",
        data: result,
      };
    } catch (err: any) {
      console.error("❌ DB Transaction rollback pada tambah toko:", err);
      throw new Error(
        err?.message || "Toko gagal dibuat. Tidak ada data yang disimpan.",
      );
    }
  });

// ============================================================================
// 4. TOGGLE STATUS TOKO (ACTIVE ↔ SUSPENDED)
// ============================================================================

export const toggleTenantStatus = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      id_barbershop: string;
      targetStatus: "active" | "suspended";
      actor_email?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id_barbershop, targetStatus, actor_email = "superadmin@barberin.test" } = data;

    if (!id_barbershop) {
      throw new Error("ID Toko wajib disertakan.");
    }
    if (targetStatus !== "active" && targetStatus !== "suspended") {
      throw new Error("Status tidak valid. Hanya Active atau Suspended.");
    }

    const [existingShop] = await db
      .select()
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, id_barbershop))
      .limit(1);

    if (!existingShop) {
      throw new Error("Toko tidak ditemukan.");
    }

    // Update status barbershop
    await db
      .update(barbershop)
      .set({
        status: targetStatus,
        updated_at: new Date(),
      })
      .where(eq(barbershop.id_barbershop, id_barbershop));

    // Catat log audit aktivitas
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "update_status",
        actor_email,
        target_tenant_id: id_barbershop,
        target_tenant_name: existingShop.nama_barbershop,
        details: `Status toko diubah dari '${existingShop.status}' menjadi '${targetStatus}'.`,
      })
      .catch((e) => console.error("Audit update status gagal:", e));

    return {
      success: true,
      id_barbershop,
      newStatus: targetStatus,
      message:
        targetStatus === "active"
          ? `Toko '${existingShop.nama_barbershop}' telah diaktifkan kembali.`
          : `Toko '${existingShop.nama_barbershop}' telah dinonaktifkan (Suspended). Akses Owner & Capster diblokir.`,
    };
  });

// ============================================================================
// 5. GET DETAIL TENANT
// ============================================================================

export const getTenantDetail = createServerFn({
  method: "GET",
})
  .validator((data: { id_barbershop: string }) => data)
  .handler(async ({ data }) => {
    const { id_barbershop } = data;

    const [shop] = await db
      .select()
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, id_barbershop))
      .limit(1);

    if (!shop) {
      throw new Error("Toko tidak ditemukan.");
    }

    // Ambil Owner (strictly for this barbershop)
    const [ownerUser] = await db
      .select({
        id_user: users.id_user,
        nama_lengkap: users.nama_lengkap,
        email: users.email,
        no_hp: users.no_hp,
        status: users.status,
        created_at: users.created_at,
      })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.id_barbershop, id_barbershop)))
      .limit(1);

    // Ambil Capsters
    const capsters = await db
      .select({
        id_capster: capster.id_capster,
        nama_lengkap: users.nama_lengkap,
        email: users.email,
        no_pegawai: capster.no_pegawai,
        status: capster.status,
      })
      .from(capster)
      .innerJoin(users, eq(capster.id_user, users.id_user))
      .where(eq(capster.id_barbershop, id_barbershop));

    // Ambil Services
    const services = await db
      .select({
        id_layanan: layanan.id_layanan,
        nama_layanan: layanan.nama_layanan,
        harga: layanan.harga,
        durasi_menit: layanan.durasi_menit,
        status: layanan.status,
      })
      .from(layanan)
      .where(eq(layanan.id_barbershop, id_barbershop));

    return {
      barbershop: shop,
      owner: ownerUser || null,
      capsters,
      services,
    };
  });

// ============================================================================
// 6. LOG AUDIT AKTIVITAS SUPERADMIN
// ============================================================================

export const logSuperadminAction = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      action: string;
      actor_email: string;
      target_tenant_id?: string;
      target_tenant_name?: string;
      details?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      await db.insert(superadminAuditLogs).values({
        action: data.action,
        actor_email: data.actor_email,
        target_tenant_id: data.target_tenant_id,
        target_tenant_name: data.target_tenant_name,
        details: data.details,
      });
      return { success: true };
    } catch (e) {
      console.error("Gagal log Superadmin action:", e);
      return { success: false };
    }
  });
