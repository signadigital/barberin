import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  HelpCircle,
  BookOpen,
  ExternalLink,
  GitFork,
  Database,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Building2,
  Users,
  Layers,
  Sparkles,
  ShieldAlert,
  Info,
  ChevronRight,
  Workflow,
  Check,
} from "lucide-react";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";

export const Route = createFileRoute("/$barbershopSlug/owner/help")({
  head: () => ({
    meta: [
      { title: "Pusat Bantuan & Arsitektur Sistem — BARBERIN Owner" },
      {
        name: "description",
        content:
          "Dokumentasi resmi alur kerja BPMN dan ERD SaaS Platform BARBERIN.",
      },
    ],
  }),
  component: OwnerHelpPage,
});

function OwnerHelpPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const [activeTab, setActiveTab] = useState<"bpmn" | "erd" | "guides">("bpmn");

  const guides = [
    {
      title: "Monitoring Omzet & Transaksi Realtime",
      desc: "Pelajari cara membaca grafik pendapatan, omzet per metode bayar, dan indikator persentase pertumbuhan harian.",
      tag: "Dashboard",
    },
    {
      title: "Manajemen Shift & Transaksi Capster",
      desc: "Pahami relasi shift capster, pembagian transaksi per capster, dan perhitungan otomatis komisi 15%.",
      tag: "Capster & Gaji",
    },
    {
      title: "Audit & Kebijakan Pembatalan Pesanan",
      desc: "SOP penanganan order yang dibatalkan oleh pelanggan maupun capster beserta audit trail anti-fraud.",
      tag: "Audit Keuangan",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/help" />
      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/help" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-28 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                <Workflow className="h-3.5 w-3.5" />
                <span>Dokumentasi Sistem Otoritatif</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Pusat Bantuan & Panduan Sistem
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Acuan alur kerja berbasis BPMN dan struktur relasi database ERD SaaS Platform BARBERIN.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center bg-[#0B1526] p-1.5 rounded-xl border border-slate-800/90 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("bpmn")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "bpmn"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>BPMN Business Flow</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("erd")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "erd"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>ERD SaaS Platform</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("guides")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "guides"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Panduan Operasional</span>
              </button>
            </div>
          </div>

          {/* TAB 1: BPMN (GAMBAR 1) */}
          {activeTab === "bpmn" && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-gradient-to-r from-blue-950/40 via-[#0E1E38] to-slate-900 border border-blue-500/20 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Business Flow Admin Platform (Gambar 1)</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Alur Lengkap dari Landing Page hingga Aktivasi & Akses Fitur
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Satu Platform, Banyak Bisnis, Pertumbuhan Tanpa Batas — Solusi SaaS untuk Industri Barbershop.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    BPMN Tervalidasi
                  </span>
                </div>
              </div>

              {/* Step 1 & 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <h3 className="text-base font-bold text-white">Landing Page BARBERIN</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Calon pengguna melihat informasi produk, fitur, dan paket langganan.
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>Informasi produk platform modern</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>Daftar lengkap fitur operasional</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>Pilihan paket: <strong>FREE</strong>, <strong>PRO</strong>, <strong>ENTERPRISE</strong></span>
                    </li>
                  </ul>
                </div>

                <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <h3 className="text-base font-bold text-white">Calon Owner / Pengguna</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Tertarik menggunakan BARBERIN untuk barbershop mereka.
                  </p>
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs text-slate-300">
                    Calon Owner memiliki pilihan untuk meminta sesi demonstrasi terlebih dahulu atau langsung melakukan registrasi mandiri.
                  </div>
                </div>
              </div>

              {/* Gateway 3 */}
              <div className="bg-[#0A1424] border border-amber-500/30 rounded-2xl p-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <GitFork className="h-3.5 w-3.5" />
                  <span>3. Decision Gateway: Pilih Aksi</span>
                </div>
                <p className="text-xs text-slate-300">
                  Calon pengguna memilih antara <strong>Minta Demo</strong> (Alur 1) atau <strong>Daftar Akun Baru</strong> (Alur 2).
                </p>
              </div>

              {/* Split Branches */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ALUR 1: MINTA DEMO */}
                <div className="bg-[#0F1D33] border border-slate-800/90 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                    <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 text-xs font-bold">
                      ALUR 1
                    </span>
                    <h3 className="text-lg font-bold text-white">Minta Demo</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                        <span>4. Isi Form Request Demo</span>
                      </div>
                      <p className="text-xs text-slate-400">Calon Owner mengisi form permintaan demo:</p>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                        <div>• Nama lengkap</div>
                        <div>• Email aktif</div>
                        <div>• Nomor kontak / WhatsApp</div>
                        <div>• Nama bisnis (opsional)</div>
                        <div className="col-span-2">• Pesan / Note kebutuhan (opsional)</div>
                      </div>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-xs font-bold text-blue-400">5. Data Tersimpan</div>
                      <p className="text-xs text-slate-400">
                        Sistem menyimpan request demo ke tabel <code className="text-sky-300">demo_request</code> di database.
                      </p>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                      <div className="text-xs font-bold text-blue-400">6. Admin Platform</div>
                      <p className="text-xs text-slate-400">Admin Platform menindaklanjuti demo:</p>
                      <ul className="text-[11px] text-slate-300 space-y-1">
                        <li>• Melihat detail request demo yang masuk</li>
                        <li>• Menghubungi calon pelanggan via telepon/WhatsApp</li>
                        <li>• Menjadwalkan & memandu sesi presentasi sistem</li>
                      </ul>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                      <div className="text-xs font-bold text-blue-400">7. Update Status Request</div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Pending</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Diproses</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Selesai</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">Ditolak</span>
                      </div>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-300">Demo Selesai</div>
                        <p className="text-[11px] text-slate-300">
                          Calon pelanggan mendapat informasi lengkap dan siap bergabung dengan BARBERIN.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ALUR 2: DAFTAR */}
                <div className="bg-[#0F1D33] border border-slate-800/90 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                      ALUR 2
                    </span>
                    <h3 className="text-lg font-bold text-white">Registrasi & Subscription</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-xs font-bold text-emerald-400">4. Registrasi Owner</div>
                      <p className="text-xs text-slate-400">Mengisi Nama, Email, Nomor kontak, dan Password akun Owner.</p>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-xs font-bold text-emerald-400">5. Registrasi Business / Barbershop</div>
                      <p className="text-xs text-slate-400">Mengisi Nama Barbershop, Alamat cabang, dan Profil usaha.</p>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                      <div className="text-xs font-bold text-emerald-400">6. Pilih Plan</div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                        <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                          <div className="font-bold text-white">FREE</div>
                          <div className="text-slate-400">Rp 0</div>
                        </div>
                        <div className="bg-blue-900/30 p-2 rounded border border-blue-700/50">
                          <div className="font-bold text-blue-400">PRO</div>
                          <div className="text-slate-400">Rp 149.000</div>
                        </div>
                        <div className="bg-purple-900/30 p-2 rounded border border-purple-700/50">
                          <div className="font-bold text-purple-400">ENTERPRISE</div>
                          <div className="text-slate-400">Custom</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <div className="text-xs font-bold text-emerald-400">7. Subscription Dibuat</div>
                      <p className="text-xs text-slate-400">
                        Sistem mencatat langganan untuk business (Plan terpilih, status awal, dan periode aktif).
                      </p>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    {/* Decision Perlu Pembayaran */}
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-center">
                      <div className="text-xs font-bold text-amber-400">8. Perlu Pembayaran?</div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="font-bold text-slate-200">Tidak (Paket FREE)</span>
                          <p className="text-slate-400 mt-0.5">Aktivasi Plan instan</p>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="font-bold text-blue-300">Ya (Paket PRO)</span>
                          <p className="text-slate-400 mt-0.5">9. Bayar Subscription</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center text-slate-500">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>

                    <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-300">10. Akses Fitur Aktif</div>
                        <p className="text-[11px] text-slate-300">
                          Business dapat mengakses fitur sesuai Plan_Feature, sistem siap digunakan mengelola operasional.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan Kritis */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-4 sm:p-5 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Info className="h-4 w-4 text-blue-400" />
                  <span>Catatan Penting Alur Bisnis SaaS:</span>
                </div>
                <ul className="space-y-1 text-slate-400 list-disc pl-5">
                  <li>Request demo tidak harus langsung menjadi Owner terdaftar (owner_id nullable).</li>
                  <li>Pembayaran subscription SaaS berbeda dengan pembayaran transaksi layanan barbershop pelanggan.</li>
                  <li>Satu business hanya boleh memiliki satu subscription aktif pada satu periode berjalan.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: ERD (GAMBAR 2) */}
          {activeTab === "erd" && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="bg-gradient-to-r from-purple-950/40 via-[#0E1E38] to-slate-900 border border-purple-500/20 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                    <Database className="h-3.5 w-3.5" />
                    <span>SaaS Platform ERD — Admin Platform (Gambar 2)</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Struktur Basis Data Manajemen SaaS BARBERIN
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Mengelola bisnis, paket, subscription, dan pertumbuhan pengguna tanpa mencampur modul operasional.
                  </p>
                </div>
                <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  8 Entitas Utama
                </span>
              </div>

              {/* 8 Entities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. owner */}
                <div className="bg-[#0F1D33] border border-blue-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : N Business</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">owner</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Menyimpan data pemilik akun / platform customer.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">owner_id (BIGINT, PK)</div>
                      <div>name (VARCHAR)</div>
                      <div className="text-emerald-400">email (VARCHAR, UQ)</div>
                      <div>phone (VARCHAR)</div>
                      <div>password_hash (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 2. business */}
                <div className="bg-[#0F1D33] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : N Subscription</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">business</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Menyimpan data barbershop yang menggunakan sistem.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">business_id (BIGINT, PK)</div>
                      <div className="text-sky-400">owner_id (BIGINT, FK)</div>
                      <div>business_name (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 3. plan */}
                <div className="bg-[#0F1D33] border border-indigo-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : N Plan_Feature</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">plan</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Katalog paket SaaS (FREE, PRO, ENTERPRISE).</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">plan_id (BIGINT, PK)</div>
                      <div className="text-emerald-400">plan_name (VARCHAR, UQ)</div>
                      <div>description (TEXT)</div>
                      <div>price (DECIMAL)</div>
                      <div>billing_period (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 4. feature */}
                <div className="bg-[#0F1D33] border border-pink-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : N Plan_Feature</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">feature</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Menyimpan daftar fitur platform BARBERIN.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">feature_id (BIGINT, PK)</div>
                      <div>feature_name (VARCHAR)</div>
                      <div>description (TEXT)</div>
                      <div>module (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 5. plan_feature */}
                <div className="bg-[#0F1D33] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                        JUNCTION
                      </span>
                      <span className="text-[11px] text-slate-400">M : N Mapping</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">plan_feature</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Relasi many-to-many hak akses fitur paket.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">plan_feature_id (BIGINT, PK)</div>
                      <div className="text-sky-400">plan_id (BIGINT, FK)</div>
                      <div className="text-sky-400">feature_id (BIGINT, FK)</div>
                    </div>
                  </div>
                </div>

                {/* 6. subscription */}
                <div className="bg-[#0F1D33] border border-violet-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : N Payment</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">subscription</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Riwayat langganan business terhadap paket.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">subscription_id (BIGINT, PK)</div>
                      <div className="text-sky-400">business_id (BIGINT, FK)</div>
                      <div className="text-sky-400">plan_id (BIGINT, FK)</div>
                      <div>status (ENUM)</div>
                      <div>start_date (DATETIME)</div>
                      <div>end_date (DATETIME)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 7. subscription_payment */}
                <div className="bg-[#0F1D33] border border-rose-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">Invoice SaaS</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">subscription_payment</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Pembayaran langganan platform ke BARBERIN.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">subscription_payment_id (PK)</div>
                      <div className="text-sky-400">subscription_id (BIGINT, FK)</div>
                      <div>amount (DECIMAL)</div>
                      <div>payment_method (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div>payment_date (DATETIME)</div>
                      <div className="text-emerald-400">reference_id (VARCHAR, UQ)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>

                {/* 8. demo_request */}
                <div className="bg-[#0F1D33] border border-yellow-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                        TABLE
                      </span>
                      <span className="text-[11px] text-slate-400">1 : 0..N Owner</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">demo_request</h3>
                    <p className="text-[11px] text-slate-400 mb-3">Permintaan demo dari calon klien / pelanggan.</p>
                    <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-amber-400">demo_request_id (BIGINT, PK)</div>
                      <div className="text-sky-400">owner_id (BIGINT, FK NULL)</div>
                      <div>name, email, phone (VARCHAR)</div>
                      <div>business_name (VARCHAR)</div>
                      <div>status (ENUM)</div>
                      <div>notes (TEXT)</div>
                      <div className="text-slate-500">created_at, updated_at</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cardinality Table (Bagian D Gambar 2) */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-blue-400" />
                  <span>D. Ringkasan Relationship & Cardinality (Gambar 2)</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-300 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Relasi Antar Entitas</th>
                        <th className="p-3 text-center">Kardinalitas</th>
                        <th className="p-3">Keterangan Bisnis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Owner → Business</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Owner dapat memiliki satu atau beberapa Business/Barbershop.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Business → Subscription</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Business memiliki banyak riwayat Subscription.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Plan → Subscription</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Plan dapat digunakan oleh banyak Business.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Plan → Plan_Feature</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Plan memiliki banyak relasi Plan_Feature.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Feature → Plan_Feature</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Feature dapat dimiliki banyak Plan melalui Plan_Feature.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Subscription → Subscription_Payment</td>
                        <td className="p-3 text-center font-mono text-blue-400">1 : N</td>
                        <td className="p-3 text-slate-400">Satu Subscription dapat memiliki banyak pembayaran perpanjangan.</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">Owner → Demo_Request</td>
                        <td className="p-3 text-center font-mono text-amber-400">1 : 0..N</td>
                        <td className="p-3 text-slate-400">Demo Request dapat berasal dari Owner terdaftar (opsional).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATIONAL GUIDES */}
          {activeTab === "guides" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {guides.map((g, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {g.tag}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug">
                        {g.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {g.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-400 font-semibold">
                      <span>Baca Panduan</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Module Boundary Assurance */}
              <div className="bg-[#0A1424] border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  <span>Isolasi Modul Operasional yang Tetap Terjaga:</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-white mb-1">Manajemen Capster</div>
                    <div className="text-slate-400 text-[11px]">Akun capster, status shift check-in, dan penugasan layanan.</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-white mb-1">Sistem Gaji & Komisi</div>
                    <div className="text-slate-400 text-[11px]">Komisi otomatis 15% dari omzet layanan per capster.</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-white mb-1">Audit Aktivitas</div>
                    <div className="text-slate-400 text-[11px]">Log transaksi, pembatalan pesanan, dan alasan pembatalan.</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-white mb-1">Audit Keuangan</div>
                    <div className="text-slate-400 text-[11px]">Pemeriksaan fisik kas harian dan rekonsiliasi selisih kas.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/help" />
      </div>
    </div>
  );
}
