import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Calculator, QrCode } from "lucide-react";
import { useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { capsterActions } from "@/lib/capster-store";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/manual")({
  head: () => ({
    meta: [
      { title: "Buat Transaksi — BARBERIN Capster" },
      { name: "description", content: "Pilih mode pembuatan transaksi baru." },
    ],
  }),
  component: ManualTransactionModePage,
});

function ManualTransactionModePage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const location = useLocation();
  const [mode, setMode] = useState<"manual" | "qr">("manual");

  if (location.pathname !== `/${barbershopSlug}/capster/transactions/manual`) {
    return <Outlet />;
  }

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Buat Transaksi"
        backTo={`/${barbershopSlug}/capster/transactions`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-6 px-4 pb-8 pt-4">
        {/* Segmented Mode Selector */}
        <div className="grid grid-cols-2 rounded-[14px] bg-white/5 p-1 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={
              mode === "manual"
                ? "flex items-center justify-center gap-2 rounded-[10px] bg-primary py-2.5 text-[13px] font-bold text-white shadow-md transition-all"
                : "flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all"
            }
          >
            <Calculator className="h-4 w-4" strokeWidth={2} />
            Manual
          </button>
          <button
            type="button"
            onClick={() => setMode("qr")}
            className={
              mode === "qr"
                ? "flex items-center justify-center gap-2 rounded-[10px] bg-primary py-2.5 text-[13px] font-bold text-white shadow-md transition-all"
                : "flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all"
            }
          >
            <QrCode className="h-4 w-4" strokeWidth={2} />
            Scan QR
          </button>
        </div>

        {mode === "manual" ? (
          /* Card Mode Manual */
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl glass-2 text-primary-soft shadow-xl ring-1 ring-white/15">
              <Calculator className="h-12 w-12" strokeWidth={1.8} />
            </div>
            <div className="space-y-1.5 max-w-[280px]">
              <h2 className="text-[18px] font-bold text-foreground">Transaksi Manual</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Buat transaksi manual langsung oleh capster tanpa perlu scan QR dari smartphone pelanggan.
              </p>
            </div>
          </div>
        ) : (
          /* Placeholder Scan QR (Disabled sesuai PRD) */
          <GlassCard className="p-6 text-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground mx-auto">
              <QrCode className="h-8 w-8" strokeWidth={1.8} />
            </div>
            <p className="text-[14px] font-bold text-foreground">Mode Scan QR</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Untuk tahap awal, pembuatan transaksi difokuskan pada mode Manual tanpa menggunakan kamera smartphone.
            </p>
          </GlassCard>
        )}
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={() => {
            capsterActions.initManualDraft();
            navigate({ to: `/${barbershopSlug}/capster/transactions/manual/services` as any });
          }}
        >
          LANJUT
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
