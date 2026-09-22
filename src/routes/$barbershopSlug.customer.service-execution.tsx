import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Scissors,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  BottomActionBar,
  CustomerHeader,
  GlassCard,
  MobileShell,
  StatusBadge,
} from "@/components/barberin/ui";
import { formatRupiah } from "@/lib/format";
import {
  actions,
  useBarberin,
  type ServiceExecutionStatus,
} from "@/lib/barberin-store";
import { cancelCustomerTransaction, getTransactionDetail } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$barbershopSlug/customer/service-execution")({
  head: () => ({
    meta: [
      { title: "Layanan Sedang Diproses — BARBERIN" },
      { name: "description", content: "Pantau status pengerjaan layanan Anda oleh capster." },
      { property: "og:title", content: "Layanan Sedang Diproses — BARBERIN" },
      { property: "og:description", content: "Status pengerjaan layanan barbershop Anda." },
    ],
  }),
  component: ServiceExecutionPage,
});

const STEPS: { id: ServiceExecutionStatus; label: string }[] = [
  { id: "MENUNGGU", label: "Menunggu layanan dimulai" },
  { id: "DIKERJAKAN", label: "Sedang dikerjakan" },
  { id: "HAMPIR_SELESAI", label: "Layanan hampir selesai" },
  { id: "DISELESAIKAN", label: "Sedang diselesaikan" },
];

const CANCELLATION_REASONS = [
  "Tidak puas dengan layanan",
  "Menunggu terlalu lama",
  "Salah memilih layanan",
  "Alasan lainnya",
];

export function ServiceExecutionStatusView({ status }: { status: ServiceExecutionStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.id === status);
  return (
    <GlassCard className="space-y-3">
      <h2 className="text-[15px] font-semibold">Status Pengerjaan</h2>
      <ol className="space-y-3">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={2} />
                ) : active ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary-soft" strokeWidth={2} />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                )}
              </span>
              <span
                className={
                  active
                    ? "font-medium text-foreground"
                    : done
                    ? "text-muted-foreground line-through"
                    : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
              {active ? (
                <span className="ml-auto">
                  <StatusBadge tone="info">Berlangsung</StatusBadge>
                </span>
              ) : done ? (
                <span className="ml-auto">
                  <StatusBadge tone="success">Selesai</StatusBadge>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </GlassCard>
  );
}

function ServiceExecutionPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const {
    cartItems,
    serviceExecutionStatus,
    transactionId,
    selectedCapster,
  } = useBarberin();

  const [txDetail, setTxDetail] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!transactionId) {
      navigate({ to: `/${barbershopSlug}/customer/services` as any });
      return;
    }

    let mounted = true;
    const check = async () => {
      try {
        const detail = await getTransactionDetail({ data: { transactionId, barbershopSlug } });
        if (!mounted || !detail) return;
        setTxDetail(detail);

        // Cek jika pesanan dibatalkan
        const isCancelled =
          detail.status === "cancelled" || detail.bookingStatus === "cancelled";
        if (isCancelled) {
          toast.info("Pesanan telah dibatalkan.");
          actions.reset();
          navigate({ to: `/${barbershopSlug}/customer/services` as any });
          return;
        }

        // Cek status pembayaran berdasarkan database:
        const isPaid =
          detail.status === "paid" || detail.status === "completed" || detail.paymentStatus === "success";

        if (isPaid) {
          actions.setPaymentConfirmationStatus("DIKONFIRMASI");
          actions.setServiceExecutionStatus("DISELESAIKAN");

          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            navigate({
              to: `/${barbershopSlug}/customer/receipt/${transactionId}` as any,
            });
          }
          return;
        }

        actions.setPaymentConfirmationStatus("MENUNGGU");

        // Status pengerjaan layanan
        if (detail.bookingStatus === "in_service") {
          actions.setServiceExecutionStatus("DIKERJAKAN");
        } else if (detail.bookingStatus === "awaiting_payment") {
          actions.setServiceExecutionStatus("HAMPIR_SELESAI");
        } else if (detail.bookingStatus === "confirmed" || detail.bookingStatus === "waiting") {
          actions.setServiceExecutionStatus("MENUNGGU");
        }
      } catch (err) {
        console.error("Polling status error:", err);
      }
    };

    check();
    const interval = setInterval(check, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [transactionId, navigate, barbershopSlug]);

  const handleConfirmCancel = async () => {
    if (!selectedReason || !transactionId) return;
    setCancelling(true);

    const finalReason =
      selectedReason === "Alasan lainnya" && otherReason.trim()
        ? `Alasan lainnya: ${otherReason.trim()}`
        : selectedReason;

    try {
      await cancelCustomerTransaction({
        data: {
          transactionId,
          reason: finalReason,
        },
      });
      toast.success("Pesanan berhasil dibatalkan", {
        description: `Alasan: ${selectedReason}`,
      });
      actions.reset();
      setShowCancelModal(false);
      navigate({ to: `/${barbershopSlug}/customer/services` as any });
    } catch (err: any) {
      console.error("Gagal membatalkan pesanan:", err);
      toast.error("Gagal Membatalkan", {
        description: err?.message || "Terjadi kendala saat membatalkan pesanan.",
      });
      setCancelling(false);
    }
  };

  return (
    <MobileShell>
      {/* Header tanpa tombol kembali */}
      <CustomerHeader
        title="Layanan Sedang Diproses"
        subtitle={transactionId ?? "Langkah 5 dari 5"}
        showBack={false}
      />

      <main className="flex-1 space-y-3 px-4 pb-28 pt-4">
        {/* Status Lifecycle Alerts */}
        {txDetail?.bookingStatus === "pending_confirmation" && (
          <GlassCard className="space-y-2 border-warning/40 bg-warning/10">
            <div className="flex items-center gap-2 text-warning font-semibold text-[14px]">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>Menunggu Konfirmasi Capster</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Pesanan Anda menunggu konfirmasi capster. Batas waktu konfirmasi otomatis adalah 5 menit.
            </p>
          </GlassCard>
        )}

        {txDetail?.estimation && (txDetail.bookingStatus === "waiting" || txDetail.bookingStatus === "confirmed" || txDetail.bookingStatus === "pending_confirmation") && (
          <GlassCard className="space-y-3 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-primary-soft">
                Estimasi Waktu Tunggu
              </span>
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-primary-soft ring-1 ring-primary/40">
                Antrean Ke-{txDetail.estimation.antreanKe}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-[14px] bg-slate-900/60 p-3 border border-white/5">
                <span className="text-[11px] text-muted-foreground block">Waktu Tunggu</span>
                <span className="text-[20px] font-extrabold text-foreground">
                  ~{txDetail.estimation.estimasiTungguMenit}{" "}
                  <span className="text-[12px] font-medium text-muted-foreground">menit</span>
                </span>
              </div>
              <div className="rounded-[14px] bg-slate-900/60 p-3 border border-white/5">
                <span className="text-[11px] text-muted-foreground block">Estimasi Mulai</span>
                <span className="text-[20px] font-extrabold text-foreground">
                  {new Date(txDetail.estimation.estimasiMulai).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })}
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">WIB</span>
                </span>
              </div>
            </div>
            {txDetail.estimation.totalAntreanSebelumnya > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Terdapat {txDetail.estimation.totalAntreanSebelumnya} pelanggan dalam antrean sebelum Anda.
              </p>
            )}
          </GlassCard>
        )}

        {txDetail?.bookingStatus === "awaiting_payment" && (
          <GlassCard className="space-y-2 border-emerald-500/30 bg-emerald-500/10">
            <div className="flex items-center gap-2 text-success font-semibold text-[14px]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Layanan Selesai! Menunggu Pembayaran</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Layanan telah selesai dikerjakan. Silakan melakukan pembayaran di kasir (batas pembayaran 2 jam).
            </p>
          </GlassCard>
        )}

        {(txDetail?.status === "expired" || txDetail?.bookingStatus === "expired") && (
          <GlassCard className="space-y-3 border-danger/30 bg-danger/10 text-center py-5">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger/20 text-danger ring-1 ring-danger/40">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-[15px] font-bold text-foreground">Pesanan Kedaluwarsa</h3>
            <p className="text-[12px] text-muted-foreground px-4">
              Batas waktu konfirmasi (5 menit) atau pembayaran (2 jam) telah terlampaui.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  actions.reset();
                  navigate({ to: `/${barbershopSlug}/customer/services` as any });
                }}
                className="inline-flex min-h-[40px] px-5 items-center justify-center rounded-[12px] bg-primary text-[13px] font-bold text-white hover:bg-primary/90"
              >
                Buat Pesanan Baru
              </button>
            </div>
          </GlassCard>
        )}

        <GlassCard className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary-soft" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">
              Capster: {selectedCapster?.name ?? txDetail?.capsterName ?? "-"}
              {selectedCapster ? ` — ${selectedCapster.role}` : ""}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {txDetail?.bookingStatus === "in_service"
                ? "Layanan Anda sedang dikerjakan. Silakan menikmati pelayanan."
                : txDetail?.bookingStatus === "awaiting_payment"
                ? "Layanan telah selesai. Menunggu pembayaran dikonfirmasi."
                : "Silakan menunggu giliran hingga capster memanggil Anda."}
            </p>
          </div>
        </GlassCard>

        <GlassCard className="space-y-2">
          <h2 className="text-[15px] font-semibold">Layanan Anda</h2>
          {cartItems.map((item) => (
            <div key={item.service.id} className="flex items-center gap-2 text-[14px]">
              <Scissors className="h-4 w-4 shrink-0 text-primary-soft" strokeWidth={2} />
              <span className="min-w-0 truncate">
                {item.service.name} {item.quantity > 1 ? `(${item.quantity}x)` : ""}
              </span>
              <span className="ml-auto shrink-0 text-[13px] text-muted-foreground">
                {formatRupiah(item.service.price * item.quantity)}
              </span>
            </div>
          ))}
        </GlassCard>

        <ServiceExecutionStatusView status={serviceExecutionStatus} />
      </main>

      {/* Tombol Aksi di Bagian Bawah */}
      <BottomActionBar>
        {txDetail?.status === "expired" || txDetail?.bookingStatus === "expired" ? (
          <button
            type="button"
            onClick={() => {
              actions.reset();
              navigate({ to: `/${barbershopSlug}/customer/services` as any });
            }}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-primary text-[14px] font-bold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <span>Kembali ke Layanan</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] border border-danger/40 bg-danger/10 text-[14px] font-bold text-danger shadow-sm transition-all hover:bg-danger/20 active:scale-[0.98]"
          >
            <XCircle className="h-4 w-4" strokeWidth={2.2} />
            <span>Batalkan Pesanan</span>
          </button>
        )}
      </BottomActionBar>

      {/* Modal Pilihan Alasan Pembatalan (Bentuknya Tombol) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-3 w-full max-w-[420px] rounded-[24px] border border-white/15 p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger ring-1 ring-danger/40">
                  <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-foreground">
                    Batalkan Pesanan
                  </h3>
                  <p className="text-[12px] text-muted-foreground">
                    Pilih alasan pembatalan layanan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!cancelling) {
                    setShowCancelModal(false);
                    setSelectedReason(null);
                    setOtherReason("");
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            {/* Menu Pilihan Alasan (Bentuknya Tombol) */}
            <div className="space-y-2 pt-1">
              <p className="text-[13px] font-semibold text-foreground">
                Silakan pilih alasan:
              </p>
              {CANCELLATION_REASONS.map((reason, idx) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[14px] p-3 text-left text-[14px] transition-all active:scale-[0.98]",
                      isSelected
                        ? "border border-danger bg-danger/20 text-white font-semibold shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-1 ring-danger/50"
                        : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/20 font-medium",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          isSelected
                            ? "bg-danger text-white"
                            : "bg-white/10 text-muted-foreground",
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span>{reason}</span>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-danger shrink-0" strokeWidth={2.5} />
                    ) : (
                      <span className="h-4 w-4" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Input Tambahan Jika Memilih 'Alasan lainnya' */}
            {selectedReason === "Alasan lainnya" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="block text-[12px] font-medium text-muted-foreground">
                  Keterangan Alasan Lainnya (Opsional):
                </label>
                <input
                  type="text"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Tulis alasan pembatalan Anda..."
                  maxLength={100}
                  className="w-full rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger"
                />
              </div>
            )}

            {/* Tombol Aksi */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={!selectedReason || cancelling}
                onClick={handleConfirmCancel}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-danger text-white text-[14px] font-bold shadow-[0_4px_16px_rgba(239,68,68,0.35)] transition-all hover:bg-danger/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                    <span>Membatalkan Pesanan...</span>
                  </>
                ) : (
                  <span>Konfirmasi Batalkan Pesanan</span>
                )}
              </button>

              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedReason(null);
                  setOtherReason("");
                }}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] border border-white/10 bg-white/5 text-[13px] font-semibold text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}

