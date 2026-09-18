import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, Clock, Coins, Receipt, Scissors, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { MobileShell } from "@/components/barberin/ui";
import {
  CapsterAuthGuard,
  CapsterBottomNav,
  CapsterHeader,
  DailyActionButtons,
  UnconfirmedTransactionsSection,
  ShiftEndModal,
  SummaryCard,
} from "@/components/capster/ui";
import { formatRupiah, formatWibClock, useLiveClock } from "@/lib/format";
import {
  capsterActions,
  useCapster,
  type CapsterTransaction,
} from "@/lib/capster-store";
import {
  getCapsterTransactions,
  getDashboardMetrics,
} from "@/lib/capster-transactions";
import { endShift } from "@/lib/shifts";

export const Route = createFileRoute("/$barbershopSlug/capster/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Capster — BARBERIN" },
      { name: "description", content: "Dashboard manajemen harian Capster BARBERIN." },
    ],
  }),
  component: CapsterDashboardPage,
});

function CapsterDashboardPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { capsterId, userId, capsterName, dashboardMetrics, shiftId, transactions } =
    useCapster();
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);

  const currentMetrics = dashboardMetrics;
  const currentTransactions = transactions;
  const unconfirmedTransactions = currentTransactions.filter(
    (t) => t.status === "Menunggu" && (!capsterId || !t.capsterId || t.capsterId === capsterId),
  );

  useEffect(() => {
    if (!capsterId) return;
    let mounted = true;

    const fetchAllData = async () => {
      try {
        const [metrics, txs] = await Promise.all([
          getDashboardMetrics({
            data: {
              capsterId,
              ...(userId ? { userId } : {}),
            },
          }),
          getCapsterTransactions({
            data: {
              capsterId,
            },
          }),
        ]);
        if (!mounted) return;
        if (metrics) capsterActions.setDashboardMetrics(metrics);
        if (txs) capsterActions.setTransactions(txs as CapsterTransaction[]);
      } catch (e) {
        console.error("Gagal memuat data dashboard:", e);
      }
    };

    fetchAllData();
    const intervalId = setInterval(fetchAllData, 3500);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [capsterId, userId]);

  const liveClock = useLiveClock(1000);

  const handleEndShiftConfirm = async () => {
    if (shiftId) {
      try {
        await endShift({ data: { shiftId } });
      } catch (e) {
        console.error("Gagal mengakhiri shift di database:", e);
      }
    }
    capsterActions.endShift();
    setShowEndShiftModal(false);
    navigate({ to: `/${barbershopSlug}/capster/shift-saved` as any });
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Dashboard"
        showBack={false}
        showActions={true}
      />

      <main className="flex-1 space-y-4 px-4 pb-8 pt-3">
        {/* Sapaan Capster */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold text-foreground">
              Halo, {capsterName.split(" ")[0] ?? "Admin"}! 👋
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Kamu ke dashboard capster mu.
            </p>
          </div>
          <div className="glass-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-primary-soft shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary-soft shrink-0" />
            <span>
              {liveClock.toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Jakarta",
              })} • {formatWibClock(liveClock, { withDate: false })}
            </span>
          </div>
        </div>

        {/* 4 Summary Cards (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={Receipt}
            title="TOTAL TRANSAKSI"
            value={currentMetrics.totalTransaksi}
            delta={currentMetrics.deltaTransaksi}
            tone="primary"
          />
          <SummaryCard
            icon={Coins}
            title="TOTAL PENDAPATAN"
            value={formatRupiah(currentMetrics.totalPendapatan)}
            delta={currentMetrics.deltaPendapatan}
            tone="success"
          />
          <SummaryCard
            icon={Scissors}
            title="TOTAL LAYANAN"
            value={currentMetrics.totalLayanan}
            delta={currentMetrics.deltaLayanan}
            tone="purple"
          />
          <SummaryCard
            icon={Users}
            title="CAPSTER AKTIF"
            value={String(currentMetrics.capsterAktif).padStart(2, "0")}
            delta={currentMetrics.deltaCapster}
            tone="warning"
          />
        </div>

        {/* Daftar Transaksi Belum Dikonfirmasi */}
        <UnconfirmedTransactionsSection transactions={unconfirmedTransactions} />

        {/* Tombol Aksi: Transaksi Hari Ini & Akhiri Shift */}
        <DailyActionButtons onEndShift={() => setShowEndShiftModal(true)} />
      </main>

      {/* Modal Konfirmasi Akhiri Shift */}
      <ShiftEndModal
        open={showEndShiftModal}
        onConfirm={handleEndShiftConfirm}
        onCancel={() => setShowEndShiftModal(false)}
      />

      <CapsterBottomNav activeTab="dashboard" />
    </MobileShell>
    </CapsterAuthGuard>
  );
}
