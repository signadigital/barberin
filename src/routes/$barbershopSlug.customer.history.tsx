import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, Receipt, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  CustomerHeader,
  EmptyState,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SkeletonCard,
  StatusBadge,
} from "@/components/barberin/ui";
import { formatRupiah, formatTransactionId } from "@/lib/format";
import { useBarberin } from "@/lib/barberin-store";
import { getCustomerTransactions } from "@/lib/bookings";

type HistoryItem = {
  id: string;
  date: string;
  time: string;
  serviceNames: string;
  total: number;
  status: "Selesai" | "Menunggu" | "Batal";
  paymentMethod: string;
};

export const Route = createFileRoute("/$barbershopSlug/customer/history")({
  head: () => ({
    meta: [
      { title: "Riwayat Transaksi — BARBERIN" },
      { name: "description", content: "Daftar riwayat transaksi Anda di BARBERIN." },
      { property: "og:title", content: "Riwayat Transaksi — BARBERIN" },
      { property: "og:description", content: "Riwayat pesanan dan struk transaksi Anda." },
    ],
  }),
  component: CustomerHistoryPage,
});

function CustomerHistoryPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { customerId, customerName } = useBarberin();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCustomerTransactions({
      data: {
        ...(customerId ? { customerId } : {}),
        ...(customerName ? { customerName } : {}),
      },
    })
      .then((data) => {
        if (!mounted) return;
        setHistory(data as HistoryItem[]);
      })
      .catch((err) => {
        console.error("Gagal memuat riwayat:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [customerId, customerName]);

  return (
    <MobileShell>
      <CustomerHeader
        title="Riwayat Transaksi"
        subtitle={customerName ? `Pelanggan: ${customerName}` : "Daftar pesanan Anda"}
        backTo={`/${barbershopSlug}/customer/services`}
      />

      <main className="flex-1 space-y-3 px-4 pb-24 pt-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : history.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada riwayat transaksi"
            description="Transaksi yang telah Anda lakukan akan muncul di sini."
            action={
              <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/services` as any })}>
                <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                Pilih Layanan
              </PrimaryButton>
            }
          />
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                navigate({
                  to: `/${barbershopSlug}/customer/receipt/${item.id}` as any,
                })
              }
              className="w-full text-left transition-all active:scale-[0.99]"
            >
              <GlassCard className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="font-mono font-bold text-primary-soft">
                      #{formatTransactionId(item.id, item.date)}
                    </span>
                    <span>•</span>
                    <Clock className="h-3.5 w-3.5 text-primary-soft" strokeWidth={2} />
                    <span>{item.date} • {item.time}</span>
                  </div>
                  <StatusBadge tone={item.status === "Selesai" ? "success" : "warning"}>
                    {item.status}
                  </StatusBadge>
                </div>

                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-foreground">
                      {item.serviceNames}
                    </p>
                    <p className="text-[12px] text-muted-foreground uppercase">
                      Bayar: {item.paymentMethod}
                    </p>
                  </div>
                  <span className="shrink-0 text-[15px] font-extrabold text-primary-soft">
                    {formatRupiah(item.total)}
                  </span>
                </div>

                <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[12px] text-primary-soft font-semibold">
                  <span>Lihat Struk</span>
                  <span>&rarr;</span>
                </div>
              </GlassCard>
            </button>
          ))
        )}
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/customer/services` as any })}>
          <ShoppingBag className="h-4 w-4" strokeWidth={2} />
          PILIH LAYANAN BARU
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
