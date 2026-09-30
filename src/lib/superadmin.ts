import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  barbershop,
  business,
  capster,
  layanan,
  owner,
  plan,
  subscription,
  subscriptionHistories,
  superadminAuditLogs,
  users,
} from "@/db/schema";
import { generateUniqueBarbershopSlug } from "./slug";
import {
  requireSuperadmin,
  setSuperadminSessionCookie,
  getSuperadminSession,
  clearSuperadminSessionCookie,
  setOwnerSessionCookie,
  clearOwnerSessionCookie,
} from "./auth-session";
import { hashPassword, verifyPassword } from "./auth-crypto";

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
  page?: number;
  pageSize?: number;
  totalPages?: number;
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

    // Verifikasi password menggunakan cryptographic comparison (scrypt / legacy plaintext)
    const verification = verifyPassword(password, superadminUser.password || "");
    if (!verification.valid) {
      throw new Error("Email atau password salah.");
    }

    // Upgrade hash legacy jika masih plaintext
    if (verification.needsRehash) {
      try {
        const newHash = hashPassword(password);
        await db
          .update(users)
          .set({ password: newHash, updated_at: new Date() })
          .where(eq(users.id_user, superadminUser.id_user));
      } catch (rehashErr) {
        console.warn("Gagal upgrade hash password superadmin:", rehashErr);
      }
    }

    // Catat log audit aktivitas login
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "LOGIN",
        actor_email: superadminUser.email,
        details: "Superadmin berhasil masuk ke platform via autentikasi aman.",
      })
      .catch((err) => console.error("Gagal mencatat audit login:", err));

    // Set signed server-side superadmin session cookie
    setSuperadminSessionCookie({
      userId: superadminUser.id_user,
      email: superadminUser.email,
      role: superadminUser.role as any,
      namaLengkap: superadminUser.nama_lengkap || "Superadmin Platform",
    });

    return {
      id_user: superadminUser.id_user,
      email: superadminUser.email,
      nama_lengkap: superadminUser.nama_lengkap,
      role: superadminUser.role,
    };
  });

// ============================================================================
// 2. LOGOUT SUPERADMIN
// ============================================================================

export const logoutSuperadmin = createServerFn({
  method: "POST",
}).handler(async () => {
  const session = getSuperadminSession();
  if (session) {
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "LOGOUT",
        actor_email: session.email,
        details: "Superadmin berhasil keluar (logout) dari platform.",
      })
      .catch((err) => console.error("Gagal mencatat audit logout:", err));
  }
  clearSuperadminSessionCookie();
  return { success: true };
});

// ============================================================================
// 3. GET DAFTAR TENANT / BARBERSHOP DENGAN FILTER, STATISTIK & PAGINASI
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
            page?: number;
            pageSize?: number;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<SuperadminTenantsResult> => {
    // SECURITY: Hanya Superadmin terotentikasi server-side
    requireSuperadmin();

    const search = (data?.search || "").trim().toLowerCase();
    const statusFilter = data?.status || "all";
    const sort = data?.sort || "terbaru";
    const page = Math.max(1, data?.page || 1);
    const pageSize = Math.min(100, Math.max(10, data?.pageSize || 25));

    // 1. Ambil seluruh barbershop dengan query yang terindeks
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

    // 2. Ambil seluruh owner dan petakan ke Map (O(1) lookup untuk mencegah N+1)
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

    const ownerMap = new Map<string, typeof allOwners[0]>();
    for (const o of allOwners) {
      if (o.id_barbershop) {
        ownerMap.set(o.id_barbershop, o);
      }
    }

    // 3. Aggregation SQL untuk hitung jumlah capster & layanan tanpa memuat seluruh baris
    const [capsterCounts, serviceCounts] = await Promise.all([
      db
        .select({
          id_barbershop: capster.id_barbershop,
          total: sql<number>`count(${capster.id_capster})::int`,
        })
        .from(capster)
        .groupBy(capster.id_barbershop),
      db
        .select({
          id_barbershop: layanan.id_barbershop,
          total: sql<number>`count(${layanan.id_layanan})::int`,
        })
        .from(layanan)
        .groupBy(layanan.id_barbershop),
    ]);

    const capsterCountMap = new Map<string, number>();
    for (const c of capsterCounts) {
      if (c.id_barbershop) {
        capsterCountMap.set(c.id_barbershop, Number(c.total) || 0);
      }
    }

    const serviceCountMap = new Map<string, number>();
    for (const s of serviceCounts) {
      if (s.id_barbershop) {
        serviceCountMap.set(s.id_barbershop, Number(s.total) || 0);
      }
    }

    // 4. Petakan setiap barbershop dengan Owner (menggunakan Map O(1))
    let mappedTenants: SuperadminTenantItem[] = allShops.map((shop) => {
      const ownerUser = ownerMap.get(shop.id_barbershop);

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

    // 7. Terapkan Pencarian Server-Side
    if (search) {
      mappedTenants = mappedTenants.filter((t) => {
        const matchShop = t.nama_barbershop.toLowerCase().includes(search);
        const matchId = t.id_barbershop.toLowerCase().includes(search);
        const matchOwnerName = t.owner?.nama_lengkap.toLowerCase().includes(search) || false;
        const matchOwnerEmail = t.owner?.email.toLowerCase().includes(search) || false;
        return matchShop || matchId || matchOwnerName || matchOwnerEmail;
      });
    }

    const filteredTotal = mappedTenants.length;
    const totalPages = Math.ceil(filteredTotal / pageSize) || 1;

    return {
      tenants: mappedTenants,
      stats: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        totalOwners,
      },
      page,
      pageSize,
      totalPages,
    };
  });

// ============================================================================
// 4. TAMBAH TOKO & OWNER BARU (DATABASE TRANSACTION)
// ============================================================================

export type CreateTenantInput = {
  nama_barbershop: string;
  nama_owner: string;
  email_owner: string;
  password_awal: string;
  alamat?: string;
  no_hp_barbershop?: string;
  no_hp_owner?: string;
};

export const createTenantWithTransaction = createServerFn({
  method: "POST",
})
  .validator((data: CreateTenantInput) => data)
  .handler(async ({ data }) => {
    // SECURITY: Wajib Superadmin
    const admin = requireSuperadmin();
    const actorEmail = admin.email;

    const namaBarbershop = (data.nama_barbershop || "").trim();
    const namaOwner = (data.nama_owner || "").trim();
    const emailOwner = (data.email_owner || "").trim().toLowerCase();
    const passwordAwal = data.password_awal || "";
    const alamat = (data.alamat || "").trim();
    const noHpBarbershop = (data.no_hp_barbershop || "").trim();
    const noHpOwner = (data.no_hp_owner || noHpBarbershop).trim();

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

    // Hash password awal dengan aman
    const hashedPassword = hashPassword(passwordAwal);

    // JALANKAN DATABASE TRANSACTION PENUH
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

        // STEP 2: Simpan Akun Owner ke tabel users (role = Owner, link id_barbershop, password ter-hash)
        const [newOwner] = await tx
          .insert(users)
          .values({
            email: emailOwner,
            password: hashedPassword,
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

        // STEP 3: Sinkronisasi model SaaS (owner, business, FREE active subscription)
        const [saasOwner] = await tx
          .insert(owner)
          .values({
            name: newOwner.nama_lengkap || namaOwner,
            email: newOwner.email,
            phone: newOwner.no_hp || noHpOwner,
            password_hash: "MANAGED_VIA_USERS_TABLE",
            status: "active",
          })
          .returning();

        if (saasOwner) {
          const [biz] = await tx
            .insert(business)
            .values({
              owner_id: saasOwner.owner_id,
              id_barbershop: newShop.id_barbershop,
              business_name: newShop.nama_barbershop,
              status: "active",
            })
            .returning();

          if (biz) {
            const [freePlan] = await tx
              .select({ plan_id: plan.plan_id })
              .from(plan)
              .where(eq(plan.plan_name, "FREE"))
              .limit(1);

            const freePlanId = freePlan ? freePlan.plan_id : 1;

            const [newSub] = await tx
              .insert(subscription)
              .values({
                business_id: biz.business_id,
                plan_id: freePlanId,
                status: "active",
                start_date: new Date(),
                end_date: null,
              })
              .returning();

            await tx.insert(subscriptionHistories).values({
              id_barbershop: newShop.id_barbershop,
              id_subscription: newSub.subscription_id,
              id_plan: freePlanId,
              status: "active",
              start_date: new Date(),
              end_date: null,
              jenis: "register_free",
              keterangan: "Inisialisasi paket gratis (Free) bawaan tenant",
            });
          }
        }

        // STEP 4: Catat ke audit log platform
        await tx.insert(superadminAuditLogs).values({
          action: "CREATE_TENANT",
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
// 5. TOGGLE STATUS TOKO (ACTIVE ↔ SUSPENDED)
// ============================================================================

export const toggleTenantStatus = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      id_barbershop: string;
      targetStatus: "active" | "suspended";
    }) => data,
  )
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    const admin = requireSuperadmin();
    const actor_email = admin.email;
    const { id_barbershop, targetStatus } = data;

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
    const auditAction = targetStatus === "active" ? "ACTIVATE_TENANT" : "SUSPEND_TENANT";
    await db
      .insert(superadminAuditLogs)
      .values({
        action: auditAction,
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
// 6. GET DETAIL TENANT
// ============================================================================

export const getTenantDetail = createServerFn({
  method: "GET",
})
  .validator((data: { id_barbershop: string }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();
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
// 7. LOG AUDIT AKTIVITAS SUPERADMIN
// ============================================================================

export const logSuperadminAction = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      action: string;
      target_tenant_id?: string;
      target_tenant_name?: string;
      details?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    // SECURITY: Identity berasal strictly dari server session
    const admin = requireSuperadmin();

    try {
      await db.insert(superadminAuditLogs).values({
        action: data.action,
        actor_email: admin.email,
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

// ============================================================================
// 8. SERVER-SIDE IMPERSONATION (SUPERADMIN TO OWNER)
// ============================================================================

export const startSuperadminImpersonation = createServerFn({
  method: "POST",
})
  .validator((data: { id_barbershop: string }) => data)
  .handler(async ({ data }) => {
    const admin = requireSuperadmin();
    const { id_barbershop } = data;

    // 1. Verifikasi barbershop ada di database
    const [shop] = await db
      .select()
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, id_barbershop))
      .limit(1);

    if (!shop) {
      throw new Error("Barbershop tidak ditemukan.");
    }

    if (shop.status === "suspended") {
      throw new Error("Toko ini sedang disuspend. Aktifkan terlebih dahulu sebelum impersonasi.");
    }

    // 2. Verifikasi owner riil di database — TIDAK BOLEH MEMBUAT FAKE USER ID
    const [realOwner] = await db
      .select({
        id_user: users.id_user,
        email: users.email,
        nama_lengkap: users.nama_lengkap,
        no_hp: users.no_hp,
        status: users.status,
      })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.id_barbershop, id_barbershop)))
      .limit(1);

    if (!realOwner) {
      throw new Error(
        `Owner untuk toko '${shop.nama_barbershop}' tidak ditemukan di database. Impersonasi dibatalkan demi integritas data.`,
      );
    }

    // 3. Set secure server-side owner session cookie dengan penanda impersonatedBy
    setOwnerSessionCookie({
      userId: realOwner.id_user,
      email: realOwner.email,
      role: "owner",
      barbershopId: shop.id_barbershop,
      barbershopName: shop.nama_barbershop,
      namaLengkap: realOwner.nama_lengkap,
      impersonatedBy: admin.userId,
    });

    // 4. Catat log audit impersonasi
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "IMPERSONATE_TENANT",
        actor_email: admin.email,
        target_tenant_id: shop.id_barbershop,
        target_tenant_name: shop.nama_barbershop,
        details: `Superadmin (${admin.email}) masuk sebagai Owner riil (${realOwner.email} / ${realOwner.nama_lengkap}) untuk toko '${shop.nama_barbershop}'.`,
      })
      .catch((e) => console.error("Audit impersonate gagal:", e));

    return {
      success: true,
      barbershop: {
        id_barbershop: shop.id_barbershop,
        nama_barbershop: shop.nama_barbershop,
        slug: shop.slug,
        alamat: shop.alamat,
        no_hp: shop.no_hp,
      },
      owner: realOwner,
    };
  });

export const exitSuperadminImpersonation = createServerFn({
  method: "POST",
}).handler(async () => {
  const admin = requireSuperadmin();

  // Hapus cookie sesi owner (impersonation)
  clearOwnerSessionCookie();

  // Catat log audit penghentian impersonasi
  await db
    .insert(superadminAuditLogs)
    .values({
      action: "EXIT_IMPERSONATION",
      actor_email: admin.email,
      details: `Superadmin (${admin.email}) keluar dari mode impersonate dan kembali ke dashboard platform.`,
    })
    .catch((e) => console.error("Audit exit impersonate gagal:", e));

  return { success: true };
});
