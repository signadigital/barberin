import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, LogOut } from "lucide-react";
import { useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { formatRupiah } from "@/lib/format";
import { capsterActions, useCapster } from "@/lib/capster-store";
import { endShift } from "@/lib/shifts";

export const Route = createFileRoute("/$barbershopSlug/capster/end-shift")({
  head: () => ({
    meta: [
      { title: "Akhiri Shift — BARBERIN Capster" },
      { name: "description", content: "Konfirmasi pengakhiran shift kerja dan rekap data harian." },
    ],
  }),
  component: EndShiftPage,
});

function EndShiftPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { dashboardMetrics, capsterName, shiftInfo, shiftId } = useCapster();
  const [ending, setEnding] = useState(false);

  const handleEndShift = async () => {
    setEnding(true);
    if (shiftId) {
      try {
        await endShift({ data: { shiftId } });
      } catch (err) {
        console.error("Gagal mengakhiri shift di database:", err);
      }
    }
    capsterActions.endShift();
    setEnding(false);
    navigate({ to: `/${barbershopSlug}/capster/shift-saved` as any });
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Akhiri Shift"
        backTo={`/${barbershopSlug}/capster/dashboard`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-4 px-4 pb-28 pt-4">
        <div className="flex flex-col items-center text-center space-y-2 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/20 text-danger ring-1 ring-danger/40">
            <LogOut className="h-8 w-8" strokeWidth={2} />
          </div>
          <h2 className="text-[20px] font-bold text-foreground">Konfirmasi Akhiri Shift</h2>
          <p className="text-[13px] text-muted-foreground max-w-[280px]">
            Apakah Anda yakin ingin mengakhiri shift hari ini, <strong>{capsterName}</strong>?
          </p>
        </div>

        {/* Rekap Shift Hari Ini */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/10 pb-2">
            Rekap Shift ({shiftInfo.date})
          </h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Transaksi</span>
              <span className="font-bold text-foreground">{dashboardMetrics.totalTransaksi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Pendapatan</span>
              <span className="font-extrabold text-primary-soft">
                {formatRupiah(dashboardMetrics.totalPendapatan)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Layanan</span>
              <span className="font-bold text-foreground">{dashboardMetrics.totalLayanan}</span>
            </div>
          </div>
        </GlassCard>

        {/* Warning Information */}
        <GlassCard className="flex items-start gap-3 border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={2} />
          <div className="space-y-1 text-[12px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-warning">Perhatian Rekap Data</p>
            <p>
              Data transaksi dan ringkasan hari ini akan disimpan di sistem sebelum dashboard di-reset untuk siklus shift berikutnya.
            </p>
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={handleEndShift}
          loading={ending}
          className="bg-danger text-white shadow-[0_8px_24px_rgba(239,68,68,0.35)]"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          AKHIRI SHIFT
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/dashboard` as any })}>
          BATAL
        </SecondaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
