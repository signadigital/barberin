import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BarberinLogo,
  BottomActionBar,
  CustomerHeader,
  ErrorState,
  GlassCard,
  InfoRow,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
  SkeletonCard,
  StatusBadge,
} from "@/components/barberin/ui";
import { formatRupiah, formatTanggal, formatWaktu, formatTransactionId, formatCustomerId } from "@/lib/format";
import { paymentMethodName, useBarberin, type ReceiptData, type PaymentMethodId } from "@/lib/barberin-store";
import { getTransactionDetail } from "@/lib/bookings";

export const Route = createFileRoute("/$barbershopSlug/customer/receipt/$transactionId")({
  head: () => ({
    meta: [
      { title: "Struk Transaksi — BARBERIN" },
      { name: "description", content: "Struk transaksi BARBERIN. Unduh PDF atau bagikan struk." },
      { property: "og:title", content: "Struk Transaksi — BARBERIN" },
      { property: "og:description", content: "Unduh PDF atau bagikan struk transaksi Anda." },
    ],
  }),
  component: ReceiptPage,
});

async function generatePdf(receipt: ReceiptData) {
  const { barbershopSlug } = (Route as any).useParams();
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [320, 520] });
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BARBERIN", 24, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 14;
  doc.text("Modern Barbershop Management System", 24, y);
  y += 8;
  doc.line(24, y, 296, y);

  const row = (label: string, value: string) => {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.text(label, 24, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, 296, y, { align: "right" });
  };

  doc.setFontSize(10);
  row("ID Transaksi", formatTransactionId(receipt.transactionId, receipt.createdAt));
  row("ID Pelanggan", formatCustomerId(receipt.customerId, receipt.createdAt));
  row("Nama", receipt.customerName);
  if (receipt.capster) {
    row("Capster", `${receipt.capster.name} — ${receipt.capster.role}`);
  }
  row("Tanggal", formatTanggal(receipt.createdAt));
  row("Waktu", formatWaktu(receipt.createdAt));

  y += 12;
  doc.line(24, y, 296, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("LAYANAN", 24, y);
  doc.setFont("helvetica", "normal");
  receipt.items.forEach((item) => {
    row(`${item.service.name} (${item.quantity}x)`, formatRupiah(item.service.price * item.quantity));
  });

  y += 12;
  doc.line(24, y, 296, y);
  row("Total", formatRupiah(receipt.total));
  row("Metode Pembayaran", paymentMethodName(receipt.paymentMethod));
  row("Status", receipt.status);

  y += 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Terima kasih telah menggunakan layanan kami.", 24, y);

  doc.save(`BARBERIN-${receipt.transactionId}.pdf`);
}

function ReceiptPage() {
  const navigate = useNavigate();
  const { transactionId, barbershopSlug } = Route.useParams();
  const { receiptData: storeReceipt } = useBarberin();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(
    storeReceipt && storeReceipt.transactionId === transactionId ? storeReceipt : null
  );
  const [loading, setLoading] = useState(!receiptData);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    if (receiptData) return;
    let mounted = true;
    getTransactionDetail({ data: { transactionId, barbershopSlug } })
      .then((detail) => {
        if (!mounted || !detail) return;
        const mapped: ReceiptData = {
          transactionId: detail.transactionId,
          customerId: detail.customerId,
          customerName: detail.customerName,
          createdAt: detail.createdAt,
          items: detail.items.map((i) => ({
            service: {
              id: i.serviceId,
              name: i.name,
              description: "",
              price: i.price,
            },
            quantity: i.quantity,
          })),
          total: detail.total,
          paymentMethod: detail.paymentMethod as PaymentMethodId,
          capster: detail.capsterName
            ? {
                id: "cap",
                name: detail.capsterName,
                role: detail.capsterRole,
                status: "AVAILABLE",
              }
            : null,
          status: "Berhasil",
        };
        setReceiptData(mapped);
      })
      .catch((err) => {
        console.error("Gagal mengambil data struk:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [transactionId, barbershopSlug, receiptData]);

  if (loading) {
    return (
      <MobileShell>
        <CustomerHeader title="Struk Transaksi" backTo={`/${barbershopSlug}/customer/services`} />
        <main className="flex-1 space-y-3 px-4 pb-6 pt-4">
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </MobileShell>
    );
  }

  if (!receiptData) {
    return (
      <MobileShell>
        <CustomerHeader title="Struk Transaksi" backTo={`/${barbershopSlug}/customer/services`} />
        <ErrorState
          title="Struk tidak ditemukan"
          message="Transaksi tidak tersedia di database. Silakan mulai transaksi baru."
          action={
            <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/services` as any })}>
              Kembali ke Home
            </PrimaryButton>
          }
        />
      </MobileShell>
    );
  }

  const downloadPdf = async () => {
    setPdfState("loading");
    try {
      await generatePdf(receiptData);
      setPdfState("done");
    } catch {
      setPdfState("error");
    }
  };

  const shareReceipt = async () => {
    const text = [
      "BARBERIN — Struk Transaksi",
      `ID Transaksi: ${receiptData.transactionId}`,
      `Nama: ${receiptData.customerName}`,
      ...(receiptData.capster
        ? [`Capster: ${receiptData.capster.name} — ${receiptData.capster.role}`]
        : []),
      `Total: ${formatRupiah(receiptData.total)}`,
      `Metode: ${paymentMethodName(receiptData.paymentMethod)}`,
      `Status: ${receiptData.status}`,
    ].join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Struk BARBERIN", text });
        setShareMessage("Struk siap dibagikan.");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMessage("Informasi struk disalin ke clipboard.");
      } else {
        setShareMessage("Gagal membagikan struk. Silakan coba lagi.");
      }
    } catch {
      setShareMessage("Gagal membagikan struk. Silakan coba lagi.");
    }
  };

  return (
    <MobileShell>
      <CustomerHeader title="Struk Transaksi" backTo={`/${barbershopSlug}/customer/success`} />

      <main className="flex-1 space-y-4 px-4 pb-6 pt-4">
        <GlassCard className="space-y-4 rounded-[20px]">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <BarberinLogo className="h-9 w-9" />
            <div className="min-w-0">
              <p className="text-[16px] font-bold">BARBERIN</p>
              <p className="text-[12px] text-muted-foreground">Struk Transaksi</p>
            </div>
            <span className="ml-auto shrink-0">
              <StatusBadge tone="success">Berhasil</StatusBadge>
            </span>
          </div>

          <div className="space-y-2">
            <InfoRow label="ID Transaksi" value={formatTransactionId(receiptData.transactionId, receiptData.createdAt)} />
            <InfoRow label="ID Pelanggan" value={formatCustomerId(receiptData.customerId, receiptData.createdAt)} />
            <InfoRow label="Nama" value={receiptData.customerName} />
            {receiptData.capster ? (
              <>
                <InfoRow label="Capster" value={receiptData.capster.name} />
                <InfoRow label="Role" value={receiptData.capster.role} />
              </>
            ) : null}
            <InfoRow label="Tanggal" value={formatTanggal(receiptData.createdAt)} />
            <InfoRow label="Waktu" value={formatWaktu(receiptData.createdAt, true)} />
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-[13px] font-semibold text-muted-foreground">LAYANAN</p>
            {receiptData.items.map((item) => (
              <div key={item.service.id} className="flex justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  {item.service.name}
                  {item.quantity > 1 ? ` (${item.quantity}x)` : ""}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatRupiah(item.service.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold">Total Bayar</span>
              <span className="text-[18px] font-bold text-primary-soft">
                {formatRupiah(receiptData.total)}
              </span>
            </div>
            <InfoRow
              label="Metode Pembayaran"
              value={paymentMethodName(receiptData.paymentMethod)}
            />
            <InfoRow label="Status" value={<span className="text-success">Berhasil</span>} />
          </div>
        </GlassCard>

        {pdfState === "loading" ? (
          <p role="status" className="text-center text-[13px] text-muted-foreground">
            Menyiapkan struk...
          </p>
        ) : null}
        {pdfState === "done" ? (
          <p role="status" className="text-center text-[13px] text-success">
            Struk berhasil dibuat.
          </p>
        ) : null}
        {pdfState === "error" ? (
          <p role="alert" className="text-center text-[13px] text-danger">
            Gagal membuat PDF. Silakan coba lagi.
          </p>
        ) : null}
        {shareMessage ? (
          <p role="status" className="text-center text-[13px] text-info">
            {shareMessage}
          </p>
        ) : null}
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={downloadPdf} loading={pdfState === "loading"}>
          <Download className="h-4 w-4" strokeWidth={2} /> Unduh PDF
        </PrimaryButton>
        <SecondaryButton onClick={shareReceipt}>
          <Share2 className="h-4 w-4" strokeWidth={2} /> Bagikan Struk
        </SecondaryButton>
        <SecondaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/completed` as any })}>
          Selesai
        </SecondaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
