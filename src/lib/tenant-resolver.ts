import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { barbershop, barbershopBrandings, customDomains } from "@/db/schema";
import { isBarbershopOpen } from "./operating-hours";

export type TenantBrandingConfig = {
  nama_brand: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  warna_primary: string;
  warna_secondary: string;
  warna_background: string;
  theme: string;
  display_mode: "light" | "dark";
  color_preset: string;
  hide_barberin_brand: boolean;
};

export type ResolvedBarbershop = {
  id_barbershop: string;
  slug: string;
  nama_barbershop: string;
  alamat: string | null;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  no_hp: string | null;
  jam_buka: string | null;
  jam_tutup: string | null;
  status: "active" | "inactive" | "suspended";
  isOpen: boolean;
  currentWibTime: string;
  branding?: TenantBrandingConfig | null;
};

// Server-side in-memory cache to prevent redundant database round-trips for the same tenant
type CachedShopRecord = {
  id_barbershop: string;
  slug: string;
  nama_barbershop: string;
  alamat: string | null;
  latitude: string | null;
  longitude: string | null;
  no_hp: string | null;
  jam_buka: string | null;
  jam_tutup: string | null;
  status: "active" | "inactive" | "suspended";
};

const shopCache = new Map<string, { data: CachedShopRecord; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export function invalidateTenantCache(slug?: string) {
  if (slug) {
    shopCache.delete(slug.toLowerCase().trim());
  } else {
    shopCache.clear();
  }
}

/**
 * Server function to resolve a barbershop strictly by its slug,
 * including its persistent branding configuration (White Labeling).
 */
export const resolveBarbershopBySlug = createServerFn({
  method: "GET",
})
  .validator((slug: string) => (slug || "").trim().toLowerCase())
  .handler(async ({ data: slug }): Promise<ResolvedBarbershop | null> => {
    if (!slug) return null;

    const cached = shopCache.get(slug);
    let found: CachedShopRecord | null | undefined =
      cached && Date.now() - cached.timestamp < CACHE_TTL_MS ? cached.data : null;

    if (!found) {
      const queryShop = async () => {
        const [shop] = await db
          .select({
            id_barbershop: barbershop.id_barbershop,
            slug: barbershop.slug,
            nama_barbershop: barbershop.nama_barbershop,
            alamat: barbershop.alamat,
            latitude: barbershop.latitude,
            longitude: barbershop.longitude,
            no_hp: barbershop.no_hp,
            jam_buka: barbershop.jam_buka,
            jam_tutup: barbershop.jam_tutup,
            status: barbershop.status,
          })
          .from(barbershop)
          .where(eq(barbershop.slug, slug))
          .limit(1);
        return shop;
      };

      try {
        found = await queryShop();
      } catch (firstErr) {
        console.warn("[TENANT RESOLVER] Transient error fetching shop, retrying...", firstErr);
        await new Promise((r) => setTimeout(r, 250));
        found = await queryShop();
      }

      if (found) {
        shopCache.set(slug, { data: found, timestamp: Date.now() });
      }
    }

    if (!found) return null;

    // Ambil konfigurasi branding aktif untuk barbershop ini
    let brandingConfig: TenantBrandingConfig | null = null;
    try {
      const [bRecord] = await db
        .select({
          nama_brand: barbershopBrandings.nama_brand,
          tagline: barbershopBrandings.tagline,
          logo_url: barbershopBrandings.logo_url,
          favicon_url: barbershopBrandings.favicon_url,
          warna_primary: barbershopBrandings.warna_primary,
          warna_secondary: barbershopBrandings.warna_secondary,
          warna_background: barbershopBrandings.warna_background,
          theme: barbershopBrandings.theme,
          display_mode: barbershopBrandings.display_mode,
          color_preset: barbershopBrandings.color_preset,
          hide_barberin_brand: barbershopBrandings.hide_barberin_brand,
        })
        .from(barbershopBrandings)
        .where(eq(barbershopBrandings.id_barbershop, found.id_barbershop))
        .limit(1);

      if (bRecord) {
        brandingConfig = {
          nama_brand: bRecord.nama_brand || found.nama_barbershop,
          tagline: bRecord.tagline,
          logo_url: bRecord.logo_url,
          favicon_url: bRecord.favicon_url,
          warna_primary: bRecord.warna_primary || "#2563EB",
          warna_secondary: bRecord.warna_secondary || "#1E293B",
          warna_background: bRecord.warna_background || "#070D18",
          theme: bRecord.theme || "default",
          display_mode: (bRecord.display_mode as "light" | "dark") || "dark",
          color_preset: bRecord.color_preset || "blue",
          hide_barberin_brand: Boolean(bRecord.hide_barberin_brand),
        };
      }
    } catch (bErr) {
      console.warn("[TENANT RESOLVER] Could not fetch branding:", bErr);
    }

    const jamBuka = found.jam_buka || "08:00 WIB";
    const jamTutup = found.jam_tutup || "21:00 WIB";
    const { isOpen, currentWibTime } = isBarbershopOpen(jamBuka, jamTutup);

    return {
      id_barbershop: found.id_barbershop,
      slug: found.slug,
      nama_barbershop: found.nama_barbershop,
      alamat: found.alamat,
      latitude: found.latitude ? Number(found.latitude) : null,
      longitude: found.longitude ? Number(found.longitude) : null,
      no_hp: found.no_hp,
      jam_buka: jamBuka,
      jam_tutup: jamTutup,
      status: found.status,
      isOpen,
      currentWibTime,
      branding: brandingConfig,
    };
  });

/**
 * Server function untuk me-resolve barbershop berdasarkan Custom Domain (BPMN Section 19)
 * Memeriksa custom domain aktif, dan mengarahkan ke primary domain jika bukan primary.
 */
export const resolveTenantByCustomDomain = createServerFn({
  method: "GET",
})
  .validator((rawDomain: string) => (rawDomain || "").trim().toLowerCase())
  .handler(async ({ data: domain }) => {
    if (!domain) return null;

    const cleanHost = domain.split(":")[0].replace(/\.$/, "");

    // 1. Cek apakah hostname ini adalah domain kustom aktif di sistem
    const [matchedDomain] = await db
      .select({
        id_domain: customDomains.id_domain,
        id_barbershop: customDomains.id_barbershop,
        domain: customDomains.domain,
        status: customDomains.status,
        is_primary: customDomains.is_primary,
      })
      .from(customDomains)
      .where(and(eq(customDomains.domain, cleanHost), eq(customDomains.status, "active")))
      .limit(1);

    if (!matchedDomain) return null;

    // 2. Ambil data barbershop terkait
    const [shop] = await db
      .select({
        id_barbershop: barbershop.id_barbershop,
        slug: barbershop.slug,
        nama_barbershop: barbershop.nama_barbershop,
      })
      .from(barbershop)
      .where(eq(barbershop.id_barbershop, matchedDomain.id_barbershop))
      .limit(1);

    if (!shop) return null;

    // 3. Aturan Requirement 19: Jika bukan primary domain dan ada primary domain yang aktif, redirect
    if (!matchedDomain.is_primary) {
      const [primaryDom] = await db
        .select({ domain: customDomains.domain })
        .from(customDomains)
        .where(
          and(
            eq(customDomains.id_barbershop, matchedDomain.id_barbershop),
            eq(customDomains.is_primary, true),
            eq(customDomains.status, "active")
          )
        )
        .limit(1);

      if (primaryDom && primaryDom.domain !== matchedDomain.domain) {
        return {
          shouldRedirect: true,
          redirectToDomain: primaryDom.domain,
          barbershopSlug: shop.slug,
        };
      }
    }

    return {
      shouldRedirect: false,
      barbershopSlug: shop.slug,
      id_barbershop: shop.id_barbershop,
      nama_barbershop: shop.nama_barbershop,
    };
  });
