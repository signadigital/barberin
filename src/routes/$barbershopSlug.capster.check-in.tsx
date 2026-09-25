import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
} from "@/components/barberin/ui";
import {
  CapsterAuthGuard,
  CapsterHeader,
  CheckInStatusCard,
  ShiftInfoCard,
} from "@/components/capster/ui";
import { capsterActions, useCapster } from "@/lib/capster-store";
import { checkInShift, getActiveShift } from "@/lib/shifts";

export const Route = createFileRoute("/$barbershopSlug/capster/check-in")({
  head: () => ({
    meta: [
      { title: "Check In Shift — BARBERIN" },
      { name: "description", content: "Check in shift harian Capster BARBERIN." },
    ],
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const { shiftInfo, capsterId, capsterName } = useCapster();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!capsterId) {
      navigate({ to: `/${barbershopSlug}/capster/login` as any, replace: true });
      return;
    }

    // Jika capster sudah check in dan belum akhiri shift, langsung ke dashboard
    if (shiftInfo.isCheckedIn && !shiftInfo.isShiftEnded) {
      navigate({ to: `/${barbershopSlug}/capster/dashboard` as any, replace: true });
      return;
    }

    getActiveShift({
      data: {
        capsterId,
        capsterName,
      },
    })
      .then((active) => {
        if (active) {
          capsterActions.checkIn(active.id_shift);
          navigate({ to: `/${barbershopSlug}/capster/dashboard` as any, replace: true });
        }
      })
      .catch((e) => console.error(e));
  }, [capsterId, capsterName, shiftInfo.isCheckedIn, shiftInfo.isShiftEnded, barbershopSlug, navigate]);

  const handleCheckIn = async () => {
    if (!capsterId) {
      navigate({ to: `/${barbershopSlug}/capster/login` as any, replace: true });
      return;
    }
    if (shiftInfo.isCheckedIn) {
      navigate({ to: `/${barbershopSlug}/capster/dashboard` as any, replace: true });
      return;
    }
    setChecking(true);
    try {
      const active = await checkInShift({
        data: { capsterId },
      });
      if (active) {
        capsterActions.checkIn(active.id_shift);
      }
      setChecking(false);
      navigate({ to: `/${barbershopSlug}/capster/dashboard` as any, replace: true });
    } catch (err) {
      console.error(err);
      capsterActions.checkIn();
      setChecking(false);
      navigate({ to: `/${barbershopSlug}/capster/dashboard` as any, replace: true });
    }
  };

  if (shiftInfo.isCheckedIn && !shiftInfo.isShiftEnded) {
    return (
      <MobileShell>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
          <p className="text-[13px] text-muted-foreground">Menuju Dashboard...</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Check In Shift"
        backTo={`/${barbershopSlug}/capster/login`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-4 px-4 pb-8 pt-4">
        {/* Card Informasi Shift Hari Ini */}
        <ShiftInfoCard shift={shiftInfo} />

        {/* Card Status Check In */}
        <CheckInStatusCard isCheckedIn={shiftInfo.isCheckedIn} />

        {/* Kotak Perhatian Aturan Check In (BPMN) */}
        <GlassCard className="flex items-start gap-3 border-info/30 bg-info/10 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" strokeWidth={2.2} />
          <div className="space-y-1 text-[13px]">
            <p className="font-bold text-info">Perhatian!</p>
            <p className="text-muted-foreground leading-relaxed">
              Hanya 1 capster yang dapat check in setiap hari. Jika sudah ada yang check in, Anda tidak dapat check in lagi.
            </p>
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={handleCheckIn} loading={checking}>
          <LogIn className="h-4 w-4" strokeWidth={2} />
          {shiftInfo.isCheckedIn ? "MENUJU DASHBOARD" : "CHECK IN"}
        </PrimaryButton>
        <p className="text-center text-[11px] text-muted-foreground pt-1">
          Setelah shift selesai dan data di-reset, sistem akan kembali ke halaman ini.
        </p>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
