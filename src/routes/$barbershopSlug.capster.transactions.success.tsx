import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Receipt } from "lucide-react";

import {
  BottomActionBar,
  GlassCard,
  MobileShell,
  PrimaryButton,
  SecondaryButton,
} from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterHeader } from "@/components/capster/ui";
import { formatRupiah, formatTransactionId } from "@/lib/format";
import { useCapster } from "@/lib/capster-store";

export const Route = createFileRoute("/$barbershopSlug/capster/transactions/success")({
  head: () => ({
    meta: [
      { title: "Transaksi Berhasil — BARBERIN Capster" },
      { name: "description", content: "Transaksi manual berhasil dibuat dan disimpan." },
    ],
  }),
  component: ManualTransactionSuccessPage,
});

function ManualTransactionSuccessPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { lastCreatedTransaction, transactions } = useCapster();

  const trx = lastCreatedTransaction ?? transactions[0];

  if (!trx) {
    return (
      <MobileShell>
        <CapsterHeader title="Transaksi" showBack={false} showActions={false} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground">Data transaksi tidak ditemukan.</p>
          <div className="mt-4 w-full max-w-[200px]">
            <PrimaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/transactions` as any })}>
              Kembali ke Daftar
            </PrimaryButton>
          </div>
        </main>
      </MobileShell>
    );
  }

  return (
    <CapsterAuthGuard>
      <MobileShell>
      <CapsterHeader
        title="Transaksi Berhasil!"
        showBack={false}
        showActions={false}
      />

      <main className="flex-1 space-y-5 px-4 pb-28 pt-4">
        {/* Success Icon & Heading */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/20 text-success ring-2 ring-success/40 animate-in zoom-in-75">
            <CheckCircle2 className="h-11 w-11" strokeWidth={2.2} />
          </div>
          <h2 className="text-[22px] font-extrabold text-foreground">Transaksi Berhasil!</h2>
          <p className="font-mono text-[14px] font-bold text-primary-soft">
            #{formatTransactionId(trx.id, trx.date)}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {trx.date} • {trx.time}
          </p>
        </div>

        {/* Info Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="space-y-1.5 border-b border-white/10 pb-2.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-medium text-muted-foreground uppercase tracking-wider">
                Pelanggan
              </span>
              <span className="font-semibold text-primary-soft">
                Capster: {trx.capsterName}
              </span>
            </div>
            <p className="text-[16px] font-bold text-foreground">{trx.customerName}</p>
            <div className="pt-1 space-y-0.5">
              {trx.items.map((item, idx) => (
                <p key={idx} className="text-[13px] text-muted-foreground">
                  • {item.service.name} ({formatRupiah(item.service.price * item.quantity)})
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-[13px] pt-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bayar</span>
              <span className="font-bold text-[15px] text-primary-soft">
                {formatRupiah(trx.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Metode</span>
              <span className="font-semibold uppercase">{trx.paymentMethod}</span>
            </div>
            {trx.paymentMethod === "tunai" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uang Diterima</span>
                  <span className="font-semibold">{formatRupiah(trx.cashReceived ?? trx.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span className="font-bold text-success">
                    {formatRupiah(trx.change ?? 0)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={() =>
            navigate({
              to: `/${barbershopSlug}/capster/transactions/${trx.id}/receipt` as any,
            })
          }
        >
          <Receipt className="h-4 w-4" strokeWidth={2} />
          LIHAT DETAIL
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate({ to: `/${barbershopSlug}/capster/transactions` as any })}>
          KEMBALI KE DAFTAR
        </SecondaryButton>
      </BottomActionBar>
    </MobileShell>
    </CapsterAuthGuard>
  );
}
