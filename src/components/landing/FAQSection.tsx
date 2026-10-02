import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

export function FAQSection() {
  const faqs = [
    {
      q: "Apa itu BARBERIN?",
      a: "BARBERIN adalah sistem manajemen barbershop yang membantu Owner, Capster, dan Pelanggan mengelola operasional dalam satu sistem.",
    },
    {
      q: "Apakah BARBERIN bisa digunakan secara gratis?",
      a: "Ya. Paket Gratis tersedia dengan batas penggunaan tertentu.",
    },
    {
      q: "Apakah BARBERIN bisa digunakan oleh lebih dari satu Capster?",
      a: "Ya. Jumlah Capster mengikuti paket yang digunakan.",
    },
    {
      q: "Apakah pelanggan dapat melihat estimasi waktu tunggu?",
      a: "Ya. Estimasi waktu tunggu dapat ditampilkan berdasarkan transaksi aktif dan durasi layanan.",
    },
    {
      q: "Apakah Owner dapat melihat transaksi dan pendapatan?",
      a: "Ya. Owner dapat memantau transaksi, pendapatan, layanan, dan aktivitas operasional melalui dashboard.",
    },
    {
      q: "Bagaimana pelanggan melakukan pemesanan?",
      a: "Pelanggan dapat mengakses halaman barbershop melalui QR dan memilih layanan serta Capster yang tersedia.",
    },
    {
      q: "Apakah Capster dapat melihat komisinya?",
      a: "Ya. Capster dapat melihat informasi komisi sesuai transaksi dan aturan komisi yang ditetapkan Owner.",
    },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 bg-[#070D18] text-slate-100 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>07 - FAQ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-2">
            Jawaban lengkap seputar cara kerja, fitur, dan penggunaan BARBERIN.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {faqs.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#0F1D33] border border-slate-800 overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-bold text-white leading-snug">
                    {item.q}
                  </span>
                  <div
                    className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen
                        ? "rotate-180 bg-blue-600 text-white"
                        : "bg-slate-800/80 text-blue-400"
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3.5 animate-in fade-in duration-150">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
