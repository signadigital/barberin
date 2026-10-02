import { AlertTriangle, TrendingDown, Info, ShieldAlert, XCircle } from "lucide-react";

export function ImpactSection() {
  const impacts = [
    {
      text: "Pendapatan sulit dicocokkan dengan transaksi yang sebenarnya.",
      desc: "Uang tunai di laci dan pembayaran QRIS kerap berbeda dengan jumlah layanan yang terlaksana di kursi cukur.",
    },
    {
      text: "Perbedaan perhitungan komisi dapat memicu perselisihan.",
      desc: "Ketidakjelasan persentase dan rekap harian dapat menciptakan ketidaknyamanan antara Owner dan tim Capster.",
    },
    {
      text: "Pembatalan dan pembayaran sulit ditelusuri jika tidak memiliki catatan.",
      desc: "Tanpa jejak audit transaksi, sulit mengetahui kapan dan mengapa suatu pesanan dibatalkan atau belum lunas.",
    },
    {
      text: "Owner kesulitan mengambil keputusan berdasarkan kondisi bisnis yang aktual.",
      desc: "Menambah Capster baru atau membuka cabang menjadi spekulasi berisiko tanpa metrik performa yang akurat.",
    },
  ];

  return (
    <section
      id="impact"
      className="py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 bg-[#070D18] text-slate-100 transition-colors"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-3">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>03 - Impact</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Ketika Pencatatan Tidak Jelas, Pengawasan Bisnis Menjadi Lebih Sulit.
          </h2>
        </div>

        {/* Impact List */}
        <div className="space-y-3.5">
          {impacts.map((item, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl bg-[#0F1D33]/90 border border-slate-800/90 flex items-start gap-4 shadow-md transition-all hover:border-slate-700"
            >
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  {item.text}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Operational Note */}
        <div className="mt-8 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-300">Catatan:</strong> Dampak di atas merupakan risiko operasional
            yang hendak ditangani BARBERIN, bukan klaim bahwa semua barbershop atau Capster mengalami kecurangan.
          </p>
        </div>
      </div>
    </section>
  );
}
