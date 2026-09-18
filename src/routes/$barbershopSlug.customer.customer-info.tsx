import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, User } from "lucide-react";
import { useState } from "react";

import {
  BottomActionBar,
  CustomerHeader,
  GlassCard,
  MobileShell,
  PrimaryButton,
} from "@/components/barberin/ui";
import { actions, useBarberin } from "@/lib/barberin-store";
import { getOrCreateCustomer } from "@/lib/bookings";
import { formatCustomerId } from "@/lib/format";

export const Route = createFileRoute("/$barbershopSlug/customer/customer-info")({
  head: () => ({
    meta: [
      { title: "Informasi Pelanggan — BARBERIN" },
      {
        name: "description",
        content: "Masukkan nama Anda, ID pelanggan BARBERIN dibuat otomatis oleh sistem.",
      },
      { property: "og:title", content: "Informasi Pelanggan — BARBERIN" },
      { property: "og:description", content: "ID pelanggan dibuat otomatis oleh sistem." },
    ],
  }),
  component: CustomerInfoPage,
});

function CustomerInfoPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { customerName, customerId } = useBarberin();
  const [name, setName] = useState(customerName);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await getOrCreateCustomer({
        data: { name: trimmed },
      });
      actions.setCustomer(res.name, res.customerId);
      setCreating(false);
      navigate({ to: `/${barbershopSlug}/customer/payment` as any });
    } catch (err) {
      console.error("Gagal membuat data pelanggan:", err);
      setError("Terjadi kesalahan saat memproses data pelanggan. Silakan coba lagi.");
      setCreating(false);
    }
  };

  return (
    <MobileShell>
      <CustomerHeader
        title="Informasi Pelanggan"
        subtitle="Langkah 3 dari 5"
        backTo={`/${barbershopSlug}/customer/cart`}
      />

      <main className="flex-1 space-y-4 px-4 pb-6 pt-4">
        <GlassCard className="space-y-4">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Masukkan nama Anda untuk digunakan sebagai ID pelanggan dan pengiriman struk.
          </p>
          <div>
            <label htmlFor="nama" className="mb-2 block text-[14px] font-semibold">
              Nama Lengkap <span className="text-danger">*</span>
            </label>
            <input
              id="nama"
              type="text"
              inputMode="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Contoh: Andi Pratama"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "nama-error" : undefined}
              className="min-h-[48px] w-full rounded-[12px] border border-white/16 bg-white/8 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70"
            />
            {error ? (
              <p id="nama-error" role="alert" className="mt-2 text-[13px] font-medium text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-soft" strokeWidth={2} />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            ID pelanggan akan dibuat otomatis oleh sistem setelah nama Anda tersimpan.
            {customerId ? (
              <>
                {" "}
                ID Anda: <span className="font-mono font-semibold text-foreground">{formatCustomerId(customerId)}</span>
              </>
            ) : null}
          </p>
        </GlassCard>
      </main>

      <BottomActionBar>
        <PrimaryButton onClick={submit} loading={creating}>
          {creating ? (
            "Membuat ID pelanggan..."
          ) : (
            <>
              <User className="h-4 w-4" strokeWidth={2} /> Lanjutkan
            </>
          )}
        </PrimaryButton>
      </BottomActionBar>
    </MobileShell>
  );
}
