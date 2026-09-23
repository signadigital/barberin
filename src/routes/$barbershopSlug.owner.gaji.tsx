import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  Receipt,
  Users,
  Calendar,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  ChevronRight,
  Filter,
  X,
  CreditCard,
  Building2,
  TrendingUp,
  RefreshCw,
  Coins,
  ShieldCheck,
  Check,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  useTenantSlug,
  getTenantPath,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import {
  getOwnerCommissionRequests,
  getOwnerCommissionRequestDetail,
  getOwnerCommissionRecap,
  getOwnerCommissionPaymentHistory,
  approveCommissionRequest,
  rejectCommissionRequest,
  payCommissionRequest,
} from "@/lib/commissions";
import { getCapsters, updateCapsterCommissionPercentage } from "@/lib/capsters";
import { useOwner } from "@/lib/owner-store";

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

type TabType = "rekap" | "pengajuan" | "riwayat";
type PeriodType = "month" | "today" | "7d" | "30d" | "all";
type StatusFilterType = "all" | "pending" | "approved" | "rejected" | "paid";

function OwnerGajiPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { user } = useOwner();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("pengajuan");

  // Filter States
  const [period, setPeriod] = useState<PeriodType>("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeText, setDateRangeText] = useState("1 - 30 September 2026");

  // Selection for Detail View
  const [selectedPengajuanId, setSelectedPengajuanId] = useState<string | null>(null);

  // Data States
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
  });
  const [requestsList, setRequestsList] = useState<any[]>([]);

  // Detail View State
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Rekap Komisi State
  const [rekapData, setRekapData] = useState<any | null>(null);
  const [isLoadingRekap, setIsLoadingRekap] = useState(false);

  // Riwayat Pembayaran State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Capsters for "Atur Komisi" Modal
  const [capsters, setCapsters] = useState<any[]>([]);
  const [isLoadingCapsters, setIsLoadingCapsters] = useState(false);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [editingCapster, setEditingCapster] = useState<{
    id: string;
    name: string;
    percentage: number;
  } | null>(null);
  const [inputPercentage, setInputPercentage] = useState("15");

  // Modals for Actions
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isPostApproveModalOpen, setIsPostApproveModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"transfer" | "tunai" | "qris">("transfer");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Pengajuan Requests
  const fetchRequests = async () => {
    if (!barbershopSlug) return;
    setIsLoadingRequests(true);
    try {
      const res = await getOwnerCommissionRequests({
        data: {
          barbershopSlug,
          statusFilter,
          period,
          ...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
        },
      });
      if (res) {
        setRequestsList(res.requests);
        setCounts(res.counts);
        if (res.dateRangeText) setDateRangeText(res.dateRangeText);
      }
    } catch (err) {
      console.error("Gagal memuat data pengajuan komisi:", err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // 2. Fetch Detail Pengajuan
  const fetchDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await getOwnerCommissionRequestDetail({
        data: {
          pengajuanId: id,
          barbershopSlug,
        },
      });
      if (res) {
        setDetailData(res);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat detail pengajuan");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 3. Fetch Rekap Komisi
  const fetchRekap = async () => {
    if (!barbershopSlug) return;
    setIsLoadingRekap(true);
    try {
      const res = await getOwnerCommissionRecap({
        data: {
          barbershopSlug,
          period,
          ...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
        },
      });
      if (res) {
        setRekapData(res);
      }
    } catch (err) {
      console.error("Gagal memuat rekap komisi:", err);
    } finally {
      setIsLoadingRekap(false);
    }
  };

  // 4. Fetch Riwayat Pembayaran
  const fetchHistory = async () => {
    if (!barbershopSlug) return;
    setIsLoadingHistory(true);
    try {
      const res = await getOwnerCommissionPaymentHistory({
        data: {
          barbershopSlug,
          period,
          ...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
        },
      });
      if (res) {
        setHistoryList(res.payments);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat pembayaran:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 5. Fetch Capsters for Atur Komisi
  const fetchCapsters = async () => {
    if (!barbershopSlug) return;
    setIsLoadingCapsters(true);
    try {
      const res = await getCapsters({ data: { slug: barbershopSlug } });
      if (res) {
        setCapsters(res);
      }
    } catch (err) {
      console.error("Gagal memuat daftar capster:", err);
    } finally {
      setIsLoadingCapsters(false);
    }
  };

  // Trigger data fetch on tab/filter change
  useEffect(() => {
    if (activeTab === "pengajuan") {
      if (selectedPengajuanId) {
        fetchDetail(selectedPengajuanId);
      } else {
        fetchRequests();
      }
    } else if (activeTab === "rekap") {
      fetchRekap();
    } else if (activeTab === "riwayat") {
      fetchHistory();
    }
  }, [activeTab, selectedPengajuanId, period, statusFilter, barbershopSlug]);

  // Handle Search Debounce or Submit
  useEffect(() => {
    const handler = setTimeout(() => {
      if (activeTab === "pengajuan" && !selectedPengajuanId) {
        fetchRequests();
      } else if (activeTab === "rekap") {
        fetchRekap();
      } else if (activeTab === "riwayat") {
        fetchHistory();
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handler: Approve Request
  const handleApprove = async () => {
    if (!selectedPengajuanId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await approveCommissionRequest({
        data: {
          pengajuanId: selectedPengajuanId,
          ...(user?.id_user ? { ownerUserId: user.id_user } : {}),
          barbershopSlug,
        },
      });
      toast.success("Pengajuan komisi berhasil disetujui!");
      setIsApproveModalOpen(false);
      setIsPostApproveModalOpen(true);
      // Refresh current detail
      await fetchDetail(selectedPengajuanId);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyetujui pengajuan komisi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Reject Request
  const handleReject = async () => {
    if (!selectedPengajuanId || isSubmitting) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectCommissionRequest({
        data: {
          pengajuanId: selectedPengajuanId,
          alasan: rejectReason.trim(),
          ...(user?.id_user ? { ownerUserId: user.id_user } : {}),
          barbershopSlug,
        },
      });
      toast.success("Pengajuan komisi berhasil ditolak.");
      setIsRejectModalOpen(false);
      setRejectReason("");
      await fetchDetail(selectedPengajuanId);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menolak pengajuan komisi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Pay Commission
  const handlePay = async () => {
    if (!selectedPengajuanId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await payCommissionRequest({
        data: {
          pengajuanId: selectedPengajuanId,
          metodePembayaran: payMethod,
          ...(user?.id_user ? { ownerUserId: user.id_user } : {}),
          ...(payNotes.trim() ? { catatan: payNotes.trim() } : {}),
          barbershopSlug,
        },
      });
      toast.success(`Pembayaran komisi sebesar ${formatRupiah(res.amount)} berhasil dikonfirmasi!`);
      setIsPayModalOpen(false);
      setIsPostApproveModalOpen(false);
      await fetchDetail(selectedPengajuanId);
      fetchRequests();
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengonfirmasi pembayaran komisi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Save Commission Percentage
  const handleSavePercentage = async (capsterId: string, percentage: number) => {
    try {
      await updateCapsterCommissionPercentage({
        data: {
          capsterId,
          percentage,
          barbershopSlug,
        },
      });
      toast.success("Persentase komisi berhasil diperbarui!");
      fetchCapsters();
      fetchRequests();
      if (selectedPengajuanId) fetchDetail(selectedPengajuanId);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui persentase komisi");
    }
  };

  // Helper: Status badge renderer
  const renderStatusBadge = (uiStatus: string, label: string) => {
    switch (uiStatus) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            {label || "Menunggu Persetujuan"}
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {label || "Disetujui / Menunggu Pembayaran"}
          </span>
        );
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {label || "Sudah Terbayarkan"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25">
            <X className="h-3.5 w-3.5" />
            {label || "Ditolak"}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {label}
          </span>
        );
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="flex h-screen bg-[#070D18] text-slate-100 overflow-hidden font-sans">
        {/* Sidebar */}
        <OwnerSidebar activePath={getTenantPath(barbershopSlug, "/owner/gaji")} />

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header Desktop & Mobile */}
          <OwnerHeader
            searchPlaceholder="Cari nama capster atau ID capster..."
            onSearchChange={setSearchQuery}
          />
          <OwnerMobileHeader
            activePath={getTenantPath(barbershopSlug, "/owner/gaji")}
          />

          {/* Main Body */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
            {/* Top Page Header & Atur Komisi Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                  Gaji
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Kelola komisi capster berdasarkan transaksi layanan yang berhasil.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  fetchCapsters();
                  setIsCommissionModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition-all self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Atur Komisi</span>
              </button>
            </div>

            {/* 3 Tabs Bar */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-px">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("rekap");
                  setSelectedPengajuanId(null);
                }}
                className={`px-4 py-3 text-sm font-semibold transition-all relative cursor-pointer ${
                  activeTab === "rekap"
                    ? "text-blue-400 border-b-2 border-blue-500 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Rekap Komisi
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("pengajuan");
                }}
                className={`px-4 py-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer ${
                  activeTab === "pengajuan"
                    ? "text-blue-400 border-b-2 border-blue-500 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Pengajuan Penarikan</span>
                {counts.pending > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] bg-red-600 text-white rounded-full font-bold leading-none">
                    {counts.pending}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("riwayat");
                  setSelectedPengajuanId(null);
                }}
                className={`px-4 py-3 text-sm font-semibold transition-all relative cursor-pointer ${
                  activeTab === "riwayat"
                    ? "text-blue-400 border-b-2 border-blue-500 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Riwayat Pembayaran
              </button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 2: PENGAJUAN PENARIKAN (SCREEN 1, SCREEN 2, SCREEN 7) */}
            {/* ========================================================================= */}
            {activeTab === "pengajuan" && (
              <>
                {/* VIEW A: DETAIL PENGAJUAN KOMISI (SCREEN 2) */}
                {selectedPengajuanId ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Back button & Title */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedPengajuanId(null)}
                          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium mb-2 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>Kembali ke Daftar Pengajuan</span>
                        </button>
                        <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                          Detail Pengajuan Penarikan Komisi
                        </h2>
                      </div>

                      {detailData && (
                        <div>
                          {renderStatusBadge(
                            detailData.pengajuan.uiStatus,
                            detailData.pengajuan.statusLabel,
                          )}
                        </div>
                      )}
                    </div>

                    {isLoadingDetail ? (
                      <div className="p-12 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                        <p className="text-sm text-slate-400">Memuat detail pengajuan...</p>
                      </div>
                    ) : detailData ? (
                      <>
                        {/* 2-Column Info Grid: Capster Info + Pengajuan Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Card 1: Informasi Capster */}
                          <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Informasi Capster
                            </h3>
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl font-bold shrink-0">
                                {detailData.capster.avatarLetter}
                              </div>
                              <div className="space-y-1">
                                <div className="text-base font-bold text-white">
                                  {detailData.capster.name}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {detailData.capster.phone}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-xs text-slate-300">
                                    {detailData.capster.role}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {detailData.capster.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card 2: Informasi Pengajuan */}
                          <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Informasi Pengajuan
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Jumlah Diajukan</span>
                                <span className="font-bold text-white text-base">
                                  {formatRupiah(detailData.pengajuan.jumlah)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Tanggal Pengajuan</span>
                                <span className="text-slate-200">
                                  {detailData.pengajuan.diajukanAtFormatted}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Status</span>
                                <span>
                                  {renderStatusBadge(
                                    detailData.pengajuan.uiStatus,
                                    detailData.pengajuan.statusLabel,
                                  )}
                                </span>
                              </div>

                              {detailData.pengajuan.alasanPenolakan && (
                                <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                                  <span className="font-semibold block mb-0.5">Alasan Penolakan:</span>
                                  {detailData.pengajuan.alasanPenolakan}
                                </div>
                              )}

                              {detailData.pengajuan.dibayarAtFormatted && (
                                <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Dibayarkan Pada:</span>
                                    <span className="font-semibold text-white">
                                      {detailData.pengajuan.dibayarAtFormatted}
                                    </span>
                                  </div>
                                  {detailData.pengajuan.metodePembayaran && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Metode:</span>
                                      <span className="uppercase text-white font-medium">
                                        {detailData.pengajuan.metodePembayaran}
                                      </span>
                                    </div>
                                  )}
                                  {detailData.pengajuan.referensi && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Referensi:</span>
                                      <span className="font-mono text-white text-[11px]">
                                        {detailData.pengajuan.referensi}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card 3: Dasar Komisi */}
                        <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-white">Dasar Komisi</h3>
                                <p className="text-xs text-slate-400">
                                  Komisi berasal dari transaksi yang telah selesai pada hari ini. Berikut daftar transaksi yang membentuk komisi:
                                </p>
                              </div>
                            </div>

                            <span className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0 cursor-pointer self-end sm:self-auto">
                              Lihat Semua Transaksi
                            </span>
                          </div>

                          {/* Table of transactions */}
                          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold">
                                <tr>
                                  <th className="px-4 py-3">Tanggal</th>
                                  <th className="px-4 py-3">Layanan</th>
                                  <th className="px-4 py-3 text-right">Nominal</th>
                                  <th className="px-4 py-3 text-right">
                                    Komisi ({detailData.capster.persentaseKomisi}%)
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {detailData.dasarKomisi.transactions.length > 0 ? (
                                  detailData.dasarKomisi.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                                        {tx.tanggalFormatted}
                                      </td>
                                      <td className="px-4 py-3 text-white font-medium">
                                        {tx.layananName}
                                      </td>
                                      <td className="px-4 py-3 text-slate-300 text-right">
                                        {formatRupiah(tx.nominal)}
                                      </td>
                                      <td className="px-4 py-3 text-emerald-400 font-semibold text-right">
                                        {formatRupiah(tx.komisi)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-xs">
                                      Tidak ada rincian transaksi pembentuk komisi yang tercatat.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              {detailData.dasarKomisi.transactions.length > 0 && (
                                <tfoot className="bg-slate-900/60 font-semibold border-t border-slate-800 text-xs">
                                  <tr>
                                    <td colSpan={2} className="px-4 py-3 text-slate-400">
                                      Total Transaksi ({detailData.dasarKomisi.transactions.length})
                                    </td>
                                    <td className="px-4 py-3 text-slate-300 text-right">
                                      {formatRupiah(detailData.dasarKomisi.totalNominal)}
                                    </td>
                                    <td className="px-4 py-3 text-emerald-400 font-bold text-right">
                                      {formatRupiah(detailData.dasarKomisi.totalKomisi)}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>

                        {/* Action Buttons / Status Notices */}
                        <div className="pt-2">
                          {detailData.pengajuan.uiStatus === "pending" && (
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectReason("");
                                  setIsRejectModalOpen(true);
                                }}
                                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-red-500/50 hover:bg-red-500/10 text-red-400 text-sm font-semibold transition-all cursor-pointer"
                              >
                                Tolak Pengajuan
                              </button>

                              <button
                                type="button"
                                onClick={() => setIsApproveModalOpen(true)}
                                className="w-full sm:flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                              >
                                Setujui Pengajuan
                              </button>
                            </div>
                          )}

                          {detailData.pengajuan.uiStatus === "approved" && (
                            <div className="space-y-4">
                              {/* Screen 5 Banner */}
                              <div className="rounded-2xl bg-blue-950/40 border border-blue-800/50 p-5 flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                                  <Clock className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold text-white text-base">
                                    Pengajuan Telah Disetujui
                                  </div>
                                  <p className="text-xs text-slate-300">
                                    Komisi sebesar {formatRupiah(detailData.pengajuan.jumlah)} untuk{" "}
                                    <span className="font-semibold text-white">
                                      {detailData.capster.name}
                                    </span>{" "}
                                    telah disetujui. Silakan lakukan pembayaran dan konfirmasi setelah komisi diberikan kepada Capster.
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setIsPayModalOpen(true)}
                                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                              >
                                Konfirmasi Komisi Sudah Dibayarkan
                              </button>
                            </div>
                          )}

                          {detailData.pengajuan.uiStatus === "paid" && (
                            <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800/50 p-5 flex items-center gap-4">
                              <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
                              <div>
                                <div className="font-bold text-emerald-400 text-base">
                                  Sudah Terbayarkan
                                </div>
                                <p className="text-xs text-slate-300">
                                  Komisi sebesar {formatRupiah(detailData.pengajuan.jumlah)} telah berhasil dibayarkan kepada{" "}
                                  <span className="font-semibold text-white">{detailData.capster.name}</span> pada{" "}
                                  {detailData.pengajuan.dibayarAtFormatted}.
                                </p>
                              </div>
                            </div>
                          )}

                          {detailData.pengajuan.uiStatus === "rejected" && (
                            <div className="rounded-2xl bg-red-950/40 border border-red-800/50 p-5 flex items-center gap-4">
                              <AlertTriangle className="h-8 w-8 text-red-400 shrink-0" />
                              <div>
                                <div className="font-bold text-red-400 text-base">
                                  Pengajuan Ditolak
                                </div>
                                <p className="text-xs text-slate-300">
                                  Pengajuan ini ditolak oleh Owner. Komisi telah dikembalikan ke saldo belum dibayar milik Capster.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  /* VIEW B: DAFTAR PENGAJUAN (SCREEN 1 & SCREEN 7) */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Filter Controls Row */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Date Filter + Segarkan Data */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Date Filter Dropdown */}
                        <div className="relative">
                          <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as PeriodType)}
                            className="appearance-none bg-[#0A1424] border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-8 text-xs font-medium text-slate-200 hover:border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                          >
                            <option value="month">1 - 30 September 2026</option>
                            <option value="today">Hari Ini</option>
                            <option value="7d">7 Hari Terakhir</option>
                            <option value="30d">30 Hari Terakhir</option>
                            <option value="all">Semua Waktu</option>
                          </select>
                          <Calendar className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Segarkan Data Button */}
                        <button
                          type="button"
                          onClick={() => fetchRequests()}
                          disabled={isLoadingRequests}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRequests ? "animate-spin" : ""}`} />
                          <span>Segarkan Data</span>
                        </button>
                      </div>

                      {/* Right: Search Capster */}
                      <div className="relative w-full lg:w-64">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari capster..."
                          className="w-full bg-[#0A1424] border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Filter Pills (Screen 1) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          statusFilter === "all"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-[#0A1424] hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        Semua ({counts.all})
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter("pending")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          statusFilter === "pending"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-[#0A1424] hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        Menunggu ({counts.pending})
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter("approved")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          statusFilter === "approved"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-[#0A1424] hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        Disetujui ({counts.approved})
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter("rejected")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          statusFilter === "rejected"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-[#0A1424] hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        Ditolak ({counts.rejected})
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter("paid")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          statusFilter === "paid"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-[#0A1424] hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        Terbayarkan ({counts.paid})
                      </button>
                    </div>

                    {/* Table (Screen 1 & Screen 7) */}
                    <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                            <tr>
                              <th className="px-5 py-3.5 w-14">NO.</th>
                              <th className="px-5 py-3.5">NAMA CAPSTER</th>
                              <th className="px-5 py-3.5">JUMLAH</th>
                              <th className="px-5 py-3.5">TANGGAL PENGAJUAN</th>
                              <th className="px-5 py-3.5">STATUS</th>
                              <th className="px-5 py-3.5">DIBAYARKAN</th>
                              <th className="px-5 py-3.5 text-right w-24">AKSI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {isLoadingRequests ? (
                              <tr>
                                <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                  <div className="flex flex-col items-center justify-center gap-3">
                                    <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
                                    <span className="text-xs">Memuat daftar pengajuan komisi...</span>
                                  </div>
                                </td>
                              </tr>
                            ) : requestsList.length > 0 ? (
                              requestsList.map((item, idx) => (
                                <tr key={item.idPengajuan} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="px-5 py-4 text-xs font-mono text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                          idx % 2 === 0 ? "bg-blue-600" : "bg-purple-600"
                                        }`}
                                      >
                                        {item.avatarLetter}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-white text-sm">
                                          {item.capsterName}
                                        </div>
                                        {item.noPegawai && (
                                          <div className="text-[11px] text-slate-400">
                                            {item.noPegawai}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 font-semibold text-white">
                                    {formatRupiah(item.jumlah)}
                                  </td>
                                  <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                                    {item.diajukanAtShort}
                                  </td>
                                  <td className="px-5 py-4">
                                    {renderStatusBadge(item.uiStatus, item.statusLabel)}
                                  </td>
                                  <td className="px-5 py-4 text-slate-400 font-mono text-xs">
                                    {item.dibayarAt || "-"}
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPengajuanId(item.idPengajuan)}
                                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                                    >
                                      Lihat
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                                  Tidak ada data pengajuan komisi yang sesuai dengan filter.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Pagination */}
                      <div className="px-5 py-3.5 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>Menampilkan {requestsList.length} dari {counts.all} data</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 cursor-not-allowed text-xs"
                          >
                            &lt;
                          </button>
                          <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold text-xs">
                            1
                          </span>
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 cursor-not-allowed text-xs"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ========================================================================= */}
            {/* TAB 1: REKAP KOMISI */}
            {/* ========================================================================= */}
            {activeTab === "rekap" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 4 Summary Cards */}
                {rekapData?.summary && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-4 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-xs">
                        <span>Total Komisi Belum Dibayar</span>
                        <Coins className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="text-xl font-bold text-amber-400">
                        {formatRupiah(rekapData.summary.totalKomisiBelumDibayar)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-4 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-xs">
                        <span>Total Komisi Terbayarkan</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-xl font-bold text-emerald-400">
                        {formatRupiah(rekapData.summary.totalKomisiTerbayar)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-4 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-xs">
                        <span>Transaksi Selesai</span>
                        <Receipt className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="text-xl font-bold text-white">
                        {rekapData.summary.totalTransaksiSelesai} Transaksi
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-4 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-xs">
                        <span>Total Omset Layanan</span>
                        <TrendingUp className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="text-xl font-bold text-white">
                        {formatRupiah(rekapData.summary.totalOmset)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rekap Table */}
                <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">Rekapitulasi Komisi Capster</h2>
                      <p className="text-xs text-slate-400">
                        Akumulasi komisi capster yang dihitung dari transaksi layanan completed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchRekap()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingRekap ? "animate-spin" : ""}`} />
                      <span>Muat Ulang</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5 w-14">NO.</th>
                          <th className="px-5 py-3.5">NAMA CAPSTER</th>
                          <th className="px-5 py-3.5 text-center">TRANSAKSI</th>
                          <th className="px-5 py-3.5 text-right">DASAR KOMISI</th>
                          <th className="px-5 py-3.5 text-center">KOMISI (%)</th>
                          <th className="px-5 py-3.5 text-right">TOTAL KOMISI</th>
                          <th className="px-5 py-3.5 text-right">BELUM DIBAYAR</th>
                          <th className="px-5 py-3.5">STATUS KOMISI</th>
                          <th className="px-5 py-3.5">TERAKHIR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {isLoadingRekap ? (
                          <tr>
                            <td colSpan={9} className="px-5 py-12 text-center text-slate-400 text-xs">
                              Memuat rekapitulasi komisi...
                            </td>
                          </tr>
                        ) : rekapData?.items?.length ? (
                          rekapData.items.map((item: any, idx: number) => (
                            <tr key={item.capsterId} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-5 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                                    {item.avatarLetter}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white text-sm">{item.capsterName}</div>
                                    <div className="text-[11px] text-slate-400">{item.noPegawai || "-"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center font-semibold text-white">
                                {item.jumlahTransaksi}
                              </td>
                              <td className="px-5 py-4 text-right text-slate-300">
                                {formatRupiah(item.dasarKomisi)}
                              </td>
                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {item.persentaseKomisi}%
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right font-bold text-white">
                                {formatRupiah(item.nominalKomisi)}
                              </td>
                              <td className="px-5 py-4 text-right font-semibold text-amber-400">
                                {formatRupiah(item.komisiBelumDibayar)}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    item.statusKomisi === "Sudah Terbayarkan"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : item.statusKomisi === "Belum Dibayar"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-slate-800 text-slate-400"
                                  }`}
                                >
                                  {item.statusKomisi}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-slate-400 font-mono text-xs">
                                {item.tanggalTerakhirFormatted}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="px-5 py-12 text-center text-slate-500 text-xs">
                              Tidak ada data komisi untuk periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: RIWAYAT PEMBAYARAN */}
            {/* ========================================================================= */}
            {activeTab === "riwayat" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">Riwayat Pembayaran Komisi</h2>
                      <p className="text-xs text-slate-400">
                        Daftar komisi yang telah berhasil dibayarkan kepada capster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchHistory()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingHistory ? "animate-spin" : ""}`} />
                      <span>Muat Ulang</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5 w-14">NO.</th>
                          <th className="px-5 py-3.5">NAMA CAPSTER</th>
                          <th className="px-5 py-3.5">NOMINAL DIBAYAR</th>
                          <th className="px-5 py-3.5">TANGGAL PEMBAYARAN</th>
                          <th className="px-5 py-3.5">METODE</th>
                          <th className="px-5 py-3.5">REFERENSI</th>
                          <th className="px-5 py-3.5">STATUS</th>
                          <th className="px-5 py-3.5 text-right w-24">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {isLoadingHistory ? (
                          <tr>
                            <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-xs">
                              Memuat riwayat pembayaran komisi...
                            </td>
                          </tr>
                        ) : historyList.length > 0 ? (
                          historyList.map((item, idx) => (
                            <tr key={item.idPembayaran} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-5 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                                    {item.avatarLetter}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white text-sm">{item.capsterName}</div>
                                    <div className="text-[11px] text-slate-400">{item.capsterPhone || "-"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-bold text-white">
                                {formatRupiah(item.jumlahBayar)}
                              </td>
                              <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                                {item.dibayarAtFormatted}
                              </td>
                              <td className="px-5 py-4">
                                <span className="uppercase text-xs font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                                  {item.metodePembayaran}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-mono text-xs text-slate-400">
                                {item.referensi}
                              </td>
                              <td className="px-5 py-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {item.statusLabel}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("pengajuan");
                                    setSelectedPengajuanId(item.idPengajuan);
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                                >
                                  Lihat
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-xs">
                              Belum ada pembayaran komisi yang tercatat.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ========================================================================= */}
        {/* MODAL 1: SETUJUI PENGAJUAN (SCREEN 3) */}
        {/* ========================================================================= */}
        {isApproveModalOpen && detailData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#0A1424] border border-slate-800 p-6 shadow-2xl space-y-5 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Setujui Penarikan Komisi?
                </h3>
                <p className="text-xs text-slate-300">
                  Anda akan menyetujui penarikan komisi sebesar{" "}
                  <span className="font-bold text-white">
                    {formatRupiah(detailData.pengajuan.jumlah)}
                  </span>{" "}
                  untuk <span className="font-semibold text-white">{detailData.capster.name}</span>.
                </p>
                <p className="text-xs text-slate-400">
                  Setelah disetujui, pengajuan masuk ke tahap pembayaran.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {isSubmitting ? "Menyetujui..." : "Setujui Pengajuan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: TOLAK PENGAJUAN (SCREEN 4) */}
        {/* ========================================================================= */}
        {isRejectModalOpen && detailData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#0A1424] border border-slate-800 p-6 shadow-2xl space-y-5">
              <div className="h-16 w-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                <AlertTriangle className="h-8 w-8 stroke-[2.5]" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Tolak Pengajuan?
                </h3>
                <p className="text-xs text-slate-300">
                  Masukkan alasan penolakan pengajuan komisi dari{" "}
                  <span className="font-semibold text-white">{detailData.capster.name}</span>.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-300">
                  Alasan Penolakan <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, 200))}
                  placeholder="Contoh: Nominal pengajuan tidak sesuai dengan komisi yang tersedia."
                  rows={4}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                />
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  {rejectReason.length}/200
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectReason.trim()}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  {isSubmitting ? "Menolak..." : "Tolak Pengajuan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: NOTICE SETELAH DISETUJUI (SCREEN 5) */}
        {/* ========================================================================= */}
        {isPostApproveModalOpen && detailData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#0A1424] border border-slate-800 p-6 shadow-2xl space-y-5 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                <Clock className="h-8 w-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Pengajuan Telah Disetujui
                </h3>
                <p className="text-xs text-slate-300">
                  Komisi sebesar{" "}
                  <span className="font-bold text-white">
                    {formatRupiah(detailData.pengajuan.jumlah)}
                  </span>{" "}
                  untuk <span className="font-semibold text-white">{detailData.capster.name}</span>{" "}
                  telah disetujui. Silakan lakukan pembayaran dan konfirmasi setelah komisi diberikan kepada Capster.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPostApproveModalOpen(false);
                    setIsPayModalOpen(true);
                  }}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  Konfirmasi Komisi Sudah Dibayarkan
                </button>
                <button
                  type="button"
                  onClick={() => setIsPostApproveModalOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: KONFIRMASI PEMBAYARAN (SCREEN 6) */}
        {/* ========================================================================= */}
        {isPayModalOpen && detailData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#0A1424] border border-slate-800 p-6 shadow-2xl space-y-5 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                <CreditCard className="h-8 w-8 stroke-[2]" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Konfirmasi Komisi Terbayarkan?
                </h3>
                <p className="text-xs text-slate-300">
                  Pastikan komisi telah diberikan kepada{" "}
                  <span className="font-semibold text-white">{detailData.capster.name}</span> sebelum melakukan konfirmasi.
                </p>
              </div>

              {/* Details card inside modal */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Capster</span>
                  <span className="font-semibold text-white">{detailData.capster.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah</span>
                  <span className="font-bold text-white text-sm">
                    {formatRupiah(detailData.pengajuan.jumlah)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-cyan-400 font-semibold">Menunggu Pembayaran</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["transfer", "tunai", "qris"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`py-1.5 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                          payMethod === m
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Konfirmasi Sudah Dibayarkan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 5: ATUR KOMISI */}
        {/* ========================================================================= */}
        {isCommissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-[#0A1424] border border-slate-800 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">Atur Komisi Capster</h3>
                    <p className="text-xs text-slate-400">
                      Tentukan persentase komisi per capster. Berlaku snapshot pada transaksi baru.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCommissionModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isLoadingCapsters ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-2" />
                  Memuat daftar capster...
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {capsters.map((c) => (
                    <div
                      key={c.id_capster}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{c.name}</div>
                          <div className="text-[11px] text-slate-400">{c.no_pegawai || c.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {editingCapster?.id === c.id_capster ? (
                          <div className="flex items-center gap-1.5">
                            <div className="relative w-20">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={inputPercentage}
                                onChange={(e) => setInputPercentage(e.target.value)}
                                className="w-full bg-slate-800 border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white text-center focus:outline-none"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                %
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(inputPercentage);
                                if (!isNaN(val) && val >= 0 && val <= 100) {
                                  handleSavePercentage(c.id_capster, val);
                                  setEditingCapster(null);
                                } else {
                                  toast.error("Persentase harus antara 0 dan 100.");
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCapster(null)}
                              className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {c.persentase_komisi || "15"}%
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCapster({
                                  id: c.id_capster,
                                  name: c.name,
                                  percentage: Number(c.persentase_komisi || 15),
                                });
                                setInputPercentage(String(c.persentase_komisi || 15));
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                            >
                              Ubah
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setIsCommissionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OwnerAuthGuard>
  );
}
