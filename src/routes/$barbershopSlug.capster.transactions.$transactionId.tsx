import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  CheckSquare,
  Clock,
  FileText,
  Phone,
  Receipt,
  Scissors,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader, TransactionStatusBadge } from "@/components/capster/ui";
import { formatRupiah, formatTransactionId, formatCustomerId } from "@/lib/format";
import {
  useCapster,
  type CapsterTransaction,
  type TransactionStatus,
} from "@/lib/capster-store";
import {
  confirmPaymentAndGenerateStruk,
  capsterConfirmBooking,
  capsterStartService,
  capsterFinishService,
  cancelBookingOrTransaction,
  getTransactionDetail,
} from "@/lib/bookings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/$transactionId")({
  head: () => ({
    meta: [
      { title: "Detail Transaksi — BARBERIN Capster" },
      { name: "description", content: "Informasi lengkap transaksi pelanggan." },
    ],
  }),
  component: CapsterTransactionDetailPage,
});

function CapsterTransactionDetailPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { transactionId } = Route.useParams();
  const { transactions, capsterId: loggedInCapsterId } = useCapster();

  const storeTrx = transactions.find((t) => t.id === transactionId);
  const [trx, setTrx] = useState<CapsterTransaction | null>(storeTrx ?? null);
  const [loading, setLoading] = useState(!storeTrx);
  const [confirming, setConfirming] = useState(false);
  const [startingService, setStartingService] = useState(false);
  const [finishingService, setFinishingService] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchDetail = async (isInitial = false) => {
    if (isInitial && !storeTrx) setLoading(true);
    try {
      const detail = await getTransactionDetail({ data: { transactionId, barbershopSlug } });
      if (!detail) return;
      let mappedStatus: TransactionStatus = "Menunggu";
      if (detail.status === "completed" || detail.status === "paid") {
        mappedStatus = "Selesai";
      } else if (
        detail.status === "expired" ||
        detail.bookingStatus === "expired" ||
        detail.paymentStatus === "expired"
      ) {
        mappedStatus = "Kedaluwarsa";
      } else if (
        detail.status === "cancelled" ||
        detail.bookingStatus === "cancelled" ||
        detail.paymentStatus === "failed"
      ) {
        mappedStatus = "Batal";
      } else if (detail.bookingStatus === "in_service" || detail.status === "ongoing") {
        mappedStatus = "Sedang Dilayani";
      } else {
        mappedStatus = "Menunggu";
      }

      const mapped: CapsterTransaction = {
        id: detail.transactionId,
        bookingId: detail.bookingId || undefined,
        bookingStatus: detail.bookingStatus || undefined,
        source: (detail as any).source || undefined,
        batasKonfirmasi: detail.batasKonfirmasi || undefined,
        batasPembayaran: detail.batasPembayaran || undefined,
        date: new Date(detail.createdAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }),
        time: new Date(detail.createdAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }),
        customerName: detail.customerName,
        customerId: detail.customerId ?? storeTrx?.customerId,
        ...(detail.customerPhone ? { customerPhone: detail.customerPhone } : {}),
        items: (detail.items || []).map((i: any) => ({
          service: {
            id: i.id || i.serviceId || "service",
            name: i.namaLayanan || i.name || "Layanan",
            category: "Barbershop",
            price: i.hargaSnapshot ?? i.price ?? 0,
          },
          quantity: i.jumlah ?? i.quantity ?? 1,
        })),
        serviceNames: (detail.items || []).map((i: any) => i.namaLayanan || i.name).join(" + "),
        subtotal: detail.subtotal ?? 0,
        discount: detail.discount ?? 0,
        total: detail.total ?? 0,
        paymentMethod: (detail.paymentMethod ?? "tunai") as "tunai" | "qris" | "transfer",
        cashReceived: detail.total ?? 0,
        change: 0,
        status: mappedStatus,
        notes: detail.notes ?? storeTrx?.notes ?? undefined,
        capsterId: detail.capsterId ?? storeTrx?.capsterId ?? "",
        capsterName: detail.capsterName,
        totalDurationMinutes: detail.totalDurationMinutes ?? detail.estimation?.totalDurationMinutes,
        remainingMinutes: detail.estimation?.remainingMinutes,
        waitTimeMinutes: detail.estimation?.waitTimeMinutes,
        positionInQueue: detail.estimation?.positionInQueue,
      };
      setTrx(mapped);
    } catch (err) {
      console.error("Gagal mengambil detail transaksi:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchDetail(true);
    const intervalId = setInterval(() => {
      if (mounted) fetchDetail(false);
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [transactionId, storeTrx]);

  const handleConfirmBooking = async () => {
    if (!trx?.bookingId) return;
    setConfirmingBooking(true);
    try {
      await capsterConfirmBooking({ data: { bookingId: trx.bookingId } });
      toast.success("Layanan berhasil dikonfirmasi!");
      await fetchDetail(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengonfirmasi booking");
    } finally {
      setConfirmingBooking(false);
    }
  };

  const handleStartService = async () => {
    if (!trx?.bookingId) return;
    setStartingService(true);
    try {
      await capsterStartService({
        data: {
          bookingId: trx.bookingId,
          ...(loggedInCapsterId ? { capsterId: loggedInCapsterId } : {}),
        },
      });
      toast.success("Layanan dimulai!");
      await fetchDetail(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memulai layanan");
    } finally {
      setStartingService(false);
    }
  };

  const handleFinishService = async () => {
    if (!trx?.bookingId) return;
    setFinishingService(true);
    try {
      await capsterFinishService({ data: { bookingId: trx.bookingId } });
      toast.success("Pelayanan selesai! Menunggu pembayaran.");
      await fetchDetail(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyelesaikan layanan");
    } finally {
      setFinishingService(false);
    }
  };

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      await confirmPaymentAndGenerateStruk({
        data: {
          transactionId,
          ...(loggedInCapsterId ? { capsterId: loggedInCapsterId } : {}),
        },
      });
      toast.success("Pembayaran berhasil dikonfirmasi & struk terbit!");
      await fetchDetail(false);
    } catch (err: any) {
      console.error("Gagal mengonfirmasi pembayaran:", err);
      toast.error(err?.message || "Gagal mengonfirmasi pembayaran");
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      toast.error("Silakan masukkan alasan pembatalan");
      return;
    }
    setCancelling(true);
    try {
      await cancelBookingOrTransaction({
        data: {
          ...(trx?.bookingId ? { bookingId: trx.bookingId } : {}),
          transactionId,
          reason: cancelReason.trim(),
        },
      });
      toast.success("Pesanan berhasil dibatalkan");
      setShowCancelModal(false);
      setCancelReason("");
      await fetchDetail(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal membatalkan pesanan");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <CapsterAuthGuard>
      {loading ? (
        <MobileShell>
          <CapsterHeader title="Detail Transaksi" backTo={`/${barbershopSlug}/capster/dashboard`} showBack={true} />
          <main className="flex-1 space-y-3 p-4">
            <SkeletonCard />
            <SkeletonCard />
          </main>
        </MobileShell>
      ) : trx && loggedInCapsterId && trx.capsterId && trx.capsterId !== loggedInCapsterId ? (
        <MobileShell>
          <CapsterHeader title="Akses Ditolak" backTo={`/${barbershopSlug}/capster/dashboard`} showBack={true} />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/20 text-danger ring-1 ring-danger/40">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-[18px] font-bold text-foreground">Akses Transaksi Ditolak</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Transaksi ini milik capster lain. Anda tidak berhak melihat atau mengonfirmasi transaksi ini.
            </p>
            <div className="pt-2 w-full max-w-[200px]">
              <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })}>
                Kembali ke Dashboard
              </PrimaryButton>
            </div>
          </main>
        </MobileShell>
      ) : !trx ? (
        <MobileShell>
          <CapsterHeader title="Detail Transaksi" backTo={`/${barbershopSlug}/capster/dashboard`} showBack={true} />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-muted-foreground">Transaksi tidak ditemukan.</p>
            <div className="mt-4 w-full max-w-[200px]">
              <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })}>
                Kembali ke Dashboard
              </PrimaryButton>
            </div>
          </main>
        </MobileShell>
      ) : (
        <MobileShell>
      <CapsterHeader
        title="Detail Transaksi"
        subtitle={`#${formatTransactionId(trx.id, trx.date)}`}
        backTo={`/${barbershopSlug}/capster/dashboard`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-4 px-4 pb-28 pt-3">
        {/* Status Header Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-[14px] font-bold text-primary-soft">
                #{formatTransactionId(trx.id, trx.date)}
              </span>
              <p className="text-[12px] text-muted-foreground">
                {trx.date} • {trx.time}
              </p>
            </div>
            <TransactionStatusBadge status={trx.status} />
          </div>
          {(trx.bookingStatus === "waiting" || trx.bookingStatus === "confirmed" || trx.bookingStatus === "pending_confirmation") && (
            <div className="flex items-center justify-between rounded-[10px] bg-primary/10 border border-primary/30 p-2.5 text-[12px] text-primary-soft font-medium">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Antrean Ke-{trx.positionInQueue ?? 1} • Durasi: {trx.totalDurationMinutes ?? 30}m</span>
              </div>
              <span className="font-bold">Estimasi Tunggu: ~{trx.waitTimeMinutes ?? 0}m</span>
            </div>
          )}
          {trx.bookingStatus === "in_service" && (
            <div className="flex flex-col gap-1.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-[12px] text-success font-medium">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 shrink-0 animate-spin text-success" />
                  <span className="font-bold">Sedang Dilayani di Kursi</span>
                </div>
                <span className="font-bold">Sisa: ~{trx.remainingMinutes ?? 0} menit</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Layanan sedang berlangsung. Pelanggan akan menyelesaikan layanan melalui halaman pelanggannya.
              </p>
            </div>
          )}
          {trx.bookingStatus === "awaiting_payment" && (
            <div className="flex flex-col gap-1 rounded-[10px] bg-primary/10 border border-primary/30 p-2.5 text-[12px] text-primary-soft font-medium">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="font-bold">Pelayanan Selesai — Menunggu Konfirmasi Pembayaran</span>
              </div>
              <span className="text-[11px] text-slate-300 pl-6">
                Batas konfirmasi pembayaran: 2 jam setelah pelayanan selesai
              </span>
            </div>
          )}
        </GlassCard>

        {/* Data Pelanggan */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <User className="h-4 w-4 text-primary-soft" strokeWidth={2} />
            <h2 className="text-[14px] font-bold">Data Pelanggan</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama</span>
              <span className="font-semibold text-foreground">{trx.customerName}</span>
            </div>
            {trx.customerId ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Pelanggan</span>
                <span className="font-mono font-semibold text-primary-soft">
                  {formatCustomerId(trx.customerId, trx.date)}
                </span>
              </div>
            ) : null}
            {trx.customerPhone ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nomor Telepon</span>
                <span className="font-semibold">{trx.customerPhone}</span>
              </div>
            ) : null}
            {trx.notes ? (
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">
                  {trx.status === "Batal" ? "Alasan Pembatalan" : "Catatan"}
                </span>
                <span className={cn("font-semibold text-right", trx.status === "Batal" ? "text-danger" : "text-foreground")}>
                  {trx.notes}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capster</span>
              <span className="font-semibold text-primary-soft">{trx.capsterName}</span>
            </div>
          </div>
        </GlassCard>

        {/* Daftar Layanan */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Scissors className="h-4 w-4 text-primary-soft" strokeWidth={2} />
            <h2 className="text-[14px] font-bold">Layanan</h2>
          </div>
          <div className="space-y-2">
            {trx.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[13px]">
                <span className="text-muted-foreground font-medium">
                  {item.service.name} {item.quantity > 1 ? `(${item.quantity}x)` : ""}
                </span>
                <span className="font-semibold text-foreground">
                  {formatRupiah(item.service.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Rincian Pembayaran */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Wallet className="h-4 w-4 text-primary-soft" strokeWidth={2} />
            <h2 className="text-[14px] font-bold">Pembayaran</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(trx.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Diskon</span>
              <span>{formatRupiah(trx.discount)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="font-bold text-foreground">Total</span>
              <span className="font-extrabold text-[16px] text-primary-soft">
                {formatRupiah(trx.total)}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">Metode Bayar</span>
              <span className="font-semibold uppercase">{trx.paymentMethod}</span>
            </div>
            {trx.paymentMethod === "tunai" && trx.cashReceived ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uang Diterima</span>
                  <span className="font-semibold">{formatRupiah(trx.cashReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span className="font-bold text-success">{formatRupiah(trx.change ?? 0)}</span>
                </div>
              </>
            ) : null}
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        {trx.bookingStatus === "pending_confirmation" ||
        trx.bookingStatus === "waiting" ||
        trx.bookingStatus === "confirmed" ? (
          <div className="flex flex-col gap-2 w-full">
            <PrimaryButton
              loading={startingService}
              onClick={handleStartService}
            >
              <Scissors className="h-4 w-4" strokeWidth={2} />
              MULAI LAYANAN
            </PrimaryButton>
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-danger/40 bg-danger/10 text-[13px] font-bold text-danger hover:bg-danger/20 transition-all active:scale-[0.98]"
            >
              <XCircle className="h-4 w-4" strokeWidth={2} />
              BATALKAN PESANAN
            </button>
          </div>
        ) : trx.bookingStatus === "in_service" ? (
          <div className="flex flex-col gap-2 w-full">
            <SecondaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </SecondaryButton>
          </div>
        ) : trx.bookingStatus === "awaiting_payment" ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="text-[11px] font-semibold text-primary-soft text-center">
              Batas konfirmasi pembayaran: 2 jam setelah pelayanan selesai
            </div>
            <PrimaryButton
              loading={confirming}
              onClick={handleConfirmPayment}
            >
              <CheckCircle className="h-4 w-4" strokeWidth={2} />
              KONFIRMASI PEMBAYARAN
            </PrimaryButton>
            <SecondaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </SecondaryButton>
          </div>
        ) : trx.status === "Selesai" ? (
          <div className="flex flex-col gap-2 w-full">
            <PrimaryButton
              onClick={() =>
                navigate({
                  to: `/${barbershopSlug}/capster/transactions/${trx.id}/receipt` as any,
                })
              }
            >
              <Receipt className="h-4 w-4" strokeWidth={2} />
              LIHAT STRUK
            </PrimaryButton>
            <SecondaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </SecondaryButton>
          </div>
        ) : trx.status === "Kedaluwarsa" ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-center gap-2 rounded-[12px] border border-rose-500/35 bg-rose-900/20 p-3 text-[13px] font-bold text-rose-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Pesanan Ini Telah Kedaluwarsa</span>
            </div>
            <PrimaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </PrimaryButton>
          </div>
        ) : trx.status === "Batal" ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-center gap-2 rounded-[12px] border border-danger/35 bg-danger/10 p-3 text-[13px] font-bold text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Pesanan Ini Telah Dibatalkan</span>
            </div>
            <PrimaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton
            onClick={() =>
              navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })
            }
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            KEMBALI KE DASHBOARD
          </PrimaryButton>
        )}
      </BottomActionBar>

      {/* Modal Pilihan Alasan Pembatalan */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-3 w-full max-w-[420px] rounded-[24px] border border-white/15 p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-foreground">Batalkan Pesanan</h3>
                <p className="text-[12px] text-muted-foreground">Tuliskan alasan pembatalan layanan ini</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Alasan pembatalan (misal: Pelanggan berhalangan)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary-soft"
              />
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setShowCancelModal(false)}>Kembali</SecondaryButton>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancelBooking}
                className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-danger text-[13px] font-bold text-white hover:bg-danger/90 disabled:opacity-50"
              >
                {cancelling ? "Membatalkan..." : "Konfirmasi Batal"}
              </button>
            </div>
          </div>
        </div>
      )}
      </MobileShell>
      )}
    </CapsterAuthGuard>
  );
}
