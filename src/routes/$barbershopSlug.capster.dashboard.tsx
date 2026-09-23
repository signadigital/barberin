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
import {
  getCapsterCommissionDashboard,
  type CapsterCommissionDashboardData,
} from "@/lib/commissions";
import { CommissionWithdrawalCard } from "@/components/capster/CommissionWithdrawalCard";
import { endShift, getActiveShift } from "@/lib/shifts";

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
  const [commissionData, setCommissionData] = useState<CapsterCommissionDashboardData | null>(null);

  // Verifikasi shift aktif: jika belum check in, alihkan ke halaman check-in
  useEffect(() => {
    if (!capsterId) return;
    let mounted = true;

    getActiveShift({
      data: {
        capsterId,
        capsterName,
      },
    })
      .then((active) => {
        if (!mounted) return;
        if (active) {
          capsterActions.checkIn(active.id_shift);
        } else {
          navigate({ to: `/${barbershopSlug}/capster/check-in` as any, replace: true });
        }
      })
      .catch((err) => {
        console.error("Gagal memeriksa status shift aktif di dashboard:", err);
      });

    return () => {
      mounted = false;
    };
  }, [capsterId, capsterName, barbershopSlug, navigate]);

  const currentMetrics = dashboardMetrics;
  const currentTransactions = transactions || [];
  const unconfirmedTransactions = currentTransactions.filter(
    (t) =>
      (t.status === "Menunggu" ||
        t.bookingStatus === "pending_confirmation" ||
        t.bookingStatus === "awaiting_payment") &&
      (!capsterId || !t.capsterId || t.capsterId === capsterId),
  );

  useEffect(() => {
    if (!capsterId) return;
    let mounted = true;

    const fetchAllData = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const [metrics, txs, comm] = await Promise.all([
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
          getCapsterCommissionDashboard({
            data: {
              ...(capsterId ? { capsterId } : {}),
              ...(userId ? { userId } : {}),
              ...(barbershopSlug ? { barbershopSlug } : {}),
            },
          }),
        ]);
        if (!mounted) return;
        if (metrics) capsterActions.setDashboardMetrics(metrics);
        if (txs) capsterActions.setTransactions(txs as CapsterTransaction[]);
        if (comm) setCommissionData(comm);
      } catch (e) {
        console.error("Gagal memuat data dashboard:", e);
      }
    };

    fetchAllData();
    const intervalId = setInterval(fetchAllData, 10000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAllData();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
              Halo, {(capsterName || "Admin").split(" ")[0]}! 👋
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
            icon={Coins}
            title="KOMISI HARI INI"
            value={formatRupiah(commissionData?.komisiHariIni ?? currentMetrics.komisiHariIni ?? 0)}
            delta={
              commissionData?.komisiHariIni
                ? "+12% dari kemarin"
                : currentMetrics.deltaKomisi || "Hari ini"
            }
            tone="warning"
          />
        </div>

        {/* Card Penarikan Komisi (Sesuai Wireframe Dashboard Capster) */}
        <CommissionWithdrawalCard
          data={commissionData}
          onRefresh={() => {
            getCapsterCommissionDashboard({
              data: {
                ...(capsterId ? { capsterId } : {}),
                ...(userId ? { userId } : {}),
                ...(barbershopSlug ? { barbershopSlug } : {}),
              },
            }).then((res) => {
              if (res) setCommissionData(res);
            });
          }}
          barbershopSlug={barbershopSlug}
        />

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
