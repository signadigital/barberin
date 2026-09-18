import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, User, Phone, ShieldCheck } from "lucide-react";

import {
  GlassCard,
  MobileShell,
} from "@/components/barberin/ui";
import {
  CapsterAuthGuard,
  CapsterHeader,
  CapsterBottomNav,
} from "@/components/capster/ui";
import { capsterActions, useCapster } from "@/lib/capster-store";

export const Route = createFileRoute("/$barbershopSlug/capster/account")({
  head: () => ({
    meta: [
      { title: "Akun Capster — BARBERIN" },
      {
        name: "description",
        content: "Informasi akun Capster",
      },
    ],
  }),
  component: CapsterAccountPage,
});

function CapsterAccountPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const { capsterName, capsterRole } = useCapster();

  const handleLogout = () => {
    capsterActions.logout();
    navigate({ to: `/${barbershopSlug}/capster/login` as any });
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
        <CapsterHeader
          title="Akun"
          showBack={false}
          showActions={false}
        />

        <main className="flex-1 space-y-4 px-4 pb-28 pt-4">
          {/* Profile */}
          <GlassCard className="p-5">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40">
                <User
                  className="h-9 w-9 text-primary-soft"
                  strokeWidth={2}
                />
              </div>

              <h2 className="mt-3 text-[18px] font-bold text-foreground">
                {capsterName || "Capster BARBERIN"}
              </h2>

              <p className="text-[12px] text-muted-foreground">
                {capsterRole || "Capster"}
              </p>
            </div>
          </GlassCard>

          {/* Informasi Akun */}
          <GlassCard className="space-y-4 p-4">
            <h2 className="text-[14px] font-bold border-b border-white/10 pb-2">
              Informasi Akun
            </h2>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/15">
                <User
                  className="h-4 w-4 text-primary-soft"
                  strokeWidth={2}
                />
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Nama
                </p>
                <p className="text-[13px] font-semibold">
                  {capsterName || "Capster"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/15">
                <Phone
                  className="h-4 w-4 text-primary-soft"
                  strokeWidth={2}
                />
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Nomor Telepon
                </p>
                <p className="text-[13px] font-semibold">
                  Tersedia di Profil
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/15">
                <ShieldCheck
                  className="h-4 w-4 text-primary-soft"
                  strokeWidth={2}
                />
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Role
                </p>
                <p className="text-[13px] font-semibold">
                  {capsterRole || "Capster"}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border border-danger/30 bg-danger/10 text-[13px] font-semibold text-danger transition-all active:scale-[0.98] cursor-pointer"
          >
            <LogOut
              className="h-4 w-4"
              strokeWidth={2}
            />
            Keluar
          </button>
        </main>

        <CapsterBottomNav activeTab="account" />
      </MobileShell>
    </CapsterAuthGuard>
  );
}