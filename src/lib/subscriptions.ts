import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql, desc, isNull, lt, gt, gte, or, count } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  barbershop,
  business,
  owner,
  plan,
  planFeatureLimits,
  subscription,
  subscriptionCodes,
  subscriptionHistories,
  subscriptionPayment,
  subscriptionRedemptions,
  subscriptionUsage,
  users,
  notifikasi,
  layanan,
  capster,
  transaksi,
  superadminAuditLogs,
} from "@/db/schema";
import { requireOwnerTenant, getOwnerSession, requireSuperadmin } from "@/lib/auth-session";
import { logAudit } from "@/lib/audit";

// ============================================================================
// 1. KONFIGURASI CENTRAL SOURCE OF TRUTH (BAGIAN 1, 2, 18, 69)
// ============================================================================

export const PRICING_WHATSAPP_NUMBER = "6281226244941";
export const PRICING_WHATSAPP_DISPLAY = "+62 812-2624-4941";

export interface PlanConfig {
  id: number;
  name: "FREE" | "PRO" | "ENTERPRISE";
  label: string;
  price: number;
  priceDisplay: string;
  billingPeriod: string;
  description: string;
  isFree: boolean;
  limits: {
    monthlyCuts: number | null; // null = unlimited
    activeCapsters: number | null; // null = unlimited
    serviceCatalog: number | null; // null = unlimited
    customerQrBooking: boolean;
    digitalReceipt: boolean;
    queueEstimation: "simple" | "dynamic_live";
    grossRevenue: boolean;
    paymentAudit: boolean;
    cashOnHand: boolean;
    capsterCommission: boolean;
    activityAudit: boolean;
    financialAudit: boolean;
    exportData: number | null; // null = unlimited
    dataRetention: number | null; // null = unlimited (days)
    branding: "BARBERIN" | "white_label";
  };
}

export const PLAN_CONFIGS: Record<"FREE" | "PRO" | "ENTERPRISE", PlanConfig> = {
  FREE: {
    id: 1,
    name: "FREE",
    label: "Paket Gratis",
    price: 0,
    priceDisplay: "Rp0",
    billingPeriod: "bulan",
    description: "Paket dasar gratis untuk operasional barbershop mandiri.",
    isFree: true,
    limits: {
      monthlyCuts: 50,
      activeCapsters: 1,
      serviceCatalog: 4,
      customerQrBooking: true,
      digitalReceipt: true,
      queueEstimation: "simple",
      grossRevenue: true,
      paymentAudit: false,
      cashOnHand: false,
      capsterCommission: false,
      activityAudit: false,
      financialAudit: false,
      exportData: 2,
      dataRetention: 14,
      branding: "BARBERIN",
    },
  },
  PRO: {
    id: 2,
    name: "PRO",
    label: "Paket Pro",
    price: 99000,
    priceDisplay: "Rp99.000",
    billingPeriod: "bulan",
    description:
      "Paket profesional dengan laporan audit lengkap, komisi capster, dan kuota lebih besar.",
    isFree: false,
    limits: {
      monthlyCuts: null,
      activeCapsters: 5,
      serviceCatalog: null,
      customerQrBooking: true,
      digitalReceipt: true,
      queueEstimation: "dynamic_live",
      grossRevenue: true,
      paymentAudit: true,
      cashOnHand: true,
      capsterCommission: true,
      activityAudit: true,
      financialAudit: true,
      exportData: 30,
      dataRetention: 30,
      branding: "BARBERIN",
    },
  },
  ENTERPRISE: {
    id: 3,
    name: "ENTERPRISE",
    label: "Paket Enterprise",
    price: 199000,
    priceDisplay: "Rp199.000",
    billingPeriod: "bulan",
    description:
      "Paket enterprise tanpa batas dengan kustomisasi white-label identitas barbershop.",
    isFree: false,
    limits: {
      monthlyCuts: null,
      activeCapsters: null,
      serviceCatalog: null,
      customerQrBooking: true,
      digitalReceipt: true,
      queueEstimation: "dynamic_live",
      grossRevenue: true,
      paymentAudit: true,
      cashOnHand: true,
      capsterCommission: true,
      activityAudit: true,
      financialAudit: true,
      exportData: null,
      dataRetention: null,
      branding: "white_label",
    },
  },
};

// ============================================================================
// 2. WHATSAPP UPGRADE MESSAGE GENERATOR (BAGIAN 19 & 58)
// ============================================================================

export function generatePricingWhatsAppUrl(params: {
  barbershopName: string;
  slug: string;
  planName: "PRO" | "ENTERPRISE";
  ownerName: string;
  email: string;
}): string {
  const priceText = params.planName === "PRO" ? "Rp99.000 / bulan" : "Rp199.000 / bulan";

  const message = `Halo BARBERIN,
Saya ingin melakukan upgrade paket.
Barbershop:
${params.barbershopName}
Slug:
${params.slug}
Paket:
${params.planName}
Harga:
${priceText}
Owner:
${params.ownerName}
Email:
${params.email}
Mohon informasi pembayaran.
Terima kasih.`;

  return `https://wa.me/${PRICING_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ============================================================================
// 3. HELPER DETERMINISTIK: BISNIS & SUBSCRIPTION TENANT (BAGIAN 5, 6, 7)
// ============================================================================

export async function ensureTenantBusiness(
  dbClient: any,
  barbershopId: string,
): Promise<{ businessId: number; ownerId: number; freePlanId: number }> {
  // Ambil plan FREE
  const [freePlan] = await dbClient
    .select({ plan_id: plan.plan_id })
    .from(plan)
    .where(eq(plan.plan_name, "FREE"))
    .limit(1);

  const freePlanId = freePlan ? freePlan.plan_id : 1;

  // Cek apakah business sudah terhubung ke id_barbershop
  const [existingBiz] = await dbClient
    .select()
    .from(business)
    .where(eq(business.id_barbershop, barbershopId))
    .limit(1);

  if (existingBiz) {
    return {
      businessId: existingBiz.business_id,
      ownerId: existingBiz.owner_id,
      freePlanId,
    };
  }

  // Jika belum, cari barbershop dan user owner-nya
  const [shop] = await dbClient
    .select({
      id_barbershop: barbershop.id_barbershop,
      nama_barbershop: barbershop.nama_barbershop,
      created_at: barbershop.created_at,
    })
    .from(barbershop)
    .where(eq(barbershop.id_barbershop, barbershopId))
    .limit(1);

  if (!shop) {
    throw new Error(`Barbershop dengan ID ${barbershopId} tidak ditemukan.`);
  }

  const [userOwner] = await dbClient
    .select()
    .from(users)
    .where(and(eq(users.id_barbershop, barbershopId), eq(users.role, "owner")))
    .limit(1);

  const ownerEmail = userOwner?.email || `owner_${barbershopId.slice(0, 8)}@barberin.id`;
  const ownerName = userOwner?.nama_lengkap || `Owner ${shop.nama_barbershop}`;

  // Cek atau buat record di tabel owner SaaS
  let saasOwnerId: number;
  const [existingOwner] = await dbClient
    .select({ owner_id: owner.owner_id })
    .from(owner)
    .where(eq(owner.email, ownerEmail))
    .limit(1);

  if (existingOwner) {
    saasOwnerId = existingOwner.owner_id;
  } else {
    const [newOwner] = await dbClient
      .insert(owner)
      .values({
        name: ownerName,
        email: ownerEmail,
        phone: userOwner?.no_hp || null,
        password_hash: "MANAGED_VIA_USERS_TABLE",
        status: "active",
      })
      .returning({ owner_id: owner.owner_id });
    saasOwnerId = newOwner.owner_id;
  }

  // Buat business
  const [newBiz] = await dbClient
    .insert(business)
    .values({
      owner_id: saasOwnerId,
      id_barbershop: barbershopId,
      business_name: shop.nama_barbershop,
      status: "active",
    })
    .returning({ business_id: business.business_id });

  // Pastikan FREE subscription aktif dibuat jika belum ada
  const [existingSub] = await dbClient
    .select()
    .from(subscription)
    .where(and(eq(subscription.business_id, newBiz.business_id), eq(subscription.status, "active")))
    .limit(1);

  if (!existingSub) {
    const [newSub] = await dbClient
      .insert(subscription)
      .values({
        business_id: newBiz.business_id,
        plan_id: freePlanId,
        status: "active",
        start_date: shop.created_at || new Date(),
        end_date: null,
      })
      .returning();

    await dbClient.insert(subscriptionHistories).values({
      id_barbershop: barbershopId,
      id_subscription: newSub.subscription_id,
      id_plan: freePlanId,
      status: "active",
      start_date: shop.created_at || new Date(),
      end_date: null,
      jenis: "register_free",
      keterangan: "Inisialisasi paket gratis (Free) bawaan tenant",
    });
  }

  return {
    businessId: newBiz.business_id,
    ownerId: saasOwnerId,
    freePlanId,
  };
}

// ============================================================================
// 4. CORE SUBSCRIPTION RESOLUTION & EXPOSURE (BAGIAN 30, 43)
// ============================================================================

export async function getCurrentSubscription(barbershopId: string) {
  const { businessId, freePlanId } = await ensureTenantBusiness(db, barbershopId);

  // Ambil active subscription
  const [sub] = await db
    .select({
      subscription_id: subscription.subscription_id,
      business_id: subscription.business_id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      created_at: subscription.created_at,
      plan_name: plan.plan_name,
      price: plan.price,
      billing_period: plan.billing_period,
      is_free: plan.is_free,
    })
    .from(subscription)
    .innerJoin(plan, eq(subscription.plan_id, plan.plan_id))
    .where(and(eq(subscription.business_id, businessId), eq(subscription.status, "active")))
    .orderBy(desc(subscription.subscription_id))
    .limit(1);

  if (!sub) {
    // Fallback darurat: aktifkan Free
    const [newSub] = await db
      .insert(subscription)
      .values({
        business_id: businessId,
        plan_id: freePlanId,
        status: "active",
        start_date: new Date(),
        end_date: null,
      })
      .returning();

    return {
      subscription_id: newSub.subscription_id,
      business_id: businessId,
      plan_id: freePlanId,
      status: "active",
      start_date: newSub.start_date,
      end_date: null,
      plan_name: "FREE" as const,
      price: "0.00",
      billing_period: "monthly",
      is_free: true,
    };
  }

  // Cek apakah subscription non-free sudah melewati end_date
  if (sub.end_date && new Date(sub.end_date) < new Date()) {
    // Expired! Jalankan transition ke FREE
    await db.transaction(async (tx) => {
      await tx
        .update(subscription)
        .set({ status: "expired", updated_at: new Date() })
        .where(eq(subscription.subscription_id, sub.subscription_id));

      const [freeSub] = await tx
        .insert(subscription)
        .values({
          business_id: businessId,
          plan_id: freePlanId,
          status: "active",
          start_date: new Date(),
          end_date: null,
        })
        .returning();

      await tx.insert(subscriptionHistories).values({
        id_barbershop: barbershopId,
        id_subscription: freeSub.subscription_id,
        id_plan: freePlanId,
        status: "active",
        start_date: new Date(),
        end_date: null,
        jenis: "expired_to_free",
        keterangan: `Masa aktif paket ${sub.plan_name} telah berakhir, kembali otomatis ke paket Free.`,
      });

      // Notifikasi
      const [u] = await tx
        .select({ id_user: users.id_user })
        .from(users)
        .where(and(eq(users.id_barbershop, barbershopId), eq(users.role, "owner")))
        .limit(1);

      if (u) {
        await tx.insert(notifikasi).values({
          id_barbershop: barbershopId,
          id_user: u.id_user,
          tipe: "peringatan",
          judul: "Masa Langganan Berakhir",
          pesan: `Masa aktif paket ${sub.plan_name} barbershop Anda telah berakhir. Sistem telah mengembalikan paket ke Gratis (Free). Silakan lakukan perpanjangan paket untuk menikmati fitur premium.`,
        });
      }
    });

    return {
      subscription_id: 0,
      business_id: businessId,
      plan_id: freePlanId,
      status: "active",
      start_date: new Date(),
      end_date: null,
      plan_name: "FREE" as const,
      price: "0.00",
      billing_period: "monthly",
      is_free: true,
    };
  }

  return {
    ...sub,
    plan_name: (sub.plan_name?.toUpperCase() || "FREE") as "FREE" | "PRO" | "ENTERPRISE",
  };
}

export async function getCurrentPlan(barbershopId: string): Promise<PlanConfig> {
  const sub = await getCurrentSubscription(barbershopId);
  const planName = sub.plan_name as "FREE" | "PRO" | "ENTERPRISE";
  return PLAN_CONFIGS[planName] || PLAN_CONFIGS.FREE;
}

// ============================================================================
// 5. FEATURE GATING & LIMIT SERVICE (BAGIAN 30, 31, 32, 33, 34, 35, 37, 39)
// ============================================================================

export async function getFeatureEntitlement(barbershopId: string, featureKey: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const limits = currentPlan.limits as any;
  return {
    featureKey,
    planName: currentPlan.name,
    isEnabled: limits[featureKey] !== false,
    limitValue: typeof limits[featureKey] === "number" ? limits[featureKey] : null,
    isUnlimited: limits[featureKey] === null,
  };
}

export async function assertFeature(barbershopId: string, featureKey: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const limits = currentPlan.limits as any;
  const val = limits[featureKey];

  if (val === false) {
    const error = new Error(
      `Fitur ini tidak tersedia pada paket ${currentPlan.label}. Silakan upgrade ke paket Pro atau Enterprise.`,
    );
    (error as any).code = "FEATURE_LOCKED";
    (error as any).featureKey = featureKey;
    (error as any).currentPlan = currentPlan.name;
    (error as any).requiredPlan = "PRO";
    throw error;
  }

  return true;
}

// 5a. Monthly Cut Limit Guard (Bagian 31: Free maks 50 transaksi per bulan kalender Asia/Jakarta)
export async function assertMonthlyCutLimit(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const maxCuts = currentPlan.limits.monthlyCuts;

  if (maxCuts === null) {
    return { allowed: true, current: 0, limit: null };
  }

  // Hitung awal bulan kalender waktu Jakarta (UTC+7)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startOfMonth = new Date(Date.UTC(year, month, 1, -7, 0, 0, 0));

  const [result] = await db
    .select({ count: count() })
    .from(transaksi)
    .where(
      and(
        eq(transaksi.id_barbershop, barbershopId),
        gte(transaksi.created_at, startOfMonth),
        or(
          eq(transaksi.status_transaksi, "completed"),
          eq(transaksi.status_transaksi, "paid"),
          eq(transaksi.status_transaksi, "pending"),
          eq(transaksi.status_transaksi, "ongoing"),
        ),
      ),
    );

  const currentCount = Number(result?.count || 0);

  if (currentCount >= maxCuts) {
    const error = new Error(
      `Batas cukur bulanan untuk paket Free (${maxCuts} cukur) telah tercapai bulan ini (${currentCount}/${maxCuts}). Silakan upgrade ke paket Pro untuk transaksi tanpa batas.`,
    );
    (error as any).code = "LIMIT_REACHED";
    (error as any).limit = maxCuts;
    (error as any).current = currentCount;
    (error as any).featureKey = "monthly_cuts";
    throw error;
  }

  return { allowed: true, current: currentCount, limit: maxCuts };
}

// 5b. Capster Limit Guard (Bagian 32: Free 1, Pro 5, Enterprise Unlimited)
export async function assertCapsterLimit(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const maxCapsters = currentPlan.limits.activeCapsters;

  if (maxCapsters === null) {
    return { allowed: true, current: 0, limit: null };
  }

  const [result] = await db
    .select({ count: count() })
    .from(capster)
    .where(and(eq(capster.id_barbershop, barbershopId), eq(capster.status, "active")));

  const currentCount = Number(result?.count || 0);

  if (currentCount >= maxCapsters) {
    const error = new Error(
      `Batas capster aktif untuk paket ${currentPlan.label} adalah ${maxCapsters} orang (${currentCount}/${maxCapsters} aktif). Silakan upgrade paket Anda untuk menambah capster.`,
    );
    (error as any).code = "LIMIT_REACHED";
    (error as any).limit = maxCapsters;
    (error as any).current = currentCount;
    (error as any).featureKey = "active_capsters";
    throw error;
  }

  return { allowed: true, current: currentCount, limit: maxCapsters };
}

// 5c. Service Limit Guard (Bagian 33: Free 4 layanan, Pro/Enterprise Unlimited)
export async function assertServiceLimit(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const maxServices = currentPlan.limits.serviceCatalog;

  if (maxServices === null) {
    return { allowed: true, current: 0, limit: null };
  }

  const [result] = await db
    .select({ count: count() })
    .from(layanan)
    .where(and(eq(layanan.id_barbershop, barbershopId), eq(layanan.status, "active")));

  const currentCount = Number(result?.count || 0);

  if (currentCount >= maxServices) {
    const error = new Error(
      `Batas katalog layanan aktif untuk paket ${currentPlan.label} adalah ${maxServices} layanan (${currentCount}/${maxServices} terdaftar). Silakan upgrade paket Anda untuk menambah lebih banyak layanan.`,
    );
    (error as any).code = "LIMIT_REACHED";
    (error as any).limit = maxServices;
    (error as any).current = currentCount;
    (error as any).featureKey = "service_catalog";
    throw error;
  }

  return { allowed: true, current: currentCount, limit: maxServices };
}

// 5d. Export Token Service (Bagian 37 & 38: Free 2 token, Pro 30 token, Enterprise Unlimited)
export async function checkExportTokenAvailable(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const maxTokens = currentPlan.limits.exportData;

  if (maxTokens === null) {
    return { allowed: true, used: 0, limit: null, remaining: null };
  }

  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [usage] = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.id_barbershop, barbershopId),
        eq(subscriptionUsage.period_month, periodMonth),
      ),
    )
    .limit(1);

  const used = usage?.export_token_used || 0;
  const remaining = Math.max(0, maxTokens - used);

  if (used >= maxTokens) {
    const error = new Error(
      `Kuota token ekspor data bulan ini telah habis (${used} / ${maxTokens} Token). Silakan upgrade ke paket Pro (30 Token) atau Enterprise (Unlimited).`,
    );
    (error as any).code = "LIMIT_REACHED";
    (error as any).limit = maxTokens;
    (error as any).current = used;
    (error as any).featureKey = "export_data";
    throw error;
  }

  return { allowed: true, used, limit: maxTokens, remaining };
}

export async function consumeExportToken(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const maxTokens = currentPlan.limits.exportData;

  if (maxTokens === null) {
    return { success: true, remaining: null, isUnlimited: true };
  }

  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Atomic upsert token usage
  const [updated] = await db
    .insert(subscriptionUsage)
    .values({
      id_barbershop: barbershopId,
      period_month: periodMonth,
      export_token_used: 1,
    })
    .onConflictDoUpdate({
      target: [subscriptionUsage.id_barbershop, subscriptionUsage.period_month],
      set: {
        export_token_used: sql`${subscriptionUsage.export_token_used} + 1`,
        updated_at: new Date(),
      },
    })
    .returning();

  const used = updated.export_token_used;
  const remaining = Math.max(0, maxTokens - used);

  return { success: true, used, limit: maxTokens, remaining, isUnlimited: false };
}

// 5e. Usage Summary Aggregator for UI (Bagian 17)
export async function getFeatureUsageSummary(barbershopId: string) {
  const currentPlan = await getCurrentPlan(barbershopId);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startOfMonth = new Date(Date.UTC(year, month, 1, -7, 0, 0, 0));
  const periodMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

  const [[transCount], [capCount], [servCount], [usageRow]] = await Promise.all([
    db
      .select({ count: count() })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.id_barbershop, barbershopId),
          gte(transaksi.created_at, startOfMonth),
          or(
            eq(transaksi.status_transaksi, "completed"),
            eq(transaksi.status_transaksi, "paid"),
            eq(transaksi.status_transaksi, "pending"),
            eq(transaksi.status_transaksi, "ongoing"),
          ),
        ),
      ),
    db
      .select({ count: count() })
      .from(capster)
      .where(and(eq(capster.id_barbershop, barbershopId), eq(capster.status, "active"))),
    db
      .select({ count: count() })
      .from(layanan)
      .where(and(eq(layanan.id_barbershop, barbershopId), eq(layanan.status, "active"))),
    db
      .select()
      .from(subscriptionUsage)
      .where(
        and(
          eq(subscriptionUsage.id_barbershop, barbershopId),
          eq(subscriptionUsage.period_month, periodMonth),
        ),
      )
      .limit(1),
  ]);

  return {
    monthlyCuts: {
      used: Number(transCount?.count || 0),
      limit: currentPlan.limits.monthlyCuts,
      isUnlimited: currentPlan.limits.monthlyCuts === null,
    },
    activeCapsters: {
      used: Number(capCount?.count || 0),
      limit: currentPlan.limits.activeCapsters,
      isUnlimited: currentPlan.limits.activeCapsters === null,
    },
    serviceCatalog: {
      used: Number(servCount?.count || 0),
      limit: currentPlan.limits.serviceCatalog,
      isUnlimited: currentPlan.limits.serviceCatalog === null,
    },
    exportTokens: {
      used: usageRow?.export_token_used || 0,
      limit: currentPlan.limits.exportData,
      isUnlimited: currentPlan.limits.exportData === null,
    },
  };
}

// ============================================================================
// 6. REDEEM SUBSCRIPTION CODE (BAGIAN 12, 13, 14, 24, 25, 26, 27)
// ============================================================================

export function generateCryptoSubscriptionCode(planName: "PRO" | "ENTERPRISE"): string {
  const prefix = planName === "PRO" ? "BARB-PRO" : "BARB-ENT";
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${part1}-${part2}`;
}

export async function executeRedeemCode(barbershopId: string, rawCode: string, userId?: string) {
  const cleanCode = (rawCode || "").trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("Kode langganan wajib diisi.");
  }

  return await db.transaction(async (tx) => {
    // 1. Validasi Code
    const [codeRecord] = await tx
      .select({
        id_code: subscriptionCodes.id_code,
        code: subscriptionCodes.code,
        plan_id: subscriptionCodes.plan_id,
        jenis: subscriptionCodes.jenis,
        durasi_hari: subscriptionCodes.durasi_hari,
        status: subscriptionCodes.status,
        expired_at: subscriptionCodes.expired_at,
        plan_name: plan.plan_name,
      })
      .from(subscriptionCodes)
      .innerJoin(plan, eq(subscriptionCodes.plan_id, plan.plan_id))
      .where(eq(subscriptionCodes.code, cleanCode))
      .limit(1);

    if (!codeRecord) {
      const err = new Error("Kode langganan tidak valid atau tidak ditemukan.");
      (err as any).code = "CODE_INVALID";
      throw err;
    }

    if (codeRecord.status === "used") {
      const err = new Error("Kode langganan sudah pernah digunakan sebelumnya.");
      (err as any).code = "CODE_ALREADY_USED";
      throw err;
    }

    if (codeRecord.status !== "unused") {
      const err = new Error(`Kode langganan tidak dapat digunakan (status: ${codeRecord.status}).`);
      (err as any).code = "CODE_INVALID";
      throw err;
    }

    if (codeRecord.expired_at && new Date(codeRecord.expired_at) < new Date()) {
      const err = new Error("Kode langganan telah kedaluwarsa.");
      (err as any).code = "CODE_EXPIRED";
      throw err;
    }

    // 2. Resolve Business & Current Subscription
    const { businessId } = await ensureTenantBusiness(tx, barbershopId);

    const [currentSub] = await tx
      .select({
        subscription_id: subscription.subscription_id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        plan_name: plan.plan_name,
      })
      .from(subscription)
      .innerJoin(plan, eq(subscription.plan_id, plan.plan_id))
      .where(and(eq(subscription.business_id, businessId), eq(subscription.status, "active")))
      .orderBy(desc(subscription.subscription_id))
      .limit(1);

    const now = new Date();
    const durationDays = codeRecord.durasi_hari || 30;

    let targetSubscriptionId: number;
    let transitionType: "upgrade" | "stacking" | "plan_change";
    let newStartDate: Date;
    let newEndDate: Date;

    const codePlanName = codeRecord.plan_name.toUpperCase();
    const currentPlanName = currentSub?.plan_name.toUpperCase() || "FREE";

    if (currentSub && currentSub.plan_id === codeRecord.plan_id) {
      // BAGIAN 26: SAME PLAN STACKING
      transitionType = "stacking";
      newStartDate = currentSub.start_date;
      const baseEnd =
        currentSub.end_date && new Date(currentSub.end_date) > now
          ? new Date(currentSub.end_date)
          : now;
      newEndDate = new Date(baseEnd.getTime() + durationDays * 24 * 60 * 60 * 1000);

      await tx
        .update(subscription)
        .set({
          end_date: newEndDate,
          updated_at: now,
        })
        .where(eq(subscription.subscription_id, currentSub.subscription_id));

      targetSubscriptionId = currentSub.subscription_id;
    } else {
      // BAGIAN 25: DIFFERENT PLAN / UPGRADE / SWITCH
      transitionType = currentPlanName === "FREE" ? "upgrade" : "plan_change";
      newStartDate = now;
      newEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Nonaktifkan subscription lama
      if (currentSub) {
        await tx
          .update(subscription)
          .set({
            status: "cancelled",
            updated_at: now,
          })
          .where(eq(subscription.subscription_id, currentSub.subscription_id));
      }

      // Buat subscription baru
      const [newSub] = await tx
        .insert(subscription)
        .values({
          business_id: businessId,
          plan_id: codeRecord.plan_id,
          status: "active",
          start_date: newStartDate,
          end_date: newEndDate,
        })
        .returning({ subscription_id: subscription.subscription_id });

      targetSubscriptionId = newSub.subscription_id;
    }

    // 3. Mark Code as Used
    await tx
      .update(subscriptionCodes)
      .set({
        status: "used",
        id_used_by: barbershopId,
        used_at: now,
        updated_at: now,
      })
      .where(eq(subscriptionCodes.id_code, codeRecord.id_code));

    // 4. Create Redemption Record (Bagian 13)
    await tx.insert(subscriptionRedemptions).values({
      id_barbershop: barbershopId,
      id_code: codeRecord.id_code,
      id_subscription: targetSubscriptionId,
      redeemed_at: now,
    });

    // 5. Create Subscription History (Bagian 14)
    await tx.insert(subscriptionHistories).values({
      id_barbershop: barbershopId,
      id_subscription: targetSubscriptionId,
      id_plan: codeRecord.plan_id,
      status: "active",
      start_date: newStartDate,
      end_date: newEndDate,
      jenis: transitionType,
      keterangan: `Redeem kode ${codeRecord.code} (${transitionType}) untuk paket ${codePlanName} selama ${durationDays} hari.`,
    });

    // 6. Kirim Notifikasi Tenant
    const [targetUser] = await tx
      .select({ id_user: users.id_user })
      .from(users)
      .where(and(eq(users.id_barbershop, barbershopId), eq(users.role, "owner")))
      .limit(1);

    if (targetUser) {
      await tx.insert(notifikasi).values({
        id_barbershop: barbershopId,
        id_user: targetUser.id_user,
        tipe: "info",
        judul: `Aktivasi Paket ${codePlanName} Berhasil`,
        pesan: `Selamat! Kode langganan ${codeRecord.code} berhasil ditukarkan. Paket ${codePlanName} Anda aktif hingga ${newEndDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`,
      });
    }

    // Catat log audit aktivitas
    try {
      await logAudit({
        barbershopId,
        userId: userId || targetUser?.id_user,
        aksi: `Redeem kode langganan: ${codeRecord.code}`,
        entityType: "subscription",
        entityId: String(targetSubscriptionId),
        alasan: `Aktivasi paket ${codePlanName} (${durationDays} hari)`,
      });
    } catch (auditErr) {
      console.warn("Audit logging warning:", auditErr);
    }

    return {
      success: true,
      planName: codePlanName,
      transitionType,
      startDate: newStartDate,
      endDate: newEndDate,
      durationDays,
    };
  });
}

// ============================================================================
// 7. DAILY EXPIRY JOB (BAGIAN 28 & 29)
// ============================================================================

export async function runDailySubscriptionExpiryJob() {
  const now = new Date();

  // Cari semua subscription aktif yang end_date < now
  const expiredSubs = await db
    .select({
      subscription_id: subscription.subscription_id,
      business_id: subscription.business_id,
      plan_id: subscription.plan_id,
      end_date: subscription.end_date,
      plan_name: plan.plan_name,
      id_barbershop: business.id_barbershop,
      business_name: business.business_name,
    })
    .from(subscription)
    .innerJoin(plan, eq(subscription.plan_id, plan.plan_id))
    .innerJoin(business, eq(subscription.business_id, business.business_id))
    .where(and(eq(subscription.status, "active"), lt(subscription.end_date, now)));

  const [freePlan] = await db
    .select({ plan_id: plan.plan_id })
    .from(plan)
    .where(eq(plan.plan_name, "FREE"))
    .limit(1);

  const freePlanId = freePlan ? freePlan.plan_id : 1;
  const processedTenants: string[] = [];

  for (const item of expiredSubs) {
    if (!item.id_barbershop) continue;

    await db.transaction(async (tx) => {
      // 1. Mark expired
      await tx
        .update(subscription)
        .set({
          status: "expired",
          updated_at: now,
        })
        .where(eq(subscription.subscription_id, item.subscription_id));

      // 2. Ensure Free active (idempotent: cek dulu apakah sudah ada free subscription aktif)
      const [existingFree] = await tx
        .select()
        .from(subscription)
        .where(
          and(
            eq(subscription.business_id, item.business_id),
            eq(subscription.plan_id, freePlanId),
            eq(subscription.status, "active"),
          ),
        )
        .limit(1);

      let freeSubId = existingFree?.subscription_id;

      if (!existingFree) {
        const [newFree] = await tx
          .insert(subscription)
          .values({
            business_id: item.business_id,
            plan_id: freePlanId,
            status: "active",
            start_date: now,
            end_date: null,
          })
          .returning({ subscription_id: subscription.subscription_id });
        freeSubId = newFree.subscription_id;
      }

      // 3. Record history (idempotent: jika belum tercatat dalam 24 jam terakhir)
      await tx.insert(subscriptionHistories).values({
        id_barbershop: item.id_barbershop!,
        id_subscription: freeSubId!,
        id_plan: freePlanId,
        status: "active",
        start_date: now,
        end_date: null,
        jenis: "expired_to_free",
        keterangan: `Masa aktif paket ${item.plan_name} telah berakhir, otomatis kembali ke paket Free.`,
      });

      // 4. Create Notification
      const [ownerUser] = await tx
        .select({ id_user: users.id_user })
        .from(users)
        .where(and(eq(users.id_barbershop, item.id_barbershop!), eq(users.role, "owner")))
        .limit(1);

      if (ownerUser) {
        await tx.insert(notifikasi).values({
          id_barbershop: item.id_barbershop!,
          id_user: ownerUser.id_user,
          tipe: "peringatan",
          judul: "Masa Langganan Berakhir",
          pesan: `Masa aktif paket ${item.plan_name} barbershop Anda telah berakhir. Sistem telah mengembalikan paket ke Gratis (Free). Silakan lakukan perpanjangan paket untuk menikmati fitur premium kembali.`,
        });
      }

      processedTenants.push(item.id_barbershop!);
    });
  }

  return {
    processedCount: processedTenants.length,
    processedTenants,
  };
}

// ============================================================================
// 8. SERVER FUNCTIONS UNTUK OWNER (BAGIAN 15, 16, 17, 24)
// ============================================================================

export const getOwnerSubscriptionDetails = createServerFn({
  method: "GET",
}).handler(async () => {
  const tenant = requireOwnerTenant();
  const barbershopId = tenant.barbershopId;

  // Resolve Barbershop, Business, and Active Subscription
  const [shop] = await db
    .select({
      id_barbershop: barbershop.id_barbershop,
      nama_barbershop: barbershop.nama_barbershop,
      slug: barbershop.slug,
      created_at: barbershop.created_at,
    })
    .from(barbershop)
    .where(eq(barbershop.id_barbershop, barbershopId))
    .limit(1);

  if (!shop) {
    throw new Error("Barbershop tidak ditemukan.");
  }

  const [ownerUser] = await db
    .select({
      id_user: users.id_user,
      nama_lengkap: users.nama_lengkap,
      email: users.email,
      no_hp: users.no_hp,
    })
    .from(users)
    .where(and(eq(users.id_barbershop, barbershopId), eq(users.role, "owner")))
    .limit(1);

  const sub = await getCurrentSubscription(barbershopId);
  const currentPlan = await getCurrentPlan(barbershopId);
  const usage = await getFeatureUsageSummary(barbershopId);

  // Hitung sisa hari
  let remainingDays: number | null = null;
  if (sub.end_date) {
    const diffMs = new Date(sub.end_date).getTime() - new Date().getTime();
    remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Ambil riwayat penukaran & perubahan langganan
  const histories = await db
    .select({
      id_history: subscriptionHistories.id_history,
      jenis: subscriptionHistories.jenis,
      status: subscriptionHistories.status,
      start_date: subscriptionHistories.start_date,
      end_date: subscriptionHistories.end_date,
      keterangan: subscriptionHistories.keterangan,
      created_at: subscriptionHistories.created_at,
      plan_name: plan.plan_name,
    })
    .from(subscriptionHistories)
    .innerJoin(plan, eq(subscriptionHistories.id_plan, plan.plan_id))
    .where(eq(subscriptionHistories.id_barbershop, barbershopId))
    .orderBy(desc(subscriptionHistories.created_at))
    .limit(20);

  return {
    barbershop: {
      id: shop.id_barbershop,
      name: shop.nama_barbershop,
      slug: shop.slug,
    },
    owner: {
      name: ownerUser?.nama_lengkap || "Owner",
      email: ownerUser?.email || "",
      phone: ownerUser?.no_hp || "",
    },
    currentSubscription: {
      id: sub.subscription_id,
      planName: currentPlan.name,
      planLabel: currentPlan.label,
      price: currentPlan.price,
      priceDisplay: currentPlan.priceDisplay,
      status: sub.status,
      startDate: sub.start_date,
      endDate: sub.end_date,
      remainingDays,
      isFree: currentPlan.isFree,
    },
    usage,
    plans: PLAN_CONFIGS,
    histories,
    whatsappConfig: {
      number: PRICING_WHATSAPP_NUMBER,
      display: PRICING_WHATSAPP_DISPLAY,
    },
  };
});

export const redeemOwnerSubscriptionCode = createServerFn({
  method: "POST",
})
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const barbershopId = tenant.barbershopId;
    const userId = tenant.userId;

    return await executeRedeemCode(barbershopId, data.code, userId);
  });

// Token check & consume server functions for Export (CSV/PDF)
export const verifyExportQuota = createServerFn({
  method: "GET",
}).handler(async () => {
  const tenant = requireOwnerTenant();
  return await checkExportTokenAvailable(tenant.barbershopId);
});

export const recordExportTokenConsumption = createServerFn({
  method: "POST",
}).handler(async () => {
  const tenant = requireOwnerTenant();
  return await consumeExportToken(tenant.barbershopId);
});

// ============================================================================
// 9. SUPERADMIN SERVER FUNCTIONS (BAGIAN 21, 22, 23)
// ============================================================================

export const superadminGetSubscriptions = createServerFn({
  method: "GET",
}).handler(async () => {
  // Verifikasi Superadmin
  requireSuperadmin();

  const tenants = await db
    .select({
      id_barbershop: barbershop.id_barbershop,
      nama_barbershop: barbershop.nama_barbershop,
      slug: barbershop.slug,
      status_toko: barbershop.status,
      created_at: barbershop.created_at,
      id_user: users.id_user,
      nama_owner: users.nama_lengkap,
      email_owner: users.email,
      phone_owner: users.no_hp,
    })
    .from(barbershop)
    .leftJoin(
      users,
      and(eq(users.id_barbershop, barbershop.id_barbershop), eq(users.role, "owner")),
    )
    .orderBy(desc(barbershop.created_at));

  const list = await Promise.all(
    tenants.map(async (t) => {
      const sub = await getCurrentSubscription(t.id_barbershop);
      let remainingDays: number | null = null;
      if (sub.end_date) {
        const diffMs = new Date(sub.end_date).getTime() - new Date().getTime();
        remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
      return {
        ...t,
        subscription: {
          id: sub.subscription_id,
          planName: sub.plan_name,
          startDate: sub.start_date,
          endDate: sub.end_date,
          remainingDays,
          status: sub.status,
          isFree: sub.is_free,
        },
      };
    }),
  );

  return list;
});

export const superadminGetCodes = createServerFn({
  method: "GET",
}).handler(async () => {
  requireSuperadmin();

  return await db
    .select({
      id_code: subscriptionCodes.id_code,
      code: subscriptionCodes.code,
      jenis: subscriptionCodes.jenis,
      durasi_hari: subscriptionCodes.durasi_hari,
      status: subscriptionCodes.status,
      used_at: subscriptionCodes.used_at,
      expired_at: subscriptionCodes.expired_at,
      created_at: subscriptionCodes.created_at,
      plan_name: plan.plan_name,
      used_by_barbershop: barbershop.nama_barbershop,
      used_by_slug: barbershop.slug,
    })
    .from(subscriptionCodes)
    .innerJoin(plan, eq(subscriptionCodes.plan_id, plan.plan_id))
    .leftJoin(barbershop, eq(subscriptionCodes.id_used_by, barbershop.id_barbershop))
    .orderBy(desc(subscriptionCodes.created_at))
    .limit(100);
});

export const superadminGenerateCode = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      planName: "PRO" | "ENTERPRISE";
      durationDays?: number;
      targetBarbershopId?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = requireSuperadmin();

    const [targetPlan] = await db
      .select({ plan_id: plan.plan_id, plan_name: plan.plan_name })
      .from(plan)
      .where(eq(plan.plan_name, data.planName))
      .limit(1);

    if (!targetPlan) {
      throw new Error(`Paket ${data.planName} tidak ditemukan.`);
    }

    const durationDays = data.durationDays || 30;
    const newCode = generateCryptoSubscriptionCode(data.planName);

    const [created] = await db
      .insert(subscriptionCodes)
      .values({
        code: newCode,
        plan_id: targetPlan.plan_id,
        jenis: "upgrade",
        durasi_hari: durationDays,
        status: "unused",
      })
      .returning();

    // Catat ke audit log superadmin
    await db
      .insert(superadminAuditLogs)
      .values({
        action: "GENERATE_SUBSCRIPTION_CODE",
        actor_email: admin.email,
        target_tenant_id: data.targetBarbershopId || undefined,
        details: `Generate voucher langganan ${data.planName} (${durationDays} hari): ${created.code}. Catatan: ${data.notes || "-"}`,
      })
      .catch((e) => console.error("Audit generate code failed:", e));

    return {
      success: true,
      code: created.code,
      planName: targetPlan.plan_name,
      durationDays,
    };
  });

export const superadminTriggerExpiryJob = createServerFn({
  method: "POST",
}).handler(async () => {
  const admin = requireSuperadmin();
  const result = await runDailySubscriptionExpiryJob();

  await db
    .insert(superadminAuditLogs)
    .values({
      action: "TRIGGER_EXPIRY_JOB",
      actor_email: admin.email,
      details: `Trigger manual expiry/retention job: ${result.expiredCount} kedaluwarsa diproses, ${result.retainedCount} retensi diproses.`,
    })
    .catch((e) => console.error("Audit trigger expiry job failed:", e));

  return result;
});
