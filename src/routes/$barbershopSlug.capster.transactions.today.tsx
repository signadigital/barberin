import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader, TransactionStatusBadge } from "@/components/capster/ui";
import { formatRupiah, formatTransactionId } from "@/lib/format";
import { capsterActions, useCapster, type CapsterTransaction } from "@/lib/capster-store";
import { getCapsterTransactions } from "@/lib/capster-transactions";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/today")({
  head: () => ({
    meta: [
      { title: "Transaksi Hari Ini — BARBERIN Capster" },
      { name: "description", content: "Daftar transaksi real-time hari ini." },
    ],
  }),
  component: TodayTransactionsPage,
});

function TodayTransactionsPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { transactions, capsterId, dashboardMetrics } = useCapster();
  const [todayTransactions, setTodayTransactions] = useState<CapsterTransaction[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filter, setFilter] = useState<"Semua" | "Menunggu" | "Selesai" | "Batal">("Semua");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!capsterId) {
      setLoading(false);
      return;
    }
    let mounted = true;

    const fetchToday = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const data = await getCapsterTransactions({
          data: {
            capsterId,
            todayOnly: true,
          },
        });
        if (!mounted) return;
        const list = (data as CapsterTransaction[]) || [];
        setTodayTransactions(list);
        setHasLoaded(true);
        capsterActions.setTransactions(list);
      } catch (err) {
        console.error("Gagal memuat transaksi hari ini:", err);
      } finally {
        if (mounted && isInitial) setLoading(false);
      }
    };

    fetchToday(true);
    const intervalId = setInterval(() => {
      fetchToday(false);
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [capsterId]);

  const baseList = hasLoaded ? todayTransactions : transactions;
  const capsterTransactions = baseList.filter(
    (t) => !capsterId || !t.capsterId || t.capsterId === capsterId,
  );

  const totalCount = capsterTransactions.length;
  const menungguCount = capsterTransactions.filter((t) => t.status === "Menunggu").length;
  const selesaiCount = capsterTransactions.filter((t) => t.status === "Selesai").length;
  const batalCount = capsterTransactions.filter((t) => t.status === "Batal").length;

  const filtered = capsterTransactions.filter((t) => {
    if (filter === "Semua") return true;
    return t.status === filter;
  });

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Transaksi Hari Ini"
        backTo={`/${barbershopSlug}/capster/dashboard`}
        showBack={true}
        showActions={true}
      />

      <main className="flex-1 space-y-4 px-4 pb-28 pt-3">
        {/* Filter Tabs with Counts */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("Semua")}
            className={
              filter === "Semua"
                ? "rounded-[12px] bg-primary py-2 text-[11px] font-bold text-white shadow-md transition-all"
                : "glass-1 rounded-[12px] py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all"
            }
          >
            Semua ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Menunggu")}
            className={
              filter === "Menunggu"
                ? "rounded-[12px] bg-warning py-2 text-[11px] font-bold text-black shadow-md transition-all"
                : "glass-1 rounded-[12px] py-2 text-[11px] font-semibold text-warning hover:text-foreground transition-all"
            }
          >
            Menunggu ({menungguCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Selesai")}
            className={
              filter === "Selesai"
                ? "rounded-[12px] bg-success py-2 text-[11px] font-bold text-white shadow-md transition-all"
                : "glass-1 rounded-[12px] py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all"
            }
          >
            Selesai ({selesaiCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Batal")}
            className={
              filter === "Batal"
                ? "rounded-[12px] bg-danger py-2 text-[11px] font-bold text-white shadow-md transition-all"
                : "glass-1 rounded-[12px] py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all"
            }
          >
            Batal ({batalCount})
          </button>
        </div>

        {/* List of Today Transactions */}
        <div className="space-y-2.5">
          {filtered.map((trx) => (
            <button
              key={trx.id}
              type="button"
              onClick={() =>
                navigate({
                  to: `/${barbershopSlug}/capster/transactions/${trx.id}` as any,
                })
              }
              className="w-full text-left transition-all active:scale-[0.99]"
            >
              <GlassCard className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-primary-soft">
                      #{formatTransactionId(trx.id, trx.date)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" strokeWidth={2} />
                      {trx.time}
                    </span>
                    <TransactionStatusBadge status={trx.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-bold text-foreground">
                      {trx.customerName}
                    </p>
                    <span className="shrink-0 text-[11px] font-semibold text-primary-soft">
                      Capster: {trx.capsterName}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {trx.serviceNames}
                  </p>
                </div>
                <span className="shrink-0 font-extrabold text-[14px] text-foreground">
                  {formatRupiah(trx.total)}
                </span>
              </GlassCard>
            </button>
          ))}

          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-10">
              Tidak ada transaksi untuk filter ini.
            </p>
          ) : null}
        </div>
      </main>

      {/* Bottom Summary Bar & Action */}
      <BottomActionBar>
        <div className="space-y-1 pb-1">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground font-medium">Total Transaksi</span>
            <span className="font-bold">{dashboardMetrics.totalTransaksi}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-muted-foreground font-medium">Total Pendapatan</span>
            <span className="font-extrabold text-primary-soft text-[16px]">
              {formatRupiah(dashboardMetrics.totalPendapatan)}
            </span>
          </div>
        </div>

        <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/transactions` as any })}>
          LIHAT SEMUA TRANSAKSI
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
