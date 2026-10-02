import {
  Scissors,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  QrCode,
  DollarSign,
  User,
  Sparkles,
  Smartphone,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

/**
 * 1. Mockup Transaksi Terpusat (POS / Layanan / QR Input)
 */
export function MockupTransaksiTerpusat() {
  return (
    <div className="w-full h-full bg-[#0A1322] rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xl">
      {/* Header POS */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">Terminal Kasir & QR</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          #TRX-8821
        </span>
      </div>

      {/* Services List Preview */}
      <div className="space-y-2 py-3">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Gentleman Haircut + Wash</div>
              <div className="text-[10px] text-slate-400">Capster: Dimas • 45 Menit</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400">Rp65.000</div>
            <div className="text-[9px] text-slate-500">Input Manual</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Beard Grooming & Hot Towel</div>
              <div className="text-[10px] text-slate-400">Capster: Dimas • 20 Menit</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400">Rp35.000</div>
            <div className="text-[9px] text-blue-400 font-medium">QR Pelanggan</div>
          </div>
        </div>
      </div>

      {/* Footer Total */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400">Total Transaksi</span>
          <div className="text-sm sm:text-base font-extrabold text-white">Rp100.000</div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Tercatat Otomatis</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Mockup Dashboard Owner (Monitoring Pendapatan, Layanan, Aktivitas)
 */
export function MockupDashboardOwner() {
  return (
    <div className="w-full h-full bg-[#0A1322] rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-[11px] text-slate-400 font-medium">Total Omzet Hari Ini</span>
          <div className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-1.5">
            <span>Rp1.850.000</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              +18%
            </span>
          </div>
        </div>
        <div className="h-8 w-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
          <TrendingUp className="h-4 w-4" />
        </div>
      </div>

      {/* Visual Chart Bars Mockup */}
      <div className="py-3">
        <div className="flex items-end justify-between gap-1.5 h-20 pt-2 px-1">
          {[40, 65, 55, 80, 70, 95, 85].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-sm transition-all ${
                  i === 5
                    ? "bg-gradient-to-t from-blue-600 to-blue-400 shadow-md shadow-blue-500/20"
                    : "bg-slate-700/60 hover:bg-slate-600"
                }`}
              />
              <span className="text-[9px] text-slate-500 font-mono">
                {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400">Total Transaksi</div>
          <div className="text-xs font-bold text-white">28 Selesai</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400">Capster Aktif</div>
          <div className="text-xs font-bold text-white">4 Bertugas</div>
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Mockup Komisi Lebih Transparan (Perhitungan Otomatis & Terverifikasi)
 */
export function MockupKomisiTransparan() {
  return (
    <div className="w-full h-full bg-[#0A1322] rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xl">
      {/* Header Komisi */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Bagi Hasil Transparan</div>
            <div className="text-[10px] text-slate-400">Aturan: 50% Layanan Selesai</div>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Tervalidasi
        </span>
      </div>

      {/* Capster Payout List */}
      <div className="space-y-2 py-3">
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px] flex items-center justify-center">
              AD
            </div>
            <div>
              <div className="text-xs font-bold text-white">Agus Dharma</div>
              <div className="text-[10px] text-slate-400">8 Layanan • Omzet: Rp480k</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 font-mono">Rp240.000</div>
            <div className="text-[9px] text-slate-400">Komisi Hari Ini</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] flex items-center justify-center">
              RF
            </div>
            <div>
              <div className="text-xs font-bold text-white">Rian Fahri</div>
              <div className="text-[10px] text-slate-400">6 Layanan • Omzet: Rp360k</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 font-mono">Rp180.000</div>
            <div className="text-[9px] text-slate-400">Komisi Hari Ini</div>
          </div>
        </div>
      </div>

      {/* Audit Guarantee Note */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5 text-blue-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Bebas Selisih Perhitungan Manual</span>
        </div>
        <span className="font-mono text-slate-500">Audit Otomatis</span>
      </div>
    </div>
  );
}

/**
 * 4. Mockup Antrean Lebih Teratur (QR Customer, Estimasi Live, Nomor Antrean)
 */
export function MockupAntreanTeratur() {
  return (
    <div className="w-full h-full bg-[#0A1322] rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xl">
      {/* Header Queue */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Live Queue Monitor</div>
            <div className="text-[10px] text-slate-400">Pemesanan via Scan QR</div>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          Real-time
        </span>
      </div>

      {/* Current Queue Box */}
      <div className="py-3">
        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-blue-300 font-medium">Nomor Antrean Anda</div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-wider">A-07</div>
            <div className="text-[10px] text-slate-400">Sedang dilayani: A-05 & A-06</div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-amber-400 font-bold text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>~12 Menit</span>
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Estimasi Tunggu</div>
            <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
              Capster Siap
            </span>
          </div>
        </div>
      </div>

      {/* Footer Benefits */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1 text-slate-300">
          <Smartphone className="h-3.5 w-3.5 text-blue-400" />
          Pelanggan tidak perlu menunggu tanpa kepastian
        </span>
      </div>
    </div>
  );
}
