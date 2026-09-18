import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  CapsterCard,
  EmptyState,
  MobileShell,
  PrimaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { capsterActions, useCapster, type Capster } from "@/lib/capster-store";
import { getCapsters } from "@/lib/capsters";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/manual/capster")({
  head: () => ({
    meta: [
      { title: "Pilih Capster — Buat Transaksi Manual" },
      {
        name: "description",
        content: "Pilih capster yang akan melayani transaksi manual.",
      },
    ],
  }),
  component: ManualSelectCapsterPage,
});

function ManualSelectCapsterPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { manualDraft } = useCapster();
  const [capsters, setCapsters] = useState<Capster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCapsters()
      .then((data) => {
        if (!mounted) return;
        const mapped: Capster[] = data.map((c) => ({
          id: c.id_capster,
          name: c.name,
          role: c.role,
          status: c.status,
        }));
        setCapsters(mapped);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const available = capsters.filter((c) => c.status === "AVAILABLE");
  const selectedCapsterId = manualDraft.capsterId;

  const handleSelectCapster = (capster: Capster) => {
    capsterActions.setManualCapster(capster);

    if (error) {
      setError(null);
    }
  };

  const handleNext = () => {
  if (!selectedCapsterId) {
    setError("Silakan pilih capster terlebih dahulu.");
    return;
  }

  navigate({ to: `/${barbershopSlug}/capster/transactions/manual/detail` as any,
  });
};

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Pilih Capster"
        subtitle="Pilih capster yang melayani"
        backTo={`/${barbershopSlug}/capster/transactions/manual/services`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-3 px-4 pb-28 pt-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : available.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="Belum ada capster yang tersedia."
            description="Semua capster sedang melayani atau tidak tersedia."
          />
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">
              Pilih capster yang bertugas menangani pesanan ini.
            </p>

            {capsters.map((capster) => (
              <CapsterCard
                key={capster.id}
                capster={capster}
                selected={selectedCapsterId === capster.id}
                onSelect={() => handleSelectCapster(capster)}
              />
            ))}
          </>
        )}

        {error ? (
          <p
            role="alert"
            className="pt-2 text-center text-[13px] font-medium text-danger"
          >
            {error}
          </p>
        ) : null}
      </main>

      <BottomActionBar>
        <PrimaryButton
          disabled={!selectedCapsterId}
          onClick={handleNext}
        >
          LANJUT
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}