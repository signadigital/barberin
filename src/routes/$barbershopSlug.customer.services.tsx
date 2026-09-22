import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Plus,
  Scissors,
  ShoppingCart,
  Store,
  MapPin,
  Clock,
  Phone,
  Moon,
  Lock,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";

import {
  BarberinLogo,
  BottomActionBar,
  ErrorState,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { formatRupiah } from "@/lib/format";
import { actions, cartCount, cartTotal, useBarberin, type Service } from "@/lib/barberin-store";
import { getServices } from "@/lib/services";
import { getPublicBarbershopInfo } from "@/lib/barbershop-operating";
import { isBarbershopOpen, type PublicBarbershopInfo } from "@/lib/operating-hours";

function formatWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "62" + digits.slice(1);
  }
  if (!digits.startsWith("62")) {
    return "62" + digits;
  }
  return digits;
}

type ServicesSearch = {
  shop?: string | undefined;
};

export const Route = createFileRoute("/$barbershopSlug/customer/services")({
  validateSearch: (search: Record<string, unknown>): ServicesSearch => {
    const rawShop = search["shop"];
    return {
      shop: typeof rawShop === "string" && rawShop.trim() ? rawShop.trim() : undefined,
    };
  },
  loader: async ({ params }: { params: { barbershopSlug: string } }) => {
    const shop = params.barbershopSlug;
    try {
      const [services, shopInfo] = await Promise.all([
        getServices({ data: { slug: shop } }).catch(() => []),
        getPublicBarbershopInfo({ data: { slug: shop } }).catch(() => null),
      ]);
      return { services, shop: shopInfo, targetSlug: shop };
    } catch (e) {
      console.error("Loader error customer.services:", e);
      return { services: [], shop: null, targetSlug: shop };
    }
  },
  head: () => ({
    meta: [
      { title: "Pilih Layanan — BARBERIN" },
      {
        name: "description",
        content:
          "Pilih layanan barbershop BARBERIN langsung dari ponsel Anda: potong rambut, keramas, dan cukur.",
      },
      { property: "og:title", content: "Pilih Layanan — BARBERIN" },
      {
        property: "og:description",
        content: "Katalog layanan barbershop BARBERIN. Pilih layanan, bayar, dan terima struk.",
      },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const loaderData = Route.useLoaderData();
  const { cartItems, shopSlug: storedShopSlug } = useBarberin();
  const [shopSlug, setShopSlug] = useState<string | undefined>(barbershopSlug);

  // Barbershop Profile State from Settings
  const [shopInfo, setShopInfo] = useState<PublicBarbershopInfo | null>(() => {
    return loaderData?.shop ?? null;
  });

  // Services list state
  const [serviceList, setServiceList] = useState<Service[]>(() => {
    if (loaderData?.services && loaderData.services.length > 0) {
      return loaderData.services.map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? "",
        price: Number(d.price),
      }));
    }
    return [];
  });

  const [loading, setLoading] = useState(serviceList.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Live Current Time & Open/Closed Status
  const [currentTime, setCurrentTime] = useState(new Date());
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlShop = new URLSearchParams(window.location.search).get("shop");
      if (urlShop && urlShop !== shopSlug) {
        setShopSlug(urlShop);
      }
    }
  }, [shopSlug]);

  useEffect(() => {
    if (shopInfo?.id_barbershop) {
      actions.setShop(shopSlug ?? shopInfo.slug ?? null, shopInfo.id_barbershop);
    }
  }, [shopInfo?.id_barbershop, shopInfo?.slug, shopSlug]);

  // Load latest shop info & services from database (only when slug changes or not preloaded)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (loaderData?.services && loaderData.services.length > 0 && shopSlug === barbershopSlug) {
        return;
      }
    }

    let mounted = true;

    // Fetch Barbershop Profile
    getPublicBarbershopInfo({ data: shopSlug ? { slug: shopSlug } : undefined })
      .then((info) => {
        if (mounted && info) {
          setShopInfo(info);
        }
      })
      .catch((err) => {
        console.warn("Gagal mengambil profil barbershop:", err);
      });

    // Fetch Services
    getServices({ data: shopSlug ? { slug: shopSlug } : undefined })
      .then((data) => {
        if (!mounted) return;
        const mapped: Service[] = data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? "",
          price: Number(d.price),
        }));
        setServiceList(mapped);
        setError(null);
      })
      .catch((err) => {
        console.error("Gagal mengambil layanan:", err);
        if (mounted) {
          setError("Gagal memuat layanan. Silakan coba lagi.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Refresh time & operating status every 15 seconds
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [shopSlug]);

  // Compute live open/closed status based on current WIB time and settings
  const operatingStatus = useMemo(() => {
    const jamBuka = shopInfo?.jam_buka || "08:00 WIB";
    const jamTutup = shopInfo?.jam_tutup || "21:00 WIB";
    return isBarbershopOpen(jamBuka, jamTutup, currentTime);
  }, [shopInfo?.jam_buka, shopInfo?.jam_tutup, currentTime]);

  const isOpen = operatingStatus.isOpen;
  const currentWibTime = operatingStatus.currentWibTime;

  const total = cartTotal(cartItems);
  const count = cartCount(cartItems);

  const displayJamBuka = shopInfo?.jam_buka?.replace(" WIB", "") || "08:00";
  const displayJamTutup = shopInfo?.jam_tutup?.replace(" WIB", "") || "21:00";

  return (
    <MobileShell>
      <header className="safe-top px-4 pb-2">
        {/* Brand Bar */}
        <div className="flex items-center gap-3">
          <BarberinLogo className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-bold leading-tight">BARBERIN</p>
            <p className="truncate text-[12px] text-muted-foreground">
              Modern Barbershop Management System
            </p>
          </div>
        </div>

        {/* Barbershop Profile Card from Owner Settings */}
        <div className="mt-4 rounded-2xl bg-[#0F1D33]/90 border border-slate-700/80 p-4 shadow-lg space-y-2.5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold uppercase tracking-wider">
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span>Profil Barbershop</span>
              </div>
              <h2 className="text-[16px] font-bold text-white tracking-tight truncate mt-0.5">
                {shopInfo?.nama_barbershop || "Barbershop"}
              </h2>
            </div>

            {/* Status Badge: BUKA or TUTUP */}
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold shrink-0 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>BUKA</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold shrink-0 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>TUTUP</span>
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80 text-xs text-slate-300">
            {/* Alamat Barbershop */}
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed text-slate-300">
                {shopInfo?.alamat || "Jl. Jenderal Soedirman No. 123, Purbalingga"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Jam Operasional */}
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>
                  {displayJamBuka} - {displayJamTutup} WIB
                </span>
              </div>

              {/* WhatsApp / Telp */}
              {shopInfo?.no_hp && (
                <a
                  href={`https://wa.me/${formatWaNumber(shopInfo.no_hp)}?text=${encodeURIComponent(
                    `Halo ${shopInfo.nama_barbershop}, saya ingin bertanya mengenai layanan barbershop.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 font-semibold hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  <span>{shopInfo.no_hp}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Header Title when Open */}
        {isOpen && (
          <div className="mt-5">
            <h1 className="text-[22px] font-bold text-white tracking-tight">Pilih Layanan</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Anda dapat memilih lebih dari satu layanan dalam satu transaksi.
            </p>
          </div>
        )}
      </header>

      {/* ================================================================ */}
      {/* CASE 1: BARBERSHOP TUTUP (DILUAR JAM OPERASIONAL)                */}
      {/* ================================================================ */}
      {!isOpen ? (
        <>
          <main className="flex-1 space-y-4 px-4 pb-8 pt-2">
            <div className="rounded-3xl bg-[#0F1D33]/95 border border-rose-500/30 p-6 text-center space-y-4 shadow-xl backdrop-blur-md animate-in fade-in duration-300">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-inner">
                <Moon className="h-8 w-8" />
              </div>

              <div className="space-y-1.5">
                <span className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold tracking-wider uppercase">
                  Toko Tutup
                </span>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Barbershop Sedang Tutup
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-[320px] mx-auto">
                  Mohon maaf, pemesanan layanan saat ini tidak dapat dilakukan karena sedang berada
                  di luar jam operasional outlet.
                </p>
              </div>

              {/* Operating Hours Details Box */}
              <div className="bg-[#0A1424] border border-slate-700/60 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Jam Operasional:</span>
                  <span className="font-bold text-white">
                    {displayJamBuka} - {displayJamTutup} WIB
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Waktu Sekarang:</span>
                  <span className="font-semibold text-amber-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {currentWibTime} WIB
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 text-center">
                  Pemesanan dibuka kembali pukul{" "}
                  <strong className="text-emerald-400 font-bold">{displayJamBuka} WIB</strong>
                </div>
              </div>

              {/* Direct WhatsApp Action Button */}
              {shopInfo?.no_hp && (
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${formatWaNumber(shopInfo.no_hp)}?text=${encodeURIComponent(
                      `Halo ${shopInfo.nama_barbershop}, saya ingin bertanya jadwal buka dan layanan barbershop.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Hubungi via WhatsApp ({shopInfo.no_hp})</span>
                  </a>
                </div>
              )}
            </div>
          </main>

          {/* Locked Bottom Action Bar */}
          <BottomActionBar>
            <PrimaryButton
              disabled
              className="opacity-60 cursor-not-allowed bg-slate-800 text-slate-400 border border-slate-700"
            >
              <Lock className="h-4 w-4" />
              <span>Barbershop Tutup (Buka {displayJamBuka} WIB)</span>
            </PrimaryButton>
          </BottomActionBar>
        </>
      ) : (
        /* ================================================================ */
        /* CASE 2: BARBERSHOP BUKA (PILIH LAYANAN NORMAL)                   */
        /* ================================================================ */
        <>
          <main className="flex-1 space-y-3 px-4 pb-6 pt-3">
            {error ? (
              <ErrorState message="Gagal memuat layanan. Silakan coba lagi." />
            ) : loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              serviceList.map((service) => {
                const selected = cartItems.some((i) => i.service.id === service.id);
                return (
                  <GlassCard key={service.id} selected={selected}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Scissors
                            className="h-4 w-4 shrink-0 text-primary-soft"
                            strokeWidth={2}
                          />
                          <p className="min-w-0 text-[15px] font-semibold leading-snug">
                            {service.name}
                          </p>
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                          {service.description}
                        </p>
                        <p className="mt-2 text-[16px] font-bold text-primary-soft">
                          {formatRupiah(service.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={
                          selected
                            ? `Hapus ${service.name} dari keranjang`
                            : `Tambah ${service.name}`
                        }
                        onClick={() => actions.toggleService(service)}
                        className={
                          selected
                            ? "flex h-11 min-w-[44px] items-center gap-1 rounded-[12px] bg-success/20 px-3 text-[13px] font-semibold text-success ring-1 ring-success/40 transition-all active:scale-95"
                            : "glass-2 flex h-11 min-w-[44px] items-center gap-1 rounded-[12px] px-3 text-[13px] font-semibold transition-all active:scale-95"
                        }
                      >
                        {selected ? (
                          <>
                            <Check className="h-4 w-4" strokeWidth={2} /> Dipilih
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" strokeWidth={2} /> Tambah
                          </>
                        )}
                      </button>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </main>

          <BottomActionBar>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted-foreground">
                {count > 0 ? `${count} layanan dipilih` : "Belum ada layanan dipilih"}
              </span>
              <span className="text-[16px] font-bold">{formatRupiah(total)}</span>
            </div>
            <PrimaryButton
              disabled={count === 0}
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/customer/capster` as any })
              }
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              Lanjut Pilih Capster
            </PrimaryButton>
          </BottomActionBar>
        </>
      )}
    </MobileShell>
  );
}
