import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  RefreshCw,
  Wallet,
  Receipt,
  Users,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  OwnerSummaryCard,
  RevenueChartCard,
  PaymentMethodsDonutCard,
  RecentTransactionsTable,
  CapsterPerformanceTable,
  RecentCancellationsTable,
  TransactionDetailModal,
  useTenantSlug,
} from "@/components/owner/ui";
import { formatRupiah, formatWibClock, useLiveClock } from "@/lib/format";
import {
  getOwnerDashboardMetrics,
  type OwnerDashboardMetrics,
  type OwnerPeriodFilter,
  type OwnerRecentTransaction,
} from "@/lib/owner";
import { ownerActions, useOwner, getOwnerAuth } from "@/lib/owner-store";

function OwnerDashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4 antialiased">
      <div className="max-w-md w-full bg-[#0F1D33] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
        <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Dashboard Tidak Dapat Dimuat
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {error?.message || "Terjadi kendala saat memuat data dashboard Owner. Sesi mungkin telah berakhir atau belum terverifikasi."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors shadow-xs"
          >
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={() => {
              ownerActions.logout();
              navigate({ to: "/owner/login" as any });
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-600/30"
          >
            Login Ulang
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/$barbershopSlug/owner/dashboard")({
  head: () => ({
    meta: [
      { title: "Owner Dashboard — BARBERIN" },
      {
        name: "description",
        content: "Pusat monitoring dan pengelolaan operasional barbershop BARBERIN.",
      },
    ],
  }),
  errorComponent: OwnerDashboardError,
  component: OwnerDashboardPage,
});

function OwnerDashboardPage() {
  const routeParams = (Route as any).useParams ? (Route as any).useParams() : {};
  const tenantSlug = useTenantSlug();
  const barbershopSlug = routeParams?.barbershopSlug || tenantSlug;
  const navigate = useNavigate();
  const { activePeriod, searchKeyword, isLoggedIn } = useOwner();
  const liveClock = useLiveClock(1000);
  const [metrics, setMetrics] = useState<OwnerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<OwnerRecentTransaction | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const fetchMetrics = async (isManualRefresh = false) => {
    if (!isLoggedIn && !getOwnerAuth()) return;
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!metrics) {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await getOwnerDashboardMetrics({
        data: {
          period: activePeriod,
        },
      });
      setMetrics(res);
    } catch (err: any) {
      console.error("Gagal mengambil data dashboard owner:", err);
      setError(err?.message || "Gagal memuat data dashboard. Silakan coba lagi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn && !getOwnerAuth()) return;
    fetchMetrics();
    // Auto refresh periodically every 30 seconds for live updates
    const timer = setInterval(() => {
      fetchMetrics(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [activePeriod, isLoggedIn]);

  const handlePeriodChange = (p: OwnerPeriodFilter) => {
    ownerActions.setPeriod(p);
    setIsFilterDropdownOpen(false);
  };

  const periodOptions: { key: OwnerPeriodFilter; label: string }[] = [
    { key: "today", label: "Hari ini" },
    { key: "7d", label: "7 Hari Terakhir" },
    { key: "30d", label: "30 Hari Terakhir" },
    { key: "month", label: "Bulan Ini" },
  ];

  // Filter transactions and performance based on search keyword if typed
  const filteredTransactions = (metrics?.recentTransactions || []).filter((tx) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      (tx.shortId || "").toLowerCase().includes(kw) ||
      (tx.customerName || "").toLowerCase().includes(kw) ||
      (tx.capsterName || "").toLowerCase().includes(kw) ||
      (tx.serviceNames || "").toLowerCase().includes(kw)
    );
  });

  const filteredCapsters = (metrics?.capsterPerformance || []).filter((c) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(kw) ||
      (c.noPegawai || "").toLowerCase().includes(kw)
    );
  });

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      {/* Desktop Sidebar */}
      <OwnerSidebar activePath="/owner/dashboard" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header & Drawer */}
        <OwnerMobileHeader
          activePath="/owner/dashboard"
          onRefresh={() => fetchMetrics(true)}
          isRefreshing={refreshing}
        />

        {/* Desktop Header */}
        <OwnerHeader
          onRefresh={() => fetchMetrics(true)}
          isRefreshing={refreshing}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Dashboard Title & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                <span className="text-slate-200 font-medium">Selamat datang, Owner 👋</span>{" "}
                — Berikut ringkasan kondisi barbershop Anda {metrics?.periodLabel?.toLowerCase() ?? "hari ini"}.
              </p>
            </div>

            {/* Date & Period Filter Selector */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#0F1D33] border border-slate-700/80 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span>{metrics?.periodLabel || "Hari ini"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {isFilterDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsFilterDropdownOpen(false)}
                    />
                    <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-44 bg-[#0F1D33] border border-slate-700 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                      {periodOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handlePeriodChange(opt.key)}
                          className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                            activePeriod === opt.key
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

              <div className="text-xs text-slate-400 font-medium hidden md:flex items-center gap-1.5">
                {activePeriod === "today" ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span>
                      {formatWibClock(liveClock, {
                        withSeconds: false,
                        withDay: true,
                        withDate: true,
                        withYear: true,
                      })}
                    </span>
                  </>
                ) : (
                  <span>{metrics?.dateRangeText || ""}</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 text-rose-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchMetrics()}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg font-semibold transition-colors shrink-0"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && !metrics ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-32 bg-[#0F1D33]/60 rounded-2xl border border-slate-800"
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 h-72 bg-[#0F1D33]/60 rounded-2xl border border-slate-800" />
                <div className="lg:col-span-5 h-72 bg-[#0F1D33]/60 rounded-2xl border border-slate-800" />
              </div>
              <div className="h-80 bg-[#0F1D33]/60 rounded-2xl border border-slate-800" />
            </div>
          ) : metrics ? (
            <>
              {/* 1. Summary Cards (4 Cards Grid) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-5">
                {/* Total Pendapatan */}
                <OwnerSummaryCard
                  title="Total Pendapatan"
                  value={formatRupiah(metrics.totalRevenue)}
                  subtitle={metrics.totalRevenueDeltaText}
                  icon={Wallet}
                  iconColor="text-blue-400"
                  iconBg="bg-blue-600/20"
                  trend={
                    metrics.revenueDeltaPercent > 0
                      ? `${metrics.revenueDeltaPercent}%`
                      : undefined
                  }
                  trendUp={metrics.isRevenueUp}
                />

                {/* Transaksi Hari Ini */}
                <OwnerSummaryCard
                  title="Transaksi"
                  value={String(metrics.totalTransactions)}
                  subtitle={metrics.totalTransactionsDeltaText}
                  icon={Receipt}
                  iconColor="text-blue-400"
                  iconBg="bg-blue-600/20"
                  trend={
                    metrics.transactionsDeltaPercent > 0
                      ? `${metrics.transactionsDeltaPercent}%`
                      : undefined
                  }
                  trendUp={metrics.isTransactionsUp}
                />

                {/* Capster Aktif */}
                <OwnerSummaryCard
                  title="Capster Aktif"
                  value={String(metrics.activeCapstersCount).padStart(2, "0")}
                  subtitle={metrics.activeCapstersText}
                  icon={Users}
                  iconColor="text-purple-400"
                  iconBg="bg-purple-600/20"
                />

                {/* Pembatalan */}
                <OwnerSummaryCard
                  title="Pembatalan"
                  value={String(metrics.cancellationsCount).padStart(2, "0")}
                  subtitle={metrics.cancellationsText}
                  icon={XCircle}
                  iconColor="text-rose-400"
                  iconBg="bg-rose-600/20"
                />
              </div>

              {/* 2. Middle Row: Grafik Pendapatan & Metode Pembayaran */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7">
                  <RevenueChartCard
                    data={metrics.chartData}
                    period={activePeriod}
                    onPeriodChange={handlePeriodChange}
                  />
                </div>
                <div className="lg:col-span-5">
                  <PaymentMethodsDonutCard
                    methods={metrics.paymentMethods}
                    totalTransactions={metrics.totalPaymentTransactions}
                  />
                </div>
              </div>

              {/* 3. Bottom Row: Transaksi Terbaru */}
              <RecentTransactionsTable
                transactions={filteredTransactions}
                onSelectTransaction={(tx) => setSelectedTx(tx)}
              />

              {/* 4. Performa Capster (Strictly separated per capster) */}
              <CapsterPerformanceTable performance={filteredCapsters} />

              {/* 5. Pembatalan Terbaru */}
              <RecentCancellationsTable
                cancellations={metrics.recentCancellations}
              />
            </>
          ) : null}
        </main>

        {/* Mobile Bottom Navigation */}
        <OwnerBottomNav activePath="/owner/dashboard" />

        {/* Transaction Detail Modal */}
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      </div>
    </div>
    </OwnerAuthGuard>
  );
}
