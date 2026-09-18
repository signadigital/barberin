import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Printer, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { formatRupiah, formatTransactionId } from "@/lib/format";
import { useCapster, type CapsterTransaction } from "@/lib/capster-store";
import { getTransactionDetail } from "@/lib/bookings";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/$transactionId/receipt")({
  head: () => ({
    meta: [
      { title: "Struk Transaksi — BARBERIN Capster" },
      { name: "description", content: "Cetak atau bagikan struk invoice transaksi BARBERIN." },
    ],
  }),
  component: CapsterReceiptPage,
});

async function downloadThermalPdf(trx: CapsterTransaction) {
  const { barbershopSlug } = (Route as any).useParams();
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [300, 500] });
  let y = 35;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BARBERIN", 150, y, { align: "center" });

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Modern Barbershop Management System", 150, y, { align: "center" });
  y += 11;
  doc.text("Jl. Jenderal Soedirman No. 123, Purbalingga • 0812-3456-7890", 150, y, { align: "center" });

  y += 10;
  doc.setLineDashPattern([2, 2], 0);
  doc.line(20, y, 280, y);
  doc.setLineDashPattern([], 0);

  const row = (label: string, value: string, bold = false) => {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(label, 20, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value, 280, y, { align: "right" });
  };

  doc.setFontSize(9);
  row("No. Transaksi", `#${formatTransactionId(trx.id, trx.date)}`, true);
  row("Tanggal", trx.date);
  row("Waktu", trx.time);
  row("Pelanggan", trx.customerName);
  row("Capster", trx.capsterName);

  y += 8;
  doc.setLineDashPattern([2, 2], 0);
  doc.line(20, y, 280, y);
  doc.setLineDashPattern([], 0);

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("LAYANAN", 20, y);
  doc.setFont("helvetica", "normal");

  trx.items.forEach((item) => {
    row(
      `${item.service.name} (${item.quantity}x)`,
      formatRupiah(item.service.price * item.quantity),
    );
  });

  y += 8;
  doc.setLineDashPattern([2, 2], 0);
  doc.line(20, y, 280, y);
  doc.setLineDashPattern([], 0);

  row("Subtotal", formatRupiah(trx.subtotal));
  if (trx.discount > 0) {
    row("Diskon", `-${formatRupiah(trx.discount)}`);
  }
  row("TOTAL", formatRupiah(trx.total), true);
  row("Metode Pembayaran", trx.paymentMethod.toUpperCase());

  if (trx.paymentMethod === "tunai" && trx.cashReceived) {
    row("Uang Diterima", formatRupiah(trx.cashReceived));
    row("Kembalian", formatRupiah(trx.change ?? 0), true);
  }

  y += 18;
  doc.setLineDashPattern([2, 2], 0);
  doc.line(20, y, 280, y);
  doc.setLineDashPattern([], 0);

  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("Terima kasih! Silakan datang kembali.", 150, y, { align: "center" });

  doc.save(`STRUK-${formatTransactionId(trx.id, trx.date)}.pdf`);
}

function CapsterReceiptPage() {
  const navigate = useNavigate();
  const { transactionId, barbershopSlug } = Route.useParams();
  const { transactions } = useCapster();
  const storeTrx = transactions.find((t) => t.id === transactionId);
  const [trx, setTrx] = useState<CapsterTransaction | null>(storeTrx ?? null);
  const [loading, setLoading] = useState(!storeTrx);
  const [downloading, setDownloading] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    if (trx) return;
    let mounted = true;
    getTransactionDetail({ data: { transactionId, barbershopSlug } })
      .then((detail) => {
        if (!mounted || !detail) return;
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
          status: detail.status === "paid" ? "Selesai" : "Menunggu",
          capsterId: "",
          capsterName: detail.capsterName,
        };
        setTrx(mapped);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [transactionId, barbershopSlug, trx]);

  const handleDownload = async () => {
    if (!trx) return;
    setDownloading(true);
    try {
      await downloadThermalPdf(trx);
      setShareMsg("Struk PDF berhasil diunduh.");
    } catch {
      setShareMsg("Gagal mengunduh PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!trx) return;
    const text = [
      "BARBERIN — STRUK TRANSAKSI",
      "Jl. Contoh No. 123, Purbalingga",
      "Telp. 0812-3456-7890",
      "-------------------------",
      `No. Transaksi : #${formatTransactionId(trx.id, trx.date)}`,
      `Tanggal       : ${trx.date}`,
      `Waktu         : ${trx.time}`,
      `Pelanggan     : ${trx.customerName}`,
      `Capster       : ${trx.capsterName}`,
      "-------------------------",
      `Layanan       : ${trx.serviceNames}`,
      `Total         : ${formatRupiah(trx.total)}`,
      `Metode Bayar  : ${trx.paymentMethod.toUpperCase()}`,
      `Status        : ${trx.status}`,
      "-------------------------",
      "Terima kasih! Silakan datang kembali.",
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `Struk BARBERIN #${formatTransactionId(trx.id, trx.date)}`, text });
        setShareMsg("Struk siap dibagikan.");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMsg("Teks struk berhasil disalin ke clipboard!");
      }
    } catch {
      setShareMsg("Gagal membagikan struk.");
    }
  };

  return (
    <CapsterAuthGuard>
      {loading ? (
        <MobileShell>
          <CapsterHeader title="Struk Transaksi" backTo={`/${barbershopSlug}/capster/transactions`} showBack={true} />
          <main className="flex-1 space-y-3 p-4">
            <SkeletonCard />
            <SkeletonCard />
          </main>
        </MobileShell>
      ) : !trx ? (
        <MobileShell>
          <CapsterHeader title="Struk Transaksi" backTo={`/${barbershopSlug}/capster/transactions`} showBack={true} />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-muted-foreground">Struk tidak ditemukan di database.</p>
            <div className="mt-4 w-full max-w-[200px]">
              <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/transactions` as any })}>
                Kembali ke Daftar
              </PrimaryButton>
            </div>
          </main>
        </MobileShell>
      ) : (
        <MobileShell>
          <CapsterHeader
            title="Struk Transaksi"
            subtitle={`#${formatTransactionId(trx.id, trx.date)}`}
            backTo={`/${barbershopSlug}/capster/transactions`}
            showBack={true}
            showActions={false}
          />

      <main className="flex-1 px-4 pb-28 pt-3">
        {/* Thermal Slip Receipt Design */}
        <div className="rounded-[18px] bg-slate-900/90 border border-white/20 p-5 space-y-3.5 shadow-2xl font-mono text-[12px] text-foreground">
          {/* Barbershop Header */}
          <div className="text-center space-y-1 pb-2">
            <h2 className="text-[16px] font-extrabold tracking-wider font-sans text-primary-soft">
              BARBERIN
            </h2>
            <p className="text-[11px] text-muted-foreground font-sans">
              Jl. Contoh No. 123, Purbalingga
            </p>
            <p className="text-[11px] text-muted-foreground font-sans">
              Telp. 0812-3456-7890
            </p>
          </div>

          <div className="border-b border-dashed border-white/20" />

          {/* Info Transaksi */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. Transaksi</span>
              <span className="font-bold text-primary-soft">#{formatTransactionId(trx.id, trx.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tanggal</span>
              <span>{trx.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Waktu</span>
              <span>{trx.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pelanggan</span>
              <span className="font-semibold text-foreground">{trx.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capster</span>
              <span>{trx.capsterName}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-white/20" />

          {/* Tabel Layanan */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-bold text-[11px] text-muted-foreground pb-1">
              <span>LAYANAN</span>
              <span>HARGA</span>
            </div>
            {trx.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {item.service.name} {item.quantity > 1 ? `(${item.quantity}x)` : ""}
                </span>
                <span className="font-semibold">
                  {formatRupiah(item.service.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-b border-dashed border-white/20" />

          {/* Rincian Finansial */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(trx.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Diskon</span>
              <span>{formatRupiah(trx.discount)}</span>
            </div>
            <div className="flex justify-between font-bold text-[13px] pt-1 text-foreground">
              <span>Total</span>
              <span className="text-primary-soft">{formatRupiah(trx.total)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">Bayar ({trx.paymentMethod.toUpperCase()})</span>
              <span>{formatRupiah(trx.cashReceived ?? trx.total)}</span>
            </div>
            {trx.paymentMethod === "tunai" ? (
              <div className="flex justify-between font-bold text-success">
                <span>Kembalian</span>
                <span>{formatRupiah(trx.change ?? 0)}</span>
              </div>
            ) : null}
          </div>

          <div className="border-b border-dashed border-white/20" />

          {/* Footer Receipt */}
          <div className="text-center pt-1 text-[11px] text-muted-foreground font-sans">
            <p>Terima kasih!</p>
            <p>Silakan datang kembali.</p>
          </div>
        </div>

        {shareMsg ? (
          <p className="mt-3 text-center text-[12px] font-semibold text-primary-soft">
            {shareMsg}
          </p>
        ) : null}
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={handleDownload} loading={downloading}>
          <Download className="h-4 w-4" strokeWidth={2} />
          UNDUH STRUK PDF
        </PrimaryButton>
        <SecondaryButton onClick={handleShare}>
          <Share2 className="h-4 w-4" strokeWidth={2} />
          BAGIKAN STRUK
        </SecondaryButton>
      </BottomActionBar>
      </MobileShell>
    )}
  </CapsterAuthGuard>
);
}
