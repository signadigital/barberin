import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Hourglass,
  Info,
  Plus,
  RefreshCw,
  Send,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MobileShell } from "@/components/barberin/ui";
import {
  CapsterAuthGuard,
  CapsterBottomNav,
  CapsterHeader,
} from "@/components/capster/ui";
import { useCapster } from "@/lib/capster-store";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getCapsterCommissionDetailData,
  getCapsterWithdrawalDetail,
  requestCommissionWithdrawal,
  type CapsterCommissionDetailData,
  type CapsterWithdrawalRequestItem,
} from "@/lib/commissions";

export const Route = createFileRoute("/$barbershopSlug/capster/commissions")({
  head: () => ({
    meta: [
      { title: "Detail Komisi — BARBERIN Capster" },
      {
        name: "description",
        content: "Detail komisi dan riwayat penarikan komisi Capster BARBERIN.",
      },
    ],
  }),
  component: CapsterCommissionsPage,
});

type FilterTabKey = "all" | "pending" | "approved" | "rejected" | "paid";

const FILTER_TABS: Array<{ id: FilterTabKey; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
  { id: "paid", label: "Sudah Ditarik" },
];

function CapsterCommissionsPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { capsterId, userId } = useCapster();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CapsterCommissionDetailData | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTabKey>("all");

  // Modal State: Ajukan Penarikan
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Modal State: Detail Pengajuan Card
  const [selectedRequest, setSelectedRequest] =
    useState<CapsterWithdrawalRequestItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [requestDetail, setRequestDetail] = useState<any | null>(null);

  // Fetch Commission Detail Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (!capsterId && !userId) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (isInitial) setLoading(true);

      try {
        const res = await getCapsterCommissionDetailData({
          data: {
            ...(capsterId ? { capsterId } : {}),
            ...(userId ? { userId } : {}),
            ...(barbershopSlug ? { barbershopSlug } : {}),
          },
        });
        if (res) {
          setData(res);
        }
      } catch (err) {
        console.error("Gagal memuat detail komisi capster:", err);
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [capsterId, userId, barbershopSlug],
  );

  useEffect(() => {
    fetchData(true);

    const intervalId = setInterval(() => {
      fetchData(false);
    }, 10000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  // Load detailed transactions when opening card
  useEffect(() => {
    if (!selectedRequest) {
      setRequestDetail(null);
      return;
    }

    let mounted = true;
    setLoadingDetail(true);

    getCapsterWithdrawalDetail({
      data: {
        pengajuanId: selectedRequest.idPengajuan,
        ...(capsterId ? { capsterId } : {}),
        ...(userId ? { userId } : {}),
        ...(barbershopSlug ? { barbershopSlug } : {}),
      },
    })
      .then((detail) => {
        if (mounted) {
          setRequestDetail(detail);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat detail penarikan:", err);
      })
      .finally(() => {
        if (mounted) setLoadingDetail(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedRequest, capsterId, userId, barbershopSlug]);

  // Filter requests locally
  const filteredRequests = useMemo(() => {
    if (!data?.requests) return [];
    if (activeFilter === "all") return data.requests;
    return data.requests.filter((r) => r.uiStatus === activeFilter);
  }, [data?.requests, activeFilter]);

  // Handle confirm withdrawal submission
  const handleConfirmWithdrawal = async () => {
    if (!data?.canWithdraw || isSubmittingWithdraw) return;
    setIsSubmittingWithdraw(true);

    try {
      await requestCommissionWithdrawal({
        data: {
          ...(capsterId ? { capsterId } : {}),
          ...(userId ? { userId } : {}),
          ...(barbershopSlug ? { barbershopSlug } : {}),
        },
      });
      toast.success("Pengajuan penarikan komisi berhasil dikirim ke Owner!");
      setIsWithdrawModalOpen(false);
      await fetchData(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengajukan penarikan komisi");
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
        {/* HEADER */}
        <CapsterHeader
          title="Detail Komisi"
          backTo={`/${barbershopSlug}/capster/dashboard`}
          showBack={true}
          showActions={true}
        />

        <main className="flex-1 space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+120px)] pt-3">
          {/* 1. RINGKASAN TOTAL KOMISI (Card Total Komisi Diterima) */}
          <div className="rounded-[20px] bg-[#0E1726]/95 border border-slate-800/80 p-4 shadow-xl flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#1E3A8A]/50 text-[#3B82F6] ring-1 ring-[#3B82F6]/30">
              <Wallet className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-400">Total Komisi Diterima</p>
              <h2 className="text-[22px] font-extrabold tracking-tight text-white">
                {data?.totalKomisiDiterimaFormatted || "Rp 0"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dari {data?.jumlahPembayaranDiterima || 0} kali pembayaran
              </p>
            </div>
          </div>

          {/* 2. KOMISI TERSEDIA & AJUKAN PENARIKAN (Row 2 Sesuai Wireframe) */}
          <div className="grid grid-cols-[1fr_auto] gap-2.5 items-stretch">
            {/* Left Box: Komisi Tersedia */}
            <div className="rounded-[18px] bg-[#0E1726]/95 border border-slate-800/80 p-3.5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A]/40 text-[#60A5FA] ring-1 ring-[#3B82F6]/25">
                <Clock className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400">Komisi Tersedia</p>
                <p className="text-[16px] font-bold text-white tracking-tight">
                  {data?.komisiTersediaFormatted || "Rp 0"}
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {!data || data.komisiTersedia === 0
                    ? "Tidak ada komisi yang dapat diajukan"
                    : data.canWithdraw
                      ? "Dapat diajukan penarikan"
                      : data.canWithdrawReason || "Ada pengajuan aktif"}
                </p>
              </div>
            </div>

            {/* Right Button: + Ajukan Penarikan */}
            <button
              type="button"
              disabled={!data?.canWithdraw || isSubmittingWithdraw}
              onClick={() => setIsWithdrawModalOpen(true)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-[18px] px-4 font-bold text-[13px] transition-all shrink-0 select-none",
                data?.canWithdraw
                  ? "bg-[#2563EB] text-white hover:bg-blue-600 active:scale-[0.98] shadow-[0_4px_16px_rgba(37,99,235,0.4)] cursor-pointer"
                  : "bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/40 opacity-70",
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Ajukan Penarikan</span>
            </button>
          </div>

          {/* 3. FILTER STATUS TABS (Semua, Menunggu, Disetujui, Ditolak, Sudah Ditarik) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              const count = data?.counts?.[tab.id] ?? 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all cursor-pointer",
                    isActive
                      ? "bg-[#2563EB] text-white font-bold shadow-md ring-1 ring-blue-500/40"
                      : "glass-1 text-slate-400 hover:text-white border border-white/5 active:bg-white/10",
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      isActive
                        ? "bg-white/20 text-white font-bold"
                        : "bg-white/10 text-slate-300",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 4. LIST PENGAJUAN KOMISI */}
          <div className="space-y-3 pt-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500 mb-2" />
                <p className="text-xs">Memuat data komisi...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Coins className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-[14px] font-semibold text-slate-300">
                  Belum Ada Pengajuan
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {activeFilter === "all"
                    ? "Belum ada riwayat pengajuan penarikan komisi."
                    : `Tidak ada pengajuan komisi dengan status "${FILTER_TABS.find((t) => t.id === activeFilter)?.label}".`}
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.idPengajuan}
                  onClick={() => setSelectedRequest(req)}
                  className="cursor-pointer rounded-[18px] bg-[#0E1726]/95 border border-slate-800/80 p-4 shadow-lg hover:border-slate-700/80 transition-all active:scale-[0.99]"
                >
                  {/* Card Header: Code & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[13px] font-bold text-[#5a8bfb] tracking-wide">
                        {req.kodePengajuan}
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {req.diajukanAtFormatted}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                      {req.uiStatus === "pending" && (
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/30">
                          <Clock className="h-3 w-3" />
                          <span>Menunggu Persetujuan</span>
                        </div>
                      )}

                      {req.uiStatus === "approved" && (
                        <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-bold text-blue-400 ring-1 ring-blue-500/30">
                          <Hourglass className="h-3 w-3" />
                          <span>Disetujui</span>
                        </div>
                      )}

                      {req.uiStatus === "rejected" && (
                        <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400 ring-1 ring-red-500/30">
                          <XCircle className="h-3 w-3" />
                          <span>Ditolak</span>
                        </div>
                      )}

                      {req.uiStatus === "paid" && (
                        <>
                          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Sudah Ditarik</span>
                          </div>
                          {req.dibayarAtFormatted && (
                            <span className="text-[10.5px] text-slate-400">
                              {req.dibayarAtFormatted}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Amount & Label & Chevron */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/60 pt-2.5">
                    <div>
                      <p className="text-[16px] font-extrabold text-white">
                        {req.jumlahFormatted}
                      </p>
                      <p className="text-[11px] text-slate-400">Penarikan komisi</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* MODAL 1: KONFIRMASI AJUKAN PENARIKAN */}
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-[24px] bg-[#0E1726] border border-slate-800 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white">
                      Ajukan Penarikan
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Konfirmasi pencairan komisi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-[16px] bg-slate-900/80 border border-slate-800/80 p-3.5 text-center">
                  <p className="text-[11px] text-slate-400 font-medium">
                    Nominal Komisi yang Diajukan
                  </p>
                  <p className="text-[24px] font-extrabold text-white mt-1">
                    {data?.komisiTersediaFormatted || "Rp 0"}
                  </p>
                </div>

                <div className="rounded-[14px] bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2.5 text-[11px] text-blue-300">
                  <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  <p>
                    Pengajuan akan langsung dikirimkan ke Owner Barbershop untuk
                    disetujui dan ditransfer.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isSubmittingWithdraw}
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="flex-1 rounded-[14px] border border-slate-700/60 bg-slate-800/60 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmittingWithdraw}
                  onClick={handleConfirmWithdrawal}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-[14px] bg-[#2563EB] hover:bg-blue-600 py-2.5 text-[13px] font-bold text-white transition-all shadow-[0_4px_16px_rgba(37,99,235,0.4)] disabled:opacity-50"
                >
                  {isSubmittingWithdraw ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Ajukan Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: DETAIL PENGAJUAN CARD (#WD-...) */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[24px] bg-[#0E1726] border border-slate-800 p-5 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <span className="text-[14px] font-extrabold text-[#5a8bfb]">
                    {selectedRequest.kodePengajuan}
                  </span>
                  <p className="text-[11px] text-slate-400">Detail Pengajuan Penarikan</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-0.5">
                {/* Status Box */}
                <div className="rounded-[16px] bg-slate-900/80 border border-slate-800/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-400">Status Pengajuan</span>
                    {selectedRequest.uiStatus === "pending" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/30">
                        <Clock className="h-3 w-3" />
                        Menunggu Persetujuan Owner
                      </span>
                    )}
                    {selectedRequest.uiStatus === "approved" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-400 ring-1 ring-blue-500/30">
                        <Hourglass className="h-3 w-3" />
                        Disetujui / Menunggu Pembayaran
                      </span>
                    )}
                    {selectedRequest.uiStatus === "rejected" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-400 ring-1 ring-red-500/30">
                        <XCircle className="h-3 w-3" />
                        Ditolak
                      </span>
                    )}
                    {selectedRequest.uiStatus === "paid" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Sudah Ditarik
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
                    <span className="text-[12px] text-slate-400">Jumlah Penarikan</span>
                    <span className="text-[16px] font-extrabold text-white">
                      {selectedRequest.jumlahFormatted}
                    </span>
                  </div>
                </div>

                {/* Timeline Info */}
                <div className="rounded-[16px] bg-slate-900/60 border border-slate-800/60 p-3.5 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tanggal Pengajuan</span>
                    <span className="text-slate-200 font-medium">
                      {selectedRequest.diajukanAtFormatted}
                    </span>
                  </div>

                  {selectedRequest.disetujuiAtFormatted && (
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-1.5">
                      <span className="text-slate-400">Tanggal Disetujui</span>
                      <span className="text-slate-200 font-medium">
                        {selectedRequest.disetujuiAtFormatted}
                      </span>
                    </div>
                  )}

                  {selectedRequest.ditolakAtFormatted && (
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-1.5">
                      <span className="text-slate-400">Tanggal Ditolak</span>
                      <span className="text-slate-200 font-medium">
                        {selectedRequest.ditolakAtFormatted}
                      </span>
                    </div>
                  )}

                  {selectedRequest.dibayarAtFormatted && (
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-1.5">
                      <span className="text-slate-400">Tanggal Pembayaran</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedRequest.dibayarAtFormatted}
                      </span>
                    </div>
                  )}

                  {selectedRequest.metodePembayaran && (
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-1.5">
                      <span className="text-slate-400">Metode Pembayaran</span>
                      <span className="text-slate-200 font-medium uppercase">
                        {selectedRequest.metodePembayaran}
                      </span>
                    </div>
                  )}

                  {selectedRequest.referensi && (
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-1.5">
                      <span className="text-slate-400">Referensi Pembayaran</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {selectedRequest.referensi}
                      </span>
                    </div>
                  )}
                </div>

                {/* Alasan Penolakan Alert jika Ditolak */}
                {selectedRequest.alasanPenolakan && (
                  <div className="rounded-[16px] bg-red-500/10 border border-red-500/25 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-red-400 font-bold text-[12px]">
                      <AlertCircle className="h-4 w-4" />
                      <span>Alasan Penolakan dari Owner</span>
                    </div>
                    <p className="text-[12px] text-red-200 pl-5 leading-relaxed">
                      "{selectedRequest.alasanPenolakan}"
                    </p>
                  </div>
                )}

                {/* Transaksi Pembentuk Komisi */}
                <div className="space-y-2">
                  <p className="text-[12px] font-bold text-slate-300">
                    Transaksi Pembentuk Komisi
                  </p>
                  {loadingDetail ? (
                    <div className="py-4 text-center text-slate-500 text-xs">
                      Memuat daftar transaksi...
                    </div>
                  ) : requestDetail?.dasarKomisi?.transactions?.length > 0 ? (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {requestDetail.dasarKomisi.transactions.map((trx: any) => (
                        <div
                          key={trx.id}
                          className="rounded-[12px] bg-slate-900/70 border border-slate-800/70 p-2.5 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {trx.layananName}
                            </p>
                            <p className="text-slate-400 text-[10px]">
                              {trx.tanggalFormatted} • {trx.persentase}% komisi
                            </p>
                          </div>
                          <span className="font-bold text-emerald-400">
                            +{formatRupiah(trx.komisi)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      {selectedRequest.transaksiCount > 0
                        ? `${selectedRequest.transaksiCount} transaksi layanan`
                        : "Tidak ada rincian transaksi terkait."}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Button */}
              <div className="pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="w-full rounded-[14px] bg-slate-800 hover:bg-slate-700 py-2.5 text-[13px] font-semibold text-white transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <CapsterBottomNav activeTab="commissions" />
      </MobileShell>
    </CapsterAuthGuard>
  );
}
