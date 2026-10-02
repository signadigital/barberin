import { useState } from "react";
import {
  Users,
  Scissors,
  Store,
  UserRound,
  ArrowRight,
  CheckCircle2,
  QrCode,
  Receipt,
  Clock,
  TrendingUp,
  CreditCard,
  Sparkles,
} from "lucide-react";

export function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"pelanggan" | "capster" | "owner">("pelanggan");

  const actorWorkflows = {
    pelanggan: {
      title: "Alur Pelanggan (Customer)",
      subtitle: "Pengalaman booking dan antrean mandiri via scan QR tanpa perlu instalasi aplikasi.",
      steps: [
        {
          num: "1",
          title: "Pilih Layanan & Capster",
          desc: "Pelanggan memindai QR barbershop, memilih layanan cukur atau grooming, serta Capster favorit.",
          icon: QrCode,
        },
        {
          num: "2",
          title: "Pengajuan & Estimasi Waktu",
          desc: "Sistem memberikan nomor antrean otomatis dengan perkiraan waktu tunggu yang transparan.",
          icon: Clock,
        },
        {
          num: "3",
          title: "Selesai & Struk Digital",
          desc: "Setelah layanan selesai, pelanggan menerima struk digital resmi via website / smartphone.",
          icon: Receipt,
        },
      ],
    },
    capster: {
      title: "Alur Capster (Staff)",
      subtitle: "Fokus melayani pelanggan dengan antrean terstruktur dan transparansi komisi.",
      steps: [
        {
          num: "1",
          title: "Check-in Harian",
          desc: "Capster memulai shift kerja di sistem untuk mengaktifkan status ketersediaan kursi.",
          icon: Scissors,
        },
        {
          num: "2",
          title: "Konfirmasi & Proses Layanan",
          desc: "Menerima notifikasi pesanan masuk, memanggil pelanggan, dan menyelesaikan pemotongan rambut.",
          icon: Users,
        },
        {
          num: "3",
          title: "Konfirmasi Bayar & Cek Komisi",
          desc: "Mengonfirmasi pembayaran tunai/QRIS dan melihat bagi hasil komisi otomatis tercatat di akunnya.",
          icon: TrendingUp,
        },
      ],
    },
    owner: {
      title: "Alur Pemilik (Owner)",
      subtitle: "Pengawasan penuh operasional, omzet, dan pembagian komisi dalam satu kendali.",
      steps: [
        {
          num: "1",
          title: "Atur Layanan & Tarif",
          desc: "Menentukan daftar paket layanan cukur, durasi, harga, dan persentase komisi Capster.",
          icon: Store,
        },
        {
          num: "2",
          title: "Kelola Tim & Otoritas",
          desc: "Mendaftarkan akun Capster, memantau kehadiran shift, dan mengevaluasi produktivitas.",
          icon: Users,
        },
        {
          num: "3",
          title: "Pantau Omzet & Keuangan",
          desc: "Melihat laporan pendapatan kotor, transaksi real-time, dan histori audit keuangan kapan pun.",
          icon: CreditCard,
        },
      ],
    },
  };

  const transactionPipeline = [
    { step: "Pelanggan", desc: "Pilih layanan & Capster" },
    { step: "Pengajuan", desc: "Scan QR & masuk antrean" },
    { step: "Capster", desc: "Konfirmasi & eksekusi layanan" },
    { step: "Pembayaran", desc: "Verifikasi tunai / QRIS" },
    { step: "Tercatat", desc: "Omzet & komisi otomatis masuk" },
  ];

  return (
    <section id="cara-kerja" className="py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 bg-[#070D18] text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Users className="h-3.5 w-3.5" />
            <span>05 - Cara Kerja</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Cara Kerja BARBERIN
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-3">
            Sinergi tanpa hambatan antara 3 aktor utama dalam ekosistem barbershop modern.
          </p>
        </div>

        {/* BPMN Transaction Visual Pipeline */}
        <div className="mb-14 p-5 sm:p-7 rounded-3xl bg-[#0F1D33]/90 border border-slate-800 shadow-xl">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Alur Transaksi End-to-End (BPMN Verified)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
            {transactionPipeline.map((p, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between relative group hover:border-blue-500/40 transition-colors"
              >
                <div>
                  <div className="text-[10px] font-mono text-blue-400 font-bold mb-1">
                    Tahap 0{idx + 1}
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{p.step}</div>
                  <div className="text-xs text-slate-400">{p.desc}</div>
                </div>
                {idx < transactionPipeline.length - 1 && (
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                    <ArrowRight className="h-4 w-4 text-blue-500/60" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actor Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("pelanggan")}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "pelanggan"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserRound className="h-4 w-4" />
              <span>Pelanggan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capster")}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "capster"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Scissors className="h-4 w-4" />
              <span>Capster</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("owner")}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "owner"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Owner</span>
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1D33]/60 border border-slate-800 shadow-xl">
          <div className="max-w-2xl mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              {actorWorkflows[activeTab].title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {actorWorkflows[activeTab].subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {actorWorkflows[activeTab].steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="p-5 sm:p-6 rounded-2xl bg-[#070D18]/90 border border-slate-800 space-y-3 relative hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      Langkah {step.num}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">{step.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
