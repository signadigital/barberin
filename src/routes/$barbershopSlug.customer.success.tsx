import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";

import {
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
  SuccessState,
} from "@/components/barberin/ui";
import { formatRupiah, formatTransactionId, formatCustomerId } from "@/lib/format";
import { paymentMethodName, useBarberin, type ReceiptData, type PaymentMethodId } from "@/lib/barberin-store";
import { getTransactionDetail } from "@/lib/bookings";

export const Route = createFileRoute("/$barbershopSlug/customer/success")({
  head: () => ({
    meta: [
      { title: "Transaksi Berhasil — BARBERIN" },
      { name: "description", content: "Transaksi Anda berhasil dan struk otomatis tersedia." },
      { property: "og:title", content: "Transaksi Berhasil — BARBERIN" },
      { property: "og:description", content: "Transaksi berhasil, struk otomatis tersedia." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { receiptData: storeReceipt, transactionId } = useBarberin();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(storeReceipt ?? null);
  const [loading, setLoading] = useState(!storeReceipt && !!transactionId);

  useEffect(() => {
    if (receiptData || !transactionId) return;
    let mounted = true;
    getTransactionDetail({ data: { transactionId } })
      .then((d) => {
        if (!mounted || !d) return;
        setReceiptData({
          transactionId: d.transactionId,
          customerId: d.customerId,
          customerName: d.customerName,
          createdAt: d.createdAt,
          items: d.items.map((i) => ({
            service: { id: i.serviceId, name: i.name, description: "", price: i.price },
            quantity: i.quantity,
          })),
          total: d.total,
          paymentMethod: d.paymentMethod as PaymentMethodId,
          capster: d.capsterName
            ? { id: "cap", name: d.capsterName, role: d.capsterRole, status: "AVAILABLE" }
            : null,
          status: "Berhasil",
        });
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [receiptData, transactionId]);

  if (loading) {
    return (
      <MobileShell>
        <CustomerHeader title="Transaksi" showBack={false} />
        <main className="flex-1 space-y-3 p-4">
          <SkeletonCard />
        </main>
      </MobileShell>
    );
  }

  if (!receiptData) {
    return (
      <MobileShell>
        <CustomerHeader title="Transaksi" showBack={false} />
        <ErrorState
          title="Transaksi tidak ditemukan"
          message="Terjadi kesalahan saat memproses transaksi. Silakan coba lagi."
          action={
            <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/services` as any })}>
              Kembali ke Home
            </PrimaryButton>
          }
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <CustomerHeader title="Transaksi Berhasil" showBack={false} />

      <main className="flex-1 space-y-4 px-4 pb-6">
        <SuccessState title="Transaksi Berhasil" message="Transaksi Anda telah berhasil." />

        <div className="flex justify-center">
          <StatusBadge tone="success">Struk otomatis telah dibuat</StatusBadge>
        </div>

        <GlassCard className="space-y-3">
          <InfoRow label="ID Transaksi" value={formatTransactionId(receiptData.transactionId)} />
          <InfoRow label="ID Pelanggan" value={formatCustomerId(receiptData.customerId)} />
          <InfoRow label="Nama" value={receiptData.customerName} />
          {receiptData.capster ? (
            <InfoRow label="Capster" value={receiptData.capster.name} />
          ) : null}
          <InfoRow label="Metode Pembayaran" value={paymentMethodName(receiptData.paymentMethod)} />
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[14px] text-muted-foreground">Total</span>
            <span className="text-[18px] font-bold text-primary-soft">
              {formatRupiah(receiptData.total)}
            </span>
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={() =>
            navigate({
              to: `/${barbershopSlug}/customer/receipt/${receiptData.transactionId}` as any,
            })
          }
        >
          <Receipt className="h-4 w-4" strokeWidth={2} /> Lihat Struk
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/completed` as any })}>
          Selesai
        </SecondaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
