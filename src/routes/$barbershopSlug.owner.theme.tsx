import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import {
  Palette,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Layers,
  History,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Tag,
  Search,
  ExternalLink,
  X,
  FileCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  OwnerAuthGuard,
} from "@/components/owner/ui";
import {
  getOwnerBranding,
  saveOwnerBranding,
  getOwnerBrandingHistories,
  COLOR_PRESETS,
  type BrandingTheme,
  type BrandingStatus,
  type ColorPreset,
} from "@/lib/branding-domains";
import { BPMNViewer } from "@/components/bpmn/bpmn-viewer";

export const Route = createFileRoute("/$barbershopSlug/owner/theme")({
  head: () => ({
    meta: [
      { title: "White Labeling & Tema — BARBERIN Owner" },
      {
        name: "description",
        content: "Kustomisasi branding, warna, logo, dan identitas visual website barbershop.",
      },
    ],
  }),
  component: OwnerWhiteLabelingPage,
});

function OwnerWhiteLabelingPage() {
  const { barbershopSlug } = (Route as any).useParams();

  // Form states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [namaBrand, setNamaBrand] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<BrandingTheme>("default");
  const [displayMode, setDisplayMode] = useState<"dark" | "light">("dark");
  const [selectedColorKey, setSelectedColorKey] = useState("purple");
  const [hideBarberinBrand, setHideBarberinBrand] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [brandingStatus, setBrandingStatus] = useState<BrandingStatus>("draft");

  // Modals
  const [showBpmnModal, setShowBpmnModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [histories, setHistories] = useState<any[]>([]);
  const [loadingHistories, setLoadingHistories] = useState(false);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getOwnerBranding();
      if (data) {
        setNamaBrand(data.nama_brand || "");
        setTagline(data.tagline || "");
        setLogoUrl(data.logo_url || null);
        setFaviconUrl(data.favicon_url || null);
        setSelectedTheme((data.theme as BrandingTheme) || "default");
        setDisplayMode((data.display_mode as "light" | "dark") || "dark");
        setHideBarberinBrand(Boolean(data.hide_barberin_brand));
        setMetaTitle(data.meta_title || "");
        setMetaDescription(data.meta_description || "");
        setBrandingStatus((data.status as BrandingStatus) || "draft");

        // Set color preset
        if (data.color_preset) {
          setSelectedColorKey(data.color_preset);
        } else {
          const matchedColor = COLOR_PRESETS.find(
            (c) => c.primary.toLowerCase() === data.warna_primary?.toLowerCase()
          );
          if (matchedColor) {
            setSelectedColorKey(matchedColor.key);
          } else {
            setSelectedColorKey("purple");
          }
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat branding:", err);
      toast.error(err.message || "Gagal memuat konfigurasi branding.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentColorPreset =
    COLOR_PRESETS.find((c) => c.key === selectedColorKey) || COLOR_PRESETS[0]!;

  // Handle Logo Upload
  const handleLogoFile = (file: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Format file logo tidak valid. Gunakan JPG, PNG, atau SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file logo terlalu besar. Maksimal 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoUrl(e.target?.result as string);
      toast.success("Logo berhasil diunggah.");
    };
    reader.readAsDataURL(file);
  };

  // Handle Favicon Upload
  const handleFaviconFile = (file: File) => {
    if (!file) return;
    if (
      !["image/x-icon", "image/vnd.microsoft.icon", "image/png", "image/svg+xml"].includes(
        file.type
      ) &&
      !file.name.endsWith(".ico")
    ) {
      toast.error("Format file favicon tidak valid. Rekomendasi ICO atau PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file favicon maksimal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFaviconUrl(e.target?.result as string);
      toast.success("Favicon berhasil diunggah.");
    };
    reader.readAsDataURL(file);
  };

  // Save changes (BPMN Step 5, 6, 8, 10, 11)
  const handleSave = async (overrideStatus?: BrandingStatus) => {
    if (!namaBrand.trim()) {
      toast.error("Validasi gagal: Nama brand wajib diisi.");
      return;
    }
    if (namaBrand.length > 100) {
      toast.error("Validasi gagal: Nama brand maksimal 100 karakter.");
      return;
    }

    try {
      setSaving(true);
      const targetStatus = overrideStatus || "active";
      const res = await saveOwnerBranding({
        data: {
          nama_brand: namaBrand.trim(),
          tagline: tagline.trim() || undefined,
          logo_url: logoUrl || undefined,
          favicon_url: faviconUrl || undefined,
          theme: selectedTheme,
          display_mode: displayMode,
          color_preset: selectedColorKey,
          hide_barberin_brand: hideBarberinBrand,
          meta_title: metaTitle.trim() || undefined,
          meta_description: metaDescription.trim() || undefined,
          status: targetStatus,
        },
      });

      setBrandingStatus(targetStatus);
      toast.success(res.message || "Konfigurasi branding berhasil disimpan!");
      setShowPreviewModal(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan konfigurasi branding.");
    } finally {
      setSaving(false);
    }
  };

  // Fetch histories
  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    try {
      setLoadingHistories(true);
      const res = await getOwnerBrandingHistories();
      setHistories(res || []);
    } catch (err: any) {
      toast.error("Gagal memuat riwayat perubahan branding.");
    } finally {
      setLoadingHistories(false);
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] flex text-slate-100 selection:bg-blue-600 selection:text-white">
        {/* Desktop Sidebar */}
        <OwnerSidebar activePath={`/${barbershopSlug}/owner/theme`} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <OwnerHeader />
          <OwnerMobileHeader activePath={`/${barbershopSlug}/owner/theme`} onRefresh={fetchData} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6 pb-24 lg:pb-12">
            {/* Header & Breadcrumb (Image 3 Wireframe) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
                  <span>Pengaturan</span>
                  <span>›</span>
                  <span className="text-blue-400 font-semibold">White Labeling</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-sm">
                    <Palette className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    White Labeling
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-bold border ${
                        brandingStatus === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      ● {brandingStatus}
                    </span>
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Sesuaikan identitas dan tampilan website barbershop Anda dengan brand Anda.
                </p>
              </div>

              {/* Action buttons (Preview & BPMN) */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBpmnModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/30 transition-all shadow-sm active:scale-95"
                >
                  <Layers className="h-4 w-4" />
                  <span>Lihat Alur BPMN</span>
                </button>

                <button
                  type="button"
                  onClick={openHistoryModal}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all shadow-sm active:scale-95"
                >
                  <History className="h-4 w-4" />
                  <span>Riwayat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-sm active:scale-95"
                >
                  <Eye className="h-4 w-4 text-purple-400" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={() => handleSave("active")}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 active:scale-95 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-xs">Memuat konfigurasi white labeling...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* CARD 1: Identitas Brand (Image 3) */}
                <div className="bg-[#0B1424] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Identitas Brand</h2>
                      <p className="text-xs text-slate-400">
                        Atur informasi dasar yang akan digunakan untuk menampilkan identitas barbershop Anda.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Nama Brand */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                        <span>Nama Brand</span>
                        <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={namaBrand}
                        onChange={(e) => setNamaBrand(e.target.value)}
                        placeholder="Contoh: Singgah Barbershop"
                        maxLength={100}
                        className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                      <span className="text-[10px] text-slate-500">
                        Nama utama yang akan tampil pada banner dan nota layanan.
                      </span>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Tagline</label>
                      <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Contoh: Potong rapi, tampil percaya diri"
                        maxLength={150}
                        className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                      <span className="text-[10px] text-slate-500">
                        Slogan singkat di bawah nama brand barbershop.
                      </span>
                    </div>
                  </div>

                  {/* Logo & Favicon Upload Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {/* Upload Logo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                          <span>Logo</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl(null)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            Hapus Logo
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/jpeg,image/png,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoFile(file);
                        }}
                      />

                      <div
                        onClick={() => logoInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleLogoFile(file);
                        }}
                        className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/80 bg-[#070D18]/70 hover:bg-[#070D18] rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] group"
                      >
                        {logoUrl ? (
                          <div className="flex items-center gap-4">
                            <img
                              src={logoUrl}
                              alt="Logo Barbershop"
                              className="h-16 w-16 object-contain rounded-lg bg-slate-900 border border-slate-700 p-1"
                            />
                            <div className="text-left">
                              <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Logo Terpasang
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Klik untuk mengganti logo
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Upload className="h-4 w-4" />
                            </div>
                            <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                              Upload Logo
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Klik atau drag &amp; drop di sini
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Format: JPG, PNG, atau SVG. Maksimal ukuran file 5 MB.
                      </div>
                    </div>

                    {/* Upload Favicon */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300">Favicon</label>
                        {faviconUrl && (
                          <button
                            type="button"
                            onClick={() => setFaviconUrl(null)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            Hapus Favicon
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={faviconInputRef}
                        accept="image/x-icon,image/png,image/svg+xml,.ico"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFaviconFile(file);
                        }}
                      />

                      <div
                        onClick={() => faviconInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleFaviconFile(file);
                        }}
                        className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/80 bg-[#070D18]/70 hover:bg-[#070D18] rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] group"
                      >
                        {faviconUrl ? (
                          <div className="flex items-center gap-4">
                            <img
                              src={faviconUrl}
                              alt="Favicon"
                              className="h-10 w-10 object-contain rounded-md bg-slate-900 border border-slate-700 p-1"
                            />
                            <div className="text-left">
                              <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Favicon Terpasang
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Klik untuk mengganti favicon
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="h-9 w-9 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Upload className="h-4 w-4" />
                            </div>
                            <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                              Upload Favicon
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Rekomendasi 32×32px • ICO/PNG
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Ikon yang ditampilkan pada tab browser pelanggan.
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Tampilan (Image 3) */}
                <div className="bg-[#0B1424] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Tampilan</h2>
                      <p className="text-xs text-slate-400">
                        Pilih gaya tampilan yang sesuai dengan karakter brand barbershop Anda.
                      </p>
                    </div>
                  </div>

                  {/* Theme Presets: 4 cards (Default, Secondary, Tertiary, Natural) */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-slate-300">Preset Tampilan UI</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 1. Default */}
                      <div
                        onClick={() => setSelectedTheme("default")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "default"
                            ? "border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/40"
                            : "border-slate-800 bg-[#070D18] hover:border-slate-700"
                        }`}
                      >
                        {selectedTheme === "default" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        {/* Mini window illustration */}
                        <div className="bg-[#0F1D33] rounded-lg p-2 space-y-1.5 border border-slate-800 mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-blue-600/70 rounded-xs w-3/4" />
                          <div className="h-2 bg-slate-700/50 rounded-xs w-full" />
                          <div className="h-2 bg-slate-700/30 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-white">Default</div>
                          <div className="text-[10px] text-slate-400">Classic Blue</div>
                        </div>
                      </div>

                      {/* 2. Secondary */}
                      <div
                        onClick={() => setSelectedTheme("secondary")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "secondary"
                            ? "border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/40"
                            : "border-slate-800 bg-[#070D18] hover:border-slate-700"
                        }`}
                      >
                        {selectedTheme === "secondary" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-[#2B0B13] rounded-lg p-2 space-y-1.5 border border-rose-900/50 mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-rose-600/70 rounded-xs w-3/4" />
                          <div className="h-2 bg-rose-900/50 rounded-xs w-full" />
                          <div className="h-2 bg-rose-900/30 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-white">Secondary</div>
                          <div className="text-[10px] text-slate-400">Bold Rose</div>
                        </div>
                      </div>

                      {/* 3. Tertiary (Purple in Image 3) */}
                      <div
                        onClick={() => setSelectedTheme("tertiary")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "tertiary"
                            ? "border-purple-500 bg-purple-950/40 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10"
                            : "border-slate-800 bg-[#070D18] hover:border-slate-700"
                        }`}
                      >
                        {selectedTheme === "tertiary" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-[#1E1238] rounded-lg p-2 space-y-1.5 border border-purple-900/50 mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-purple-600/80 rounded-xs w-3/4" />
                          <div className="h-2 bg-purple-900/60 rounded-xs w-full" />
                          <div className="h-2 bg-purple-900/40 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-white">Tertiary</div>
                          <div className="text-[10px] text-purple-400">Vibrant Purple</div>
                        </div>
                      </div>

                      {/* 4. Natural */}
                      <div
                        onClick={() => setSelectedTheme("natural")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "natural"
                            ? "border-slate-400 bg-slate-900/60 ring-2 ring-slate-400/40"
                            : "border-slate-800 bg-[#070D18] hover:border-slate-700"
                        }`}
                      >
                        {selectedTheme === "natural" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-slate-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-[#111827] rounded-lg p-2 space-y-1.5 border border-slate-800 mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-slate-500/80 rounded-xs w-3/4" />
                          <div className="h-2 bg-slate-700/50 rounded-xs w-full" />
                          <div className="h-2 bg-slate-700/30 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-white">Natural</div>
                          <div className="text-[10px] text-slate-400">Minimalist Slate</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Tampilan (Light / Dark) */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Mode Tampilan</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Pilih skema warna dasar tampilan website barbershop Anda.
                    </p>

                    <div className="inline-flex items-center gap-2 bg-[#070D18] p-1.5 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setDisplayMode("light")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                          displayMode === "light"
                            ? "bg-white text-slate-900 shadow-md font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayMode("dark")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                          displayMode === "dark"
                            ? "bg-purple-600 text-white shadow-md font-bold shadow-purple-600/30"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Moon className="h-3.5 w-3.5" />
                        <span>Dark</span>
                        <Check className="h-3.5 w-3.5 ml-1" />
                      </button>
                    </div>
                  </div>

                  {/* Warna Presets (Blue, Emerald, Purple, Rose, Amber, Slate) */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-semibold text-white">Warna</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Pilih kombinasi warna yang telah disediakan BARBERIN untuk tampilan website Anda.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {COLOR_PRESETS.map((preset) => {
                        const isSelected = selectedColorKey === preset.key;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setSelectedColorKey(preset.key)}
                            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                              isSelected
                                ? "border-purple-500 bg-purple-950/30 text-white ring-2 ring-purple-500/40 shadow-md"
                                : "border-slate-800 bg-[#070D18] text-slate-400 hover:text-white hover:border-slate-700"
                            }`}
                          >
                            {/* Color tri-swatch */}
                            <div className="flex items-center -space-x-1.5">
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-slate-900 shadow-xs"
                                style={{ backgroundColor: preset.primary }}
                              />
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-slate-900 shadow-xs"
                                style={{ backgroundColor: preset.secondary }}
                              />
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-slate-900 shadow-xs"
                                style={{ backgroundColor: preset.background }}
                              />
                            </div>
                            <span>{preset.name.split(" ")[0]}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-purple-400" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 italic pt-1">
                      Setiap preset mencakup Warna Utama, Warna Sekunder, dan Warna Background yang sudah terkalibrasi kontrasnya dengan teks &amp; icon sistem.
                    </p>
                  </div>
                </div>

                {/* CARD 3: SEO & Watermark Settings */}
                <div className="bg-[#0B1424] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div>
                      <h2 className="text-sm font-bold text-white">SEO &amp; Visibilitas Brand</h2>
                      <p className="text-xs text-slate-400">
                        Pengaturan metadata pencarian Google dan opsi sembunyikan merek platform.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Meta Title</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder="Contoh: Singgah Barbershop — Potong Rapi & Nyaman"
                        maxLength={150}
                        className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Meta Description</label>
                      <input
                        type="text"
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        placeholder="Deskripsi singkat yang muncul di hasil pencarian Google"
                        className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl bg-[#070D18] border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Sembunyikan Label "Powered by BARBERIN"
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Menghilangkan watermark brand platform dari footer halaman reservasi pelanggan.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideBarberinBrand}
                        onChange={(e) => setHideBarberinBrand(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <OwnerBottomNav activePath={`/${barbershopSlug}/owner/theme`} />

        {/* MODAL 1: PREVIEW (BPMN Step 3: Klik Preview -> Sesuai?) */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1526] border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F1E36]">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Preview Website Barbershop
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mockup preview canvas */}
              <div
                className="p-8 space-y-6 transition-colors"
                style={{
                  backgroundColor: currentColorPreset.background,
                  color: currentColorPreset.textColor,
                }}
              >
                {/* Header Mockup */}
                <div
                  className="p-4 rounded-2xl flex items-center justify-between border shadow-lg"
                  style={{
                    backgroundColor: currentColorPreset.cardBg,
                    borderColor: currentColorPreset.secondary,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                        style={{ backgroundColor: currentColorPreset.primary }}
                      >
                        {namaBrand ? namaBrand.charAt(0) : "B"}
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-base tracking-tight">
                        {namaBrand || "Nama Barbershop"}
                      </h3>
                      <p className="text-xs opacity-75">{tagline || "Tagline barbershop Anda"}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                    style={{ backgroundColor: currentColorPreset.primary }}
                  >
                    Booking Sekarang
                  </button>
                </div>

                {/* Service Card Mockup */}
                <div
                  className="p-5 rounded-2xl border space-y-3 shadow-md"
                  style={{
                    backgroundColor: currentColorPreset.cardBg,
                    borderColor: currentColorPreset.secondary,
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm">Gentlemen Haircut &amp; Wash</div>
                      <div className="text-xs opacity-70">45 Menit • Termasuk pijat kepala</div>
                    </div>
                    <div
                      className="font-extrabold text-sm font-mono px-3 py-1 rounded-lg text-white"
                      style={{ backgroundColor: currentColorPreset.primary }}
                    >
                      Rp 75.000
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full opacity-20 bg-slate-500" />
                </div>

                {/* Footer Mockup */}
                <div className="text-center text-xs opacity-60 pt-4 border-t border-slate-800">
                  {hideBarberinBrand ? (
                    <span>© 2026 {namaBrand || "Barbershop"}. All rights reserved.</span>
                  ) : (
                    <span>
                      © 2026 {namaBrand || "Barbershop"} • Powered by{" "}
                      <strong className="underline">BARBERIN</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Footer BPMN Decision: Sesuai? */}
              <div className="p-4 bg-[#081220] border-t border-slate-800 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  <span className="text-amber-400 font-bold">Decision (BPMN):</span> Apakah tampilan sudah sesuai keinginan Anda?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Kembali Edit
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave("active")}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30"
                  >
                    {saving ? "Menyimpan..." : "Ya, Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: BPMN VIEWER */}
        {showBpmnModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
            <div className="max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
              <BPMNViewer
                initialMode="white_label"
                onClose={() => setShowBpmnModal(false)}
                className="max-h-[90vh]"
              />
            </div>
          </div>
        )}

        {/* MODAL 3: AUDIT HISTORY */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1526] border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F1E36]">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Riwayat Perubahan Branding (Audit Log)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
                {loadingHistories ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Memuat riwayat perubahan...
                  </div>
                ) : histories.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada riwayat perubahan branding.
                  </div>
                ) : (
                  histories.map((h) => {
                    let beforeObj = null;
                    let afterObj = null;
                    try {
                      beforeObj = h.data_before ? JSON.parse(h.data_before) : null;
                      afterObj = h.data_after ? JSON.parse(h.data_after) : null;
                    } catch {}

                    return (
                      <div
                        key={h.id_history}
                        className="bg-[#070D18] border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>
                            Diubah oleh: <strong className="text-white">{h.user?.nama_lengkap || "Owner"}</strong>
                          </span>
                          <span className="font-mono">
                            {new Date(h.created_at).toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-slate-900/60 p-2 rounded border border-slate-800 text-slate-400">
                            <span className="text-[10px] text-rose-400 block font-sans font-bold">Sebelum:</span>
                            <div>Brand: {beforeObj?.nama_brand || "-"}</div>
                            <div>Warna: {beforeObj?.warna_primary || "-"}</div>
                            <div>Theme: {beforeObj?.theme || "-"}</div>
                          </div>
                          <div className="bg-slate-900/60 p-2 rounded border border-slate-800 text-slate-200">
                            <span className="text-[10px] text-emerald-400 block font-sans font-bold">Sesudah:</span>
                            <div>Brand: {afterObj?.nama_brand || "-"}</div>
                            <div>Warna: {afterObj?.warna_primary || "-"}</div>
                            <div>Theme: {afterObj?.theme || "-"}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-[#081220] border-t border-slate-800 text-right">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OwnerAuthGuard>
  );
}
