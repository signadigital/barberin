import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Phone,
  Receipt,
  Scissors,
  User,
  Wallet,
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

  useEffect(() => {
    let mounted = true;

    const fetchDetail = async (isInitial = false) => {
      if (isInitial && !storeTrx) setLoading(true);
      try {
        const detail = await getTransactionDetail({ data: { transactionId, barbershopSlug } });
        if (!mounted || !detail) return;
        let mappedStatus: TransactionStatus = "Menunggu";
        if (detail.status === "paid") {
          mappedStatus = "Selesai";
        } else if (
          detail.status === "cancelled" ||
          detail.bookingStatus === "cancelled" ||
          detail.paymentStatus === "failed"
        ) {
          mappedStatus = "Batal";
        }

        const mapped: CapsterTransaction = {
          id: detail.transactionId,
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
          items: detail.items.map((i) => ({
            service: {
              id: i.serviceId,
              name: i.name,
              category: "Barbershop",
              price: i.price,
            },
            quantity: i.quantity,
          })),
          serviceNames: detail.items.map((i) => i.name).join(" + "),
          subtotal: detail.subtotal,
          discount: detail.discount,
          total: detail.total,
          paymentMethod: detail.paymentMethod as "tunai" | "qris" | "transfer",
          cashReceived: detail.total,
          change: 0,
          status: mappedStatus,
          notes: detail.notes ?? storeTrx?.notes ?? undefined,
          capsterId: detail.capsterId ?? storeTrx?.capsterId ?? "",
          capsterName: detail.capsterName,
        };
        setTrx(mapped);
      } catch (err) {
        console.error("Gagal mengambil detail transaksi:", err);
      } finally {
        if (mounted && isInitial) setLoading(false);
      }
    };

    fetchDetail(true);
    const intervalId = setInterval(() => {
      fetchDetail(false);
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [transactionId, storeTrx]);

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      await confirmPaymentAndGenerateStruk({
        data: {
          transactionId,
          ...(loggedInCapsterId ? { capsterId: loggedInCapsterId } : {}),
        },
      });
      if (trx) {
        setTrx({ ...trx, status: "Selesai" });
      }
      toast.success("Pembayaran berhasil dikonfirmasi!");
    } catch (err: any) {
      console.error("Gagal mengonfirmasi pembayaran:", err);
      toast.error(err?.message || "Gagal mengonfirmasi pembayaran");
    } finally {
      setConfirming(false);
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
        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[14px] font-bold text-primary-soft">
              #{formatTransactionId(trx.id, trx.date)}
            </span>
            <p className="text-[12px] text-muted-foreground">
              {trx.date} • {trx.time}
            </p>
          </div>
          <TransactionStatusBadge status={trx.status} />
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
        {trx.status === "Menunggu" ? (
          <div className="flex flex-col gap-2 w-full">
            <PrimaryButton
              loading={confirming}
              onClick={handleConfirmPayment}
            >
              <CheckCircle className="h-4 w-4" strokeWidth={2} />
              KONFIRMASI PEMBAYARAN
            </PrimaryButton>
            <SecondaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any,
                })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </SecondaryButton>
          </div>
        ) : trx.status === "Batal" ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-center gap-2 rounded-[12px] border border-danger/35 bg-danger/10 p-3 text-[13px] font-bold text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Pesanan Ini Telah Dibatalkan</span>
            </div>
            <PrimaryButton
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/dashboard` as any,
                })
              }
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              KEMBALI KE DASHBOARD
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton
            onClick={() =>
              navigate({ to: `/${barbershopSlug}/capster/dashboard` as any,
              })
            }
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            KEMBALI KE DASHBOARD
          </PrimaryButton>
        )}
        </BottomActionBar>
        </MobileShell>
      )}
    </CapsterAuthGuard>
  );
}
