import { Sparkles, Layers, ShieldCheck } from "lucide-react";
import {
  MockupTransaksiTerpusat,
  MockupDashboardOwner,
  MockupKomisiTransparan,
  MockupAntreanTeratur,
} from "./MockupVisuals";

export function SolutionSection() {
  const solutions = [
    {
      title: "Transaksi Terpusat",
      description:
        "Catat transaksi dari QR pelanggan maupun input manual Capster dalam satu sistem.",
      mockup: <MockupTransaksiTerpusat />,
    },
    {
      title: "Dashboard Owner",
      description:
        "Pantau transaksi, pendapatan, layanan, dan aktivitas operasional secara real-time.",
      mockup: <MockupDashboardOwner />,
    },
    {
      title: "Komisi Lebih Transparan",
      description:
        "Komisi dihitung dari transaksi yang selesai sesuai persentase yang ditetapkan Owner.",
      mockup: <MockupKomisiTransparan />,
    },
    {
      title: "Antrean Lebih Teratur",
      description:
        "Pelanggan dapat mengajukan layanan melalui QR dan memperoleh estimasi waktu tunggu.",
      mockup: <MockupAntreanTeratur />,
    },
  ];

  return (
    <section id="solusi" className="py-16 sm:py-24 scroll-mt-20 border-t border-slate-800/80 bg-[#070D18]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>03 - Solution</span>
          </div>
          <p className="text-xs sm:text-sm uppercase tracking-wider font-bold text-blue-400 mb-2">
            Bagaimana BARBERIN Membantu?
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Setiap Layanan, Transaksi, dan Komisi Memiliki Catatan yang Jelas.
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-3">
            Solusi digital terintegrasi yang menyatukan alur kerja kasir, antrean pelanggan, dan pengawasan pemilik.
          </p>
        </div>

        {/* 2x2 Feature Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
          {solutions.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-3xl bg-[#0F1D33]/60 border border-slate-800 p-5 sm:p-7 shadow-xl hover:border-slate-700/80 transition-all duration-300"
            >
              {/* Product Visual Mockup Container */}
              <div className="w-full aspect-16/10 rounded-2xl overflow-hidden mb-6 bg-slate-950/60 p-2 sm:p-3 border border-slate-800/80 flex items-center justify-center">
                {item.mockup}
              </div>

              {/* Title & Description */}
              <div className="space-y-2 mt-auto">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
