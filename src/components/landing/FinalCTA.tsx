import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-16 sm:py-24 border-t border-slate-800/80 bg-[#070D18] relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-600/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-b from-[#0F1D33] to-[#0A1424] border border-blue-500/25 p-8 sm:p-14 text-center shadow-2xl relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-bold mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Transformasi Digital Barbershop Anda</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto">
            Siap Mengelola Barbershop dengan Lebih Teratur?
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mt-4 leading-relaxed">
            Mulai catat transaksi, kelola layanan, pantau pendapatan, dan berikan pengalaman
            yang lebih teratur kepada pelanggan.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8">
            <Link
              to="/owner/register"
              search={{ plan: "basic" }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm sm:text-base font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-xl shadow-blue-600/35 hover:shadow-blue-500/50 transition-all cursor-pointer"
            >
              <span>Mulai Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/owner/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm sm:text-base font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <span>Masuk ke BARBERIN</span>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Paket Gratis tanpa biaya tersembunyi
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Dapat ditingkatkan kapan saja
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
