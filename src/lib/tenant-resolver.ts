import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { barbershop } from "@/db/schema";
import { isBarbershopOpen } from "./operating-hours";

export type ResolvedBarbershop = {
  id_barbershop: string;
  slug: string;
  nama_barbershop: string;
  alamat: string | null;
  no_hp: string | null;
  jam_buka: string | null;
  jam_tutup: string | null;
  status: "active" | "inactive" | "suspended";
  isOpen: boolean;
  currentWibTime: string;
};

// Server-side in-memory cache to prevent redundant database round-trips for the same tenant
type CachedShopRecord = {
  id_barbershop: string;
  slug: string;
  nama_barbershop: string;
  alamat: string | null;
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
 * Server function to resolve a barbershop strictly by its slug.
 * Throws or returns null if not found. NEVER uses default/fallback shops.
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
        // Retry once after 250ms delay
        await new Promise((r) => setTimeout(r, 250));
        found = await queryShop();
      }

      if (found) {
        shopCache.set(slug, { data: found, timestamp: Date.now() });
      }
    }

    if (!found) return null;

    const jamBuka = found.jam_buka || "08:00 WIB";
    const jamTutup = found.jam_tutup || "21:00 WIB";
    const { isOpen, currentWibTime } = isBarbershopOpen(jamBuka, jamTutup);

    return {
      id_barbershop: found.id_barbershop,
      slug: found.slug,
      nama_barbershop: found.nama_barbershop,
      alamat: found.alamat,
      no_hp: found.no_hp,
      jam_buka: jamBuka,
      jam_tutup: jamTutup,
      status: found.status,
      isOpen,
      currentWibTime,
    };
  });
