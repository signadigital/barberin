import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Sparkles, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { useTenantSlug, getTenantPath } from "@/components/owner/ui";

interface FeatureLockedCardProps {
  featureName: string;
  description: string;
  requiredPlan?: "PRO" | "ENTERPRISE";
  bullets?: string[];
}

export function FeatureLockedCard({
  featureName,
  description,
  requiredPlan = "PRO",
  bullets = [
    "Audit Aktivitas Lengkap & Jejak Audit Finansial",
    "Pemeriksaan Rincian Metode Pembayaran & Selisih Kas Tunai",
    "Manajemen Komisi & Bagi Hasil Capster Otomatis",
    "Katalog Layanan Tanpa Batas & Hingga 5 Akun Capster",
    "Kuota 30 Token Ekspor Data Laporan (CSV/PDF) per Bulan",
  ],
}: FeatureLockedCardProps) {
  const navigate = useNavigate();
  const slug = useTenantSlug();
  const pricingPath = getTenantPath(slug, "/owner/pricing");

  const planLabel = requiredPlan === "ENTERPRISE" ? "Paket Enterprise" : "Paket Pro";
  const planPrice = requiredPlan === "ENTERPRISE" ? "Rp199.000 / bulan" : "Rp99.000 / bulan";

  return (
    <div className="w-full max-w-3xl mx-auto my-8 p-1 sm:p-2">
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-card/90 via-card/50 to-background/90 p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
        {/* Glow ambient background effects */}
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-400 text-xs font-semibold tracking-wide uppercase mb-6">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            Fitur Eksklusif {planLabel}
          </div>

          {/* Icon */}
          <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 shadow-inner mb-6">
            <Lock className="h-9 w-9 text-purple-400" />
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 animate-pulse" />
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-3">
            {featureName}
          </h2>

          {/* Description */}
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mb-8 leading-relaxed">
            {description}
          </p>

          {/* Benefit Box */}
          <div className="w-full max-w-md bg-card/60 border border-border/80 rounded-2xl p-5 mb-8 text-left space-y-2.5">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Keuntungan Menggunakan {planLabel} ({planPrice}):
            </div>
            {bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-xs sm:max-w-md">
            <Link
              to={pricingPath as any}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm sm:text-base shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all flex items-center justify-center gap-2"
            >
              <span>Upgrade ke {planLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground mt-4">
            Proses aktivasi instan melalui verifikasi WhatsApp & redeem kode langganan.
          </p>
        </div>
      </div>
    </div>
  );
}
