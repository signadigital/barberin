import { useState } from "react";
import { CheckCircle2, Clock, Hourglass, Send, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/format";
import {
  requestCommissionWithdrawal,
  type CapsterCommissionDashboardData,
} from "@/lib/commissions";

interface CommissionWithdrawalCardProps {
  data: CapsterCommissionDashboardData | null;
  onRefresh: () => void;
  barbershopSlug?: string;
}

export function CommissionWithdrawalCard({
  data,
  onRefresh,
  barbershopSlug,
}: CommissionWithdrawalCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!data) return null;

  const { cardState, totalBelumTerbayar, activePengajuan } = data;

  // Tentukan nominal yang ditampilkan berdasarkan state
  let displayAmount = totalBelumTerbayar;
  if (cardState === "pending" || cardState === "approved") {
    displayAmount = activePengajuan?.jumlah || totalBelumTerbayar;
  } else if (cardState === "paid") {
    displayAmount = activePengajuan?.jumlah || totalBelumTerbayar;
  }

  const handleOpenModal = () => {
    if (totalBelumTerbayar <= 0) {
      toast.error("Belum ada komisi yang dapat diajukan saat ini.");
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmWithdrawal = async () => {
    setIsSubmitting(true);
    try {
      await requestCommissionWithdrawal({
        data: {
          capsterId: data.capsterId,
          ...(barbershopSlug ? { barbershopSlug } : {}),
        },
      });
      toast.success("Pengajuan penarikan komisi berhasil dikirim ke Owner!");
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengajukan penarikan komisi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-[20px] bg-[#0E1726]/90 border border-slate-800/80 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.25)] transition-all">
        {/* Header Label */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            PENARIKAN KOMISI
          </span>
          {cardState === "can_withdraw" && totalBelumTerbayar > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>

        {/* Content Card Body */}
        <div className="flex items-center justify-between gap-3">
          {/* Sisi Kiri: Icon, State Label, Amount, Subtext */}
          <div className="flex items-center gap-3 min-w-0">
            {cardState === "can_withdraw" && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17253D] text-blue-400 ring-1 ring-blue-500/20">
                <Wallet className="h-5 w-5" />
              </div>
            )}

            {cardState === "pending" && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
                <Clock className="h-5 w-5" />
              </div>
            )}

            {cardState === "approved" && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <Hourglass className="h-5 w-5 animate-pulse" />
              </div>
            )}

            {cardState === "paid" && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}

            {cardState === "rejected" && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
                <X className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 leading-tight">
                {cardState === "can_withdraw" && "Belum Terbayar"}
                {cardState === "pending" && "Menunggu Persetujuan"}
                {cardState === "approved" && "Menunggu Pembayaran"}
                {cardState === "paid" && "Sudah Terbayar"}
                {cardState === "rejected" && "Pengajuan Ditolak"}
              </p>
              <p className="text-[17px] sm:text-[19px] font-bold text-white tracking-tight mt-0.5 leading-snug">
                {formatRupiah(displayAmount)}
              </p>
              <p className="text-[11px] text-slate-400/90 mt-0.5 truncate">
                {cardState === "can_withdraw" && "Komisi yang dapat diajukan ke owner."}
                {cardState === "pending" && "Menunggu persetujuan owner."}
                {cardState === "approved" && "Disetujui oleh owner"}
                {cardState === "paid" &&
                  (activePengajuan?.dibayarAtFormatted || "Telah dibayarkan oleh owner")}
                {cardState === "rejected" &&
                  (activePengajuan?.alasanPenolakan
                    ? `Alasan: ${activePengajuan.alasanPenolakan}`
                    : "Ditolak oleh owner")}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Action Button Sesuai Wireframe */}
          <div className="shrink-0">
            {cardState === "can_withdraw" && (
              <button
                type="button"
                onClick={handleOpenModal}
                disabled={totalBelumTerbayar <= 0}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5 shrink-0" />
                <span>Ajukan Penarikan</span>
              </button>
            )}

            {cardState === "pending" && (
              <button
                type="button"
                disabled
                className="rounded-xl bg-[#172236] border border-slate-700/60 px-3 py-2 text-[11px] font-medium text-amber-400/90 cursor-not-allowed shadow-inner"
              >
                Menunggu Persetujuan
              </button>
            )}

            {cardState === "approved" && (
              <button
                type="button"
                disabled
                className="rounded-xl bg-[#172236] border border-slate-700/60 px-3 py-2 text-[11px] font-medium text-slate-400 cursor-not-allowed shadow-inner"
              >
                Menunggu Pembayaran
              </button>
            )}

            {cardState === "paid" && totalBelumTerbayar > 0 && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-2 text-[11px] font-semibold text-white shadow-md active:scale-95 transition-all"
              >
                <Send className="h-3 w-3 shrink-0" />
                <span>Tarik Komisi Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal / Dialog Konfirmasi Ajukan Penarikan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F1D33] border border-slate-700/80 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-400" />
                Ajukan Penarikan Komisi
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Kamu akan mengajukan penarikan seluruh komisi yang belum terbayar saat ini kepada Owner untuk diverifikasi dan dibayarkan.
              </p>

              <div className="rounded-xl bg-[#070D18] border border-slate-800 p-3.5 space-y-1 text-center">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Jumlah Penarikan
                </span>
                <p className="text-2xl font-black text-white tracking-tight">
                  {formatRupiah(totalBelumTerbayar)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Snapshot Komisi: {data.persentaseKomisi}% dari omzet layanan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-2.5 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmWithdrawal}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white py-2.5 text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Ajukan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
