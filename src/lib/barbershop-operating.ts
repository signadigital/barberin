import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { barbershop } from "@/db/schema";

export {
  parseTimeToMinutes,
  getWibTimeParts,
  isBarbershopOpen,
  type PublicBarbershopInfo,
} from "./operating-hours";
import { isBarbershopOpen, type PublicBarbershopInfo } from "./operating-hours";

type CachedOperatingShop = {
  id_barbershop: string;
  slug: string | null;
  nama_barbershop: string;
  alamat: string | null;
  no_hp: string | null;
  jam_buka: string | null;
  jam_tutup: string | null;
};

const shopOperatingCache = new Map<string, { data: CachedOperatingShop; timestamp: number }>();
const CACHE_TTL_MS = 60_000;

export function invalidatePublicShopCache(key?: string) {
  if (key) {
    shopOperatingCache.delete(key.toLowerCase().trim());
  } else {
    shopOperatingCache.clear();
  }
}

/**
 * Server function to fetch public profile and real-time open/closed status for customers.
 */
export const getPublicBarbershopInfo = createServerFn({
  method: "GET",
})
  .validator((data?: { barbershopId?: string; slug?: string }) => data)
  .handler(async ({ data }): Promise<PublicBarbershopInfo> => {
    try {
      const cacheKey = (data?.barbershopId || data?.slug || "").toLowerCase().trim();
      const cached = cacheKey ? shopOperatingCache.get(cacheKey) : null;
      let shop: CachedOperatingShop | undefined =
        cached && Date.now() - cached.timestamp < CACHE_TTL_MS ? cached.data : undefined;

      if (!shop) {
        if (data?.barbershopId) {
          const [found] = await db
            .select()
            .from(barbershop)
            .where(
              and(
                eq(barbershop.id_barbershop, data.barbershopId),
                eq(barbershop.status, "active"),
              ),
            )
            .limit(1);
          shop = found;
        } else if (data?.slug) {
          const [found] = await db
            .select()
            .from(barbershop)
            .where(
              and(
                eq(barbershop.slug, data.slug),
                eq(barbershop.status, "active"),
              ),
            )
            .limit(1);
          shop = found;
        }

        if (shop && cacheKey) {
          shopOperatingCache.set(cacheKey, { data: shop, timestamp: Date.now() });
          if (shop.slug && shop.slug.toLowerCase() !== cacheKey) {
            shopOperatingCache.set(shop.slug.toLowerCase(), { data: shop, timestamp: Date.now() });
          }
          if (shop.id_barbershop && shop.id_barbershop.toLowerCase() !== cacheKey) {
            shopOperatingCache.set(shop.id_barbershop.toLowerCase(), { data: shop, timestamp: Date.now() });
          }
        }
      }

      if (!shop) {
        throw new Error("Barbershop tidak ditemukan.");
      }

      const nama = shop.nama_barbershop;
      const alamat = shop.alamat || "";
      const noHp = shop.no_hp || "";
      const jamBuka = shop.jam_buka || "08:00 WIB";
      const jamTutup = shop.jam_tutup || "21:00 WIB";

      const { isOpen, currentWibTime } = isBarbershopOpen(jamBuka, jamTutup);

      return {
        id_barbershop: shop.id_barbershop,
        slug: shop.slug ?? undefined,
        nama_barbershop: nama,
        alamat,
        no_hp: noHp,
        jam_buka: jamBuka,
        jam_tutup: jamTutup,
        isOpen,
        currentWibTime,
      };
    } catch (err: any) {
      console.error("Gagal mengambil profil publik barbershop:", err);
      throw new Error(err?.message || "Barbershop tidak ditemukan.");
    }
  });
