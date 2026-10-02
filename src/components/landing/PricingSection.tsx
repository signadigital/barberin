import { Link } from "@tanstack/react-router";
import { Check, ArrowRight, Zap, Shield, Sparkles } from "lucide-react";

export function PricingSection() {
  const plans = [
    {
      id: "basic",
      name: "GRATIS",
      price: "Rp0",
      period: "/ bulan",
      description: "Mulai digitalisasi operasional barbershop Anda dengan fitur dasar.",
      isPopular: false,
      ctaLabel: "Mulai Gratis",
      ctaPlan: "basic",
      features: [
        "Maksimal 50 transaksi per bulan",
        "1 akun Capster",
        "Maksimal 4 layanan",
        "Pemesanan layanan melalui QR",
        "Struk digital",
        "Total pendapatan kotor",
        "Penyimpanan data: 2 minggu",
        "2 token export PDF/CSV",
      ],
    },
    {
      id: "pro",
      name: "PRO",
      price: "Rp99rb",
      period: "/ bulan",
      description: "Cocok untuk barbershop berkembang dengan tim Capster aktif.",
      isPopular: true,
      popularBadge: "Paling Populer",
      ctaLabel: "Mulai Pro",
      ctaPlan: "pro",
      features: [
        "Transaksi tanpa batas",
        "Maksimal 5 Capster aktif",
        "Layanan tanpa batas",
        "Pemesanan layanan melalui QR",
        "Struk digital",
        "Total pendapatan kotor",
        "Estimasi waktu tunggu dinamis (Live)",
        "Audit metode pembayaran",
        "Penyimpanan data: sekitar 30 hari",
        "30 token export PDF/CSV",
      ],
    },
    {
      id: "enterprise",
      name: "ENTERPRISE",
      price: "Rp199rb",
      period: "/ bulan",
      description: "Solusi terlengkap untuk barbershop berskala besar dan multi-cabang.",
      isPopular: false,
      ctaLabel: "Mulai Enterprise",
      ctaPlan: "enterprise",
      features: [
        "Transaksi tanpa batas",
        "Capster tanpa batas",
        "Layanan tanpa batas",
        "Pemesanan layanan melalui QR",
        "Struk digital",
        "Total pendapatan kotor",
        "Estimasi waktu tunggu dinamis (Live)",
        "Audit metode pembayaran",
        "Penyimpanan data tanpa batas",
        "Export PDF/CSV tanpa batas",
      ],
    },
  ];

  return (
    <section id="harga" className="py-16 sm:py-24 scroll-mt-20 bg-[#F8FAFC] text-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <Zap className="h-3.5 w-3.5" />
            <span>06 - Offer / Harga</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0A1424] tracking-tight leading-snug">
            Kelola Barbershop Lebih Teratur Tanpa Biaya di Awal.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-3">
            Pilih paket yang paling sesuai dengan skala usaha dan jumlah Capster di barbershop Anda.
          </p>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-8 transition-all duration-300 ${
                plan.isPopular
                  ? "bg-white border-2 border-blue-600 shadow-xl shadow-blue-500/10 lg:-translate-y-2 ring-1 ring-blue-600/20"
                  : "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md shadow-blue-600/30">
                    <Sparkles className="h-3 w-3" />
                    {plan.popularBadge}
                  </span>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-5">
                  <h3 className="text-lg font-extrabold text-[#0A1424] tracking-wider uppercase">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 min-h-[32px]">{plan.description}</p>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-slate-100">
                  <span className="text-3xl sm:text-4xl font-black text-[#0A1424] tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">
                    {plan.period}
                  </span>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Fitur yang didapatkan:
                  </div>
                  {plan.features.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          plan.isPopular
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                      <span className="leading-snug">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/owner/register"
                  search={{ plan: plan.ctaPlan }}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    plan.isPopular
                      ? "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-600/25"
                      : "bg-white hover:bg-slate-50 text-[#0A1424] border border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <span>{plan.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
