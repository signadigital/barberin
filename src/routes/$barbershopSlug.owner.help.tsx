import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  HelpCircle,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Building2,
  Info,
  ChevronRight,
  Search,
  X,
  Zap,
  MessageSquare,
  ShieldCheck,
  Send,
  Headphones,
  Check,
  ArrowRight,
} from "lucide-react";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  getTenantPath,
} from "@/components/owner/ui";
import { useOwner } from "@/lib/owner-store";
import {
  BARBERIN_SUPPORT_CONTACTS,
  generateWhatsAppSupportUrl,
  WhatsAppIcon,
  type SupportContact,
} from "@/lib/support";

export const Route = createFileRoute("/$barbershopSlug/owner/help")({
  head: () => ({
    meta: [
      { title: "Pusat Bantuan & Panduan Sistem — BARBERIN Owner" },
      {
        name: "description",
        content: "Panduan lengkap operasional dan dukungan resmi WhatsApp BARBERIN.",
      },
    ],
  }),
  component: OwnerHelpPage,
});

interface GuideItem {
  id: string;
  title: string;
  desc: string;
  tag: string;
  href: string;
  sop: string[];
}

function OwnerHelpPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { user } = useOwner();
  const barbershopName =
    user?.barbershopName ||
    (barbershopSlug
      ? String(barbershopSlug)
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : "BARBERIN");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Modal 1: Pilih Kontak WhatsApp
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Modal 2: Transition / Menghubungkan ke WhatsApp
  const [isConnectingModalOpen, setIsConnectingModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SupportContact | null>(null);
  const [generatedWhatsAppUrl, setGeneratedWhatsAppUrl] = useState("");

  // Modal 3: Baca Panduan Modal
  const [activeGuide, setActiveGuide] = useState<GuideItem | null>(null);

  const guides: GuideItem[] = [
    {
      id: "monitoring",
      title: "Monitoring Omzet & Transaksi Realtime",
      desc: "Pelajari cara membaca grafik pendapatan, omzet per metode bayar, dan indikator persentase pertumbuhan harian.",
      tag: "DASHBOARD",
      href: "/owner/dashboard",
      sop: [
        "Akses Dashboard untuk memantau ringkasan omzet harian, transaksi selesai, dan capster yang sedang bertugas.",
        "Gunakan filter periode (Hari Ini, 7 Hari, Bulan Ini, atau Kustom) untuk menganalisis tren pertumbuhan bisnis.",
        "Periksa grafik omzet dan perbandingan metode bayar (Tunai vs QRIS) secara berkala.",
      ],
    },
    {
      id: "shift",
      title: "Manajemen Shift & Transaksi Capster",
      desc: "Pahami relasi shift capster, pembagian transaksi per capster, dan perhitungan otomatis komisi 15%.",
      tag: "CAPSTER & GAJI",
      href: "/owner/gaji",
      sop: [
        "Capster wajib melakukan check-in shift sebelum melayani pelanggan dan membuat transaksi.",
        "Setiap transaksi selesai otomatis terikat pada capster dan menghitung komisi 15% dari omzet layanan.",
        "Owner meninjau permintaan penarikan di menu Gaji & Komisi, menyetujui, dan mengonfirmasi pembayaran.",
      ],
    },
    {
      id: "audit",
      title: "Audit & Kebijakan Pembatalan Pesanan",
      desc: "SOP penanganan order yang dibatalkan oleh pelanggan maupun capster beserta audit trail anti-fraud.",
      tag: "AUDIT KEUANGAN",
      href: "/owner/audit-finance",
      sop: [
        "Setiap pembatalan pesanan wajib mencatat aktor pembatal, timestamp, dan alasan pembatalan.",
        "Lakukan pemeriksaan fisik kas harian di menu Audit Keuangan untuk mencocokkan kas sistem dan fisik.",
        "Selisih kas harian akan tercatat pada rekonsiliasi audit trail keuangan.",
      ],
    },
  ];

  // Filtered guides based on search query
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return guides;
    const q = searchQuery.toLowerCase().trim();
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.desc.toLowerCase().includes(q) ||
        g.tag.toLowerCase().includes(q),
    );
  }, [searchQuery, guides]);

  // Handler: When Owner clicks a contact (Fibula / Nabila)
  const handleSelectContact = (contact: SupportContact) => {
    const url = generateWhatsAppSupportUrl({
      phone: contact.phone,
      barbershopName,
      pageName: "Pusat Bantuan",
    });

    setSelectedContact(contact);
    setGeneratedWhatsAppUrl(url);

    // Switch to connecting modal
    setIsContactModalOpen(false);
    setIsConnectingModalOpen(true);

    // Automatically trigger opening WhatsApp in new tab/window
    try {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error("Gagal membuka window WhatsApp:", e);
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased font-sans">
        {/* Sidebar Desktop */}
        <OwnerSidebar activePath={getTenantPath(barbershopSlug, "/owner/help")} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Mobile & Desktop */}
          <OwnerMobileHeader activePath={getTenantPath(barbershopSlug, "/owner/help")} />
          <OwnerHeader
            searchPlaceholder="Cari panduan..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-28 lg:pb-12 max-w-[1400px] w-full mx-auto">
            {/* Page Header: Temukan Panduan & Dukungan (Matches Wireframe Screenshot) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <span className="text-[11px] font-bold text-blue-400 tracking-wider uppercase">
                  PUSAT BANTUAN
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
                  Temukan Panduan & Dukungan
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Semua yang Anda butuhkan untuk mengelola barbershop dengan lebih mudah.
                </p>
              </div>

              {/* Search Bar Input */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari panduan..."
                  className="w-full pl-10 pr-16 py-2 rounded-xl bg-[#0B1526] border border-slate-800/90 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 pointer-events-none">
                  Ctrl K
                </span>
              </div>
            </div>

            {/* PANDUAN OPERASIONAL CARDS */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredGuides.map((g) => (
                  <div
                    key={g.id}
                    className="bg-[#0E1726]/95 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">
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

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setActiveGuide(g)}
                        className="w-full flex items-center justify-between text-xs text-blue-400 font-semibold hover:text-blue-300 transition-colors cursor-pointer"
                      >
                        <span>Baca Panduan</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredGuides.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">Tidak ada panduan ditemukan</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Coba cari dengan kata kunci lain atau kosongkan kolom pencarian.
                    </p>
                  </div>
                )}
              </div>

              {/* Isolasi Modul Operasional yang Tetap Terjaga */}
              <div className="bg-[#0A1424] border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  <span>Isolasi Modul Operasional yang Tetap Terjaga:</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="font-bold text-white mb-1">Manajemen Capster</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Akun capster, status shift check-in, dan penugasan layanan.
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="font-bold text-white mb-1">Sistem Gaji & Komisi</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Komisi otomatis 15% dari omzet layanan per capster.
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="font-bold text-white mb-1">Audit Aktivitas</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Log transaksi, pembatalan pesanan, dan alasan pembatalan.
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="font-bold text-white mb-1">Audit Keuangan</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Pemeriksaan fisik kas harian dan rekonsiliasi selisih kas.
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: BUTUH BANTUAN LANGSUNG? (SESUAI WIREFRAME SCREENSHOT) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm md:text-base font-bold text-white">
                    Butuh Bantuan Langsung?
                  </h2>
                </div>

                <div className="rounded-[20px] bg-[#0E1726]/95 border border-slate-800/80 p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Icon & Text */}
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20 ring-1 ring-[#25D366]/40">
                      <WhatsAppIcon className="h-7 w-7 fill-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Hubungi Tim BARBERIN
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Respon lebih cepat melalui WhatsApp.
                      </p>
                    </div>
                  </div>

                  {/* Right: Hubungi via WhatsApp Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContact(null);
                      setIsContactModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00A884] hover:bg-[#008f6f] active:scale-[0.98] text-white font-bold text-xs px-5 py-3 transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Hubungi via WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </main>

          <OwnerBottomNav activePath={getTenantPath(barbershopSlug, "/owner/help")} />
        </div>

        {/* ========================================================================= */}
        {/* MODAL 1: PILIH KONTAK WHATSAPP (SCREENSHOT REFERENSI 2 - LEFT MODAL)       */}
        {/* ========================================================================= */}
        {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Icon & Title */}
              <div className="text-center">
                <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/20 text-[#25D366] ring-1 ring-[#25D366]/40 shadow-[0_0_25px_rgba(37,211,102,0.25)]">
                  <WhatsAppIcon className="h-9 w-9 fill-current" />
                </div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Hubungi Tim BARBERIN
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                  Pilih tim yang ingin Anda hubungi melalui WhatsApp.
                </p>
              </div>

              {/* Value Highlights Box */}
              <div className="mt-4 rounded-2xl bg-[#142036]/70 border border-slate-800/80 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-[12px]">Respon lebih cepat</p>
                    <p className="text-[11px] text-slate-400">
                      Dapatkan bantuan langsung dari tim kami.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-[12px]">Konsultasi langsung</p>
                    <p className="text-[11px] text-slate-400">
                      Sampaikan kendala dengan lebih jelas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-[12px]">Jam operasional</p>
                    <p className="text-[11px] text-slate-400">
                      Senin – Sabtu, 08.00 – 17.00 WIB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Options: Fibula & Nabila */}
              <div className="mt-4 space-y-2.5">
                {BARBERIN_SUPPORT_CONTACTS.map((contact) => (
                  <div
                    key={contact.name}
                    className="rounded-xl bg-slate-900/80 border border-slate-800/90 p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                        <WhatsAppIcon className="h-5 w-5 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-white">{contact.name}</p>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                            {contact.role}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          {contact.phoneDisplay}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5 fill-white" />
                      <span>Hubungi {contact.name}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons & Notice */}
              <div className="mt-5 space-y-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Nanti Saja
                </button>
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Tautan akan membuka WhatsApp di aplikasi atau browser Anda.</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: TRANSITION CONNECTING MODAL (SCREENSHOT REFERENSI 2 - RIGHT MODAL) */}
        {/* ========================================================================= */}
        {isConnectingModalOpen && selectedContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl relative text-center space-y-5 animate-in zoom-in-95 duration-150">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsConnectingModalOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Device Graphic / WhatsApp Icon */}
              <div className="relative mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#1E293B]/70 border border-slate-700/60 shadow-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30">
                  <WhatsAppIcon className="h-7 w-7 fill-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-[#0F172A]">
                  <Send className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xl font-extrabold text-white">
                  Menghubungkan ke WhatsApp
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Sedang membuka WhatsApp BARBERIN ke{" "}
                  <strong className="text-white font-semibold">{selectedContact.name}</strong>...
                  Mohon tunggu sebentar.
                </p>
              </div>

              {/* Stepper Progress */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-4">
                <div className="relative flex items-center justify-between">
                  {/* Step 1: Menyiapkan Tautan */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md text-xs font-bold">
                      <Check className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] text-slate-300 font-medium">
                      Menyiapkan tautan
                    </span>
                  </div>

                  {/* Connecting Line 1-2 */}
                  <div className="absolute left-[20%] right-[50%] top-3.5 h-0.5 bg-blue-600" />

                  {/* Step 2: Membuka WhatsApp */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md text-xs font-bold">
                      <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                      <span className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-60" />
                    </div>
                    <span className="text-[10px] text-blue-400 font-bold">
                      Membuka WhatsApp
                    </span>
                  </div>

                  {/* Connecting Line 2-3 */}
                  <div className="absolute left-[50%] right-[20%] top-3.5 h-0.5 bg-slate-700" />

                  {/* Step 3: Selesai */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold">
                      3
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Selesai</span>
                  </div>
                </div>
              </div>

              {/* Fallback Box */}
              <div className="rounded-xl bg-[#142036]/60 border border-slate-800/80 p-3.5 space-y-2 text-xs text-left">
                <div className="flex items-start gap-2 text-slate-300">
                  <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Jika WhatsApp tidak terbuka secara otomatis, silakan klik tombol di bawah ini:
                  </p>
                </div>
                <a
                  href={generatedWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  <span>Buka WhatsApp</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* Close Button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsConnectingModalOpen(false);
                    setIsContactModalOpen(true);
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Pilih Kontak Lain
                </button>
                <button
                  type="button"
                  onClick={() => setIsConnectingModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: BACA PANDUAN MODAL                                              */}
        {/* ========================================================================= */}
        {activeGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg rounded-3xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl relative space-y-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {activeGuide.tag}
                  </span>
                  <h3 className="text-base md:text-lg font-bold text-white mt-1.5">
                    {activeGuide.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveGuide(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p className="text-slate-400 leading-relaxed">{activeGuide.desc}</p>

                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-2">
                  <p className="font-bold text-white text-xs">Langkah & SOP Operasional:</p>
                  <ul className="space-y-1.5">
                    {activeGuide.sop.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveGuide(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Tutup
                </button>
                <a
                  href={getTenantPath(barbershopSlug, activeGuide.href)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                >
                  <span>Buka Halaman {activeGuide.tag}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </OwnerAuthGuard>
  );
}
