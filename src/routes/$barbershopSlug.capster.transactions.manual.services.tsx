import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { capsterActions, useCapster } from "@/lib/capster-store";
import { getServices } from "@/lib/services";

type Service = {
  id: string;
  name: string;
  category: string;
  price: string;
  status: "active" | "inactive" | "suspended";
};

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/manual/services")({
  head: () => ({
    meta: [
      { title: "Pilih Layanan — Buat Transaksi Manual" },
      {
        name: "description",
        content: "Pilih satu atau lebih layanan untuk transaksi manual.",
      },
    ],
  }),
  component: ManualSelectServicesPage,
});

function ManualSelectServicesPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { manualDraft } = useCapster();

  const [search, setSearch] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getServices({ data: { slug: barbershopSlug } })
      .then((data) => {
        const mapped: Service[] = data.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.durasi_menit ? `${d.durasi_menit} Menit` : "Barbershop",
          price: String(d.price),
          status: d.status,
        }));
        setServices(mapped);
      })
      .catch((err) => {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data layanan.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const selectedIds = manualDraft.selectedServiceIds;

  const filtered = services.filter(
    (service) =>
      service.status === "active" &&
      (service.name.toLowerCase().includes(search.toLowerCase()) ||
        service.category.toLowerCase().includes(search.toLowerCase())),
  );

  const selectedServices = services.filter((service) =>
    selectedIds.includes(service.id),
  );

  const totalAmount = selectedServices.reduce(
    (sum, service) => sum + Number(service.price),
    0,
  );

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Pilih Layanan"
        backTo={`/${barbershopSlug}/capster/transactions`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-3 px-4 pb-28 pt-3">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-muted-foreground">
            <Search className="h-4 w-4" strokeWidth={2} />
          </span>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari layanan..."
            className="min-h-[46px] w-full rounded-[12px] border border-white/16 bg-white/8 pl-10 pr-4 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        {/* Loading */}
        {loading && (
          <GlassCard className="p-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              Memuat layanan...
            </p>
          </GlassCard>
        )}

        {/* Error */}
        {!loading && error && (
          <GlassCard className="p-6 text-center">
            <p className="text-[14px] font-bold text-destructive">
              Gagal memuat layanan
            </p>

            <p className="mt-2 text-[12px] text-muted-foreground">
              {error}
            </p>
          </GlassCard>
        )}

        {/* Services List */}
        {!loading && !error && (
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-[13px] text-muted-foreground">
                  Layanan tidak ditemukan.
                </p>
              </GlassCard>
            ) : (
              filtered.map((service) => {
                const isSelected = selectedIds.includes(service.id);

                return (
                  <button
                    key={service.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      capsterActions.toggleManualService({
                        id: service.id,
                        name: service.name,
                        price: Number(service.price),
                        category: service.category,
                      })
                    }
                    className="w-full text-left transition-all active:scale-[0.99]"
                  >
                    <GlassCard
                      className={cn(
                        "flex items-center justify-between gap-3 p-3.5 transition-all",
                        isSelected &&
                          "border-primary-soft bg-primary/15 ring-1 ring-primary-soft/60",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Checkbox */}
                        <div
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-white"
                              : "border-white/30 bg-white/5",
                          )}
                        >
                          {isSelected ? (
                            <Check
                              className="h-4 w-4"
                              strokeWidth={3}
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-foreground">
                            {service.name}
                          </p>

                          <p className="truncate text-[12px] text-muted-foreground">
                            {service.category}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-[14px] font-bold text-primary-soft">
                        {formatRupiah(Number(service.price))}
                      </span>
                    </GlassCard>
                  </button>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Summary */}
      <BottomActionBar>
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-medium text-muted-foreground">
            Total {selectedIds.length} Layanan
          </span>

          <span className="text-[18px] font-extrabold text-primary-soft">
            {formatRupiah(totalAmount)}
          </span>
        </div>

        <PrimaryButton
          disabled={loading || !!error || selectedIds.length === 0}
          onClick={() => {
            capsterActions.setSelectedServices(
              selectedServices.map((s) => ({
                id: s.id,
                name: s.name,
                price: Number(s.price),
                category: s.category,
              })),
            );
            navigate({ to: `/${barbershopSlug}/capster/transactions/manual/capster` as any,
            });
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