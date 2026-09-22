import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

import { useEffect, useState, useRef } from "react";
import {
  BottomActionBar,
  CapsterCard,
  CustomerHeader,
  EmptyState,
  ErrorState,
  MobileShell,
  PrimaryButton,
  SkeletonCard,
} from "@/components/barberin/ui";
import { actions, useBarberin, type Capster } from "@/lib/barberin-store";
import { getCapsters } from "@/lib/capsters";

type CapsterSearch = {
  shop?: string | undefined;
};

export const Route = createFileRoute("/$barbershopSlug/customer/capster")({
  validateSearch: (search: Record<string, unknown>): CapsterSearch => {
    const rawShop = search["shop"];
    return {
      shop: typeof rawShop === "string" && rawShop.trim() ? rawShop.trim() : undefined,
    };
  },
  loader: async ({ params }: { params: { barbershopSlug: string } }) => {
    try {
      return await getCapsters({ data: { onlyCheckedIn: true, slug: params.barbershopSlug } });
    } catch (e) {
      console.error("Loader error getCapsters:", e);
      return [];
    }
  },
  head: () => ({
    meta: [
      { title: "Pilih Capster — BARBERIN" },
      {
        name: "description",
        content: "Pilih capster BARBERIN yang akan melayani Anda sesuai ketersediaannya.",
      },
      { property: "og:title", content: "Pilih Capster — BARBERIN" },
      { property: "og:description", content: "Pilih capster yang ingin melayani Anda." },
    ],
  }),
  component: CapsterPage,
});

function CapsterPage() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const loaderData = Route.useLoaderData();
  const { selectedCapster } = useBarberin();
  const shopSlug = barbershopSlug;
  const [capsters, setCapsters] = useState<Capster[]>(() => {
    if (loaderData && Array.isArray(loaderData) && loaderData.length > 0) {
      return loaderData.map((c: any) => ({
        id: c.id_capster,
        name: c.name,
        role: c.role,
        status: c.status,
      }));
    }
    return [];
  });
  const [loading, setLoading] = useState(capsters.length === 0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (capsters.length > 0) return;
    }

    let mounted = true;
    getCapsters({ data: { onlyCheckedIn: true, slug: shopSlug ?? undefined } })
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
      .catch((err) => {
        console.error("Gagal memuat capster:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [shopSlug]);

  const available = capsters.filter((c) => c.status === "AVAILABLE");
  const selectedUnavailable =
    selectedCapster && !available.some((c) => c.id === selectedCapster.id);

  useEffect(() => {
    if (selectedUnavailable) {
      actions.setCapster(null);
    }
  }, [selectedUnavailable]);

  return (
    <MobileShell>
      <CustomerHeader
        title="Pilih Capster"
        subtitle="Pilih capster yang ingin melayani Anda."
        backTo={shopSlug ? `/customer/services?shop=${shopSlug}` : "/customer/services"}
      />

      <main className="flex-1 space-y-3 px-4 pb-6 pt-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : available.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="Belum ada capster yang bertugas"
            description="Saat ini belum ada capster yang check-in atau sedang aktif bertugas. Silakan tunggu capster memulai shift."
          />
        ) : (
          <>
            {selectedUnavailable ? (
              <ErrorState
                title="Capster tidak tersedia"
                message="Capster yang Anda pilih sudah tidak bertugas. Silakan pilih capster lain."
              />
            ) : null}
            {available.map((capster) => (
              <CapsterCard
                key={capster.id}
                capster={capster}
                selected={selectedCapster?.id === capster.id}
                onSelect={() => actions.setCapster(capster)}
              />
            ))}
          </>
        )}
      </main>

      <BottomActionBar>
        <PrimaryButton
          disabled={!selectedCapster || !!selectedUnavailable}
          onClick={() => navigate({ to: `/${barbershopSlug}/customer/cart` as any })}
        >
          Lanjutkan
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
