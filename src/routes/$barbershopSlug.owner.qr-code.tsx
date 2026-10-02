import { createFileRoute } from "@tanstack/react-router";
import { QrCode, Store } from "lucide-react";
import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  OwnerAuthGuard,
} from "@/components/owner/ui";
import { CustomerQRCodeCard } from "@/components/barberin/CustomerQRCodeCard";
import { useTenantShop } from "@/components/tenant/TenantLogo";

export const Route = createFileRoute("/$barbershopSlug/owner/qr-code")({
  head: () => ({
    meta: [
      { title: "QR Pelanggan — BARBERIN Owner" },
      {
        name: "description",
        content: "QR Code pemesanan mandiri pelanggan barbershop BARBERIN.",
      },
    ],
  }),
  component: OwnerQRCodePage,
});

function OwnerQRCodePage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { shop, branding } = useTenantShop();

  const barbershopName = branding?.nama_brand || shop?.nama_barbershop || "Barbershop";

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background flex text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Desktop Sidebar */}
        <OwnerSidebar activePath={`/${barbershopSlug}/owner/qr-code`} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <OwnerHeader />
          <OwnerMobileHeader activePath={`/${barbershopSlug}/owner/qr-code`} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6 pb-24 lg:pb-12">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                  <span>Operasional</span>
                  <span>›</span>
                  <span className="text-primary font-semibold">QR Pelanggan</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    QR Pelanggan
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Tampilkan atau cetak QR Code agar pelanggan dapat langsung memesan layanan dari smartphone tanpa perlu login.
                </p>
              </div>
            </div>

            {/* Core QR Code Card with Download, Print, and Copy Link */}
            <CustomerQRCodeCard
              barbershopSlug={shop?.slug || barbershopSlug}
              barbershopName={barbershopName}
              logoUrl={branding?.logo_url}
              alamat={shop?.alamat}
              noHp={shop?.no_hp}
            />
          </main>

          {/* Mobile Bottom Navigation */}
          <OwnerBottomNav activePath={`/${barbershopSlug}/owner/qr-code`} />
        </div>
      </div>
    </OwnerAuthGuard>
  );
}
