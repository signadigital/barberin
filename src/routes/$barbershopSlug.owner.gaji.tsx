import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Wallet,
  Receipt,
  Users,
  Calendar,
  Download,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  ChevronRight,
  Filter,
  X,
  CreditCard,
  Building2,
  TrendingUp,
  FileCheck,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah, getIndonesianMonthYear } from "@/lib/format";
import {
  getOwnerSalaryData,
  getOwnerCapsterBaseTransactions,
  type SalaryPeriod,
} from "@/lib/salary";
import {
  useCommissionStore,
  commissionActions,
  type CapsterCommissionItem,
} from "@/lib/commission-store";

export const Route = createFileRoute("/$barbershopSlug/owner/gaji")({
  head: () => ({
    meta: [
      { title: "Gaji & Komisi Capster — BARBERIN Owner" },
      {
        name: "description",
        content: "Kelola komisi capster berdasarkan transaksi layanan yang berhasil.",
      },
    ],
  }),
  component: OwnerGajiPage,
});

type ViewMode = "overview" | "detail" | "settings" | "history";
type PeriodFilter = SalaryPeriod;

function OwnerGajiPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const store = useCommissionStore();

  // Active view mode
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedCapsterId, setSelectedCapsterId] = useState<string>("");

  // Filters & States
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [dateRangeText, setDateRangeText] = useState("Memuat periode...");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // 1. Fetch live salary summary & capsters from PostgreSQL database
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getOwnerSalaryData({
      data: {
        period: periodFilter,
        barbershopSlug,
      },
    })
      .then((liveSummary) => {
        if (isMounted && liveSummary) {
          commissionActions.syncWithLiveSalaryData(liveSummary);
          setDateRangeText(liveSummary.dateRangeText);
          if (!selectedCapsterId && liveSummary.capsters.length > 0 && liveSummary.capsters[0]) {
            setSelectedCapsterId(liveSummary.capsters[0].capsterId);
          }
        }
      })
      .catch((err) => {
        console.warn("Gagal memuat data komisi & gaji live:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [periodFilter, barbershopSlug]);

  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCapster, setPaymentCapster] = useState<CapsterCommissionItem | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [editingCapster, setEditingCapster] = useState<CapsterCommissionItem | null>(null);
  const [inputPercentage, setInputPercentage] = useState<string>("15");

  // Selected capster for detail view
  const currentDetailCapster = useMemo(() => {
    return (
      store.capsters.find(
        (c) =>
          c.capsterId === selectedCapsterId ||
          c.id === selectedCapsterId ||
          c.name.toLowerCase() === selectedCapsterId.toLowerCase(),
      ) || store.capsters[0]
    );
  }, [store.capsters, selectedCapsterId]);

  // 2. Fetch live base transactions for the selected capster in detail view
  useEffect(() => {
    let isMounted = true;
    if (viewMode === "detail" && currentDetailCapster) {
      const targetId = currentDetailCapster.capsterId || currentDetailCapster.id;
      setLoadingTransactions(true);
      getOwnerCapsterBaseTransactions({
        data: {
          capsterId: targetId,
          period: periodFilter,
          barbershopSlug,
        },
      })
        .then((txs) => {
          if (isMounted && txs) {
            commissionActions.setLiveBaseTransactions(targetId, txs);
          }
        })
        .catch((err) => {
          console.warn("Gagal mengambil transaksi dasar live:", err);
        })
        .finally(() => {
          if (isMounted) setLoadingTransactions(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [viewMode, currentDetailCapster?.capsterId, periodFilter, barbershopSlug]);

  // Base transactions for current detail capster
  const baseTransactions = useMemo(() => {
    if (!currentDetailCapster) return [];
    const nameKey = currentDetailCapster.name.toLowerCase();
    const idKey = currentDetailCapster.capsterId || currentDetailCapster.id;
    return (
      store.baseTransactions[idKey] ||
      store.baseTransactions[currentDetailCapster.id] ||
      store.baseTransactions[`cps-${nameKey}`] ||
      []
    );
  }, [store.baseTransactions, currentDetailCapster]);

  const successfulBaseTxs = useMemo(() => {
    return baseTransactions.filter((t) => t.countedInCommission);
  }, [baseTransactions]);

  const cancelledBaseTxs = useMemo(() => {
    return baseTransactions.filter((t) => !t.countedInCommission);
  }, [baseTransactions]);

  // Overview Summary metrics based on actual capsters in store
  const totalCapsters = store.capsters.length;
  const totalTransactions = store.capsters.reduce((sum, c) => sum + c.transactionCount, 0);
  const totalRevenue = store.capsters.reduce((sum, c) => sum + c.serviceRevenue, 0);
  const totalCommission = store.capsters.reduce((sum, c) => sum + c.totalCommission, 0);
  const unpaidCommission = store.capsters
    .filter(
      (c) =>
        c.paymentStatus !== "Sudah Dibayar" &&
        c.paymentStatus !== "Belum Diatur" &&
        c.totalCommission > 0,
    )
    .reduce((sum, c) => sum + c.totalCommission, 0);
  const netIncome = Math.max(0, totalRevenue - totalCommission);

  // Filtered Capster List for Table
  const filteredCapsters = useMemo(() => {
    return store.capsters.filter((c) => {
      const q = (searchQuery || topSearch).trim().toLowerCase();
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.noPegawai.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        c.paymentStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus;
    });
  }, [store.capsters, searchQuery, topSearch, statusFilter]);

  // Filtered Payment History
  const filteredPaymentHistory = useMemo(() => {
    return store.paymentHistory.filter((p) => {
      if (historyPeriodFilter === "all") return true;
      return p.period.toLowerCase().includes(historyPeriodFilter.toLowerCase());
    });
  }, [store.paymentHistory, historyPeriodFilter]);

  // Handlers
  const handleOpenDetail = (capsterId: string) => {
    setSelectedCapsterId(capsterId);
    setViewMode("detail");
  };

  const handleOpenPaymentModal = (c: CapsterCommissionItem) => {
    setPaymentCapster(c);
    const now = new Date();
    setPaymentDate(
      now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }),
    );
    setPaymentNotes(`Pembayaran komisi ${c.name} periode ${c.period || dateRangeText}`);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!paymentCapster) return;
    commissionActions.payCommission(
      paymentCapster.capsterId,
      paymentDate,
      paymentNotes,
    );
    setIsPaymentModalOpen(false);
    toast.success(
      `Pembayaran komisi ${paymentCapster.name} (${formatRupiah(paymentCapster.totalCommission)}) berhasil dikonfirmasi!`,
    );
  };

  const handleOpenCommissionModal = (c: CapsterCommissionItem) => {
    setEditingCapster(c);
    setInputPercentage(
      c.commissionPercentage !== null ? String(c.commissionPercentage) : "15",
    );
    setIsCommissionModalOpen(true);
  };

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCapster) return;
    const num = Number(inputPercentage);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error("Persentase komisi harus berupa angka antara 0 dan 100.");
      return;
    }

    commissionActions.setCommissionPercentage(editingCapster.capsterId, num);
    setIsCommissionModalOpen(false);
    toast.success(
      `Persentase komisi ${editingCapster.name} berhasil diatur ke ${num}%.`,
    );
  };

  const handleExportCSV = () => {
    const headers = [
      "No",
      "Nama Capster",
      "ID Capster",
      "Periode",
      "Jumlah Transaksi",
      "Pendapatan Layanan",
      "Persentase Komisi",
      "Total Komisi",
      "Status Pembayaran",
    ];
    const rows = store.capsters.map((c, i) => [
      i + 1,
      c.name,
      c.noPegawai,
      c.period,
      c.transactionCount,
      c.serviceRevenue,
      c.commissionPercentage !== null ? `${c.commissionPercentage}%` : "-",
      c.totalCommission,
      c.paymentStatus,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `data_komisi_capster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data komisi berhasil diexport!");
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased font-sans">
      {/* Sidebar BARBERIN Desktop */}
      <OwnerSidebar activePath="/owner/gaji" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <OwnerMobileHeader activePath="/owner/gaji" />

        {/* Desktop Header with dark theme matching the other pages */}
        <OwnerHeader
          variant="dark"
          searchPlaceholder="Cari nama capster atau ID capster..."
          searchValue={topSearch}
          onSearchChange={setTopSearch}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* ================================================================ */}
          {/* CASE 1: VIEW DETAIL GAJI CAPSTER (DESKTOP & MOBILE)               */}
          {/* ================================================================ */}
          {viewMode === "detail" && currentDetailCapster && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Navigation */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewMode("overview")}
                    className="p-2 rounded-xl bg-[#0F1D33] border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
                    title="Kembali"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                      Detail Gaji Capster
                    </h1>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Rincian perhitungan komisi capster berdasarkan transaksi layanan yang berhasil.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewMode("overview")}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F1D33] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Kembali</span>
                  </button>

                  {currentDetailCapster.paymentStatus !== "Sudah Dibayar" &&
                    currentDetailCapster.statusCommission === "Diatur" &&
                    currentDetailCapster.totalCommission > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(currentDetailCapster)}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>
                          {currentDetailCapster.paymentStatus === "Diproses"
                            ? "Selesaikan Pembayaran"
                            : "Bayar Komisi"}
                        </span>
                      </button>
                  )}
                </div>
              </div>

              {/* Capster Profile Card */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xl flex items-center justify-center shrink-0">
                    {currentDetailCapster.avatarLetter}
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-white leading-tight">
                      {currentDetailCapster.name}
                    </h2>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      ID Capster: {currentDetailCapster.noPegawai}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Periode</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">
                      {currentDetailCapster.period}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Status</div>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          currentDetailCapster.paymentStatus === "Sudah Dibayar"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : currentDetailCapster.paymentStatus === "Diproses"
                              ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {currentDetailCapster.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Detail Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Informasi Komisi */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Informasi Komisi
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Jumlah Transaksi Berhasil</span>
                      <span className="font-bold text-white text-sm">
                        {currentDetailCapster.transactionCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Transaksi Dibatalkan</span>
                      <span className="text-rose-400 font-medium">
                        {cancelledBaseTxs.length} (tidak dihitung)
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Pendapatan Layanan</span>
                      <span className="font-bold text-white">
                        {formatRupiah(currentDetailCapster.serviceRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Persentase Komisi</span>
                      <span className="font-bold text-blue-400">
                        {currentDetailCapster.commissionPercentage !== null
                          ? `${currentDetailCapster.commissionPercentage}%`
                          : "Belum Diatur"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Perhitungan Komisi */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Perhitungan Komisi
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Pendapatan Layanan</span>
                      <span className="font-semibold text-slate-200">
                        {formatRupiah(currentDetailCapster.serviceRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">× Persentase Komisi</span>
                      <span className="font-semibold text-blue-400">
                        {currentDetailCapster.commissionPercentage || 0}%
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">Total Komisi</span>
                      <span className="text-xl font-extrabold text-blue-400">
                        {formatRupiah(currentDetailCapster.totalCommission)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Catatan */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-2 flex flex-col justify-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Catatan
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Transaksi yang dibatalkan tidak dihitung dalam perhitungan komisi. Persentase komisi dapat disesuaikan melalui menu{" "}
                    <button
                      type="button"
                      onClick={() => setViewMode("settings")}
                      className="text-blue-400 font-semibold hover:underline"
                    >
                      Pengaturan Komisi
                    </button>
                    . Perubahan komisi akan tercatat otomatis pada Audit Aktivitas.
                  </p>
                </div>
              </div>

              {/* Mobile Primary Action Button */}
              {currentDetailCapster.paymentStatus !== "Sudah Dibayar" &&
                currentDetailCapster.statusCommission === "Diatur" &&
                currentDetailCapster.totalCommission > 0 && (
                  <div className="block sm:hidden">
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal(currentDetailCapster)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>
                        {currentDetailCapster.paymentStatus === "Diproses"
                          ? "Selesaikan Pembayaran"
                          : "Bayar Komisi"}
                      </span>
                    </button>
                  </div>
              )}

              {/* Base Transactions Section */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Transaksi Dasar Komisi{" "}
                      <span className="text-sm font-normal text-slate-400">
                        (Transaksi Berhasil: {successfulBaseTxs.length})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Daftar transaksi layanan yang dikerjakan langsung oleh capster ini pada periode terkait.
                    </p>
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  {loadingTransactions ? (
                    <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Mengambil data transaksi asli dari database...</span>
                    </div>
                  ) : successfulBaseTxs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada transaksi berhasil untuk capster ini pada periode {dateRangeText}.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-3">No.</th>
                          <th className="py-3 px-3">No. Transaksi</th>
                          <th className="py-3 px-3">Tanggal & Waktu</th>
                          <th className="py-3 px-3">Pelanggan</th>
                          <th className="py-3 px-3">Layanan</th>
                          <th className="py-3 px-3">Nominal</th>
                          <th className="py-3 px-3">Metode</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Pembayaran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {successfulBaseTxs.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-3 font-semibold text-white">
                              {t.transactionNumber}
                            </td>
                            <td className="py-3.5 px-3 text-slate-300">{t.dateTime}</td>
                            <td className="py-3.5 px-3 font-medium text-slate-200">
                              {t.customerName}
                            </td>
                            <td className="py-3.5 px-3 text-slate-300">{t.serviceName}</td>
                            <td className="py-3.5 px-3 font-semibold text-white">
                              {formatRupiah(t.amount)}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-[#0A1424] border border-slate-700 text-slate-300 text-[11px] font-medium">
                                {t.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
                                {t.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Mobile Transaction Cards */}
                <div className="block md:hidden divide-y divide-slate-800/50">
                  {loadingTransactions ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Mengambil transaksi...</span>
                    </div>
                  ) : successfulBaseTxs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada transaksi berhasil pada periode ini.
                    </div>
                  ) : (
                    successfulBaseTxs.map((t) => (
                      <div key={t.id} className="py-3.5 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 mt-0.5">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">
                              {t.transactionNumber}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {t.dateTime}
                            </div>
                            <div className="text-xs font-medium text-slate-300 mt-1">
                              {t.serviceName} • {t.customerName}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">
                            {formatRupiah(t.amount)}
                          </div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium">
                            {t.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CASE 2: VIEW PENGATURAN KOMISI CAPSTER (DESKTOP & MOBILE)         */}
          {/* ================================================================ */}
          {viewMode === "settings" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Header Title & Back Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewMode("overview")}
                    className="p-2 rounded-xl bg-[#0F1D33] border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
                    title="Kembali ke Gaji"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      Pengaturan Komisi Capster
                    </h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                      Atur persentase komisi untuk setiap capster sebagai dasar perhitungan gaji dan komisi.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode("overview")}
                  className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-[#0F1D33] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Halaman Gaji</span>
                </button>
              </div>

              {/* Table / Card Container */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3">No.</th>
                        <th className="py-3 px-3">Nama Capster</th>
                        <th className="py-3 px-3">ID Capster</th>
                        <th className="py-3 px-3">Persentase Komisi</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {store.capsters.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                            Belum ada akun capster yang terdaftar untuk toko ini. Tambahkan capster terlebih dahulu di menu Manajemen Akun Capster.
                          </td>
                        </tr>
                      ) : (
                        store.capsters.map((c, index) => (
                          <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-3 text-slate-400">{index + 1}</td>
                            <td className="py-4 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                                  {c.avatarLetter}
                                </div>
                                <span className="font-semibold text-white">{c.name}</span>
                              </div>
                            </td>
                          <td className="py-4 px-3 font-mono text-slate-400">{c.noPegawai}</td>
                          <td className="py-4 px-3 font-semibold text-white">
                            {c.commissionPercentage !== null ? `${c.commissionPercentage}%` : "-"}
                          </td>
                          <td className="py-4 px-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                c.statusCommission === "Diatur"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {c.statusCommission}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            {c.statusCommission === "Diatur" ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCommissionModal(c)}
                                className="text-blue-400 hover:text-blue-300 font-semibold text-xs hover:underline"
                              >
                                Ubah
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenCommissionModal(c)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                              >
                                Atur Komisi
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>

                {/* Mobile Cards List */}
                <div className="block md:hidden divide-y divide-slate-800/50">
                  {store.capsters.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Belum ada akun capster yang terdaftar.
                    </div>
                  ) : (
                    store.capsters.map((c) => (
                      <div
                        key={c.id}
                      onClick={() => handleOpenCommissionModal(c)}
                      className="py-3.5 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-800/40 rounded-xl px-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                          {c.avatarLetter}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{c.name}</div>
                          <div className="text-xs text-slate-400">{c.noPegawai}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {c.commissionPercentage !== null ? (
                          <div className="text-sm font-bold text-white">
                            {c.commissionPercentage}%
                          </div>
                        ) : null}

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            c.statusCommission === "Diatur"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {c.statusCommission}
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

                {/* Pagination footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  <div>Menampilkan 1 - {store.capsters.length} dari {store.capsters.length} data</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                    >
                      &lt;
                    </button>
                    <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold shadow-xs">
                      1
                    </span>
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                    >
                      &gt;
                    </button>
                    <span className="ml-2 text-slate-400 font-medium">10 per halaman</span>
                  </div>
                </div>
              </div>

              {/* Information Card (5 Points Wireframe) */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Informasi</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed pl-1">
                  <li>Persentase komisi ditentukan oleh Owner.</li>
                  <li>Jika belum diatur, sistem tidak akan menghitung komisi.</li>
                  <li>Komisi dihitung dari transaksi layanan yang berhasil.</li>
                  <li>Transaksi yang dibatalkan tidak dihitung sebagai komisi.</li>
                  <li>Perubahan persentase komisi akan tercatat di Audit Aktivitas.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CASE 3: VIEW MOBILE RIWAYAT PEMBAYARAN                            */}
          {/* ================================================================ */}
          {viewMode === "history" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewMode("overview")}
                    className="p-2 rounded-xl bg-[#0F1D33] border border-slate-700/80 text-slate-300 hover:text-white shadow-xs"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="text-xl font-bold text-white">Riwayat Pembayaran</h1>
                </div>
              </div>

              {/* Mobile Search & Filter */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-3 flex items-center gap-2 shadow-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari capster atau periode..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#0A1424] border border-slate-700/80 text-white outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="Filter"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </div>

              {/* List Cards */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-4 shadow-xs divide-y divide-slate-800/50">
                {filteredPaymentHistory.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada riwayat pembayaran.
                  </div>
                ) : (
                  filteredPaymentHistory.map((h) => (
                  <div key={h.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 mt-0.5">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{h.capsterName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {h.paymentDate}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        {formatRupiah(h.commissionAmount)}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {/* ================================================================ */}
          {/* CASE 4: VIEW UTAMA (OVERVIEW) — Sesuai Gambar 1 & Gambar 2        */}
          {/* ================================================================ */}
          {viewMode === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Title, Subtitle, & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    Gaji
                  </h1>
                  <p className="text-xs md:text-sm text-slate-400 mt-1">
                    Kelola komisi capster berdasarkan transaksi layanan yang berhasil.
                  </p>
                </div>

                {/* Button Atur Komisi (Sesuai Gambar 2 screen 1) */}
                <button
                  type="button"
                  onClick={() => setViewMode("settings")}
                  className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                >
                  <Settings className="h-4 w-4" />
                  <span>Atur Komisi</span>
                </button>
              </div>

              {/* Filter Bar (Desktop & Mobile) */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-3.5 md:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                {/* Period Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
                  {(["today", "7d", "month", "all"] as const).map((p) => {
                    const label =
                      p === "today"
                        ? "Hari ini"
                        : p === "7d"
                          ? "7 Hari"
                          : p === "month"
                            ? "Bulan ini"
                            : "Semua";
                    const isActive = periodFilter === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriodFilter(p)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                          isActive
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {loading && (
                    <div className="flex items-center gap-1 text-xs text-blue-400 pl-2 shrink-0">
                      <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Memuat...</span>
                    </div>
                  )}
                </div>

                {/* Date range & Apply */}
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {/* Date Range Box */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-blue-400" />
                    <span>{dateRangeText}</span>
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      getOwnerSalaryData({
                        data: { period: periodFilter, barbershopSlug },
                      })
                        .then((liveSummary) => {
                          if (liveSummary) {
                            commissionActions.syncWithLiveSalaryData(liveSummary);
                            setDateRangeText(liveSummary.dateRangeText);
                            toast.success("Data transaksi komisi berhasil diperbarui!");
                          }
                        })
                        .catch(() => {
                          toast.error("Gagal memperbarui data dari database.");
                        })
                        .finally(() => setLoading(false));
                    }}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    Segarkan Data
                  </button>
                </div>
              </div>

              {/* 6 Summary Cards Grid */}
              {/* DESKTOP: 6 columns in a row. TABLET: 3 columns. MOBILE: 2 columns */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 md:gap-4">
                {/* 1. Total Capster */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                      <Users className="h-4 w-4" />
                    </div>
                    <span>Total Capster</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      {totalCapsters}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">capster</span>
                  </div>
                </div>

                {/* 2. Total Transaksi */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <span>Total Transaksi</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      {totalTransactions}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">transaksi</span>
                  </div>
                  {totalTransactions > 0 ? (
                    <div className="mt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <span>↑ 12% dari periode sebelumnya</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500 font-normal">
                      <span>Belum ada transaksi</span>
                    </div>
                  )}
                </div>

                {/* 3. Total Pendapatan Layanan */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-teal-600/20 text-teal-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="truncate">Total Pendapatan</span>
                  </div>
                  <div className="mt-3 text-lg md:text-xl font-extrabold text-white tracking-tight truncate">
                    {formatRupiah(totalRevenue)}
                  </div>
                  {totalRevenue > 0 ? (
                    <div className="mt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <span>↑ 10% dari periode sebelumnya</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500 font-normal">
                      <span>Rp 0 pada periode ini</span>
                    </div>
                  )}
                </div>

                {/* 4. Total Komisi */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <span>Total Komisi</span>
                  </div>
                  <div className="mt-3 text-lg md:text-xl font-extrabold text-white tracking-tight truncate">
                    {formatRupiah(totalCommission)}
                  </div>
                  {totalCommission > 0 ? (
                    <div className="mt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <span>↑ 10% dari periode sebelumnya</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500 font-normal">
                      <span>Rp 0 pada periode ini</span>
                    </div>
                  )}
                </div>

                {/* 5. Belum Dibayar */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <span>Belum Dibayar</span>
                  </div>
                  <div className="mt-3 text-lg md:text-xl font-extrabold text-rose-400 tracking-tight truncate">
                    {formatRupiah(unpaidCommission)}
                  </div>
                </div>

                {/* 6. Pendapatan Bersih Owner */}
                <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
                    <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <span className="truncate">Pendapatan Bersih</span>
                  </div>
                  <div className="mt-3 text-lg md:text-xl font-extrabold text-emerald-400 tracking-tight truncate">
                    {formatRupiah(netIncome)}
                  </div>
                  {netIncome > 0 ? (
                    <div className="mt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <span>↑ 10% dari periode sebelumnya</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500 font-normal">
                      <span>Rp 0 pada periode ini</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Data Komisi Capster */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xs space-y-4">
                {/* Section Header with Search & Export */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    Data Komisi Capster
                  </h3>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari capster..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#0A1424] border border-slate-700/80 text-white placeholder:text-slate-500 outline-hidden focus:border-blue-500 transition-all"
                      />
                    </div>

                    {/* Status Dropdown */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 outline-hidden hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <option value="all">Semua Status</option>
                      <option value="Belum Dibayar">Belum Dibayar</option>
                      <option value="Sudah Dibayar">Sudah Dibayar</option>
                      <option value="Diproses">Diproses</option>
                      <option value="Belum Diatur">Belum Diatur</option>
                    </select>

                    {/* Export Button */}
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors shadow-xs shrink-0"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3">No.</th>
                        <th className="py-3 px-3">Nama Capster</th>
                        <th className="py-3 px-3">Periode</th>
                        <th className="py-3 px-3">Jumlah Transaksi</th>
                        <th className="py-3 px-3">Pendapatan Layanan</th>
                        <th className="py-3 px-3">Persentase Komisi</th>
                        <th className="py-3 px-3">Total Komisi</th>
                        <th className="py-3 px-3">Status Pembayaran</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredCapsters.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Wallet className="h-8 w-8 text-slate-600 stroke-[1.5]" />
                              <p className="font-semibold text-slate-300">Belum Ada Data Komisi Capster</p>
                              <p className="text-slate-500 text-[11px]">
                                Belum ada capster atau transaksi yang tercatat pada periode ini.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredCapsters.map((c, index) => (
                          <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-3 text-slate-400">{index + 1}</td>
                            <td className="py-4 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                                  {c.avatarLetter}
                                </div>
                                <span className="font-semibold text-white">{c.name}</span>
                              </div>
                            </td>
                            <td className="py-4 px-3 text-slate-400">{c.period}</td>
                            <td className="py-4 px-3 text-slate-200 font-medium">
                              {c.transactionCount}
                            </td>
                            <td className="py-4 px-3 font-semibold text-white">
                              {formatRupiah(c.serviceRevenue)}
                            </td>
                            <td className="py-4 px-3 text-slate-300">
                              {c.commissionPercentage !== null ? `${c.commissionPercentage}%` : "-"}
                            </td>
                            <td className="py-4 px-3 font-bold text-white">
                              {c.totalCommission > 0 ? formatRupiah(c.totalCommission) : "-"}
                            </td>
                            <td className="py-4 px-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  c.paymentStatus === "Sudah Dibayar"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : c.paymentStatus === "Diproses"
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {c.paymentStatus}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                {c.paymentStatus !== "Sudah Dibayar" &&
                                  c.statusCommission === "Diatur" &&
                                  c.totalCommission > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenPaymentModal(c);
                                      }}
                                      className="px-2.5 py-1 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
                                    >
                                      {c.paymentStatus === "Diproses" ? "Selesaikan" : "Bayar"}
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(c.capsterId)}
                                  className="text-blue-400 hover:text-blue-300 font-semibold text-xs hover:underline"
                                >
                                  Lihat Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards List View */}
                <div className="block md:hidden divide-y divide-slate-800/50">
                  {filteredCapsters.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Wallet className="h-7 w-7 text-slate-600 stroke-[1.5]" />
                      <p className="font-semibold text-slate-300">Belum Ada Data Komisi Capster</p>
                      <p className="text-slate-500 text-[11px]">
                        Belum ada capster atau transaksi pada periode ini.
                      </p>
                    </div>
                  ) : (
                    filteredCapsters.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleOpenDetail(c.capsterId)}
                        className="py-3.5 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                            {c.avatarLetter}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{c.name}</div>
                            <div className="text-xs text-slate-400">
                              {c.transactionCount} transaksi
                            </div>
                          </div>
                        </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.paymentStatus === "Sudah Dibayar"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : c.paymentStatus === "Diproses"
                                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {c.paymentStatus}
                        </span>
                        <div className="text-xs font-extrabold text-white mt-1">
                          {c.totalCommission > 0 ? formatRupiah(c.totalCommission) : "-"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  <div>
                    Menampilkan 1 - {filteredCapsters.length} dari {store.capsters.length} data
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                    >
                      &lt;
                    </button>
                    <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold shadow-xs">
                      1
                    </span>
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                    >
                      &gt;
                    </button>
                    <span className="ml-2 text-slate-400 font-medium">10 per halaman</span>
                  </div>
                </div>
              </div>

              {/* Section: Riwayat Pembayaran Komisi */}
              <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    Riwayat Pembayaran Komisi
                  </h3>

                  <div className="flex items-center gap-2">
                    <select
                      value={historyPeriodFilter}
                      onChange={(e) => setHistoryPeriodFilter(e.target.value)}
                      className="px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 outline-hidden hover:bg-slate-800 transition-colors"
                    >
                      <option value="all">Semua Periode</option>
                      <option value={getIndonesianMonthYear(0)}>
                        {getIndonesianMonthYear(0)}
                      </option>
                      <option value={getIndonesianMonthYear(-1)}>
                        {getIndonesianMonthYear(-1)}
                      </option>
                      <option value={getIndonesianMonthYear(-2)}>
                        {getIndonesianMonthYear(-2)}
                      </option>
                    </select>

                    {/* Mobile link to open dedicated history page */}
                    <button
                      type="button"
                      onClick={() => setViewMode("history")}
                      className="sm:hidden text-xs text-blue-400 font-semibold flex items-center gap-0.5"
                    >
                      <span>Lihat Semua</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3">No.</th>
                        <th className="py-3 px-3">Tanggal Pembayaran</th>
                        <th className="py-3 px-3">Nama Capster</th>
                        <th className="py-3 px-3">Periode</th>
                        <th className="py-3 px-3">Pendapatan Layanan</th>
                        <th className="py-3 px-3">Persentase</th>
                        <th className="py-3 px-3">Nominal Komisi</th>
                        <th className="py-3 px-3">Dibayar Oleh</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredPaymentHistory.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                            Belum ada riwayat pembayaran komisi.
                          </td>
                        </tr>
                      ) : (
                        filteredPaymentHistory.map((h, index) => (
                          <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-3 text-slate-400">{index + 1}</td>
                            <td className="py-4 px-3 font-medium text-slate-300">{h.paymentDate}</td>
                            <td className="py-4 px-3 font-semibold text-white">{h.capsterName}</td>
                            <td className="py-4 px-3 text-slate-400">{h.period}</td>
                            <td className="py-4 px-3 font-semibold text-white">
                              {formatRupiah(h.serviceRevenue)}
                            </td>
                            <td className="py-4 px-3 text-slate-300">{h.commissionPercentage}%</td>
                            <td className="py-4 px-3 font-bold text-white">
                              {formatRupiah(h.commissionAmount)}
                            </td>
                            <td className="py-4 px-3 text-slate-400">{h.paidBy}</td>
                            <td className="py-4 px-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                                {h.status}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(h.capsterId)}
                                className="text-blue-400 hover:text-blue-300 font-semibold text-xs hover:underline"
                              >
                                Lihat Detail
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Simple Cards */}
                <div className="block md:hidden divide-y divide-slate-800/50">
                  {filteredPaymentHistory.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Belum ada riwayat pembayaran komisi.
                    </div>
                  ) : (
                    filteredPaymentHistory.slice(0, 3).map((h) => (
                      <div key={h.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-white">{h.capsterName}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {h.paymentDate}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">
                            {formatRupiah(h.commissionAmount)}
                          </div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                            {h.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <OwnerBottomNav activePath="/owner/gaji" />
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: KONFIRMASI PEMBAYARAN (DESKTOP & MOBILE)                    */}
      {/* ==================================================================== */}
      {isPaymentModalOpen && paymentCapster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F1D33] border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Konfirmasi Pembayaran
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Capster Overview */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A1424] border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                    {paymentCapster.avatarLetter}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {paymentCapster.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ID Capster: {paymentCapster.noPegawai}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Periode</div>
                  <div className="text-xs font-bold text-slate-200">
                    {paymentCapster.period}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#0A1424]/60 border border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Pendapatan Layanan</span>
                  <span className="font-semibold text-white">
                    {formatRupiah(paymentCapster.serviceRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Persentase Komisi</span>
                  <span className="font-semibold text-blue-400">
                    {paymentCapster.commissionPercentage || 0}%
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-slate-300">Total Komisi</span>
                  <span className="text-base font-extrabold text-blue-400">
                    {formatRupiah(paymentCapster.totalCommission)}
                  </span>
                </div>
              </div>

              {/* Input Tanggal Pembayaran */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Tanggal Pembayaran</label>
                <div className="relative">
                  <input
                    type="text"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-[#0A1424] text-white text-xs outline-hidden focus:border-blue-500"
                  />
                  <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Input Catatan (Opsional) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Tambahkan catatan pembayaran..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-[#0A1424] text-white text-xs outline-hidden focus:border-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-[#0A1424]/40">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all active:scale-95"
              >
                Konfirmasi Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ATUR / UBAH PERSENTASE KOMISI (DESKTOP & MOBILE)            */}
      {/* ==================================================================== */}
      {isCommissionModalOpen && editingCapster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F1D33] border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingCapster.commissionPercentage !== null
                  ? "Ubah Persentase Komisi"
                  : "Atur Persentase Komisi"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCommissionModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveCommission} className="p-6 space-y-4 text-xs">
              {/* Capster Identity */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0A1424] border border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                  {editingCapster.avatarLetter}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{editingCapster.name}</div>
                  <div className="text-[11px] text-slate-400">
                    ID Capster: {editingCapster.noPegawai}
                  </div>
                </div>
              </div>

              {/* Percentage Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Persentase Komisi</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={inputPercentage}
                    onChange={(e) => setInputPercentage(e.target.value)}
                    placeholder="15"
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-700 bg-[#0A1424] text-white font-semibold text-sm outline-hidden focus:border-blue-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan persentase komisi (contoh: 15)
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCommissionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </OwnerAuthGuard>
  );
}
