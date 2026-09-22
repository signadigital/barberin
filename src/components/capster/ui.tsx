import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Grid,
  Info,
  ListOrdered,
  LogOut,
  Receipt,
  Scissors,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatRupiah, formatTransactionId, formatWibClock, useLiveClock } from "@/lib/format";
import { BarberinLogo, GlassCard } from "@/components/barberin/ui";
import {
  capsterActions,
  useCapster,
  getCapsterAuth,
  type CapsterService,
  type CapsterTransaction,
  type ShiftInfo,
  type TransactionStatus,
} from "@/lib/capster-store";
import { getCapsterTransactions } from "@/lib/capster-transactions";

// ============================================================================
// TENANT SLUG HELPERS
// ============================================================================
export function useCapsterTenantSlug(): string {
  const { barbershopSlug } = useCapster();
  if (barbershopSlug) return barbershopSlug;
  if (typeof window !== "undefined") {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (
      parts.length > 0 &&
      parts[0] !== "owner" &&
      parts[0] !== "capster" &&
      parts[0] !== "customer" &&
      parts[0] !== "superadmin"
    ) {
      return parts[0]!;
    }
  }
  return "";
}

export function getCapsterTenantPath(slug: string, path: string): string {
  if (!slug) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${slug}${cleanPath}`;
}

// ============================================================================
// 0. AUTH GUARD
// ============================================================================
export function CapsterAuthGuard({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isLoggedIn } = useCapster();
  const navigate = useNavigate();
  const slug = useCapsterTenantSlug();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const hasAuth = isLoggedIn || getCapsterAuth(slug || undefined);
    if (!hasAuth) {
      navigate({ to: getCapsterTenantPath(slug, "/capster/login") as any, replace: true });
    }
  }, [mounted, isLoggedIn, slug, navigate]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Memuat sesi capster...</p>
        </div>
      </div>
    );
  }

  const hasAuth = isLoggedIn || getCapsterAuth(slug || undefined);
  if (!hasAuth) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Mengarahkan ke login capster...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Komponen Notifikasi Transaksi yang Dapat Digeser (Swipe to Dismiss) & Memiliki Tombol Close
function SwipeableNotificationCard({
  trx,
  onSelect,
  onDismiss,
}: {
  trx: CapsterTransaction;
  onSelect: () => void;
  onDismiss: (id: string) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startXRef.current;
    currentXRef.current = e.clientX;
    setOffsetX(diff);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 75) {
      setIsRemoving(true);
      setOffsetX(diff > 0 ? 320 : -320);
      setTimeout(() => {
        onDismiss(trx.id);
      }, 180);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] transition-all",
        isRemoving && "opacity-0 scale-95 h-0 my-0 py-0 overflow-hidden duration-200",
      )}
      style={{ touchAction: "pan-y" }}
    >
      {/* Background saat kartu digeser */}
      <div className="absolute inset-0 flex items-center justify-between px-4 bg-danger/25 rounded-[14px] text-danger text-[11px] font-bold">
        <span className="flex items-center gap-1">
          <X className="h-3.5 w-3.5" /> Hapus
        </span>
        <span className="flex items-center gap-1">
          Hapus <X className="h-3.5 w-3.5" />
        </span>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          if (Math.abs(offsetX) < 8) {
            onSelect();
          }
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          opacity: Math.max(0.35, 1 - Math.abs(offsetX) / 240),
          transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease",
        }}
        className="relative z-10 w-full text-left glass-2 rounded-[14px] p-3 border border-white/5 space-y-1.5 cursor-grab active:cursor-grabbing hover:bg-white/10 select-none transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[11px] font-bold text-primary-soft truncate">
              #{formatTransactionId(trx.id)}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">• {trx.time}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning ring-1 ring-warning/30">
              <Clock className="h-2.5 w-2.5" />
              Menunggu
            </span>
            {/* Tombol Close / Hapus individual */}
            <button
              type="button"
              title="Hapus notifikasi ini"
              aria-label="Hapus notifikasi ini"
              onClick={(e) => {
                e.stopPropagation();
                setIsRemoving(true);
                setTimeout(() => onDismiss(trx.id), 180);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-muted-foreground hover:bg-white/25 hover:text-white transition-all active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p className="truncate text-[13px] font-bold text-foreground">
          {trx.customerName}
        </p>

        <p className="truncate text-[11px] text-muted-foreground">
          {trx.serviceNames}
        </p>

        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[12px]">
          <div>
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {trx.paymentMethod}
            </span>
            <p className="font-bold text-[13px] text-foreground">
              {formatRupiah(trx.total)}
            </p>
          </div>
          <span className="flex h-6 items-center justify-center rounded-[8px] bg-primary/25 px-2.5 text-[11px] font-bold text-primary-soft ring-1 ring-primary/40">
            Konfirmasi &gt;
          </span>
        </div>
      </div>
    </div>
  );
}

// Persistent dismissed notification storage
const getDismissedNotifStorageKey = (capsterId?: string | null) =>
  `barberin_dismissed_notif_${capsterId || "global"}`;

const getStoredDismissedIds = (capsterId?: string | null): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getDismissedNotifStorageKey(capsterId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredDismissedIds = (ids: string[], capsterId?: string | null) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getDismissedNotifStorageKey(capsterId), JSON.stringify(ids));
  } catch {}
};

// Session toasted transactions storage (so a toast is not shown repeatedly in a session)
const getSessionToastedStorageKey = (capsterId?: string | null) =>
  `barberin_toasted_trx_${capsterId || "global"}`;

const getSessionToastedIds = (capsterId?: string | null): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(getSessionToastedStorageKey(capsterId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveSessionToastedId = (id: string, capsterId?: string | null) => {
  if (typeof window === "undefined") return;
  try {
    const set = getSessionToastedIds(capsterId);
    set.add(id);
    sessionStorage.setItem(
      getSessionToastedStorageKey(capsterId),
      JSON.stringify(Array.from(set)),
    );
  } catch {}
};

// Header Capster
export function CapsterHeader({
  title,
  subtitle,
  showBack = true,
  backTo,
  showActions = true,
}: {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  showActions?: boolean;
}) {
  const router = useRouter();
  const slug = useCapsterTenantSlug();
  const { transactions, capsterId, shiftInfo } = useCapster();
  const [showNotifications, setShowNotifications] = useState(false);
  const [headerPending, setHeaderPending] = useState<CapsterTransaction[]>([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() =>
    getStoredDismissedIds(capsterId),
  );
  const prevPendingIdsRef = useRef<Set<string> | null>(null);

  const pathname = router.state.location.pathname;
  const isCheckInPage = pathname.includes("/check-in");
  const isShiftActive = shiftInfo.isCheckedIn && !shiftInfo.isShiftEnded;
  // Notifikasi konfirmasi pembayaran HANYA boleh aktif jika capster sudah aktif check-in dan bukan di halaman check-in
  const allowNotifications = Boolean(showActions && isShiftActive && !isCheckInPage);

  // Jika sedang di halaman check-in, tutup toast konfirmasi yang mungkin masih aktif
  useEffect(() => {
    if (isCheckInPage) {
      toast.dismiss();
    }
  }, [isCheckInPage]);

  // Sync dismissed IDs when capsterId changes
  useEffect(() => {
    setDismissedNotifIds(getStoredDismissedIds(capsterId));
  }, [capsterId]);

  // Background polling agar notifikasi selalu realtime di semua halaman capster
  // CATATAN: Hanya jalan jika allowNotifications aktif (sudah check-in & berada di halaman capster)
  useEffect(() => {
    if (!allowNotifications || !capsterId) return;
    let mounted = true;

    const fetchPending = async () => {
      try {
        const data = await getCapsterTransactions({ data: { capsterId } });
        if (!mounted || !data) return;
        const pending = (data as CapsterTransaction[]).filter((t) => t.status === "Menunggu");
        setHeaderPending(pending);
      } catch {
        // silent error on background poll
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [allowNotifications, capsterId]);

  // Gabungkan transaksi pending dari polling header dan transaksi dari store (deduplikasi by id)
  const allPendingTransactions = useMemo(() => {
    if (!allowNotifications) return [];
    const map = new Map<string, CapsterTransaction>();
    for (const t of transactions) {
      if (t.status === "Menunggu" && (!capsterId || !t.capsterId || t.capsterId === capsterId)) {
        map.set(t.id, t);
      }
    }
    for (const t of headerPending) {
      if (t.status === "Menunggu" && (!capsterId || !t.capsterId || t.capsterId === capsterId)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [allowNotifications, transactions, headerPending, capsterId]);

  // Bersihkan ID dari dismissedNotifIds jika transaksi tersebut sudah dikonfirmasi atau dibatalkan
  useEffect(() => {
    if (dismissedNotifIds.length === 0 || allPendingTransactions.length === 0) return;
    const activePendingIds = new Set(allPendingTransactions.map((t) => t.id));
    const cleaned = dismissedNotifIds.filter((id) => activePendingIds.has(id));
    if (cleaned.length !== dismissedNotifIds.length) {
      setDismissedNotifIds(cleaned);
      saveStoredDismissedIds(cleaned, capsterId);
    }
  }, [allPendingTransactions, dismissedNotifIds, capsterId]);

  // Notifikasi yang masih aktif (belum di-close/swipe oleh capster)
  const visiblePendingTransactions = useMemo(() => {
    return allPendingTransactions.filter((t) => !dismissedNotifIds.includes(t.id));
  }, [allPendingTransactions, dismissedNotifIds]);

  const pendingCount = visiblePendingTransactions.length;

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissedNotifIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveStoredDismissedIds(next, capsterId);
        return next;
      });
      saveSessionToastedId(id, capsterId);
    },
    [capsterId],
  );

  const handleClearDismissed = useCallback(() => {
    setDismissedNotifIds([]);
    saveStoredDismissedIds([], capsterId);
  }, [capsterId]);

  // Notifikasi Toast ketika ada transaksi baru yang masuk dan butuh konfirmasi
  useEffect(() => {
    if (!allowNotifications) return;

    const currentPendingIds = new Set(visiblePendingTransactions.map((t) => t.id));

    // Pada render/mount pertama, rekam ID yang sudah ada agar tidak spam toast untuk transaksi lama saat halaman dibuka
    if (prevPendingIdsRef.current === null) {
      prevPendingIdsRef.current = currentPendingIds;
      return;
    }

    const sessionToasted = getSessionToastedIds(capsterId);

    // Cari transaksi baru yang belum pernah di-toast pada sesi ini dan belum di-dismiss
    const newlyArrived = visiblePendingTransactions.filter(
      (t) =>
        !prevPendingIdsRef.current?.has(t.id) &&
        !sessionToasted.has(t.id) &&
        !dismissedNotifIds.includes(t.id),
    );

    if (newlyArrived.length > 0 && newlyArrived[0]) {
      const latest = newlyArrived[0];
      const toastId = `pending-toast-${latest.id}`;

      saveSessionToastedId(latest.id, capsterId);

      toast.info("Permintaan Konfirmasi Pembayaran", {
        id: toastId,
        description: `${latest.customerName} meminta konfirmasi (${formatRupiah(latest.total)})`,
        action: {
          label: "Konfirmasi",
          onClick: () => {
            handleDismiss(latest.id);
            router.navigate({
              to: getCapsterTenantPath(slug, `/capster/transactions/${latest.id}`) as any,
            });
          },
        },
        cancel: {
          label: "Tutup",
          onClick: () => {
            handleDismiss(latest.id);
            toast.dismiss(toastId);
          },
        },
        onDismiss: () => {
          handleDismiss(latest.id);
        },
        closeButton: true,
        dismissible: true,
        duration: 9000,
      });
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [visiblePendingTransactions, dismissedNotifIds, capsterId, router, handleDismiss]);

  return (
    <header className="glass-3 safe-top sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-x-0 border-t-0 px-4 pb-3">
      {showBack ? (
        <button
          type="button"
          aria-label="Kembali"
          onClick={() => (backTo ? router.navigate({ to: backTo }) : router.history.back())}
          className="glass-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] transition-colors active:bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
      ) : (
        <BarberinLogo className="h-9 w-9" />
      )}

      <div className="min-w-0 text-center">
        {title ? <h1 className="truncate text-[18px] font-bold leading-tight">{title}</h1> : null}
        {subtitle ? (
          <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        {showActions ? (
          <>
            <button
              type="button"
              aria-label="Notifikasi"
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "glass-1 relative flex h-10 w-10 items-center justify-center rounded-[12px] transition-all active:scale-[0.95]",
                pendingCount > 0 && "ring-1 ring-warning/40",
                showNotifications && "bg-white/20",
              )}
            >
              <Bell
                className={cn(
                  "h-4 w-4 transition-colors",
                  pendingCount > 0 ? "text-warning" : "text-primary-soft",
                )}
                strokeWidth={2}
              />
              {pendingCount > 0 ? (
                <>
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-sm">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                  <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-danger/50 pointer-events-none" />
                </>
              ) : null}
            </button>
            <Link
              to={getCapsterTenantPath(slug, "/capster/login") as any}
              onClick={() => capsterActions.logout()}
              aria-label="Keluar"
              className="glass-1 flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors active:bg-white/15"
            >
              <LogOut className="h-4 w-4 text-primary-soft" strokeWidth={2} />
            </Link>
          </>
        ) : (
          <div className="h-10 w-10 shrink-0" aria-hidden />
        )}
      </div>

      {/* Popover / Panel Notifikasi Realtime */}
      {showNotifications && (
        <>
          {/* Backdrop transparan untuk menutup saat klik luar */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowNotifications(false)}
          />

          {/* Dialog Notifikasi */}
          <div className="absolute left-3 right-3 top-[calc(100%+6px)] z-50 rounded-[20px] border border-white/15 bg-[#0F172A]/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-warning/20 text-warning">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[14px] font-bold text-foreground">
                      Konfirmasi Pembayaran
                    </h3>
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-warning/20 px-1.5 py-0.2 text-[10px] font-bold text-warning ring-1 ring-warning/30">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Geser kartu atau tekan ✕ untuk menghapus
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setShowNotifications(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-muted-foreground hover:text-foreground active:scale-[0.95]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-0.5">
              {pendingCount === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-success/70 mb-1.5" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Tidak Ada Permintaan
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {dismissedNotifIds.length > 0
                      ? "Semua notifikasi telah ditutup atau dikonfirmasi."
                      : "Semua pembayaran saat ini sudah dikonfirmasi."}
                  </p>
                  {dismissedNotifIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearDismissed}
                      className="mt-2.5 text-[11px] font-semibold text-primary-soft hover:underline"
                    >
                      Tampilkan Kembali ({dismissedNotifIds.length}) Notifikasi
                    </button>
                  )}
                </div>
              ) : (
                visiblePendingTransactions.map((trx) => (
                  <SwipeableNotificationCard
                    key={trx.id}
                    trx={trx}
                    onSelect={() => {
                      setShowNotifications(false);
                      handleDismiss(trx.id);
                      router.navigate({
                        to: getCapsterTenantPath(slug, `/capster/transactions/${trx.id}`) as any,
                      });
                    }}
                    onDismiss={(id) => {
                      handleDismiss(id);
                    }}
                  />
                ))
              )}
            </div>

            {pendingCount > 0 && (
              <div className="mt-2.5 border-t border-white/10 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    router.navigate({ to: getCapsterTenantPath(slug, "/capster/transactions") as any });
                  }}
                  className="text-[12px] font-semibold text-primary-soft hover:underline"
                >
                  Lihat Semua Transaksi &gt;
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}

// Bottom Navigation Capster
export function CapsterBottomNav({
  activeTab,
}: {
  activeTab?: "dashboard" | "transactions" | "services" | "account";
}) {
  const slug = useCapsterTenantSlug();
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Grid, to: getCapsterTenantPath(slug, "/capster/dashboard") },
    { id: "transactions", label: "Transaksi", icon: ListOrdered, to: getCapsterTenantPath(slug, "/capster/transactions") },
    { id: "services", label: "Layanan", icon: Scissors, to: getCapsterTenantPath(slug, "/capster/services") },
  ];

  return (
    <nav
      aria-label="Navigasi Capster"
      className="glass-3 safe-bottom sticky bottom-0 z-20 mt-auto border-x-0 border-b-0 px-3 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]"
    >
      <div className="grid grid-cols-3 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[12px] py-1.5 transition-colors",
                isActive
                  ? "text-primary-soft font-semibold"
                  : "text-muted-foreground hover:text-foreground active:bg-white/5",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  isActive && "bg-primary/20 ring-1 ring-primary/40",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[11px] leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Summary Card untuk Dashboard
export function SummaryCard({
  icon: Icon,
  title,
  value,
  delta,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  delta?: string;
  tone?: "primary" | "success" | "purple" | "warning";
}) {
  const toneBg: Record<string, string> = {
    primary: "bg-primary/20 text-primary-soft ring-1 ring-primary/30",
    success: "bg-success/20 text-success ring-1 ring-success/30",
    purple: "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30",
    warning: "bg-warning/20 text-warning ring-1 ring-warning/30",
  };

  return (
    <GlassCard className="p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-[8px]", toneBg[tone])}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
      </div>
      <div className="text-[20px] font-extrabold tracking-tight">{value}</div>
      {delta ? (
        <p className="text-[11px] font-medium text-success flex items-center gap-1">
          {delta}
        </p>
      ) : null}
    </GlassCard>
  );
}

// Card Info Shift
export function ShiftInfoCard({ shift }: { shift: ShiftInfo }) {
  const liveClock = useLiveClock(1000);

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
        <Calendar className="h-4 w-4 text-primary-soft" strokeWidth={2} />
        <h2 className="text-[14px] font-bold">Informasi Shift Hari Ini</h2>
      </div>
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tanggal</span>
          <span className="font-semibold">{shift.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Hari</span>
          <span className="font-semibold">{shift.day}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Waktu Sekarang</span>
          <span className="font-semibold text-emerald-400 font-mono">
            {formatWibClock(liveClock, { withDate: false, withSeconds: true })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Waktu Mulai</span>
          <span className="font-semibold text-primary-soft">{shift.startTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Waktu Akhir</span>
          <span className="font-semibold text-primary-soft">{shift.endTime}</span>
        </div>
      </div>
    </GlassCard>
  );
}

// Card Status Check In
export function CheckInStatusCard({ isCheckedIn }: { isCheckedIn: boolean }) {
  return (
    <GlassCard className="space-y-3 p-4">
      <h2 className="text-[14px] font-bold">Status Check In</h2>
      <div className="glass-2 flex items-center gap-3 rounded-[14px] p-3.5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            isCheckedIn ? "bg-success/20 text-success ring-1 ring-success/40" : "bg-primary/20 text-primary-soft",
          )}
        >
          <CheckCircle2 className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-bold">
            {isCheckedIn ? "Anda Sudah Check In" : "Belum Ada Capster Yang Check In"}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {isCheckedIn
              ? "Shift Anda aktif dan dapat memproses transaksi."
              : "Jadilah capster pertama yang check in hari ini."}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// Section Transaksi Belum Dikonfirmasi di Dashboard
export function UnconfirmedTransactionsSection({
  transactions,
}: {
  transactions: CapsterTransaction[];
}) {
  const slug = useCapsterTenantSlug();
  return (
    <GlassCard className="space-y-3.5 p-4 rounded-[20px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-foreground">
            TRANSAKSI BELUM DIKONFIRMASI
          </h2>
          {transactions.length > 0 && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-warning/20 px-1.5 text-[11px] font-bold text-warning ring-1 ring-warning/30">
              {transactions.length}
            </span>
          )}
        </div>
        <Link
          to={getCapsterTenantPath(slug, "/capster/transactions") as any}
          className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-primary-soft hover:text-primary whitespace-nowrap transition-colors"
        >
          <span>Lihat Semua</span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="py-7 text-center text-muted-foreground">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <p className="text-[13px] font-semibold text-foreground">
            Tidak Ada Transaksi Menunggu
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Semua transaksi saat ini sudah dikonfirmasi.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 pb-0.5 custom-scrollbar">
          {transactions.map((trx) => (
            <Link
              key={trx.id}
              to={getCapsterTenantPath(slug, `/capster/transactions/${trx.id}`) as any}
              className="group block rounded-[16px] p-3.5 bg-slate-900/40 hover:bg-slate-800/60 border border-white/[0.08] hover:border-primary/40 transition-all duration-200 active:scale-[0.99] shadow-sm"
            >
              {/* Row 1: ID Transaksi & Waktu */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                <span className="font-mono text-[11px] font-semibold text-primary-soft/90 truncate max-w-[170px] sm:max-w-[210px]">
                  #{formatTransactionId(trx.id)}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground shrink-0 flex items-center gap-1">
                  <span>•</span>
                  <span>{trx.time}</span>
                </span>
              </div>

              {/* Row 2: Nama Pelanggan & Layanan (kiri) vs Status Menunggu (kanan) */}
              <div className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-foreground truncate group-hover:text-primary-soft transition-colors">
                    {trx.customerName}
                  </h3>
                  <p className="text-[12px] text-muted-foreground truncate leading-snug mt-0.5">
                    {trx.serviceNames}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning ring-1 ring-warning/30 shadow-sm mt-0.5">
                  <Clock className="h-3 w-3" strokeWidth={2.5} />
                  <span>Menunggu</span>
                </span>
              </div>

              {/* Row 3: Metode Pembayaran (kiri) vs Total Harga & Tombol Konfirmasi (kanan) */}
              <div className="flex items-end justify-between gap-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center pb-0.5">
                  <span className="inline-flex items-center rounded-[6px] bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {trx.paymentMethod}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[14px] font-extrabold text-foreground tracking-tight">
                    {formatRupiah(trx.total)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[8px] bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-bold shadow-[0_2px_8px_rgba(78,120,255,0.35)] group-hover:bg-primary/90 transition-all">
                    <span>Konfirmasi</span>
                    <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// Card Section Status Layanan di Dashboard (kompatibilitas)
export function ServiceStatusSection({
  selesai,
  sedangDikerjakan,
  menunggu,
  dibatalkan,
}: {
  selesai: number;
  sedangDikerjakan: number;
  menunggu: number;
  dibatalkan: number;
}) {
  const slug = useCapsterTenantSlug();
  const items = [
    { label: "Selesai", count: selesai, color: "bg-success", text: "text-success" },
    { label: "Sedang Dikerjakan", count: sedangDikerjakan, color: "bg-info", text: "text-info" },
    { label: "Menunggu", count: menunggu, color: "bg-warning", text: "text-warning" },
    { label: "Dibatalkan", count: dibatalkan, color: "bg-danger", text: "text-danger" },
  ];

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-[14px] font-bold uppercase tracking-wider">STATUS LAYANAN</h2>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2.5">
              <span className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-white/10", item.color)} />
              <span className="font-medium">{item.label}</span>
            </div>
            <span className={cn("font-bold text-[14px]", item.text)}>{item.count}</span>
          </div>
        ))}
      </div>
      <Link
        to={getCapsterTenantPath(slug, "/capster/services") as any}
        className="mt-2 flex items-center justify-end text-[12px] font-semibold text-primary-soft hover:underline"
      >
        Lihat Semua Layanan &gt;
      </Link>
    </GlassCard>
  );
}

// Action Buttons Hari Ini (Transaksi Hari Ini & Akhiri Shift)
export function DailyActionButtons({
  onEndShift,
}: {
  onEndShift: () => void;
}) {
  const slug = useCapsterTenantSlug();
  return (
    <div className="grid grid-cols-2 gap-2.5 pt-1">
      <Link
        to={getCapsterTenantPath(slug, "/capster/transactions/today") as any}
        className="glass-2 flex h-11 items-center justify-center rounded-[12px] px-3 text-[13px] font-semibold text-foreground transition-all active:scale-[0.98]"
      >
        Transaksi Hari Ini
      </Link>
      <button
        type="button"
        onClick={onEndShift}
        className="flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-danger/40 bg-danger/15 px-3 text-[13px] font-semibold text-danger transition-all active:scale-[0.98]"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
        Akhiri Shift
      </button>
    </div>
  );
}

// Kompatibilitas DailySummaryCard (hanya tombol aksi)
export function DailySummaryCard({
  onEndShift,
}: {
  pendapatan?: number;
  transaksi?: number;
  layanan?: number;
  selesai?: number;
  belumSelesai?: number;
  onEndShift: () => void;
}) {
  return <DailyActionButtons onEndShift={onEndShift} />;
}

// Badge Status Transaksi
export function TransactionStatusBadge({ status }: { status: TransactionStatus | string }) {
  const map: Record<string, { bg: string; text: string; icon: LucideIcon; label: string }> = {
    Selesai: { bg: "bg-success/20 ring-success/40", text: "text-success", icon: CheckCircle2, label: "Selesai" },
    completed: { bg: "bg-success/20 ring-success/40", text: "text-success", icon: CheckCircle2, label: "Selesai" },
    Menunggu: { bg: "bg-warning/20 ring-warning/40", text: "text-warning", icon: Clock, label: "Menunggu" },
    waiting: { bg: "bg-warning/20 ring-warning/40", text: "text-warning", icon: Clock, label: "Menunggu" },
    "Sedang Dilayani": { bg: "bg-primary/20 ring-primary/40", text: "text-primary-soft", icon: Scissors, label: "Sedang Dilayani" },
    in_service: { bg: "bg-primary/20 ring-primary/40", text: "text-primary-soft", icon: Scissors, label: "Sedang Dilayani" },
    Batal: { bg: "bg-danger/20 ring-danger/40", text: "text-danger", icon: AlertCircle, label: "Dibatalkan" },
    cancelled: { bg: "bg-danger/20 ring-danger/40", text: "text-danger", icon: AlertCircle, label: "Dibatalkan" },
    Dibatalkan: { bg: "bg-danger/20 ring-danger/40", text: "text-danger", icon: AlertCircle, label: "Dibatalkan" },
    Kedaluwarsa: { bg: "bg-rose-900/30 ring-rose-500/40", text: "text-rose-400", icon: Clock, label: "Kedaluwarsa" },
    expired: { bg: "bg-rose-900/30 ring-rose-500/40", text: "text-rose-400", icon: Clock, label: "Kedaluwarsa" },
  };

  const fallback = { bg: "bg-warning/20 ring-warning/40", text: "text-warning", icon: Clock, label: "Menunggu" };
  const conf = map[status] ?? map["Menunggu"] ?? fallback;
  const Icon = conf.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
        conf.bg,
        conf.text,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {conf.label}
    </span>
  );
}

// Card Transaksi Item
export function CapsterTransactionCard({
  trx,
  onClick,
}: {
  trx: CapsterTransaction;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-all active:scale-[0.99]"
    >
      <GlassCard className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-mono text-[13px] font-bold text-primary-soft">
              #{formatTransactionId(trx.id)}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {trx.date} • {trx.time}
            </p>
          </div>
          <TransactionStatusBadge status={trx.status} />
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[14px] font-bold leading-tight text-foreground">
              {trx.customerName}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-primary-soft">
              Capster: {trx.capsterName}
            </span>
          </div>
          <p className="truncate text-[12px] text-muted-foreground">{trx.serviceNames}</p>
          {trx.status === "Batal" && trx.notes ? (
            <p className="text-[11px] text-danger/90 line-clamp-1 italic bg-danger/10 px-2 py-1 rounded-[6px] border border-danger/20 mt-1">
              {trx.notes}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[13px]">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {trx.paymentMethod}
          </span>
          <span className="font-bold text-[14px] text-foreground">{formatRupiah(trx.total)}</span>
        </div>
      </GlassCard>
    </button>
  );
}

// Modal Konfirmasi Akhiri Shift
export function ShiftEndModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <GlassCard className="w-full max-w-[360px] rounded-[24px] p-5 space-y-4 shadow-2xl border-white/20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/20 text-danger ring-1 ring-danger/40 mx-auto">
          <LogOut className="h-7 w-7" strokeWidth={2} />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-[18px] font-bold text-foreground">Akhiri Shift?</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Data transaksi dan ringkasan hari ini akan disimpan sebelum dashboard di-reset untuk siklus berikutnya.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="glass-2 flex h-11 items-center justify-center rounded-[12px] text-[14px] font-semibold text-foreground transition-all active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-11 items-center justify-center rounded-[12px] bg-danger text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all active:scale-[0.98]"
          >
            Akhiri Shift
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
