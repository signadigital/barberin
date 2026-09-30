import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Check,
  Sparkles,
  Zap,
  Shield,
  CreditCard,
  QrCode,
  Users,
  Scissors,
  FileText,
  Clock,
  ExternalLink,
  KeyRound,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  ArrowRight,
  Lock,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import {
  getOwnerSubscriptionDetails,
  redeemOwnerSubscriptionCode,
  generatePricingWhatsAppUrl,
  PRICING_WHATSAPP_DISPLAY,
} from "@/lib/subscriptions";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/$barbershopSlug/owner/pricing")({
  head: () => ({
    meta: [
      { title: "Paket & Langganan — BARBERIN Owner" },
      {
        name: "description",
        content: "Kelola paket langganan barbershop, nikmati fitur premium, dan redeem kode aktivasi.",
      },
    ],
  }),
  component: OwnerPricingPage,
});

function OwnerPricingPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const res = await getOwnerSubscriptionDetails();
      setData(res);
    } catch (err: any) {
      console.error("Gagal memuat informasi langganan:", err);
      toast.error(err?.message || "Gagal memuat informasi langganan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionData();
  }, [barbershopSlug]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = redeemCodeInput.trim().toUpperCase();
    if (!clean) {
      toast.error("Silakan masukkan kode langganan.");
      return;
    }

    try {
      setIsRedeeming(true);
      const res = await redeemOwnerSubscriptionCode({ data: { code: clean } });
      toast.success(
        `Berhasil! Paket ${res.planName} Anda aktif hingga ${new Date(res.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`,
      );
      setRedeemCodeInput("");
      await loadSubscriptionData();
    } catch (err: any) {
      console.error("Gagal redeem kode:", err);
      toast.error(err?.message || "Kode langganan tidak valid.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const currentPlanName = data?.currentSubscription?.planName || "FREE";

  const getWhatsAppUpgradeUrl = (targetPlan: "PRO" | "ENTERPRISE") => {
    return generatePricingWhatsAppUrl({
      barbershopName: data?.barbershop?.name || "Barbershop",
      slug: data?.barbershop?.slug || barbershopSlug,
      planName: targetPlan,
      ownerName: data?.owner?.name || "Owner",
      email: data?.owner?.email || "",
    });
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased font-sans">
        <OwnerSidebar activePath="/owner/pricing" />

        <div className="flex-1 flex flex-col min-w-0">
          <OwnerMobileHeader
            activePath="/owner/pricing"
            onRefresh={loadSubscriptionData}
            isRefreshing={loading}
          />
          <OwnerHeader onRefresh={loadSubscriptionData} isRefreshing={loading} />

          <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
            {/* Top Banner / Current Status */}
            {data && (
              <div className="relative overflow-hidden rounded-3xl border border-border bg-card/80 p-6 md:p-8 backdrop-blur-xl shadow-xl">
                <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                        Paket Saat Ini
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Status: Aktif
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">
                      {data.currentSubscription.planLabel}
                    </h1>

                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                      {data.currentSubscription.isFree
                        ? "Anda menggunakan paket dasar gratis selamanya. Dapatkan fitur audit, komisi capster, dan kuota tanpa batas dengan upgrade."
                        : `Masa aktif berlaku sampai ${new Date(data.currentSubscription.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} (${data.currentSubscription.remainingDays ?? 0} hari tersisa).`}
                    </p>
                  </div>

                  {/* Usage Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 shrink-0">
                    {/* Capster */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Capster Aktif
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {data.usage.activeCapsters.used} /{" "}
                        {data.usage.activeCapsters.isUnlimited
                          ? "∞"
                          : data.usage.activeCapsters.limit}
                      </div>
                    </div>

                    {/* Cukur Bulanan */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Cukur Bulan Ini
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {data.usage.monthlyCuts.used} /{" "}
                        {data.usage.monthlyCuts.isUnlimited
                          ? "∞"
                          : data.usage.monthlyCuts.limit}
                      </div>
                    </div>

                    {/* Layanan */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Katalog Layanan
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {data.usage.serviceCatalog.used} /{" "}
                        {data.usage.serviceCatalog.isUnlimited
                          ? "∞"
                          : data.usage.serviceCatalog.limit}
                      </div>
                    </div>

                    {/* Token Ekspor */}
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Token Ekspor
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {data.usage.exportTokens.used} /{" "}
                        {data.usage.exportTokens.isUnlimited
                          ? "∞"
                          : data.usage.exportTokens.limit}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Redeem Subscription Code Section */}
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">
                      Redeem Kode Langganan
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                    Punya kode voucher aktivasi atau perpanjangan dari Admin BARBERIN? Masukkan kode di bawah untuk mengaktifkan paket Anda secara instan.
                  </p>
                </div>

                <form
                  onSubmit={handleRedeem}
                  className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto"
                >
                  <input
                    type="text"
                    required
                    value={redeemCodeInput}
                    onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: BARB-PRO-AB12-CD34"
                    className="w-full sm:w-72 px-4 py-2.5 bg-background border border-input rounded-xl text-sm font-mono font-semibold tracking-wider uppercase text-foreground focus:outline-none focus:border-primary shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={isRedeeming}
                    className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isRedeeming ? "Memproses..." : "Redeem Kode"}
                  </button>
                </form>
              </div>
            </div>

            {/* Radiant Header & Visual Inspiration Area */}
            <div className="relative text-center pt-4 pb-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Pilihan Paket
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
                Paket Langganan Fleksibel
              </h2>

              <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto mt-2">
                Pilih paket terbaik yang dirancang khusus untuk mempercepat pertumbuhan dan kemudahan operasional barbershop Anda.
              </p>
            </div>

            {/* 3 PRICING CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch pt-2">
              {/* 1. FREE CARD */}
              <div
                className={`relative flex flex-col justify-between rounded-3xl border p-7 sm:p-8 transition-all bg-card/80 backdrop-blur-xl ${
                  currentPlanName === "FREE"
                    ? "border-blue-500/50 shadow-lg shadow-blue-500/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Scissors className="h-5 w-5" />
                    </div>
                    {currentPlanName === "FREE" && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Digunakan Saat Ini
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground">Paket Gratis</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cocok untuk barbershop mandiri baru yang ingin memulai digitalisasi operasional.
                  </p>

                  <div className="my-6">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      Rp0
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                      / bulan
                    </span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/80 text-xs">
                    <div className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-2">
                      Fitur & Limit:
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Batas Cukur Bulanan: <strong>50 cukur</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Capster Aktif: <strong>1 orang</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Katalog Layanan: <strong>Maks. 4 layanan</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Pemesanan QR Pelanggan & Struk Digital</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Estimasi Antrean Sederhana</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Total Pendapatan Kotor</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Ekspor Data: <strong>2 Token / bulan</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Masa Simpan Data: <strong>14 hari</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground/60 line-through">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span>Audit Metode Pembayaran & Kas Fisik</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground/60 line-through">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span>Sistem Komisi Capster</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground/60 line-through">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span>Log Audit Aktivitas & Keuangan</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 px-4 rounded-xl border border-border bg-muted/40 text-muted-foreground text-xs font-semibold cursor-not-allowed text-center"
                  >
                    {currentPlanName === "FREE" ? "Saat Ini Digunakan" : "Paket Dasar"}
                  </button>
                </div>
              </div>

              {/* 2. PRO CARD (POPULER / EMPHASIS) */}
              <div
                className={`relative flex flex-col justify-between rounded-3xl border-2 p-7 sm:p-8 transition-all bg-gradient-to-b from-purple-950/20 via-card to-card backdrop-blur-2xl shadow-2xl ${
                  currentPlanName === "PRO"
                    ? "border-purple-500 shadow-purple-500/20"
                    : "border-purple-500/60 hover:border-purple-400"
                }`}
              >
                {/* Glowing light beam effect */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-44 h-44 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm">
                      {currentPlanName === "PRO" ? "Paket Saat Ini" : "Paling Populer"}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-foreground">Paket Pro</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solusi lengkap barbershop profesional dengan audit menyeluruh, komisi capster, dan kuota luas.
                  </p>

                  <div className="my-6">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      Rp99.000
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                      / bulan
                    </span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/80 text-xs">
                    <div className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-2">
                      Semua Fitur Free Ditambah:
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Batas Cukur Bulanan: <strong>Tanpa Batas (Unlimited)</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Capster Aktif: <strong>Maks. 5 orang</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Katalog Layanan: <strong>Tanpa Batas</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Estimasi Waktu Antrean: <strong>Dinamis (Live)</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Audit Metode Pembayaran & Selisih Kas Tunai</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Sistem Komisi Capster Otomatis</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Log Audit Aktivitas & Jejak Finansial</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Ekspor Data: <strong>30 Token / bulan</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground font-medium">
                      <Check className="h-4 w-4 text-purple-400 shrink-0 font-bold" />
                      <span>Masa Simpan Data: <strong>30 hari</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  {currentPlanName === "PRO" ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 text-xs font-semibold cursor-not-allowed text-center"
                    >
                      Paket Saat Ini
                    </button>
                  ) : (
                    <a
                      href={getWhatsAppUpgradeUrl("PRO")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm text-center shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Upgrade ke Pro</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* 3. ENTERPRISE CARD */}
              <div
                className={`relative flex flex-col justify-between rounded-3xl border p-7 sm:p-8 transition-all bg-card/80 backdrop-blur-xl ${
                  currentPlanName === "ENTERPRISE"
                    ? "border-amber-500/50 shadow-lg shadow-amber-500/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    {currentPlanName === "ENTERPRISE" && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Paket Saat Ini
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground">Paket Enterprise</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Skala penuh untuk barbershop premium dengan staf tanpa batas dan white-label kustomisasi brand.
                  </p>

                  <div className="my-6">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      Rp199.000
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                      / bulan
                    </span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/80 text-xs">
                    <div className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-2">
                      Semua Fitur Pro Ditambah:
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Capster Aktif: <strong>Tanpa Batas (Unlimited)</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Ekspor Data: <strong>Tanpa Batas (Unlimited)</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Masa Simpan Data: <strong>Tanpa Batas</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-amber-400 shrink-0 font-bold" />
                      <span>Identitas Brand: <strong>Label Putih (White-label)</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Kustomisasi Logo, Favicon, & Nama Brand</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Dukungan Teknis Prioritas</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  {currentPlanName === "ENTERPRISE" ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold cursor-not-allowed text-center"
                    >
                      Paket Saat Ini
                    </button>
                  ) : (
                    <a
                      href={getWhatsAppUpgradeUrl("ENTERPRISE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl bg-card hover:bg-muted border border-border hover:border-primary/50 text-foreground font-bold text-xs sm:text-sm text-center shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <span>Upgrade ke Enterprise</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Riwayat Langganan & Aktivasi (Section 14) */}
            {data?.histories && data.histories.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-bold text-foreground">
                      Riwayat Langganan & Aktivasi
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {data.histories.length} catatan tercatat
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-3">Tanggal</th>
                        <th className="py-3 px-3">Paket</th>
                        <th className="py-3 px-3">Jenis Transisi</th>
                        <th className="py-3 px-3">Masa Berlaku</th>
                        <th className="py-3 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.histories.map((h: any) => (
                        <tr key={h.id_history} className="hover:bg-muted/20">
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                            {new Date(h.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-3 font-bold text-foreground">
                            {h.plan_name}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full font-medium text-[11px] bg-muted text-foreground">
                              {h.jenis === "register_free"
                                ? "Pendaftaran Gratis"
                                : h.jenis === "upgrade"
                                  ? "Upgrade Paket"
                                  : h.jenis === "stacking"
                                    ? "Perpanjangan (Stacking)"
                                    : h.jenis === "expired_to_free"
                                      ? "Kembali ke Free"
                                      : h.jenis}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                            {h.end_date
                              ? new Date(h.end_date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Selamanya (Free)"}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">
                            {h.keterangan || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hubungi Tim BARBERIN Footer Info */}
            <div className="rounded-2xl bg-muted/30 border border-border p-5 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>
                  Ada pertanyaan mengenai paket atau pembayaran manual? Hubungi WhatsApp Resmi BARBERIN di:{" "}
                  <strong className="text-foreground">{PRICING_WHATSAPP_DISPLAY}</strong>
                </span>
              </div>
              <a
                href={`https://wa.me/6281226244941`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0"
              >
                <span>Buka WhatsApp</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </main>

          <OwnerBottomNav activePath="/owner/pricing" />
        </div>
      </div>
    </OwnerAuthGuard>
  );
}
