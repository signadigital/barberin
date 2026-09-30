import dns from "node:dns/promises";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  barbershop,
  barbershopBrandings,
  brandingHistories,
  customDomains,
  domainVerificationLogs,
  users,
} from "@/db/schema";
import {
  requireOwnerTenant,
  getOwnerSession,
  requireSuperadmin,
} from "@/lib/auth-session";
import { invalidateTenantCache } from "@/lib/tenant-resolver";
import { getCurrentPlan } from "./subscriptions";

// ============================================================================
// TYPES & ENUMS (BPMN / ERD SESUAI SPESIFIKASI)
// ============================================================================

export type BrandingTheme = "default" | "secondary" | "tertiary" | "natural";
export type DisplayMode = "light" | "dark";
export type BrandingStatus = "active" | "inactive" | "draft";

export type CustomDomainStatus =
  | "pending"
  | "verifying"
  | "verified"
  | "active"
  | "inactive"
  | "failed";

export interface ColorPreset {
  name: string;
  key: string;
  primary: string;
  secondary: string;
  background: string;
  cardBg: string;
  textColor: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: "Blue (Default)",
    key: "blue",
    primary: "#2563EB",
    secondary: "#1E293B",
    background: "#070D18",
    cardBg: "#0F1D33",
    textColor: "#F8FAFC",
  },
  {
    name: "Emerald",
    key: "emerald",
    primary: "#059669",
    secondary: "#064E3B",
    background: "#022C22",
    cardBg: "#063D2F",
    textColor: "#ECFDF5",
  },
  {
    name: "Purple",
    key: "purple",
    primary: "#7C3AED",
    secondary: "#4C1D95",
    background: "#0F0A1F",
    cardBg: "#1E1238",
    textColor: "#FAF5FF",
  },
  {
    name: "Rose",
    key: "rose",
    primary: "#E11D48",
    secondary: "#881337",
    background: "#19050A",
    cardBg: "#2B0B13",
    textColor: "#FFF1F2",
  },
  {
    name: "Amber",
    key: "amber",
    primary: "#D97706",
    secondary: "#78350F",
    background: "#190F05",
    cardBg: "#2E1A08",
    textColor: "#FFFBEB",
  },
  {
    name: "Slate",
    key: "slate",
    primary: "#475569",
    secondary: "#1E293B",
    background: "#0B132B",
    cardBg: "#132142",
    textColor: "#F1F5F9",
  },
];

export interface SaveBrandingInput {
  nama_brand: string;
  tagline?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  theme?: BrandingTheme;
  display_mode?: DisplayMode;
  color_preset?: string;
  hide_barberin_brand?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  status?: BrandingStatus;
}

// Domain Validation Rules (BPMN Section 3)
export function validateDomainFormat(rawDomain: string): { isValid: boolean; error?: string } {
  if (!rawDomain || typeof rawDomain !== "string") {
    return { isValid: false, error: "Nama domain wajib diisi." };
  }

  const d = rawDomain.trim().toLowerCase();

  // Tidak boleh diawali protokol
  if (d.startsWith("http://") || d.startsWith("https://")) {
    return { isValid: false, error: "Jangan sertakan 'http://' atau 'https://' pada nama domain." };
  }

  // Tidak boleh ada spasi
  if (/\s/.test(d)) {
    return { isValid: false, error: "Domain tidak boleh mengandung spasi." };
  }

  // Tidak boleh ada path '/'
  if (d.includes("/")) {
    return { isValid: false, error: "Domain tidak boleh mengandung path seperti '/login'." };
  }

  // Tidak boleh ada karakter khusus (@, #, _, $, dll)
  if (/[@#_!$%^&*()+=[\]{};':"\\|,<>?~]/.test(d)) {
    return { isValid: false, error: "Karakter khusus seperti @, #, atau _ tidak diperbolehkan." };
  }

  // Tidak boleh diawali atau diakhiri tanda minus
  if (d.startsWith("-") || d.endsWith("-")) {
    return { isValid: false, error: "Domain tidak boleh diawali atau diakhiri dengan tanda hubung (-)." };
  }

  // Tidak boleh double dot '..'
  if (d.includes("..")) {
    return { isValid: false, error: "Domain tidak boleh mengandung titik ganda (..)." };
  }

  // Harus memiliki pemisah titik dan ekstensi valid
  const parts = d.split(".");
  if (parts.length < 2) {
    return { isValid: false, error: "Domain harus menyertakan ekstensi valid (misal: .com, .id, .co.id)." };
  }

  // Cek setiap bagian tidak kosong dan valid
  for (const part of parts) {
    if (!part || part.length === 0) {
      return { isValid: false, error: "Format bagian domain tidak valid." };
    }
    if (part.startsWith("-") || part.endsWith("-")) {
      return { isValid: false, error: "Bagian domain tidak boleh diawali atau diakhiri tanda minus." };
    }
    if (!/^[a-z0-9-]+$/.test(part)) {
      return { isValid: false, error: "Domain hanya boleh terdiri dari huruf (a-z), angka (0-9), dan tanda hubung (-)." };
    }
  }

  // Ekstensi tld minimal 2 karakter
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { isValid: false, error: "Ekstensi domain (TLD) tidak valid." };
  }

  return { isValid: true };
}

// ============================================================================
// 1. OWNER BRANDING SERVER FUNCTIONS (STRICT TENANT ISOLATION)
// ============================================================================

export const getOwnerBranding = createServerFn({
  method: "GET",
}).handler(async () => {
  const tenant = requireOwnerTenant();
  const shopId = tenant.barbershopId;

  // 1. Ambil data barbershop milik tenant ini
  const shop = await db.query.barbershop.findFirst({
    where: eq(barbershop.id_barbershop, shopId),
  });

  if (!shop) {
    throw new Error("Barbershop tidak ditemukan.");
  }

  // 2. Ambil data branding dari tabel barbershop_brandings
  const branding = await db.query.barbershopBrandings.findFirst({
    where: eq(barbershopBrandings.id_barbershop, shopId),
  });

  // Jika belum ada, return default scaffold
  if (!branding) {
    return {
      id_branding: null,
      id_barbershop: shopId,
      nama_barbershop_asli: shop.nama_barbershop,
      nama_brand: shop.nama_barbershop,
      tagline: "Modern Barbershop Management System",
      logo_url: shop.foto || null,
      favicon_url: null,
      warna_primary: "#2563EB",
      warna_secondary: "#1E293B",
      warna_background: "#070D18",
      theme: "default" as BrandingTheme,
      display_mode: "dark" as DisplayMode,
      color_preset: "blue",
      hide_barberin_brand: false,
      meta_title: `${shop.nama_barbershop} — Layanan Barbershop Terbaik`,
      meta_description: `Nikmati layanan cukur dan styling rambut profesional di ${shop.nama_barbershop}.`,
      status: "active" as BrandingStatus,
      updated_at: new Date(),
    };
  }

  return {
    ...branding,
    display_mode: (branding.display_mode as DisplayMode) || "dark",
    color_preset: branding.color_preset || "purple",
    nama_barbershop_asli: shop.nama_barbershop,
  };
});

export const saveOwnerBranding = createServerFn({
  method: "POST",
})
  .validator((data: SaveBrandingInput) => data)
  .handler(async ({ data }) => {
    // SECURITY: Ambil id_barbershop murni dari authenticated owner session
    const tenant = requireOwnerTenant();
    const session = getOwnerSession();
    const shopId = tenant.barbershopId;

    if (!session || !session.userId) {
      throw new Error("Sesi Owner tidak valid.");
    }

    // Subscription Entitlement Check (Bagian 35 & 36: White-label hanya untuk Enterprise)
    const currentPlan = await getCurrentPlan(shopId);
    if (currentPlan.name !== "ENTERPRISE") {
      const err = new Error(
        "Kustomisasi branding dan label putih (white-label) hanya tersedia untuk paket Enterprise (Rp199.000 / bulan). Silakan upgrade paket Anda.",
      );
      (err as any).code = "FEATURE_LOCKED";
      (err as any).requiredPlan = "ENTERPRISE";
      throw err;
    }

    // STEP 5 BPMN: Validasi Konfigurasi Input
    if (!data.nama_brand || !data.nama_brand.trim()) {
      throw new Error("Nama brand wajib diisi.");
    }
    if (data.nama_brand.length > 100) {
      throw new Error("Nama brand maksimal 100 karakter.");
    }
    if (data.tagline && data.tagline.length > 150) {
      throw new Error("Tagline maksimal 150 karakter.");
    }
    if (data.meta_title && data.meta_title.length > 150) {
      throw new Error("Meta title maksimal 150 karakter.");
    }

    // Validasi Preset Warna (Strict Backend Validation: Owner tidak boleh input arbitrary HEX)
    const presetKey = (data.color_preset || "blue").toLowerCase().trim();
    const foundPreset = COLOR_PRESETS.find((p) => p.key === presetKey);
    if (!foundPreset) {
      throw new Error(
        `Preset warna "${data.color_preset}" tidak valid. Pilihan yang tersedia: ${COLOR_PRESETS.map((p) => p.name).join(", ")}.`
      );
    }

    // Validasi Display Mode (light | dark)
    const displayMode: DisplayMode = data.display_mode === "light" ? "light" : "dark";

    // Validasi Theme
    const validThemes: BrandingTheme[] = ["default", "secondary", "tertiary", "natural"];
    const theme: BrandingTheme =
      data.theme && validThemes.includes(data.theme) ? data.theme : "default";

    // Validasi URL / Base64 gambar
    if (data.logo_url && data.logo_url.startsWith("data:")) {
      if (!data.logo_url.startsWith("data:image/")) {
        throw new Error("Format file logo tidak valid. Hanya format gambar (JPG/PNG/SVG) yang diperbolehkan.");
      }
    }
    if (data.favicon_url && data.favicon_url.startsWith("data:")) {
      if (!data.favicon_url.startsWith("data:image/")) {
        throw new Error("Format file favicon tidak valid. Hanya format gambar (ICO/PNG) yang diperbolehkan.");
      }
    }

    const payload = {
      nama_brand: data.nama_brand.trim(),
      tagline: data.tagline?.trim() || null,
      logo_url: data.logo_url || null,
      favicon_url: data.favicon_url || null,
      warna_primary: foundPreset.primary,
      warna_secondary: foundPreset.secondary,
      warna_background: foundPreset.background,
      theme,
      display_mode: displayMode,
      color_preset: foundPreset.key,
      hide_barberin_brand: Boolean(data.hide_barberin_brand),
      meta_title: data.meta_title?.trim() || null,
      meta_description: data.meta_description?.trim() || null,
      status: data.status || "active",
      updated_at: new Date(),
    };

    // TRANSACTION-SAFE MUTATION (Atomicity: Update branding + Insert history)
    await db.transaction(async (tx) => {
      // 1. Ambil existing data di dalam transaksi
      const existing = await tx.query.barbershopBrandings.findFirst({
        where: eq(barbershopBrandings.id_barbershop, shopId),
      });

      let brandingId = existing?.id_branding;

      if (existing) {
        await tx
          .update(barbershopBrandings)
          .set(payload)
          .where(eq(barbershopBrandings.id_branding, existing.id_branding));
      } else {
        const [inserted] = await tx
          .insert(barbershopBrandings)
          .values({
            id_barbershop: shopId,
            ...payload,
          })
          .returning({ id_branding: barbershopBrandings.id_branding });
        brandingId = inserted?.id_branding;
      }

      // 2. Insert ke branding_histories dengan changed_by dari authenticated session
      if (brandingId) {
        await tx.insert(brandingHistories).values({
          id_branding: brandingId,
          changed_by: session.userId,
          data_before: existing ? JSON.stringify(existing) : null,
          data_after: JSON.stringify(payload),
          created_at: new Date(),
        });
      }
    });

    // Invalidate in-memory tenant cache so loaders immediately return fresh branding
    const shopRecord = await db.query.barbershop.findFirst({
      where: eq(barbershop.id_barbershop, shopId),
      columns: { slug: true },
    });
    if (shopRecord?.slug) {
      invalidateTenantCache(shopRecord.slug);
    }
    invalidateTenantCache();

    return {
      success: true,
      message: "Konfigurasi branding berhasil disimpan dan diterapkan pada website.",
    };
  });

export const getOwnerBrandingHistories = createServerFn({
  method: "GET",
}).handler(async () => {
  const tenant = requireOwnerTenant();
  const shopId = tenant.barbershopId;

  const branding = await db.query.barbershopBrandings.findFirst({
    where: eq(barbershopBrandings.id_barbershop, shopId),
  });

  if (!branding) return [];

  const histories = await db.query.brandingHistories.findMany({
    where: eq(brandingHistories.id_branding, branding.id_branding),
    orderBy: [desc(brandingHistories.created_at)],
    limit: 15,
    with: {
      user: {
        columns: {
          nama_lengkap: true,
          email: true,
        },
      },
    },
  });

  return histories.map((h) => ({
    ...h,
    data_before: typeof h.data_before === "string" ? h.data_before : JSON.stringify(h.data_before ?? null),
    data_after: typeof h.data_after === "string" ? h.data_after : JSON.stringify(h.data_after ?? null),
  }));
});

// ============================================================================
// 2. SUPERADMIN CUSTOM DOMAIN SERVER FUNCTIONS (STRICT ROLE AUTHORIZATION)
// ============================================================================

export const getSuperadminDomains = createServerFn({
  method: "GET",
})
  .validator((filter?: { barbershopId?: string; search?: string }) => filter)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin yang boleh mengakses daftar custom domain
    requireSuperadmin();

    // 1. Ambil daftar barbershop untuk dropdown filter
    const allShops = await db
      .select({
        id_barbershop: barbershop.id_barbershop,
        nama_barbershop: barbershop.nama_barbershop,
        slug: barbershop.slug,
      })
      .from(barbershop)
      .orderBy(barbershop.nama_barbershop);

    // 2. Ambil domain dengan join ke barbershop
    const domains = await db
      .select({
        id_domain: customDomains.id_domain,
        id_barbershop: customDomains.id_barbershop,
        nama_barbershop: barbershop.nama_barbershop,
        slug_barbershop: barbershop.slug,
        domain: customDomains.domain,
        domain_type: customDomains.domain_type,
        dns_name: customDomains.dns_name,
        dns_value: customDomains.dns_value,
        verification_token: customDomains.verification_token,
        status: customDomains.status,
        ssl_status: customDomains.ssl_status,
        is_primary: customDomains.is_primary,
        verified_at: customDomains.verified_at,
        activated_at: customDomains.activated_at,
        created_at: customDomains.created_at,
        updated_at: customDomains.updated_at,
      })
      .from(customDomains)
      .leftJoin(barbershop, eq(customDomains.id_barbershop, barbershop.id_barbershop))
      .orderBy(desc(customDomains.created_at));

    // Filter di memori
    let filtered = domains;
    if (data?.barbershopId && data.barbershopId !== "all") {
      filtered = filtered.filter((d) => d.id_barbershop === data.barbershopId);
    }
    if (data?.search && data.search.trim()) {
      const q = data.search.trim().toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.domain.toLowerCase().includes(q) ||
          d.nama_barbershop?.toLowerCase().includes(q)
      );
    }

    return {
      barbershops: allShops,
      domains: filtered,
    };
  });

export const addOrEditCustomDomain = createServerFn({
  method: "POST",
})
  .validator((data: {
    id_domain?: string;
    id_barbershop: string;
    domain: string;
    domain_type?: string;
    is_primary?: boolean;
  }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    // STEP 3 & 4 BPMN: Validasi Format Domain
    const formatCheck = validateDomainFormat(data.domain);
    if (!formatCheck.isValid) {
      throw new Error(`Format domain tidak valid: ${formatCheck.error}`);
    }

    const cleanDomain = data.domain.trim().toLowerCase();

    // Validasi keberadaan tenant barbershop
    const targetShop = await db.query.barbershop.findFirst({
      where: eq(barbershop.id_barbershop, data.id_barbershop),
    });
    if (!targetShop) {
      throw new Error("Barbershop tenant yang dipilih tidak valid.");
    }

    // STEP 5 & 6 BPMN: Cek Ketersediaan Domain (Harus unik secara global)
    const existing = await db.query.customDomains.findFirst({
      where: eq(customDomains.domain, cleanDomain),
    });

    if (existing && existing.id_domain !== data.id_domain) {
      throw new Error(`Domain "${cleanDomain}" sudah digunakan oleh barbershop lain.`);
    }

    // Tentukan DNS Type dan Value
    const parts = cleanDomain.split(".");
    const isSubdomain = parts.length > 2;
    const dnsName = isSubdomain ? parts[0] || "@" : "@";
    const dnsValue = "cname.barberin.id";
    const verificationToken = `barberin-verif-${Math.random().toString(36).substring(2, 10)}`;

    if (data.id_domain) {
      // Edit Domain
      await db
        .update(customDomains)
        .set({
          domain: cleanDomain,
          domain_type: data.domain_type || "primary",
          dns_name: dnsName,
          dns_value: dnsValue,
          updated_at: new Date(),
        })
        .where(eq(customDomains.id_domain, data.id_domain));

      return { success: true, message: `Domain ${cleanDomain} berhasil diperbarui.` };
    }

    // STEP 12 BPMN: Simpan Data Domain Baru (Status: pending)
    // Domain baru TIDAK boleh langsung primary atau active sebelum verifikasi DNS
    const [inserted] = await db
      .insert(customDomains)
      .values({
        id_barbershop: data.id_barbershop,
        domain: cleanDomain,
        domain_type: data.domain_type || "primary",
        dns_name: dnsName,
        dns_value: dnsValue,
        verification_token: verificationToken,
        status: "pending",
        ssl_status: "pending",
        is_primary: false, // Baru aktif setelah lolos DNS verifikasi dan diaktifkan
      })
      .returning({ id_domain: customDomains.id_domain });

    if (inserted) {
      await db.insert(domainVerificationLogs).values({
        id_domain: inserted.id_domain,
        status: "pending",
        response_message: "Domain didaftarkan. Menunggu konfigurasi CNAME dari registrar domain.",
      });
    }

    return {
      success: true,
      message: `Domain ${cleanDomain} berhasil didaftarkan. Silakan konfigurasikan CNAME record sesuai instruksi.`,
    };
  });

/**
 * Verifikasi DNS Domain dengan REAL DNS LOOKUP (node:dns)
 * Memeriksa apakah CNAME mengarah ke cname.barberin.id atau TXT record cocok dengan verification_token.
 */
export const verifyCustomDomain = createServerFn({
  method: "POST",
})
  .validator((data: { id_domain: string }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    const domainRecord = await db.query.customDomains.findFirst({
      where: eq(customDomains.id_domain, data.id_domain),
    });

    if (!domainRecord) {
      throw new Error("Domain tidak ditemukan.");
    }

    const domainToCheck = domainRecord.domain.trim().toLowerCase();
    const expectedCname = domainRecord.dns_value.trim().toLowerCase().replace(/\.$/, "");
    const token = domainRecord.verification_token || "";

    let matched = false;
    let detailMessage = "";

    // 1. Coba CNAME lookup
    try {
      const cnames = await dns.resolveCname(domainToCheck);
      const cleanFoundCnames = cnames.map((c) => c.trim().toLowerCase().replace(/\.$/, ""));
      const isCnameMatch = cleanFoundCnames.some((c) => c === expectedCname);

      if (isCnameMatch) {
        matched = true;
        detailMessage = `CNAME cocok: ${cleanFoundCnames.join(", ")} mengarah ke ${expectedCname}.`;
      } else {
        detailMessage = `CNAME ditemukan: [${cleanFoundCnames.join(", ")}], tidak mengarah ke ${expectedCname}.`;
      }
    } catch (cnameErr: any) {
      detailMessage = `CNAME tidak terdeteksi (${cnameErr.code || cnameErr.message}).`;
    }

    // 2. Jika CNAME belum cocok, cek apakah ada TXT record verifikasi
    if (!matched && token) {
      try {
        const txtRecords = await dns.resolveTxt(domainToCheck);
        const flatTxt = txtRecords.flat().map((t) => t.trim());
        const isTxtMatch = flatTxt.some((t) => t === token || t.includes(token));

        if (isTxtMatch) {
          matched = true;
          detailMessage += ` TXT verification token cocok (${token}).`;
        } else if (flatTxt.length > 0) {
          detailMessage += ` TXT ditemukan: [${flatTxt.join(", ")}], token tidak cocok.`;
        }
      } catch (txtErr: any) {
        detailMessage += ` TXT tidak terdeteksi (${txtErr.code || txtErr.message}).`;
      }
    }

    // Update status berdasarkan hasil lookup DNS yang sebenarnya
    if (matched) {
      // Status verified (bukan active! Domain harus di-activate secara sadar oleh admin)
      await db
        .update(customDomains)
        .set({
          status: "verified",
          verified_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(customDomains.id_domain, data.id_domain));

      await db.insert(domainVerificationLogs).values({
        id_domain: data.id_domain,
        status: "verified",
        response_message: `DNS Valid: ${detailMessage}`,
      });

      return {
        success: true,
        status: "verified",
        message: `DNS domain ${domainToCheck} berhasil diverifikasi! Klik "Aktifkan Domain" untuk mengaktifkan routing.`,
      };
    } else {
      // DNS tidak cocok atau masih propagasi
      await db
        .update(customDomains)
        .set({
          status: "failed",
          updated_at: new Date(),
        })
        .where(eq(customDomains.id_domain, data.id_domain));

      await db.insert(domainVerificationLogs).values({
        id_domain: data.id_domain,
        status: "failed",
        response_message: `DNS Belum Sesuai: ${detailMessage}`,
      });

      throw new Error(`Verifikasi DNS gagal: ${detailMessage} Periksa pengaturan DNS di registrar Anda.`);
    }
  });

/**
 * Aktivasi domain yang sudah verified
 */
export const activateCustomDomain = createServerFn({
  method: "POST",
})
  .validator((data: { id_domain: string }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    const domainRecord = await db.query.customDomains.findFirst({
      where: eq(customDomains.id_domain, data.id_domain),
    });

    if (!domainRecord) {
      throw new Error("Domain tidak ditemukan.");
    }

    if (domainRecord.status !== "verified" && domainRecord.status !== "active") {
      throw new Error(
        `Domain belum lolos verifikasi DNS (status saat ini: ${domainRecord.status}). Lakukan verifikasi DNS terlebih dahulu.`
      );
    }

    await db
      .update(customDomains)
      .set({
        status: "active",
        activated_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(customDomains.id_domain, data.id_domain));

    await db.insert(domainVerificationLogs).values({
      id_domain: data.id_domain,
      status: "active",
      response_message: `Domain diaktifkan oleh Superadmin. Routing tenant aktif.`,
    });

    return {
      success: true,
      message: `Domain ${domainRecord.domain} kini berstatus aktif.`,
    };
  });

/**
 * Deaktivasi domain aktif menjadi inactive
 */
export const deactivateCustomDomain = createServerFn({
  method: "POST",
})
  .validator((data: { id_domain: string }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    const domainRecord = await db.query.customDomains.findFirst({
      where: eq(customDomains.id_domain, data.id_domain),
    });

    if (!domainRecord) {
      throw new Error("Domain tidak ditemukan.");
    }

    await db
      .update(customDomains)
      .set({
        status: "inactive",
        is_primary: false, // Inactive domain tidak boleh primary
        updated_at: new Date(),
      })
      .where(eq(customDomains.id_domain, data.id_domain));

    await db.insert(domainVerificationLogs).values({
      id_domain: data.id_domain,
      status: "inactive",
      response_message: `Domain dinonaktifkan oleh Superadmin.`,
    });

    return {
      success: true,
      message: `Domain ${domainRecord.domain} dinonaktifkan.`,
    };
  });

/**
 * Menjadikan domain sebagai Primary Domain (Domain Utama).
 * Syarat wajib: domain harus berstatus 'active'.
 */
export const setPrimaryCustomDomain = createServerFn({
  method: "POST",
})
  .validator((data: { id_domain: string; id_barbershop: string }) => data)
  .handler(async ({ data }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    const targetDomain = await db.query.customDomains.findFirst({
      where: eq(customDomains.id_domain, data.id_domain),
    });

    if (!targetDomain) {
      throw new Error("Domain tidak ditemukan.");
    }

    // Aturan Requirement 18: Hanya domain active yang dapat menjadi primary
    if (targetDomain.status !== "active") {
      throw new Error(
        `Domain ${targetDomain.domain} berstatus "${targetDomain.status}". Hanya domain berstatus "active" yang dapat dijadikan domain utama.`
      );
    }

    // Transaction-safe: Reset semua domain lain milik barbershop ini menjadi is_primary = false
    await db.transaction(async (tx) => {
      await tx
        .update(customDomains)
        .set({ is_primary: false })
        .where(eq(customDomains.id_barbershop, data.id_barbershop));

      await tx
        .update(customDomains)
        .set({ is_primary: true, updated_at: new Date() })
        .where(eq(customDomains.id_domain, data.id_domain));
    });

    return { success: true, message: `Domain ${targetDomain.domain} ditetapkan sebagai domain utama tenant.` };
  });

export const deleteCustomDomain = createServerFn({
  method: "POST",
})
  .validator((id_domain: string) => id_domain)
  .handler(async ({ data: id_domain }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    await db.delete(customDomains).where(eq(customDomains.id_domain, id_domain));
    return { success: true, message: "Custom domain berhasil dihapus." };
  });

export const getDomainVerificationLogs = createServerFn({
  method: "GET",
})
  .validator((id_domain: string) => id_domain)
  .handler(async ({ data: id_domain }) => {
    // SECURITY: Hanya Superadmin
    requireSuperadmin();

    return await db.query.domainVerificationLogs.findMany({
      where: eq(domainVerificationLogs.id_domain, id_domain),
      orderBy: [desc(domainVerificationLogs.created_at)],
      limit: 20,
    });
  });
