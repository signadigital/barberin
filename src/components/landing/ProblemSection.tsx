import { Receipt, Calculator, Clock, BarChart3, AlertCircle } from "lucide-react";

export function ProblemSection() {
  const problems = [
    {
      icon: Receipt,
      iconColor: "text-rose-600 bg-rose-50 border-rose-100",
      title: "Apakah Setiap Uang yang Masuk Sudah Tercatat?",
      description:
        "Ketika transaksi masih dicatat secara manual, Owner kesulitan mencocokkan uang yang diterima dengan layanan yang telah diselesaikan.",
    },
    {
      icon: Calculator,
      iconColor: "text-amber-600 bg-amber-50 border-amber-100",
      title: "Apakah Perhitungan Komisi Capster Sudah Jelas?",
      description:
        "Perhitungan manual dapat menimbulkan perbedaan nominal, kesalahan rekap, dan pertanyaan mengenai komisi yang belum dibayarkan.",
    },
    {
      icon: Clock,
      iconColor: "text-blue-600 bg-blue-50 border-blue-100",
      title: "Apakah Pelanggan Tahu Kapan Akan Dilayani?",
      description:
        "Antrean yang tidak teratur membuat pelanggan harus terus bertanya dan Capster kesulitan mengelola urutan layanan.",
    },
    {
      icon: BarChart3,
      iconColor: "text-purple-600 bg-purple-50 border-purple-100",
      title: "Apakah Anda Mengetahui Kondisi Bisnis Tanpa Harus Datang ke Lokasi?",
      description:
        "Tanpa rekap terpusat, Owner perlu memeriksa catatan satu per satu untuk mengetahui pendapatan, transaksi, dan aktivitas operasional.",
    },
  ];

  return (
    <section
      id="problem"
      className="py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 bg-[#F8FAFC] text-slate-800 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>02 - Problem</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0A1424] tracking-tight leading-snug">
            Mengelola Barbershop Seharusnya Tidak Bergantung pada Perkiraan.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-3">
            Tantangan operasional nyata yang dihadapi ratusan pemilik barbershop setiap hari.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {problems.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="group p-6 sm:p-7 rounded-2xl bg-white hover:bg-white border border-slate-200/90 hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${p.iconColor}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-[#0A1424] group-hover:text-blue-600 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
