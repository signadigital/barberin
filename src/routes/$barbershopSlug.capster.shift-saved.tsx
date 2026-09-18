import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, CheckCircle2, Clock, Database, LogOut, RefreshCw } from "lucide-react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { capsterActions } from "@/lib/capster-store";

export const Route = createFileRoute("/$barbershopSlug/capster/shift-saved")({
  head: () => ({
    meta: [
      { title: "Data Shift Disimpan — BARBERIN Capster" },
      { name: "description", content: "Data hari ini telah disimpan dan dashboard siap untuk shift berikutnya." },
    ],
  }),
  component: ShiftSavedPage,
});

function ShiftSavedPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();

  const handleReturnToCheckIn = () => {
    capsterActions.resetDailyData();
    navigate({ to: `/${barbershopSlug}/capster/check-in` as any });
  };

  const handleReturnToLogin = () => {
    capsterActions.logout();
    navigate({ to: `/${barbershopSlug}/capster/login` as any });
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Shift Selesai"
        showBack={false}
        showActions={false}
      />

      <main className="flex-1 space-y-4 px-4 pb-36 pt-4">
        <div className="flex flex-col items-center text-center space-y-2 py-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success ring-1 ring-success/40">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2.2} />
          </div>
          <h2 className="text-[20px] font-extrabold text-foreground">
            Data Hari Ini Telah Disimpan
          </h2>
          <p className="text-[13px] text-muted-foreground max-w-[300px]">
            Rekap transaksi harian telah diamankan. Dashboard siap untuk siklus kerja baru.
          </p>
        </div>

        {/* 3 Alur Sistem Pasca Akhir Shift */}
        <div className="space-y-3">
          {/* Card 1: Data Disimpan */}
          <GlassCard className="p-4 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-primary/20 text-primary-soft ring-1 ring-primary/40">
              <Database className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[14px] font-bold text-foreground">Data Disimpan</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Data hari ini telah disimpan di sistem. Dashboard harian telah di-reset.
              </p>
            </div>
          </GlassCard>

          {/* Card 2: Kembali ke Check In Shift */}
          <GlassCard className="p-4 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">
              <Calendar className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[14px] font-bold text-foreground">Kembali ke Check In Shift</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Sistem kembali ke halaman Check In Shift untuk shift berikutnya.
              </p>
            </div>
          </GlassCard>

          {/* Card 3: Siap untuk Shift Baru */}
          <GlassCard className="p-4 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-success/20 text-success ring-1 ring-success/40">
              <Clock className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[14px] font-bold text-foreground">Siap untuk Shift Baru</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Capster dapat check in lagi pada hari berikutnya sesuai jadwal shift.
              </p>
            </div>
          </GlassCard>
        </div>
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={handleReturnToCheckIn}>
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          KEMBALI KE CHECK IN SHIFT
        </PrimaryButton>
        <SecondaryButton onClick={handleReturnToLogin}>
          <LogOut className="h-4 w-4" strokeWidth={2} />
          KEMBALI KE HALAMAN LOGIN
        </SecondaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
