import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Scissors, User } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SelectedCapsterCard,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { formatRupiah } from "@/lib/format";
import {
  CAPSTERS,
  CAPSTER_SERVICES,
  capsterActions,
  useCapster,
  type CapsterService,
} from "@/lib/capster-store";
import { getServices } from "@/lib/services";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/manual/detail")({
  head: () => ({
    meta: [
      { title: "Detail Transaksi — Buat Transaksi Manual" },
      {
        name: "description",
        content: "Periksa rincian transaksi sebelum melakukan pembayaran.",
      },
    ],
  }),
  component: ManualTransactionDetailPage,
});

function ManualTransactionDetailPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { manualDraft } = useCapster();

  const [name, setName] = useState(manualDraft.customerName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [resolvedServices, setResolvedServices] = useState<CapsterService[]>(
    () => manualDraft.selectedServices ?? [],
  );
  const [loading, setLoading] = useState(
    manualDraft.selectedServiceIds.length > 0 &&
      (!manualDraft.selectedServices || manualDraft.selectedServices.length === 0),
  );

  useEffect(() => {
    if (manualDraft.selectedServices && manualDraft.selectedServices.length > 0) {
      setResolvedServices(manualDraft.selectedServices);
      setLoading(false);
      return;
    }

    if (manualDraft.selectedServiceIds.length === 0) {
      setResolvedServices([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    getServices({ data: { slug: barbershopSlug } })
      .then((data) => {
        if (!mounted) return;
        const matched: CapsterService[] = data
          .filter((d) => manualDraft.selectedServiceIds.includes(d.id))
          .map((d) => ({
            id: d.id,
            name: d.name,
            price: Number(d.price),
            category: d.durasi_menit ? `${d.durasi_menit} Menit` : "Barbershop",
          }));

        if (matched.length > 0) {
          setResolvedServices(matched);
          capsterActions.setSelectedServices(matched);
        } else {
          const staticMatched = CAPSTER_SERVICES.filter((s) =>
            manualDraft.selectedServiceIds.includes(s.id),
          );
          setResolvedServices(staticMatched);
          if (staticMatched.length > 0) {
            capsterActions.setSelectedServices(staticMatched);
          }
        }
      })
      .catch((err) => {
        console.error("Gagal memuat detail layanan:", err);
        const staticMatched = CAPSTER_SERVICES.filter((s) =>
          manualDraft.selectedServiceIds.includes(s.id),
        );
        setResolvedServices(staticMatched);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [manualDraft.selectedServiceIds, manualDraft.selectedServices]);

  const selectedCapster =
    CAPSTERS.find((c) => c.id === manualDraft.capsterId) ??
    (manualDraft.capsterName
      ? {
          id: manualDraft.capsterId ?? "CAP001",
          name: manualDraft.capsterName,
          role: manualDraft.capsterRole || "Barber",
          status: "AVAILABLE" as const,
        }
      : null);

  const selectedServices =
    resolvedServices.length > 0
      ? resolvedServices
      : (manualDraft.selectedServices ?? []);

  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = 0;
  const total = subtotal - discount;

  const handleNext = () => {
    if (!name.trim()) {
      setNameError("Nama pelanggan wajib diisi");
      return;
    }

    capsterActions.setManualCustomerData({
      name: name.trim(),
      phone: "",
      notes: "",
    });

    navigate({ to: `/${barbershopSlug}/capster/transactions/manual/payment` as any,
    });
  };

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Detail Transaksi"
        backTo={`/${barbershopSlug}/capster/transactions/manual/capster`}
        showBack={true}
        showActions={false}
      />

      <main className="flex-1 space-y-4 px-4 pb-28 pt-3">
        {/* Card Capster Terpilih */}
        {selectedCapster ? (
          <SelectedCapsterCard
            capster={selectedCapster}
            action={
              <button
                type="button"
                onClick={() =>
                  navigate({ to: `/${barbershopSlug}/capster/transactions/manual/capster` as any,
                  })
                }
                className="rounded-[12px] px-2 py-1 text-[13px] font-semibold text-primary-soft transition-colors active:bg-white/10"
              >
                Ganti Capster
              </button>
            }
          />
        ) : (
          <GlassCard className="flex items-center justify-between p-4">
            <div>
              <p className="text-[14px] font-bold text-foreground">
                Capster Belum Dipilih
              </p>
              <p className="text-[12px] text-muted-foreground">
                Silakan pilih capster yang bertugas.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate({ to: `/${barbershopSlug}/capster/transactions/manual/capster` as any,
                })
              }
              className="rounded-[10px] bg-primary px-3 py-1.5 text-[12px] font-bold text-white shadow"
            >
              Pilih Capster
            </button>
          </GlassCard>
        )}

        {/* Card Data Pelanggan */}
        <GlassCard className="space-y-3.5 p-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <User
              className="h-4 w-4 text-primary-soft"
              strokeWidth={2}
            />
            <h2 className="text-[14px] font-bold">
              Data Pelanggan
            </h2>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="customer-name"
                className="flex items-center gap-1 text-[12px] font-medium text-foreground"
              >
                <span>Nama Pelanggan</span>
                <span className="text-danger font-bold">*</span>
              </label>
              <span className="text-[11px] font-medium text-danger/90">Wajib diisi</span>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3 text-muted-foreground">
                <User className="h-4 w-4" strokeWidth={2} />
              </span>

              <input
                id="customer-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Contoh: Ricky Pratama"
                className={`min-h-[44px] w-full rounded-[10px] border ${
                  nameError
                    ? "border-danger focus:ring-danger"
                    : "border-white/16 focus:ring-primary-soft"
                } bg-white/8 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1`}
              />
            </div>

            {nameError && (
              <p className="text-[11px] font-medium text-danger animate-in fade-in duration-150">
                {nameError}
              </p>
            )}
          </div>
        </GlassCard>

        {/* Card Daftar Layanan & Rincian Biaya */}
        <GlassCard className="space-y-3 p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Scissors
                className="h-4 w-4 text-primary-soft"
                strokeWidth={2}
              />

              <h2 className="text-[14px] font-bold">
                Daftar Layanan
              </h2>
            </div>

            <span className="text-[12px] font-medium text-muted-foreground">
              {loading ? "Memuat..." : `${selectedServices.length} Layanan`}
            </span>
          </div>

          {loading ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              Memuat detail layanan...
            </p>
          ) : selectedServices.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-[13px] text-muted-foreground">
                Belum ada layanan yang dipilih.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate({ to: `/${barbershopSlug}/capster/transactions/manual/services` as any,
                  })
                }
                className="rounded-[10px] bg-primary/20 px-3 py-1.5 text-[12px] font-bold text-primary-soft hover:bg-primary/30 transition-colors"
              >
                Pilih Layanan
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="font-medium text-muted-foreground">
                    {service.name}
                  </span>

                  <span className="font-semibold text-foreground">
                    {formatRupiah(service.price)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-white/10 pt-3 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Diskon</span>
              <span>{formatRupiah(discount)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-1 text-[15px]">
              <span className="font-bold text-foreground">
                Total Bayar
              </span>

              <span className="text-[18px] font-extrabold text-primary-soft">
                {formatRupiah(total)}
              </span>
            </div>
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={handleNext}
          disabled={loading || selectedServices.length === 0 || !name.trim()}
        >
          LANJUT KE PEMBAYARAN
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}