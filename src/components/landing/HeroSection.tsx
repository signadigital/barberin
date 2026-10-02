import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  Scissors,
} from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden bg-[#070D18] text-slate-100 scroll-mt-24"
    >
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[300px] h-[250px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold tracking-wide shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-ping" />
              <Scissors className="h-3.5 w-3.5" />
              <span>Sistem Manajemen Barbershop</span>
            </div>

            {/* Main H1 */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Apakah Anda Benar-Benar Tahu ke Mana Uang Barbershop Anda Pergi?
            </h1>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Transaksi tidak tercatat, komisi sulit diperiksa, dan antrean tidak teratur?
              Kelola seluruh operasional barbershop dalam satu sistem yang transparan dan
              mudah dipantau.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Link
                to="/owner/register"
                search={{ plan: "basic" }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 cursor-pointer"
              >
                <span>Mulai Gratis</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#solusi"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all duration-200 cursor-pointer"
              >
                <span>Lihat Fitur</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Tanpa Kartu Kredit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Paket Gratis Selamanya</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Setup Cepat 2 Menit</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Product */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Outer decorative halo */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-purple-600/30 blur-xl opacity-60" />

              {/* Main Image Card */}
              <div className="relative rounded-3xl bg-[#0F1D33] border border-slate-700/80 p-2 sm:p-3 shadow-2xl overflow-hidden group">
                <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-slate-900">
                  <img
                    src="/hero-barbershop.jpg"
                    alt="Operasional Modern Barbershop BARBERIN"
                    className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  {/* Floating Stat 1: Live Antrean */}
                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4 p-2.5 sm:p-3 rounded-2xl bg-[#070D18]/85 backdrop-blur-md border border-slate-700/90 shadow-xl flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-500">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Antrean Berjalan</div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>3 Pelanggan</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      </div>
                    </div>
                  </div>

                  {/* Floating Stat 2: Omzet Real-time */}
                  <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-2.5 sm:p-3 rounded-2xl bg-[#070D18]/85 backdrop-blur-md border border-slate-700/90 shadow-xl flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-500">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Omzet Hari Ini</div>
                      <div className="text-xs font-bold text-white">Rp1.850.000</div>
                    </div>
                  </div>
                </div>

                {/* Subtitle Caption */}
                <div className="pt-2.5 pb-1 text-center">
                  <p className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                    <span>Satu sistem untuk Owner, Capster, dan Pelanggan.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
