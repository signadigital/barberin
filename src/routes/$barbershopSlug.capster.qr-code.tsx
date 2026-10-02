import { createFileRoute } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { MobileShell } from "@/components/barberin/ui";
import { CapsterAuthGuard, CapsterBottomNav, CapsterHeader } from "@/components/capster/ui";
import { CustomerQRCodeCard } from "@/components/barberin/CustomerQRCodeCard";
import { useTenantShop } from "@/components/tenant/TenantLogo";

export const Route = createFileRoute("/$barbershopSlug/capster/qr-code")({
  head: () => ({
    meta: [
      { title: "QR Pelanggan — BARBERIN Capster" },
      {
        name: "description",
        content: "QR Code pemesanan mandiri pelanggan barbershop BARBERIN untuk Capster.",
      },
    ],
  }),
  component: CapsterQRCodePage,
});

function CapsterQRCodePage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { shop, branding } = useTenantShop();

  const barbershopName = branding?.nama_brand || shop?.nama_barbershop || "Barbershop";

  return (
    <CapsterAuthGuard>
      <MobileShell>
        <CapsterHeader
          title="QR Pelanggan"
          backTo={`/${barbershopSlug}/capster/dashboard`}
          showBack={true}
          showActions={true}
        />

        <main className="space-y-5 p-4 pb-24">
          {/* Header Description */}
          <div className="rounded-2xl bg-card border border-border p-4 shadow-sm text-card-foreground">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-8 w-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                <QrCode className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Pemesanan Mandiri Pelanggan
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tunjukkan QR Code ini kepada pelanggan yang baru tiba agar mereka dapat memilih layanan dan masuk antrean secara mandiri tanpa menunggu pencatatan manual.
            </p>
          </div>

          {/* Customer QR Code Card */}
          <CustomerQRCodeCard
            barbershopSlug={shop?.slug || barbershopSlug}
            barbershopName={barbershopName}
            logoUrl={branding?.logo_url}
            alamat={shop?.alamat}
            noHp={shop?.no_hp}
          />
        </main>

        <CapsterBottomNav />
      </MobileShell>
    </CapsterAuthGuard>
  );
}
