import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Activity,
  Users,
  Scissors,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  Calendar,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Eye,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from "lucide-react";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import {
  getOwnerAuditActivities,
  type OwnerAuditActivitiesResult,
  type OwnerActivityItem,
  type OwnerPeriodFilter,
} from "@/lib/owner";

export const Route = createFileRoute("/$barbershopSlug/owner/audit-activities")({
  head: () => ({
    meta: [
      { title: "Audit Aktivitas — BARBERIN Owner" },
      {
        name: "description",
        content: "Pantau seluruh aktivitas pengguna yang terjadi di dalam sistem barbershop.",
      },
    ],
  }),
  component: OwnerAuditActivitiesPage,
});

function OwnerAuditActivitiesPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<OwnerAuditActivitiesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState<OwnerPeriodFilter>("today");
  const [role, setRole] = useState<string>("all");
  const [activityType, setActivityType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getOwnerAuditActivities({
        data: {
          period,
          role,
          activityType,
          search,
          page,
          pageSize: 8,
        },
      });
      setData(res);
    } catch (err: any) {
      console.error("Gagal mengambil audit aktivitas:", err);
      setError(err?.message || "Gagal memuat riwayat aktivitas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [period, role, activityType, page]);

  const handleApplyFilter = () => {
    setPage(1);
    fetchActivities();
    setIsFilterModalOpen(false);
  };

  const handleResetFilter = () => {
    setPeriod("today");
    setRole("all");
    setActivityType("all");
    setSearch("");
    setPage(1);
  };

  const periodOptions: { key: OwnerPeriodFilter; label: string }[] = [
    { key: "today", label: "Hari ini" },
    { key: "7d", label: "7 Hari Terakhir" },
    { key: "30d", label: "30 Hari Terakhir" },
    { key: "month", label: "Bulan ini" },
  ];

  const roleBadgeStyle = (r: string) => {
    switch (r.toLowerCase()) {
      case "capster":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "pelanggan":
        return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "admin":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "owner":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-slate-700/40 text-slate-300 border-slate-600";
    }
  };

  const statusBadgeStyle = (s: string) => {
    switch (s) {
      case "Berhasil":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "Dibatalkan":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default:
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-activities" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader
          activePath="/owner/audit-activities"
          onRefresh={fetchActivities}
          isRefreshing={loading}
        />
        <OwnerHeader onRefresh={fetchActivities} isRefreshing={loading} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Header Title & Date Range */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Audit Aktivitas
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Pantau seluruh aktivitas pengguna yang terjadi di dalam sistem barbershop.
              </p>
            </div>

            {/* Date Range Selector Dropdown */}
            <div className="relative self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#0F1D33] border border-slate-700/80 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Calendar className="h-4 w-4 text-blue-400" />
                <span>{data?.periodLabel || "Hari ini"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {isPeriodDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsPeriodDropdownOpen(false)}
                  />
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-44 bg-[#0F1D33] border border-slate-700 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                    {periodOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setPeriod(opt.key);
                          setPage(1);
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                          period === opt.key
                            ? "bg-blue-600 text-white font-semibold"
                            : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Filter Bar */}
          <div className="hidden lg:flex items-center gap-3 bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-3 shadow-xs">
            {/* Periode */}
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Periode
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#0A1424] border border-slate-700/60 rounded-xl text-xs text-white">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                <span>{data?.dateRangeText || "Hari ini"}</span>
              </div>
            </div>

            {/* Role */}
            <div className="w-44">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Semua Role</option>
                <option value="capster">Capster</option>
                <option value="pelanggan">Pelanggan</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            {/* Jenis Aktivitas */}
            <div className="w-48">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Jenis Aktivitas
              </label>
              <select
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Semua Aktivitas</option>
                <option value="transaksi">Aktivitas Transaksi</option>
                <option value="pembatalan">Pembatalan</option>
                <option value="pembayaran">Pembayaran</option>
                <option value="shift">Aktivitas Shift</option>
                <option value="login">Login / Logout</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Cari Aktivitas
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                  placeholder="Cari aktivitas, nama pengguna, atau ID..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0A1424] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-2 pt-5">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors shadow-md shadow-blue-600/20"
              >
                Terapkan Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-colors"
                title="Reset Filter"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Mobile Filter Button */}
          <div className="flex lg:hidden items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="flex-1 flex items-center justify-between px-4 py-2.5 bg-[#0F1D33] border border-slate-800 rounded-xl text-xs font-medium text-slate-300"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                <span>Filter & Pencarian</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* 5 Metric Cards (Desktop 5 cols, Mobile 2 cols) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 md:gap-4">
            {/* Card 1: Total Aktivitas */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Total Aktivitas</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.totalActivities ?? 0}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.totalActivitiesDelta || "+12%"}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Login / Logout */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Login / Logout</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.loginLogoutCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.loginLogoutDelta || "+8%"}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Aktivitas Transaksi */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Scissors className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Aktivitas Transaksi</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.transactionActivitiesCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.transactionActivitiesDelta || "+15%"}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Pembatalan Transaksi */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Pembatalan Transaksi</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.cancellationCount ?? 0}
                </div>
                <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingDown className="h-3 w-3" />
                  <span>{data?.stats.cancellationDelta || "-20%"}</span>
                </div>
              </div>
            </div>

            {/* Card 5: Aktivitas Shift */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs col-span-2 md:col-span-1">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Aktivitas Shift</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.shiftActivitiesCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.shiftActivitiesDelta || "+5%"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Riwayat Aktivitas */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Riwayat Aktivitas</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Catatan audit sistem berbasis kejadian nyata di barbershop.
                </p>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 bg-[#0A1424] px-2.5 py-1 rounded-lg border border-slate-800">
                <span>Urutkan:</span>
                <span className="text-white font-medium">Terbaru</span>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs animate-pulse">
                Memuat data riwayat aktivitas...
              </div>
            ) : error ? (
              <div className="py-12 text-center text-rose-400 text-xs">
                {error}
              </div>
            ) : data && data.activities.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                Tidak ada aktivitas yang sesuai dengan filter.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-medium">
                        <th className="py-3 px-3">No</th>
                        <th className="py-3 px-3">Waktu</th>
                        <th className="py-3 px-3">ID Aktivitas</th>
                        <th className="py-3 px-3">Pengguna</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Aktivitas</th>
                        <th className="py-3 px-3">Data Terkait</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data?.activities.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="py-3.5 px-3 text-slate-400">{item.no}</td>
                          <td className="py-3.5 px-3 text-slate-300 font-mono text-[11px]">
                            {item.waktu}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-blue-400 font-semibold">
                            {item.id}
                          </td>
                          <td className="py-3.5 px-3 text-white font-medium">
                            {item.pengguna}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${roleBadgeStyle(
                                item.role,
                              )}`}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-200">
                            {item.aktivitas}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-400">
                            {item.dataTerkait}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeStyle(
                                item.status,
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <Link
                              to={`/${barbershopSlug}/owner/audit-activities/${item.id}` as any}
                              className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 hover:underline"
                            >
                              <span>Lihat Detail</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View (Strictly Responsive without Table Scroll) */}
                <div className="lg:hidden space-y-3 pt-3">
                  {data?.activities.map((item) => (
                    <Link
                      key={item.id}
                      to={`/${barbershopSlug}/owner/audit-activities/${item.id}` as any}
                      className="block bg-[#0A1424] border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/60">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {item.waktu}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeStyle(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="pt-2.5 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {item.aktivitas}
                          </div>
                          <div className="text-xs font-mono text-blue-400 mt-0.5">
                            {item.dataTerkait !== "-" ? item.dataTerkait : item.id}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${roleBadgeStyle(
                            item.role,
                          )}`}
                        >
                          {item.role}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                        <span>{item.pengguna}</span>
                        <span className="text-blue-400 font-medium inline-flex items-center gap-1">
                          Detail <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                  <div>
                    Menampilkan{" "}
                    <span className="text-white font-medium">
                      {(page - 1) * 8 + 1}
                    </span>{" "}
                    -{" "}
                    <span className="text-white font-medium">
                      {Math.min(page * 8, data?.totalCount || 0)}
                    </span>{" "}
                    dari{" "}
                    <span className="text-white font-medium">
                      {data?.totalCount || 0}
                    </span>{" "}
                    data
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: Math.min(5, data?.totalPages || 1) }).map(
                      (_, i) => {
                        const pNum = i + 1;
                        return (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => setPage(pNum)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              page === pNum
                                ? "bg-blue-600 text-white font-bold shadow-xs"
                                : "bg-[#0A1424] border border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      },
                    )}
                    {data && data.totalPages > 5 && (
                      <>
                        <span className="px-1 text-slate-600">...</span>
                        <button
                          type="button"
                          onClick={() => setPage(data.totalPages)}
                          className="px-3 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-slate-400 hover:text-white"
                        >
                          {data.totalPages}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={page >= (data?.totalPages || 1)}
                      onClick={() =>
                        setPage((p) => Math.min(data?.totalPages || 1, p + 1))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                      &gt;
                    </button>
                    <span className="ml-2 text-slate-500 hidden sm:inline">
                      8 per halaman
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <OwnerBottomNav activePath="/owner/audit-activities" />
      </div>

      {/* Mobile Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsFilterModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-[#0F1D33] border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                <span>Filter Aktivitas</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Cari Kata Kunci
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nama, aktivitas, ID..."
                  className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Periode
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as OwnerPeriodFilter)}
                  className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700 rounded-xl text-white"
                >
                  <option value="today">Hari ini</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="month">Bulan ini</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700 rounded-xl text-white"
                >
                  <option value="all">Semua Role</option>
                  <option value="capster">Capster</option>
                  <option value="pelanggan">Pelanggan</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Jenis Aktivitas
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A1424] border border-slate-700 rounded-xl text-white"
                >
                  <option value="all">Semua Aktivitas</option>
                  <option value="transaksi">Aktivitas Transaksi</option>
                  <option value="pembatalan">Pembatalan</option>
                  <option value="pembayaran">Pembayaran</option>
                  <option value="shift">Aktivitas Shift</option>
                  <option value="login">Login / Logout</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="flex-1 py-2.5 bg-blue-600 rounded-xl text-xs font-semibold text-white"
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetFilter();
                  setIsFilterModalOpen(false);
                }}
                className="px-4 py-2.5 bg-slate-800 rounded-xl text-xs font-medium text-slate-300"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </OwnerAuthGuard>
  );
}
