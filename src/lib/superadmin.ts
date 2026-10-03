import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  barbershop,
  barbershopBrandings,
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
} from "./auth-session";
import { hashPassword, verifyPassword } from "./auth-crypto";
import { supabase } from "@/lib/supabase-client";

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
  total?: number;
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
    const t0 = performance.now();
    // SECURITY: Hanya Superadmin terotentikasi server-side
    requireSuperadmin();
    const tAuth = Math.round(performance.now() - t0);

    const search = (data?.search || "").trim();
    const statusFilter = data?.status || "all";
    const sort = data?.sort || "terbaru";
    const page = Math.max(1, data?.page || 1);
    const pageSize = Math.min(100, Math.max(10, data?.pageSize || 25));
    const offset = (page - 1) * pageSize;

    // 1. Filter condition di level SQL
    const conditions: SQL[] = [];
    if (statusFilter !== "all") {
      conditions.push(eq(barbershop.status, statusFilter));
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(barbershop.nama_barbershop, searchPattern),
          sql`${barbershop.id_barbershop}::text ilike ${searchPattern}`,
          ilike(users.nama_lengkap, searchPattern),
          ilike(users.email, searchPattern),
        )!,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 2. Sorting di level SQL
    const orderByClause =
      sort === "terlama"
        ? barbershop.created_at
        : sort === "name_asc"
          ? barbershop.nama_barbershop
          : sort === "name_desc"
            ? desc(barbershop.nama_barbershop)
            : desc(barbershop.created_at);

    // 3. STEP 1: Query total count terfilter, halaman data tenant aktif (LIMIT + OFFSET), dan platform stats
    const tCountStart = performance.now();
    const countPromise = db
      .select({ total: sql<number>`count(distinct ${barbershop.id_barbershop})::int` })
      .from(barbershop)
      .leftJoin(
        users,
        and(eq(users.id_barbershop, barbershop.id_barbershop), eq(users.role, "owner")),
      )
      .where(whereClause);

    const tQueryStart = performance.now();
    const pageShopsPromise = db
      .select({
        id_barbershop: barbershop.id_barbershop,
        slug: barbershop.slug,
        nama_barbershop: barbershop.nama_barbershop,
        alamat: barbershop.alamat,
        no_hp: barbershop.no_hp,
        status: barbershop.status,
        created_at: barbershop.created_at,
        owner_id_user: users.id_user,
        owner_nama: users.nama_lengkap,
        owner_email: users.email,
        owner_no_hp: users.no_hp,
        owner_status: users.status,
      })
      .from(barbershop)
      .leftJoin(
        users,
        and(eq(users.id_barbershop, barbershop.id_barbershop), eq(users.role, "owner")),
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    const tStatsStart = performance.now();
    const statsPromise = Promise.all([
      db
        .select({
          totalTenants: sql<number>`count(*)::int`,
          activeTenants: sql<number>`count(*) filter (where ${barbershop.status} = 'active')::int`,
          suspendedTenants: sql<number>`count(*) filter (where ${barbershop.status} = 'suspended')::int`,
        })
        .from(barbershop),
      db
        .select({
          totalOwners: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(eq(users.role, "owner")),
    ]);

    const [totalResult, pageShops, [statsResult, ownerCountResult]] = await Promise.all([
      countPromise,
      pageShopsPromise,
      statsPromise,
    ]);

    const tCount = Math.round(performance.now() - tCountStart);
    const tQuery = Math.round(performance.now() - tQueryStart);
    const tStats = Math.round(performance.now() - tStatsStart);

    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 4. STEP 2: Pre-aggregate capster & service count HANYA untuk barbershop yang muncul di halaman aktif (maks 25 ID)
    const tAggStart = performance.now();
    const pageShopIds = pageShops.map((s) => s.id_barbershop).filter(Boolean);
    const capsterMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();

    if (pageShopIds.length > 0) {
      const [capsterRows, serviceRows] = await Promise.all([
        db
          .select({
            id_barbershop: capster.id_barbershop,
            total: sql<number>`count(*)::int`,
          })
          .from(capster)
          .where(
            sql`${capster.id_barbershop} IN ${sql`(${sql.join(
              pageShopIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`}`,
          )
          .groupBy(capster.id_barbershop),
        db
          .select({
            id_barbershop: layanan.id_barbershop,
            total: sql<number>`count(*)::int`,
          })
          .from(layanan)
          .where(
            sql`${layanan.id_barbershop} IN ${sql`(${sql.join(
              pageShopIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`}`,
          )
          .groupBy(layanan.id_barbershop),
      ]);

      for (const c of capsterRows) {
        if (c.id_barbershop) capsterMap.set(c.id_barbershop, Number(c.total) || 0);
      }
      for (const s of serviceRows) {
        if (s.id_barbershop) serviceMap.set(s.id_barbershop, Number(s.total) || 0);
      }
    }
    const tAgg = Math.round(performance.now() - tAggStart);

    // 5. Petakan data row halaman aktif (maksimal pageSize baris)
    const mappedTenants: SuperadminTenantItem[] = pageShops.map((shop) => ({
      id_barbershop: shop.id_barbershop,
      slug: shop.slug,
      nama_barbershop: shop.nama_barbershop,
      alamat: shop.alamat,
      no_hp: shop.no_hp,
      status: (shop.status as any) || "active",
      created_at: shop.created_at ? shop.created_at.toISOString() : new Date().toISOString(),
      owner: shop.owner_id_user
        ? {
            id_user: shop.owner_id_user,
            nama_lengkap: shop.owner_nama || "",
            email: shop.owner_email || "",
            no_hp: shop.owner_no_hp || null,
            status: shop.owner_status || "active",
          }
        : null,
      capsterCount: capsterMap.get(shop.id_barbershop) || 0,
      serviceCount: serviceMap.get(shop.id_barbershop) || 0,
    }));

    const totalDuration = Math.round(performance.now() - t0);
    console.info(
      `[SUPERADMIN_PERF] getSuperadminTenants total=${totalDuration}ms (auth=${tAuth}ms, countQuery=${tCount}ms, tenantQuery=${tQuery}ms, aggQuery=${tAgg}ms, statsQuery=${tStats}ms, rows=${mappedTenants.length}/${total})`,
    );

    return {
      tenants: mappedTenants,
      stats: {
        totalTenants: statsResult[0]?.totalTenants || 0,
        activeTenants: statsResult[0]?.activeTenants || 0,
        suspendedTenants: statsResult[0]?.suspendedTenants || 0,
        totalOwners: ownerCountResult[0]?.totalOwners || 0,
      },
      page,
      pageSize,
      totalPages,
      total,
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

            if (newSub) {
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
      throw new Error(err?.message || "Toko gagal dibuat. Tidak ada data yang disimpan.");
    }
  });

// ============================================================================
// 5. TOGGLE STATUS TOKO (ACTIVE ↔ SUSPENDED)
// ============================================================================

export const toggleTenantStatus = createServerFn({
  method: "POST",
})
  .validator((data: { id_barbershop: string; targetStatus: "active" | "suspended" }) => data)
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
// 7. HAPUS AKUN OWNER & SELURUH DATA TENANT SECARA PERMANEN
// ============================================================================

export const deleteTenantPermanent = createServerFn({
  method: "POST",
})
  .validator((data: { id_barbershop: string }) => data)
  .handler(async ({ data }) => {
    // 1. SECURITY: Hanya Superadmin yang terotentikasi
    const admin = requireSuperadmin();
    const actor_email = admin.email;
    const { id_barbershop } = data;

    if (!id_barbershop) {
      throw new Error("ID Toko wajib disertakan.");
    }

    // 2. Temukan barbershop yang akan dihapus
    const [existingShop] = await db
      .select()
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, id_barbershop))
      .limit(1);

    if (!existingShop) {
      throw new Error("Toko tidak ditemukan atau sudah dihapus.");
    }

    // 3. Kumpulkan data user, capster, dan owner terkait toko ini
    const shopUsers = await db
      .select({
        id_user: users.id_user,
        email: users.email,
        role: users.role,
        nama_lengkap: users.nama_lengkap,
      })
      .from(users)
      .where(eq(users.id_barbershop, id_barbershop));

    const ownerUser = shopUsers.find((u) => u.role === "owner");
    const ownerEmail = ownerUser?.email || null;
    const ownerUserId = ownerUser?.id_user || null;

    let saasOwnerId: number | null = null;
    if (ownerEmail) {
      const [saasOwner] = await db
        .select({ owner_id: owner.owner_id })
        .from(owner)
        .where(eq(owner.email, ownerEmail))
        .limit(1);
      if (saasOwner) {
        saasOwnerId = saasOwner.owner_id;
      }
    }

    // Daftar User ID dan Email untuk dihapus dari Supabase Auth
    const userIdsToDelete = shopUsers.map((u) => u.id_user);
    const emailsToDelete = shopUsers.map((u) => u.email).filter(Boolean);
    if (ownerEmail && !emailsToDelete.includes(ownerEmail)) {
      emailsToDelete.push(ownerEmail);
    }

    // 4. Cleanup Supabase Storage files jika ada
    try {
      const [branding] = await db
        .select({
          logo_url: barbershopBrandings.logo_url,
          favicon_url: barbershopBrandings.favicon_url,
        })
        .from(barbershopBrandings)
        .where(eq(barbershopBrandings.id_barbershop, id_barbershop))
        .limit(1);

      const extractStorageInfo = (url?: string | null) => {
        if (!url || typeof url !== "string") return null;
        if (url.includes("/storage/v1/object/public/")) {
          const parts = url.split("/storage/v1/object/public/")[1]?.split("/");
          if (parts && parts.length > 1) {
            const bucket = parts[0];
            const path = parts.slice(1).join("/");
            return { bucket, path };
          }
        }
        return null;
      };

      const filesToDelete = [
        extractStorageInfo(existingShop.foto),
        extractStorageInfo(branding?.logo_url),
        extractStorageInfo(branding?.favicon_url),
      ].filter(Boolean) as { bucket: string; path: string }[];

      for (const f of filesToDelete) {
        try {
          await supabase.storage.from(f.bucket).remove([f.path]);
        } catch (storageErr) {
          console.warn("[DELETE_TENANT] Gagal menghapus file storage:", f, storageErr);
        }
      }
    } catch (storageScanErr) {
      console.warn("[DELETE_TENANT] Catatan storage cleanup:", storageScanErr);
    }

    // 5. Eksekusi DB Transaction Atomic
    try {
      await db.transaction(async (tx) => {
        // A. Struk
        await tx.execute(sql`DELETE FROM struk WHERE id_barbershop = ${id_barbershop}`);

        // B. Pembayaran
        await tx.execute(sql`DELETE FROM pembayaran WHERE id_barbershop = ${id_barbershop}`);

        // C. Komisi Transaksi
        await tx.execute(sql`DELETE FROM komisi_transaksi WHERE id_barbershop = ${id_barbershop}`);

        // D. Pembatalan
        await tx.execute(sql`
          DELETE FROM pembatalan WHERE id_transaksi IN (
            SELECT id_transaksi FROM transaksi WHERE id_barbershop = ${id_barbershop}
          )
        `);

        // E. Transaksi
        await tx.execute(sql`DELETE FROM transaksi WHERE id_barbershop = ${id_barbershop}`);

        // F. Detail Booking
        await tx.execute(sql`
          DELETE FROM detail_booking 
          WHERE id_barbershop = ${id_barbershop} 
             OR id_layanan IN (SELECT id_layanan FROM layanan WHERE id_barbershop = ${id_barbershop})
             OR id_booking IN (SELECT id_booking FROM booking WHERE id_barbershop = ${id_barbershop})
        `);

        // G. Booking
        await tx.execute(sql`DELETE FROM booking WHERE id_barbershop = ${id_barbershop}`);

        // H. Komisi (Pembayaran & Pengajuan)
        await tx.execute(sql`DELETE FROM pembayaran_komisi WHERE id_barbershop = ${id_barbershop}`);
        await tx.execute(sql`DELETE FROM pengajuan_komisi WHERE id_barbershop = ${id_barbershop}`);

        // I. Shift Capster
        await tx.execute(sql`DELETE FROM shift_capster WHERE id_barbershop = ${id_barbershop}`);

        // J. Capster
        await tx.execute(sql`DELETE FROM capster WHERE id_barbershop = ${id_barbershop}`);

        // K. Pelanggan
        await tx.execute(sql`DELETE FROM pelanggan WHERE id_barbershop = ${id_barbershop}`);

        // L. Layanan
        await tx.execute(sql`DELETE FROM layanan WHERE id_barbershop = ${id_barbershop}`);

        // M. Auxiliary Tables
        if (ownerUserId) {
          await tx.execute(
            sql`DELETE FROM audit_log WHERE id_barbershop = ${id_barbershop} OR id_user = ${ownerUserId}`,
          );
          await tx.execute(
            sql`DELETE FROM notifikasi WHERE id_barbershop = ${id_barbershop} OR id_user = ${ownerUserId}`,
          );
          await tx.execute(
            sql`DELETE FROM branding_histories WHERE changed_by = ${ownerUserId} OR id_branding IN (SELECT id_branding FROM barbershop_brandings WHERE id_barbershop = ${id_barbershop})`,
          );
        } else {
          await tx.execute(sql`DELETE FROM audit_log WHERE id_barbershop = ${id_barbershop}`);
          await tx.execute(sql`DELETE FROM notifikasi WHERE id_barbershop = ${id_barbershop}`);
          await tx.execute(
            sql`DELETE FROM branding_histories WHERE id_branding IN (SELECT id_branding FROM barbershop_brandings WHERE id_barbershop = ${id_barbershop})`,
          );
        }
        await tx.execute(
          sql`DELETE FROM barbershop_brandings WHERE id_barbershop = ${id_barbershop}`,
        );
        await tx.execute(sql`
          DELETE FROM domain_verification_logs WHERE id_domain IN (
            SELECT id_domain FROM custom_domains WHERE id_barbershop = ${id_barbershop}
          )
        `);
        await tx.execute(sql`DELETE FROM custom_domains WHERE id_barbershop = ${id_barbershop}`);
        await tx.execute(
          sql`DELETE FROM subscription_histories WHERE id_barbershop = ${id_barbershop}`,
        );
        await tx.execute(
          sql`DELETE FROM subscription_usage WHERE id_barbershop = ${id_barbershop}`,
        );
        await tx.execute(
          sql`DELETE FROM subscription_payment WHERE id_barbershop = ${id_barbershop}`,
        );
        await tx.execute(
          sql`DELETE FROM subscription_redemptions WHERE id_barbershop = ${id_barbershop}`,
        );
        await tx.execute(sql`DELETE FROM saldo_bisnis WHERE id_barbershop = ${id_barbershop}`);
        await tx.execute(
          sql`DELETE FROM pemeriksaan_keuangan WHERE id_barbershop = ${id_barbershop}`,
        );
        if (saasOwnerId) {
          await tx.execute(sql`DELETE FROM demo_request WHERE owner_id = ${saasOwnerId}`);
        }

        // N. Subscription & Business
        if (saasOwnerId) {
          const bizList = await tx
            .select({ business_id: business.business_id })
            .from(business)
            .where(
              or(eq(business.owner_id, saasOwnerId), eq(business.id_barbershop, id_barbershop)),
            );
          for (const b of bizList) {
            await tx.execute(sql`DELETE FROM subscription WHERE business_id = ${b.business_id}`);
          }
          await tx
            .delete(business)
            .where(
              or(eq(business.owner_id, saasOwnerId), eq(business.id_barbershop, id_barbershop)),
            );
        } else {
          const bizList = await tx
            .select({ business_id: business.business_id })
            .from(business)
            .where(eq(business.id_barbershop, id_barbershop));
          for (const b of bizList) {
            await tx.execute(sql`DELETE FROM subscription WHERE business_id = ${b.business_id}`);
          }
          await tx.delete(business).where(eq(business.id_barbershop, id_barbershop));
        }

        // O. Owner Verification Tokens
        if (ownerUserId) {
          await tx.execute(
            sql`DELETE FROM owner_verification_tokens WHERE id_user = ${ownerUserId}`,
          );
        }

        // P. Users
        await tx.execute(
          sql`DELETE FROM users WHERE id_barbershop = ${id_barbershop} ${ownerUserId ? sql`OR id_user = ${ownerUserId}` : sql``}`,
        );

        // Q. Barbershop
        await tx.execute(sql`DELETE FROM barbershop WHERE id_barbershop = ${id_barbershop}`);

        // R. Owner
        if (saasOwnerId) {
          await tx.execute(sql`DELETE FROM owner WHERE owner_id = ${saasOwnerId}`);
        } else if (ownerEmail) {
          await tx.execute(sql`DELETE FROM owner WHERE email = ${ownerEmail}`);
        }

        // S. auth.users in Supabase Auth
        if (userIdsToDelete.length > 0) {
          await tx.execute(sql`
            DELETE FROM auth.users 
            WHERE id IN ${sql`(${sql.join(
              userIdsToDelete.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`}
          `);
        }
        if (ownerEmail) {
          await tx.execute(sql`DELETE FROM auth.users WHERE email = ${ownerEmail}`);
        }

        // T. Catat Superadmin Audit Log
        await tx.insert(superadminAuditLogs).values({
          action: "DELETE_TENANT",
          actor_email,
          target_tenant_id: id_barbershop,
          target_tenant_name: existingShop.nama_barbershop,
          details: `Toko '${existingShop.nama_barbershop}' (slug: '${existingShop.slug}') dan akun Owner '${ownerEmail || "-"}' beserta seluruh data operasional, transaksi, capster, dan pelanggan berhasil dihapus secara permanen.`,
        });
      });

      return {
        success: true,
        message: "Akun Owner dan seluruh data barbershop berhasil dihapus secara permanen.",
      };
    } catch (err: any) {
      console.error("❌ DB Transaction rollback pada penghapusan toko:", err);
      throw new Error(
        "Gagal menghapus akun Owner. Tidak ada perubahan yang dianggap berhasil sampai proses deletion selesai.",
      );
    }
  });

// ============================================================================
// 8. LOG AUDIT AKTIVITAS SUPERADMIN
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
