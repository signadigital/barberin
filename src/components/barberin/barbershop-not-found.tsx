import { Store, ArrowLeft } from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";

export function BarbershopNotFound() {
  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4 text-white font-sans selection:bg-[#E5A65E]/30 selection:text-[#E5A65E]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <BarberinLogo className="h-12 w-12" />
        </div>

        <div className="bg-[#0D1527]/90 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#E5A65E]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Barbershop Tidak Ditemukan
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Barbershop dengan tautan ini tidak tersedia, belum terdaftar, atau sedang dinonaktifkan.
            Pastikan alamat URL barbershop yang Anda tuju sudah benar.
          </p>

          <div className="pt-2 border-t border-slate-800/80">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-sm font-semibold text-white transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Beranda</span>
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          BARBERIN Multi-Tenant Barbershop Platform
        </p>
      </div>
    </div>
  );
}
