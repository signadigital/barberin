import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Users,
  LogOut,
  Clock,
  RefreshCw,
  Search,
  Plus,
  Shield,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  SlidersHorizontal,
  ChevronRight,
  Store,
  ExternalLink,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
} from "lucide-react";

import { BarberinLogo } from "@/components/barberin/ui";
import { formatWibClock, useLiveClock } from "@/lib/format";
import { superadminActions, useSuperadmin, getSuperadminAuth } from "@/lib/superadmin-store";
import type { SuperadminTenantItem } from "@/lib/superadmin";

// ============================================================================
// 0. SUPERADMIN AUTH GUARD
// ============================================================================
export function SuperadminAuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isLoggedIn } = useSuperadmin();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const hasAuth = isLoggedIn || getSuperadminAuth();
    if (!hasAuth) {
      navigate({ to: "/superadmin/login", replace: true });
    }
  }, [mounted, isLoggedIn, navigate]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Memuat sesi superadmin...</p>
        </div>
      </div>
    );
  }

  const hasAuth = isLoggedIn || getSuperadminAuth();
  if (!hasAuth) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Mengarahkan ke login superadmin...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// 1. SUPERADMIN SIDEBAR (DESKTOP)
// ============================================================================
export function SuperadminSidebar({ activePath }: { activePath: string }) {
  const { user } = useSuperadmin();
  const navigate = useNavigate();

  const handleLogout = () => {
    superadminActions.logout();
    navigate({ to: "/superadmin/login" });
  };

  const navItems = [
    {
      label: "Manajemen Toko / Tenants",
      href: "/superadmin/tenants",
      icon: Store,
    },
    {
      label: "Custom Domain (BPMN)",
      href: "/superadmin/domains",
      icon: Globe,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0A1424] border-r border-slate-800/80 h-screen sticky top-0 text-slate-300 p-5 select-none shrink-0 z-40 overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6 shrink-0 border-b border-slate-800/60 pb-5">
        <BarberinLogo className="h-10 w-10 shrink-0" />
        <div>
          <div className="font-extrabold tracking-wider text-white text-base leading-none">
            BARBERIN
          </div>
          <div className="text-[11px] text-blue-400 mt-1 leading-tight font-bold uppercase tracking-wider flex items-center gap-1">
            <Shield className="h-3 w-3 inline" />
            Admin Platform
          </div>
        </div>
      </div>

      {/* Role Pill */}
      <div className="mx-2 mb-6 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
        <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
          Level Otoritas
        </div>
        <div className="text-xs font-semibold text-white mt-0.5">
          Superadmin Platform
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
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3 shrink-0">
        <div className="px-2 py-1.5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
            SA
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {user?.nama_lengkap || "Superadmin Platform"}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {user?.email || "superadmin@barberin.test"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Keluar Superadmin</span>
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// 2. SUPERADMIN TOP HEADER (DESKTOP)
// ============================================================================
export function SuperadminHeader({
  onRefresh,
  isRefreshing,
}: {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { user } = useSuperadmin();
  const liveTime = useLiveClock(1000);

  return (
    <header className="hidden lg:flex items-center justify-between px-8 py-3.5 sticky top-0 z-30 bg-[#0A1424] border-b border-slate-800/80 transition-colors">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <Shield className="h-3.5 w-3.5" />
          <span>Platform Administration Panel</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Clock WIB */}
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border bg-[#0F1D33] border-slate-800 text-slate-300 shadow-xs"
          title="Waktu Indonesia Barat (WIB)"
        >
          <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="font-mono tracking-tight font-semibold">
            {formatWibClock(liveTime, {
              withSeconds: true,
              withDay: true,
              withDate: true,
              withYear: true,
            })}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
            />
          </button>
        )}

        {/* Current User Badge */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
          <div className="h-8 w-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
            SA
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-white leading-tight">
              {user?.nama_lengkap || "Superadmin Platform"}
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              {user?.email || "superadmin@barberin.test"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// 3. SUPERADMIN MOBILE HEADER & DRAWER
// ============================================================================
export function SuperadminMobileHeader({
  activePath,
  onRefresh,
  isRefreshing,
}: {
  activePath: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useSuperadmin();
  const navigate = useNavigate();

  const handleLogout = () => {
    superadminActions.logout();
    setDrawerOpen(false);
    navigate({ to: "/superadmin/login" });
  };

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 bg-[#0A1424] border-b border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Buka Menu Superadmin"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <BarberinLogo className="h-7 w-7" />
            <div>
              <div className="font-extrabold text-sm tracking-wider leading-none">
                BARBERIN
              </div>
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider leading-none mt-0.5">
                Superadmin
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
              />
            </button>
          )}
          <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
            SA
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0A1424] border-r border-slate-800 p-5 text-slate-300 z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <BarberinLogo className="h-8 w-8" />
                <div>
                  <div className="font-extrabold text-white text-base leading-none">
                    BARBERIN
                  </div>
                  <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">
                    Admin Platform
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs mb-4">
              <div className="text-[10px] uppercase font-bold text-blue-400">
                Akun Aktif
              </div>
              <div className="font-bold text-white mt-0.5">
                {user?.nama_lengkap || "Superadmin Platform"}
              </div>
              <div className="text-[10px] text-slate-400">{user?.email}</div>
            </div>

            <nav className="space-y-1.5 flex-1">
              <Link
                to="/superadmin/tenants"
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activePath === "/superadmin/tenants"
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Store className="h-4 w-4" />
                <span>Manajemen Toko / Tenants</span>
              </Link>
              <Link
                to="/superadmin/domains"
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activePath === "/superadmin/domains"
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Custom Domain (BPMN)</span>
              </Link>
            </nav>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Superadmin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 4. STAT CARD COMPONENT
// ============================================================================
export function SuperadminStatCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant = "blue",
}: {
  title: string;
  value: number | string;
  subtext?: string;
  icon: React.ElementType;
  variant?: "blue" | "emerald" | "amber" | "purple";
}) {
  const variantStyles = {
    blue: "from-blue-600/20 to-blue-900/10 border-blue-500/30 text-blue-400 bg-blue-500/10",
    emerald: "from-emerald-600/20 to-emerald-900/10 border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    amber: "from-amber-600/20 to-amber-900/10 border-amber-500/30 text-amber-400 bg-amber-500/10",
    purple: "from-purple-600/20 to-purple-900/10 border-purple-500/30 text-purple-400 bg-purple-500/10",
  };

  return (
    <div
      className={`rounded-2xl border p-5 bg-gradient-to-br ${variantStyles[variant]} shadow-sm flex items-center justify-between gap-4`}
    >
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          {value}
        </div>
        {subtext && (
          <div className="text-[11px] text-slate-400 mt-1">{subtext}</div>
        )}
      </div>

      <div
        className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${variantStyles[variant]}`}
      >
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}
