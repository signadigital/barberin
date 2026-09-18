import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Home } from "lucide-react";

import {
  BottomActionBar,
  CustomerHeader,
  MobileShell,
  PrimaryButton,
  SuccessState,
} from "@/components/barberin/ui";
import { actions } from "@/lib/barberin-store";

export const Route = createFileRoute("/$barbershopSlug/customer/completed")({
  head: () => ({
    meta: [
      { title: "Selesai — BARBERIN" },
      { name: "description", content: "Terima kasih telah menggunakan BARBERIN." },
      { property: "og:title", content: "Selesai — BARBERIN" },
      { property: "og:description", content: "Terima kasih telah menggunakan BARBERIN." },
    ],
  }),
  component: CompletedPage,
});

function CompletedPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();

  return (
    <MobileShell>
      <CustomerHeader title="Selesai" showBack={false} />

      <main className="flex-1 px-4 pb-6">
        <SuccessState title="Selesai" message="Terima kasih telah menggunakan BARBERIN." />
        <p className="mt-4 text-center text-[14px] text-muted-foreground">
          Sampai jumpa kembali di kunjungan berikutnya.
        </p>
      </main>

      <BottomActionBar>
        <PrimaryButton
          onClick={() => {
            actions.reset();
            navigate({ to: `/${barbershopSlug}/customer/services` as any });
          }}
        >
          <Home className="h-4 w-4" strokeWidth={2} /> Kembali ke Home
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
