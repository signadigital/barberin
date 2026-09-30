import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
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
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getOwnerAuditActivities,
  deleteOwnerAuditActivities,
  type OwnerAuditActivitiesResult,
  type OwnerActivityItem,
  type OwnerPeriodFilter,
} from "@/lib/owner";
import { FeatureLockedCard } from "@/components/subscription/FeatureLockedCard";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

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
  const router = useRouter();
  const [data, setData] = useState<OwnerAuditActivitiesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Deletion States
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<OwnerActivityItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [period, setPeriod] = useState<OwnerPeriodFilter>("today");
  const [role, setRole] = useState<string>("all");
  const [activityType, setActivityType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Clear selections when filters or search change
  useEffect(() => {
    setSelectedAuditIds([]);
  }, [period, role, activityType, search]);

  const pageAuditIds = useMemo(() => {
    if (!data?.activities) return [];
    return data.activities.map((item) => item.id);
  }, [data?.activities]);

  const allFilteredAuditIds = useMemo(
    () => data?.allFilteredAuditIds || [],
    [data?.allFilteredAuditIds]
  );

  const isAllPageSelected =
    pageAuditIds.length > 0 && pageAuditIds.every((id) => selectedAuditIds.includes(id));
  const isSomePageSelected =
    pageAuditIds.some((id) => selectedAuditIds.includes(id)) && !isAllPageSelected;

  const handleToggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedAuditIds((prev) => prev.filter((id) => !pageAuditIds.includes(id)));
    } else {
      setSelectedAuditIds((prev) => Array.from(new Set([...prev, ...pageAuditIds])));
    }
  };

  const handleToggleRow = (auditId: string) => {
    setSelectedAuditIds((prev) =>
      prev.includes(auditId) ? prev.filter((x) => x !== auditId) : [...prev, auditId]
    );
  };

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteTarget || !singleDeleteTarget.id) return;
    try {
      setIsDeleting(true);
      const auditId = singleDeleteTarget.id;
      const res = await deleteOwnerAuditActivities({
        data: { auditIds: [auditId] },
      });
      toast.success(res.message || "Aktivitas berhasil dihapus.");
      setSingleDeleteTarget(null);
      setSelectedAuditIds((prev) => prev.filter((id) => id !== auditId));
      await fetchActivities();
      await router.invalidate();
    } catch (err: any) {
      console.error("Gagal menghapus aktivitas:", err);
      toast.error(
        err?.message ||
          "Gagal menghapus aktivitas. Silakan coba lagi."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedAuditIds.length === 0) return;
    try {
      setIsDeleting(true);
      const countToDelete = selectedAuditIds.length;
      const res = await deleteOwnerAuditActivities({
        data: { auditIds: selectedAuditIds },
      });
      toast.success(
        res.message || `${countToDelete} aktivitas berhasil dihapus.`
      );
      setIsBulkDeleteOpen(false);
      setSelectedAuditIds([]);
      await fetchActivities();
      await router.invalidate();
    } catch (err: any) {
      console.error("Gagal menghapus aktivitas terpilih:", err);
      toast.error(
        err?.message ||
          "Gagal menghapus aktivitas. Silakan coba lagi."
      );
    } finally {
      setIsDeleting(false);
    }
  };

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
        return "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30";
      case "pelanggan":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30";
      case "admin":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30";
      case "owner":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const statusBadgeStyle = (s: string) => {
    switch (s) {
      case "Berhasil":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "Dibatalkan":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-activities" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader
          activePath="/owner/audit-activities"
          onRefresh={fetchActivities}
          isRefreshing={loading}
        />
        <OwnerHeader onRefresh={fetchActivities} isRefreshing={loading} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {error && (error.includes("paket Pro") || error.includes("FEATURE_LOCKED")) ? (
            <FeatureLockedCard
              featureName="Log Audit Aktivitas"
              description="Pencatatan riwayat audit lengkap (aktivitas capster, penghapusan transaksi, histori login/logout, rekonsiliasi kas) tersedia eksklusif pada paket Pro."
              requiredPlan="PRO"
            />
          ) : (
            <>
          {/* Header Title & Date Range */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Audit Aktivitas
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Pantau seluruh aktivitas pengguna yang terjadi di dalam sistem barbershop.
              </p>
            </div>

            {/* Date Range Selector Dropdown */}
            <div className="relative self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <Calendar className="h-4 w-4 text-primary" />
                <span>{data?.periodLabel || "Hari ini"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {isPeriodDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsPeriodDropdownOpen(false)}
                  />
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
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
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="hidden lg:flex items-center gap-3 bg-card border border-border rounded-2xl p-3 shadow-xs">
            {/* Periode */}
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Periode
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-background border border-input rounded-xl text-xs text-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{data?.dateRangeText || "Hari ini"}</span>
              </div>
            </div>

            {/* Role */}
            <div className="w-44">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="all">Semua Role</option>
                <option value="capster">Capster</option>
                <option value="pelanggan">Pelanggan</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            {/* Jenis Aktivitas */}
            <div className="w-48">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Jenis Aktivitas
              </label>
              <select
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
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
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Cari Aktivitas
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                  placeholder="Cari aktivitas, nama pengguna, atau ID..."
                  className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-2 pt-5">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-colors shadow-md shadow-primary/20 cursor-pointer"
              >
                Terapkan Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-2 border border-border bg-card hover:bg-muted rounded-xl text-xs font-medium text-foreground transition-colors cursor-pointer"
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
              className="flex-1 flex items-center justify-between px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Filter & Pencarian</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* 5 Metric Cards (Desktop 5 cols, Mobile 2 cols) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 md:gap-4">
            {/* Card 1: Total Aktivitas */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground font-medium">Total Aktivitas</div>
                <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                  {data?.stats.totalActivities ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.totalActivitiesDelta || "+12%"}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Login / Logout */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground font-medium">Login / Logout</div>
                <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                  {data?.stats.loginLogoutCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.loginLogoutDelta || "+8%"}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Aktivitas Transaksi */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Scissors className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground font-medium">Aktivitas Transaksi</div>
                <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                  {data?.stats.transactionActivitiesCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.transactionActivitiesDelta || "+15%"}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Pembatalan Transaksi */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground font-medium">Pembatalan Transaksi</div>
                <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                  {data?.stats.cancellationCount ?? 0}
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingDown className="h-3 w-3" />
                  <span>{data?.stats.cancellationDelta || "-20%"}</span>
                </div>
              </div>
            </div>

            {/* Card 5: Aktivitas Shift */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs col-span-2 md:col-span-1">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground font-medium">Aktivitas Shift</div>
                <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                  {data?.stats.shiftActivitiesCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.shiftActivitiesDelta || "+5%"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Riwayat Aktivitas */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Riwayat Aktivitas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Catatan audit sistem berbasis kejadian nyata di barbershop.
                </p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border">
                <span>Urutkan:</span>
                <span className="text-foreground font-medium">Terbaru</span>
              </div>
            </div>

            {/* Selection Toolbar Banner */}
            {selectedAuditIds.length > 0 && (
              <div className="mt-4 p-3 bg-muted/90 border border-primary/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-foreground">
                    {selectedAuditIds.length} aktivitas dipilih
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAuditIds([])}
                    className="text-xs text-primary font-medium hover:underline cursor-pointer"
                  >
                    Batalkan Pilihan
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus yang Dipilih ({selectedAuditIds.length})</span>
                </button>
              </div>
            )}

            {/* Select All Filtered Prompt Banner */}
            {isAllPageSelected && allFilteredAuditIds.length > pageAuditIds.length && (
              <div className="mt-3 px-3.5 py-2.5 bg-primary/10 border border-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span>
                  {selectedAuditIds.length === allFilteredAuditIds.length ? (
                    <>
                      Seluruh <strong className="text-foreground font-semibold">{allFilteredAuditIds.length}</strong> aktivitas hasil filter telah dipilih.
                    </>
                  ) : (
                    <>
                      Semua <strong className="text-foreground font-semibold">{pageAuditIds.length}</strong> aktivitas di halaman ini terpilih.
                    </>
                  )}
                </span>
                {selectedAuditIds.length === allFilteredAuditIds.length ? (
                  <button
                    type="button"
                    onClick={() => setSelectedAuditIds(pageAuditIds)}
                    className="text-primary font-bold hover:underline cursor-pointer text-left sm:text-right"
                  >
                    Batalkan pilihan seluruh filter (hanya halaman ini)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedAuditIds(allFilteredAuditIds)}
                    className="text-primary font-bold hover:underline cursor-pointer text-left sm:text-right"
                  >
                    Pilih seluruh {allFilteredAuditIds.length} aktivitas hasil filter
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-muted-foreground text-xs animate-pulse">
                Memuat data riwayat aktivitas...
              </div>
            ) : error ? (
              <div className="py-12 text-center text-rose-500 dark:text-rose-400 text-xs">
                {error}
              </div>
            ) : data && data.activities.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                Tidak ada aktivitas yang sesuai dengan filter.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border font-medium">
                        <th className="py-3 px-3 w-10 text-center">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={
                                isAllPageSelected
                                  ? true
                                  : isSomePageSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={handleToggleSelectAllPage}
                              aria-label="Pilih semua aktivitas pada halaman ini"
                            />
                          </div>
                        </th>
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
                    <tbody className="divide-y divide-border">
                      {data?.activities.map((item) => (
                        <tr
                          key={item.id}
                          className={cn(
                            "hover:bg-muted/50 transition-colors group",
                            selectedAuditIds.includes(item.id) && "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selectedAuditIds.includes(item.id)}
                                onCheckedChange={() => handleToggleRow(item.id)}
                                aria-label={`Pilih aktivitas ${item.id}`}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-muted-foreground">{item.no}</td>
                          <td className="py-3.5 px-3 text-muted-foreground font-mono text-[11px]">
                            {item.waktu}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-primary font-semibold">
                            {item.id}
                          </td>
                          <td className="py-3.5 px-3 text-foreground font-medium">
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
                          <td className="py-3.5 px-3 text-foreground">
                            {item.aktivitas}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-muted-foreground">
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
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/${barbershopSlug}/owner/audit-activities/${item.id}` as any}
                                className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1 hover:underline"
                              >
                                <span>Lihat Detail</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setSingleDeleteTarget(item)}
                                className="text-destructive hover:text-destructive/80 font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Hapus aktivitas ini secara permanen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View (Strictly Responsive without Table Scroll) */}
                <div className="lg:hidden space-y-3 pt-3">
                  {data?.activities.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "bg-card border border-border rounded-xl p-3.5 transition-colors",
                        selectedAuditIds.includes(item.id) && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={selectedAuditIds.includes(item.id)}
                            onCheckedChange={() => handleToggleRow(item.id)}
                            aria-label={`Pilih aktivitas ${item.id}`}
                          />
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {item.waktu}
                          </span>
                        </div>
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
                          <div className="text-sm font-semibold text-foreground">
                            {item.aktivitas}
                          </div>
                          <div className="text-xs font-mono text-primary mt-0.5">
                            {item.dataTerkait !== "-" ? item.dataTerkait : item.id}
                            {item.details?.nominal !== undefined && (
                              <span className="ml-2 font-sans font-bold text-foreground">
                                • {formatRupiah(item.details.nominal)}
                              </span>
                            )}
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
                      <div className="mt-3 pt-2 border-t border-border text-xs flex items-center justify-between">
                        <span className="text-muted-foreground">{item.pengguna}</span>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/${barbershopSlug}/owner/audit-activities/${item.id}` as any}
                            className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                          >
                            <span>Detail</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setSingleDeleteTarget(item)}
                            className="text-destructive hover:bg-destructive/10 font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div>
                    Menampilkan{" "}
                    <span className="text-foreground font-medium">
                      {(page - 1) * 8 + 1}
                    </span>{" "}
                    -{" "}
                    <span className="text-foreground font-medium">
                      {Math.min(page * 8, data?.totalCount || 0)}
                    </span>{" "}
                    dari{" "}
                    <span className="text-foreground font-medium">
                      {data?.totalCount || 0}
                    </span>{" "}
                    data
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              page === pNum
                                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      },
                    )}
                    {data && data.totalPages > 5 && (
                      <>
                        <span className="px-1 text-muted-foreground">...</span>
                        <button
                          type="button"
                          onClick={() => setPage(data.totalPages)}
                          className="px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
                    >
                      &gt;
                    </button>
                    <span className="ml-2 text-muted-foreground hidden sm:inline">
                      8 per halaman
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          </>
          )}
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
          <div className="relative w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl z-10 space-y-4 text-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Filter Aktivitas</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Cari Kata Kunci
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nama, aktivitas, ID..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Periode
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as OwnerPeriodFilter)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="today">Hari ini</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="month">Bulan ini</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="all">Semua Role</option>
                  <option value="capster">Capster</option>
                  <option value="pelanggan">Pelanggan</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Jenis Aktivitas
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:border-primary"
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
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-colors cursor-pointer"
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetFilter();
                  setIsFilterModalOpen(false);
                }}
                className="px-4 py-2.5 border border-border bg-card hover:bg-muted rounded-xl text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Single Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(singleDeleteTarget)}
        onOpenChange={(open) => !isDeleting && !open && setSingleDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-destructive pb-1">
              <div className="p-2 rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Hapus aktivitas ini?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-3 pt-2 text-left">
              <span>
                Apakah Anda yakin ingin menghapus aktivitas ini secara permanen dari database Supabase?
              </span>
              <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1.5 font-mono text-xs">
                <div className="font-bold text-primary font-mono text-sm">
                  {singleDeleteTarget?.aktivitas}
                </div>
                <div className="text-muted-foreground font-sans text-xs">
                  Pengguna: <strong className="text-foreground">{singleDeleteTarget?.pengguna}</strong> ({singleDeleteTarget?.role})
                </div>
                <div className="text-muted-foreground font-sans text-xs">
                  Waktu: {singleDeleteTarget?.waktu}
                </div>
                {singleDeleteTarget?.dataTerkait && singleDeleteTarget.dataTerkait !== "-" && (
                  <div className="text-muted-foreground font-sans text-xs">
                    Data Terkait: <strong className="text-foreground font-mono">{singleDeleteTarget.dataTerkait}</strong>
                  </div>
                )}
              </div>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                Data rekaman aktivitas audit akan dihapus secara permanen dari database Supabase. Akun pengguna, transaksi, dan data bisnis lainnya tetap aman dan tidak akan terhapus.
              </div>
              <div className="font-semibold text-foreground text-xs">
                Tindakan ini tidak dapat dibatalkan.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs rounded-xl"
            >
              Batal
            </AlertDialogCancel>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmSingleDelete}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "text-xs font-semibold gap-1.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus</span>
                </>
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={isBulkDeleteOpen}
        onOpenChange={(open) => !isDeleting && !open && setIsBulkDeleteOpen(false)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-destructive pb-1">
              <div className="p-2 rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Hapus {selectedAuditIds.length} aktivitas?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-3 pt-2 text-left">
              <span>
                Anda akan menghapus <strong className="text-foreground">{selectedAuditIds.length} aktivitas</strong> secara permanen. Data yang dihapus tidak dapat dikembalikan.
              </span>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                Data rekaman aktivitas audit akan dihapus secara permanen dari database Supabase. Akun pengguna, data transaksi, dan entitas bisnis lainnya tetap aman dan tidak akan terhapus.
              </div>
              <div className="font-semibold text-foreground text-xs">
                Tindakan ini tidak dapat dibatalkan.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs rounded-xl"
            >
              Batal
            </AlertDialogCancel>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmBulkDelete}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "text-xs font-semibold gap-1.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus yang Dipilih</span>
                </>
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </OwnerAuthGuard>
  );
}
