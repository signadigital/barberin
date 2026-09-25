import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Scissors,
  Home,
  Users,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  Calendar,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  XCircle,
  Clock,
  CheckCircle2,
  X,
  Menu,
  ArrowRight,
  RefreshCw,
  Activity,
  Check,
  UserCheck,
  LogIn,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { formatRupiah, formatWibClock, useLiveClock } from "@/lib/format";
import { BarberinLogo } from "@/components/barberin/ui";
import {
  type OwnerDashboardMetrics,
  type OwnerPeriodFilter,
  type OwnerRecentTransaction,
  type OwnerCapsterPerformance,
  type OwnerRecentCancellation,
  type OwnerNotificationItem,
  type OwnerNotificationType,
  getOwnerNotifications,
  markNotificationAsRead,
} from "@/lib/owner";
import { ownerActions, useOwner, getOwnerAuth } from "@/lib/owner-store";
import { useSuperadmin, superadminActions } from "@/lib/superadmin-store";

export function useTenantSlug(): string {
  const { user } = useOwner();
  if (user.barbershopSlug) return user.barbershopSlug;
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

export function getTenantPath(slug: string, path: string): string {
  if (!slug) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${slug}${cleanPath}`;
}

// ============================================================================
// 0. AUTH GUARD
// ============================================================================
export function OwnerAuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isLoggedIn } = useOwner();
  const navigate = useNavigate();
  const slug = useTenantSlug();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const hasAuth = isLoggedIn || getOwnerAuth(slug || undefined);
    if (!hasAuth) {
      navigate({ to: "/owner/login" as any, replace: true });
    }
  }, [mounted, isLoggedIn, slug, navigate]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  const hasAuth = isLoggedIn || getOwnerAuth(slug || undefined);
  if (!hasAuth) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Mengarahkan ke login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// 1. SIDEBAR (DESKTOP)
// ============================================================================
export function OwnerSidebar({ activePath }: { activePath: string }) {
  const navigate = useNavigate();
  const slug = useTenantSlug();

  const navItems = [
    { label: "Dashboard", href: getTenantPath(slug, "/owner/dashboard"), icon: Home },
    { label: "Layanan", href: getTenantPath(slug, "/owner/services"), icon: Scissors },
    { label: "Gaji", href: getTenantPath(slug, "/owner/gaji"), icon: Wallet },
    { label: "Manajemen Akun Capster", href: getTenantPath(slug, "/owner/capsters"), icon: Users },
    { label: "Audit Aktivitas", href: getTenantPath(slug, "/owner/audit-activities"), icon: Activity },
    { label: "Audit Keuangan", href: getTenantPath(slug, "/owner/audit-finance"), icon: FileText },
  ];

  const bottomItems = [
    { label: "Setelan", href: getTenantPath(slug, "/owner/settings"), icon: Settings },
    { label: "Pusat Bantuan", href: getTenantPath(slug, "/owner/help"), icon: HelpCircle },
  ];

  const handleLogout = () => {
    ownerActions.logout();
    navigate({ to: "/owner/login" as any });
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0A1424] border-r border-slate-800/80 h-screen sticky top-0 text-slate-300 p-5 select-none shrink-0 z-40 overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6 shrink-0">
        <BarberinLogo className="h-10 w-10 shrink-0" />
        <div>
          <div className="font-extrabold tracking-wider text-white text-base leading-none">
            BARBERIN
          </div>
          <div className="text-[11px] text-slate-400 mt-1 leading-tight font-medium">
            Modern Barbershop
            <br />
            Management System
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-px bg-slate-800/80 my-4 shrink-0" />

      {/* Bottom Nav */}
      <div className="space-y-1.5 shrink-0">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// 1.5. NOTIFICATION BELL & POPOVER (OWNER)
// ============================================================================
export function OwnerNotificationBell({
  variant = "dark",
  isMobile = false,
}: {
  variant?: "dark" | "light";
  isMobile?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<OwnerNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "komisi" | "transaksi" | "pembatalan" | "shift"
  >("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("barberin_owner_read_notifs");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const navigate = useNavigate();
  const slug = useTenantSlug();
  const isLight = variant === "light";

  const fetchNotifs = async () => {
    try {
      setLoading(true);
      const res = await getOwnerNotifications({ data: { limit: 30 } });
      if (res?.notifications) {
        setNotifications(res.notifications);
      }
    } catch (e) {
      console.error("Gagal memuat notifikasi owner:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetchNotifs();
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifs();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const saveReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "barberin_owner_read_notifs",
          JSON.stringify(Array.from(newSet)),
        );
      } catch {}
    }
  };

  const handleMarkAllRead = () => {
    const allIds = new Set(readIds);
    notifications.forEach((n) => allIds.add(n.id));
    saveReadIds(allIds);
  };

  const isCommissionType = (type: string) =>
    type === "pengajuan_komisi" ||
    type === "persetujuan_komisi" ||
    type === "penolakan_komisi" ||
    type === "pembayaran_komisi";

  const handleItemClick = (item: OwnerNotificationItem) => {
    const updated = new Set(readIds);
    updated.add(item.id);
    saveReadIds(updated);
    if (item.id.startsWith("db-notif-")) {
      markNotificationAsRead({ data: { notificationId: item.id } }).catch(() => {});
    }
    setIsOpen(false);
    navigate({ to: getTenantPath(slug, item.link) as any });
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const countKomisi = notifications.filter((n) => isCommissionType(n.type)).length;
  const countTx = notifications.filter((n) => n.type === "tx_success").length;
  const countCancel = notifications.filter((n) => n.type === "tx_cancelled").length;
  const countShift = notifications.filter(
    (n) => n.type === "capster_checkin" || n.type === "capster_shift_end",
  ).length;

  const filteredNotifs = notifications.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "komisi") return isCommissionType(item.type);
    if (activeTab === "transaksi") return item.type === "tx_success";
    if (activeTab === "pembatalan") return item.type === "tx_cancelled";
    if (activeTab === "shift")
      return item.type === "capster_checkin" || item.type === "capster_shift_end";
    return true;
  });

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifikasi Aktivitas"
        className={
          isMobile
            ? `p-1.5 rounded-lg transition-colors relative ${
                isOpen
                  ? isLight
                    ? "bg-slate-200 text-blue-600"
                    : "bg-slate-800 text-blue-400"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`
            : `p-2 rounded-xl transition-colors relative ${
                isOpen
                  ? isLight
                    ? "bg-slate-200 text-blue-600"
                    : "bg-slate-800 text-blue-400"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`
        }
      >
        <Bell className={isMobile ? "h-5 w-5" : "h-5 w-5"} />
        {unreadCount > 0 ? (
          <>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#0A1424]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
            <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-rose-500 animate-ping opacity-40 pointer-events-none" />
          </>
        ) : (
          <span
            className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-slate-500/40 ring-2 ${
              isLight ? "ring-white" : "ring-[#0A1424]"
            }`}
          />
        )}
      </button>

      {/* Popover / Panel Notifikasi */}
      {isOpen && (
        <>
          {/* Backdrop for closing when clicking outside */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`absolute right-0 top-[calc(100%+8px)] z-50 rounded-2xl shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 ${
              isMobile
                ? "w-[330px] sm:w-[380px] -right-12 sm:right-0"
                : "w-[420px]"
            } ${
              isLight
                ? "bg-white/95 border border-slate-200 backdrop-blur-xl text-slate-800 shadow-slate-300/50"
                : "bg-[#0D192B]/95 border border-slate-700/80 backdrop-blur-xl text-slate-100 shadow-black/80"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide">Notifikasi</h3>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {unreadCount} baru
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Semua sudah dibaca</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1 hover:underline"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Tandai dibaca
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700/40 overflow-x-auto text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("komisi")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "komisi"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Komisi ({countKomisi})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("transaksi")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "transaksi"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Transaksi ({countTx})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pembatalan")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "pembatalan"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Pembatalan ({countCancel})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shift")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "shift"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Shift Capster ({countShift})
              </button>
            </div>

            {/* List Body */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
              {loading && notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-500 mb-2" />
                  <p className="text-xs">Memuat notifikasi...</p>
                </div>
              ) : filteredNotifs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-slate-500 mb-2 opacity-60" />
                  <p className="text-xs font-semibold text-slate-300">Belum Ada Notifikasi</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Aktivitas transaksi, komisi capster, dan shift akan muncul di sini.
                  </p>
                </div>
              ) : (
                filteredNotifs.map((item) => {
                  const isRead = readIds.has(item.id);

                  let iconBadge;
                  if (isCommissionType(item.type)) {
                    iconBadge = (
                      <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Wallet className="h-4 w-4" />
                      </div>
                    );
                  } else if (item.type === "tx_success") {
                    iconBadge = (
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    );
                  } else if (item.type === "tx_cancelled") {
                    iconBadge = (
                      <div className="h-8 w-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <XCircle className="h-4 w-4" />
                      </div>
                    );
                  } else if (item.type === "capster_checkin") {
                    iconBadge = (
                      <div className="h-8 w-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <UserCheck className="h-4 w-4" />
                      </div>
                    );
                  } else {
                    iconBadge = (
                      <div className="h-8 w-8 rounded-xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center text-slate-400 shrink-0">
                        <LogOut className="h-4 w-4" />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`group p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-3 relative ${
                        isRead
                          ? isLight
                            ? "hover:bg-slate-100 opacity-80"
                            : "hover:bg-slate-800/50 opacity-75"
                          : isLight
                            ? "bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60"
                            : "bg-blue-950/25 hover:bg-blue-900/35 border border-blue-500/15"
                      }`}
                    >
                      {iconBadge}

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isCommissionType(item.type)
                                ? "text-amber-400"
                                : item.type === "tx_success"
                                  ? "text-emerald-400"
                                  : item.type === "tx_cancelled"
                                    ? "text-rose-400"
                                    : item.type === "capster_checkin"
                                      ? "text-blue-400"
                                      : "text-slate-400"
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {item.timeAgo}
                          </span>
                        </div>

                        <p
                          className={`text-xs font-medium leading-snug mt-0.5 ${
                            isLight ? "text-slate-900" : "text-slate-200"
                          }`}
                        >
                          {item.message}
                        </p>

                        {item.detail && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {item.detail}
                          </p>
                        )}
                      </div>

                      {!isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1 shadow-sm" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-700/40 text-center bg-slate-900/40 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate({ to: getTenantPath(slug, "/owner/audit-activities") as any });
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Lihat Riwayat Aktivitas Lengkap</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 1.8. BANNER IMPERSONATE (SUPERADMIN TO OWNER)
// ============================================================================
export function ImpersonateBanner() {
  const { impersonation } = useSuperadmin();
  const navigate = useNavigate();

  if (!impersonation.isImpersonating) return null;

  const handleExit = () => {
    superadminActions.stopImpersonate();
    navigate({ to: "/superadmin/tenants" });
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 px-4 sm:px-6 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2.5 shadow-md border-b border-amber-600/30 z-50 sticky top-0">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 rounded-full bg-slate-950/15 items-center justify-center text-slate-950 font-black text-xs shrink-0">
          ⚠️
        </span>
        <span className="leading-snug">
          <span className="uppercase tracking-wider font-extrabold mr-1.5">
            Mode Impersonate
          </span>
          <span className="opacity-70">|</span>
          <span className="ml-1.5 font-normal">
            Anda sedang melihat:{" "}
            <strong className="font-bold underline">
              {impersonation.targetTenant?.nama_barbershop || "Barbershop"}
            </strong>{" "}
            (Masuk sebagai Owner)
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ml-auto"
      >
        <span>Kembali ke Akun Superadmin</span>
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ============================================================================
// 2. TOP HEADER (DESKTOP)
// ============================================================================
export function OwnerHeader({
  onRefresh,
  isRefreshing,
  variant = "dark",
  searchPlaceholder,
  searchValue,
  onSearchChange,
}: {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  variant?: "dark" | "light";
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
}) {
  const { user } = useOwner();
  const liveTime = useLiveClock(1000);
  const isLight = variant === "light";

  return (
    <>
      <ImpersonateBanner />
      <header
        className={`hidden lg:flex items-center ${
          searchPlaceholder ? "justify-between" : "justify-end"
        } px-8 py-3.5 sticky top-0 z-30 transition-colors ${
          isLight
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs"
            : "bg-[#0A1424] border-b border-slate-800/80"
        }`}
      >
      {/* Optional Left Search Bar (Wireframe-compliant) */}
      {searchPlaceholder ? (
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full pl-9 pr-3.5 py-2 text-xs rounded-xl transition-all border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                : "bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-blue-500"
            }`}
          />
        </div>
      ) : null}

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Live Date & Time WIB */}
        <div
          className={`hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border ${
            isLight
              ? "bg-slate-100/80 border-slate-200 text-slate-700"
              : "bg-[#0F1D33] border-slate-800 text-slate-300 shadow-xs"
          }`}
          title="Waktu Indonesia Barat (WIB)"
        >
          <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="font-mono tracking-tight font-semibold">
            {formatWibClock(liveTime, { withSeconds: true, withDay: true, withDate: true, withYear: true })}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh Data"
            className={`p-2 rounded-xl transition-colors relative ${
              isLight
                ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}
            />
          </button>
        )}

        {/* Notification Bell */}
        <OwnerNotificationBell variant={variant} />

        {/* Owner Profile */}
        <div
          className={`flex items-center gap-3 pl-3 border-l ${
            isLight ? "border-slate-200" : "border-slate-800"
          }`}
        >
          <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
            {user?.nama_lengkap ? user.nama_lengkap.charAt(0) : "O"}
          </div>
          <div className="text-left">
            <div
              className={`text-sm font-semibold leading-tight ${
                isLight ? "text-slate-900" : "text-white"
              }`}
            >
              {user.nama_lengkap || "Owner"}
            </div>
            <div
              className={`text-xs leading-tight ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {user.barbershopName || "Barberin Barbershop"}
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}

// ============================================================================
// 3. MOBILE HEADER & DRAWER & BOTTOM NAV
// ============================================================================
export function OwnerMobileHeader({
  activePath,
  onRefresh,
  isRefreshing,
  variant = "dark",
}: {
  activePath: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  variant?: "dark" | "light";
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useOwner();
  const navigate = useNavigate();
  const isLight = variant === "light";

  const slug = useTenantSlug();
  const navItems = [
    { label: "Dashboard", href: getTenantPath(slug, "/owner/dashboard"), icon: Home },
    { label: "Layanan", href: getTenantPath(slug, "/owner/services"), icon: Scissors },
    { label: "Gaji", href: getTenantPath(slug, "/owner/gaji"), icon: Wallet },
    { label: "Manajemen Akun Capster", href: getTenantPath(slug, "/owner/capsters"), icon: Users },
    { label: "Audit Aktivitas", href: getTenantPath(slug, "/owner/audit-activities"), icon: Activity },
    { label: "Audit Keuangan", href: getTenantPath(slug, "/owner/audit-finance"), icon: FileText },
  ];

  const bottomItems = [
    { label: "Setelan", href: getTenantPath(slug, "/owner/settings"), icon: Settings },
    { label: "Pusat Bantuan", href: getTenantPath(slug, "/owner/help"), icon: HelpCircle },
  ];

  const handleLogout = () => {
    ownerActions.logout();
    setDrawerOpen(false);
    navigate({ to: "/owner/login" as any });
  };

  return (
    <>
      <ImpersonateBanner />
      <header
        className={`lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 transition-colors ${
          isLight
            ? "bg-white border-b border-slate-200 shadow-xs text-slate-900"
            : "bg-[#0A1424] border-b border-slate-800 text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarberinLogo className="h-7 w-7 shrink-0" />
            <span
              className={`font-extrabold tracking-wider text-sm ${
                isLight ? "text-slate-900" : "text-white"
              }`}
            >
              BARBERIN
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}
              />
            </button>
          )}

          {/* Notification Bell */}
          <OwnerNotificationBell variant={variant} isMobile />

          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-blue-500/20">
            {user?.nama_lengkap ? user.nama_lengkap.charAt(0) : "O"}
          </div>
        </div>
      </header>

      {/* Slide-out Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 bg-[#0A1424] border-r border-slate-800 h-full p-5 flex flex-col z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <BarberinLogo className="h-8 w-8 shrink-0" />
                <div className="font-extrabold text-white text-base">BARBERIN</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 border-b border-slate-800/80">
              <div className="text-sm font-semibold text-white">
                {user.nama_lengkap}
              </div>
              <div className="text-xs text-slate-400">{user.barbershopName}</div>
            </div>

            {/* Main Navigation (Scrollable) */}
            <nav className="space-y-1.5 flex-1 py-4 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="h-px bg-slate-800/80 my-3 shrink-0" />

            {/* Bottom Nav & Logout (Pinned to bottom) */}
            <div className="space-y-1.5 shrink-0 pt-1">
              {bottomItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-slate-800 text-white font-semibold"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full text-left transition-all"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OwnerBottomNav({ activePath }: { activePath: string }) {
  const slug = useTenantSlug();
  const navItems = [
    { label: "Dashboard", href: getTenantPath(slug, "/owner/dashboard"), icon: Home },
    { label: "Layanan", href: getTenantPath(slug, "/owner/services"), icon: Scissors },
    { label: "Gaji", href: getTenantPath(slug, "/owner/gaji"), icon: Wallet },
    { label: "Aktivitas", href: getTenantPath(slug, "/owner/audit-activities"), icon: Activity },
    { label: "Keuangan", href: getTenantPath(slug, "/owner/audit-finance"), icon: FileText },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A1424]/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activePath === item.href || (Boolean(activePath) && item.href.endsWith(activePath));
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
              isActive ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ============================================================================
// 4. SUMMARY METRIC CARD
// ============================================================================
export function OwnerSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendUp,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  trend?: string | undefined;
  trendUp?: boolean | undefined;
}) {
  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div
            className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
              trendUp
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-rose-400 bg-rose-500/10"
            }`}
          >
            {trendUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-xs text-slate-400 font-medium">{title}</div>
        <div className="text-xl md:text-2xl font-bold text-white tracking-tight mt-0.5">
          {value}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">{subtitle}</div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. REVENUE AREA CHART
// ============================================================================
export function RevenueChartCard({
  data,
  period,
  onPeriodChange,
}: {
  data: { date: string; revenue: number; count: number }[];
  period: OwnerPeriodFilter;
  onPeriodChange?: (p: OwnerPeriodFilter) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = (data || []).reduce((sum, d) => sum + (Number(d?.revenue) || 0), 0);

  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Grafik Pendapatan</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Perbandingan pendapatan 7 hari terakhir
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400">Total Periode:</span>
          <div className="text-sm font-bold text-blue-400">
            {formatRupiah(total)}
          </div>
        </div>
      </div>

      <div className="h-56 md:h-64 w-full">
        {mounted && (data || []).length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data || []}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${Math.round(val / 1000)}K`;
                  return `${val}`;
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const rev = Number(payload[0]?.value || 0);
                    const cnt = (payload[0]?.payload as any)?.count || 0;
                    return (
                      <div className="bg-[#0B1526] border border-blue-500/30 rounded-xl px-3 py-2 shadow-xl">
                        <div className="text-[11px] text-slate-400 font-medium">
                          {label}
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {formatRupiah(rev)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {cnt} transaksi
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#3B82F6", stroke: "#0B1526", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "#60A5FA", stroke: "#fff", strokeWidth: 2 }}
                fillOpacity={1}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Memuat grafik pendapatan...
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 6. PAYMENT METHODS DONUT CHART
// ============================================================================
export function PaymentMethodsDonutCard({
  methods,
  totalTransactions,
}: {
  methods: {
    method: "tunai" | "qris" | "transfer";
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  totalTransactions: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = (methods || []).map((m) => ({
    name: m?.label || "",
    value: m?.count || 0,
    color: m?.color || "#3B82F6",
  }));

  const hasData = (methods || []).some((m) => (m?.count || 0) > 0);

  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">Metode Pembayaran</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Distribusi pembayaran pelanggan
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto">
        {/* Donut Chart with Center Total */}
        <div className="relative w-40 h-40 shrink-0">
          {mounted && hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0F1D33" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full rounded-full border-4 border-slate-800 flex items-center justify-center text-xs text-slate-500">
              0 Transaksi
            </div>
          )}
          {hasData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-white leading-tight">
                {totalTransactions}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                Transaksi
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="space-y-3 w-full sm:w-auto flex-1">
          {methods.map((m) => (
            <div
              key={m.method}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-slate-300 font-medium">{m.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">{m.count}</span>
                <span className="text-slate-400 w-9 text-right font-mono text-[11px]">
                  {m.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. RECENT TRANSACTIONS TABLE
// ============================================================================
export function RecentTransactionsTable({
  transactions,
  onSelectTransaction,
}: {
  transactions: OwnerRecentTransaction[];
  onSelectTransaction?: (tx: OwnerRecentTransaction) => void;
}) {
  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Transaksi Terbaru</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar transaksi terkini dari pelanggan
          </p>
        </div>
        <Link
          to={getTenantPath(useTenantSlug(), "/owner/audit-finance")}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
        >
          Lihat Semua <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800 font-medium">
              <th className="pb-3 font-medium">No. Transaksi</th>
              <th className="pb-3 font-medium">Layanan</th>
              <th className="pb-3 font-medium">Capster</th>
              <th className="pb-3 font-medium">Nominal</th>
              <th className="pb-3 font-medium">Metode</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(transactions || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                  Belum ada transaksi pada periode ini
                </td>
              </tr>
            ) : (
              (transactions || []).map((tx) => {
                const isPaid = tx.status === "Selesai";
                const isCancelled = tx.status === "Batal";
                const isPending = tx.status === "Menunggu" || tx.status === "Diproses";

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction?.(tx)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 font-mono text-slate-300 font-semibold">
                      {tx.shortId}
                    </td>
                    <td className="py-3.5 text-white font-medium max-w-[180px] truncate">
                      {tx.serviceNames}
                    </td>
                    <td className="py-3.5 text-slate-300">{tx.capsterName}</td>
                    <td className="py-3.5 font-semibold text-white">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium capitalize ${
                          tx.paymentMethod === "tunai"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : tx.paymentMethod === "qris"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-purple-500/15 text-purple-300"
                        }`}
                      >
                        {tx.paymentMethodLabel}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          isPaid
                            ? "bg-emerald-500/15 text-emerald-300"
                            : isCancelled
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400 text-right font-mono text-[11px]">
                      {tx.dateTime}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 8. CAPSTER PERFORMANCE TABLE
// ============================================================================
export function CapsterPerformanceTable({
  performance,
}: {
  performance: OwnerCapsterPerformance[];
}) {
  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Performa Capster</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Kontribusi transaksi dan estimasi komisi per capster
          </p>
        </div>
        <Link
          to={getTenantPath(useTenantSlug(), "/owner/capsters")}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
        >
          Lihat Capster <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800 font-medium">
              <th className="pb-3 font-medium">Nama Capster</th>
              <th className="pb-3 font-medium text-center">Total Transaksi</th>
              <th className="pb-3 font-medium">Total Pendapatan Layanan</th>
              <th className="pb-3 font-medium">Komisi</th>
              <th className="pb-3 font-medium text-right">Persentase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(performance || []).length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                  Belum ada data performa capster
                </td>
              </tr>
            ) : (
              (performance || []).map((c) => (
                <tr key={c.capsterId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs">
                        {c.avatarLetter}
                      </div>
                      <div>
                        <div className="text-white font-medium">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {c.noPegawai}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-center font-semibold text-white">
                    {c.totalTransactions}
                  </td>
                  <td className="py-3.5 font-semibold text-white">
                    {formatRupiah(c.totalRevenue)}
                  </td>
                  <td className="py-3.5 font-semibold text-emerald-400">
                    {formatRupiah(c.commissionAmount)}
                  </td>
                  <td className="py-3.5 text-right text-slate-300 font-mono">
                    {c.commissionPercentage}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 9. RECENT CANCELLATIONS TABLE
// ============================================================================
export function RecentCancellationsTable({
  cancellations,
}: {
  cancellations: OwnerRecentCancellation[];
}) {
  return (
    <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Pembatalan Terbaru</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit riwayat transaksi yang dibatalkan
          </p>
        </div>
        <Link
          to={getTenantPath(useTenantSlug(), "/owner/audit-activities")}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
        >
          Lihat Semua <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800 font-medium">
              <th className="pb-3 font-medium">No. Transaksi</th>
              <th className="pb-3 font-medium">Capster</th>
              <th className="pb-3 font-medium">Alasan Pembatalan</th>
              <th className="pb-3 font-medium">Dibatalkan Oleh</th>
              <th className="pb-3 font-medium text-right">Waktu</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(cancellations || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                  Tidak ada transaksi yang dibatalkan
                </td>
              </tr>
            ) : (
              (cancellations || []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 font-mono text-slate-300 font-semibold">
                    {c.shortId}
                  </td>
                  <td className="py-3 text-slate-300">{c.capsterName}</td>
                  <td className="py-3 text-rose-300 max-w-[200px] truncate">
                    {c.reason}
                  </td>
                  <td className="py-3 text-slate-400">{c.cancelledBy}</td>
                  <td className="py-3 text-slate-400 text-right font-mono text-[11px]">
                    {c.date} {c.time}
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/15 text-rose-300">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 10. TRANSACTION DETAIL MODAL
// ============================================================================
export function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: OwnerRecentTransaction | null;
  onClose: () => void;
}) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#0F1D33] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Detail Transaksi</h3>
            <p className="text-xs text-slate-400 font-mono">
              {transaction.shortId}
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Status</span>
            <span
              className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                transaction.status === "Selesai"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : transaction.status === "Batal"
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {transaction.status}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Pelanggan</span>
            <span className="text-white font-medium">
              {transaction.customerName}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Capster yang Melayani</span>
            <span className="text-white font-medium">
              {transaction.capsterName}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Layanan</span>
            <span className="text-white font-medium text-right max-w-[200px]">
              {transaction.serviceNames}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Metode Pembayaran</span>
            <span className="text-white font-medium capitalize">
              {transaction.paymentMethodLabel}
            </span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Waktu Transaksi</span>
            <span className="text-white font-mono">{transaction.dateTime}</span>
          </div>

          {transaction.notes && (
            <div className="py-2 border-b border-slate-800">
              <span className="text-slate-400 block mb-1">Catatan</span>
              <span className="text-slate-200">{transaction.notes}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-semibold text-slate-300">Total Biaya</span>
            <span className="text-lg font-extrabold text-emerald-400">
              {formatRupiah(transaction.amount)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
