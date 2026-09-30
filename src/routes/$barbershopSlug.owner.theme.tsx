import { createFileRoute, useRouter } from "@tanstack/react-router";
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
  Crop,
} from "lucide-react";
import { toast } from "sonner";
import { ImageCropper } from "@/components/ui/image-cropper";

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
import { PRESET_SEMANTIC_TOKENS } from "@/lib/tenant-theme";
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
  const router = useRouter();
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
  const [brandingStatus, setBrandingStatus] = useState<BrandingStatus>("draft");

  // Modals
  const [showBpmnModal, setShowBpmnModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [histories, setHistories] = useState<any[]>([]);
  const [loadingHistories, setLoadingHistories] = useState(false);

  // Image Cropper States (Logo & Favicon)
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<"logo" | "favicon">("logo");
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [logoOriginalSrc, setLogoOriginalSrc] = useState<string | null>(null);
  const [faviconOriginalSrc, setFaviconOriginalSrc] = useState<string | null>(null);

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
        setLogoOriginalSrc(data.logo_url || null);
        setFaviconOriginalSrc(data.favicon_url || null);
        setSelectedTheme((data.theme as BrandingTheme) || "default");
        setDisplayMode((data.display_mode as "light" | "dark") || "dark");
        setHideBarberinBrand(Boolean(data.hide_barberin_brand));
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

  // Handle Logo Upload with Cropper (Flow: Select -> Validate -> Open Cropper)
  const handleLogoFile = (file: File) => {
    if (!file) return;
    if (file.size <= 0) {
      toast.error("File logo tidak valid atau kosong.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isSupported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!isImage || !isSupported) {
      toast.error("Format file logo tidak valid. Gunakan gambar berformat JPG, PNG, atau WEBP.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Ukuran file logo terlalu besar. Maksimal 500 KB.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Gagal membaca file gambar logo. Pastikan file tidak rusak.");
      if (logoInputRef.current) logoInputRef.current.value = "";
    };
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        toast.error("File gambar kosong.");
        return;
      }
      setLogoOriginalSrc(dataUrl);
      setCropperImageSrc(dataUrl);
      setCropTarget("logo");
      setCropperOpen(true);
      if (logoInputRef.current) logoInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  // Handle Favicon Upload with Cropper (Flow: Select -> Validate -> Open Cropper)
  const handleFaviconFile = (file: File) => {
    if (!file) return;
    if (file.size <= 0) {
      toast.error("File favicon tidak valid atau kosong.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
      return;
    }
    const isImage = file.type.startsWith("image/") || file.name.endsWith(".ico");
    const isSupported =
      ["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"].includes(
        file.type
      ) || file.name.endsWith(".ico");
    if (!isImage || !isSupported) {
      toast.error("Format file favicon tidak valid. Gunakan format PNG, JPG, WEBP, atau ICO.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Ukuran file favicon maksimal 500 KB.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Gagal membaca file favicon. Pastikan file tidak rusak.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    };
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        toast.error("File favicon kosong.");
        return;
      }
      setFaviconOriginalSrc(dataUrl);
      setCropperImageSrc(dataUrl);
      setCropTarget("favicon");
      setCropperOpen(true);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  // Callback saat crop berhasil diproses oleh Canvas
  const handleCropComplete = ({ dataUrl }: { blob: Blob; dataUrl: string; file: File }) => {
    if (cropTarget === "logo") {
      setLogoUrl(dataUrl);
      toast.success("Hasil crop logo siap digunakan. Klik 'Simpan Perubahan' untuk menerapkan.");
    } else {
      setFaviconUrl(dataUrl);
      // Langsung sinkronkan favicon tab browser
      if (typeof document !== "undefined") {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = dataUrl;
      }
      toast.success("Hasil crop favicon siap digunakan. Klik 'Simpan Perubahan' untuk menerapkan.");
    }
  };

  // Handler Crop Ulang dari gambar yang aktif
  const handleReCrop = (target: "logo" | "favicon") => {
    if (target === "logo") {
      const srcToCrop = logoOriginalSrc || logoUrl;
      if (!srcToCrop) {
        toast.error("Belum ada logo untuk dipotong ulang.");
        return;
      }
      setCropTarget("logo");
      setCropperImageSrc(srcToCrop);
      setCropperOpen(true);
    } else {
      const srcToCrop = faviconOriginalSrc || faviconUrl;
      if (!srcToCrop) {
        toast.error("Belum ada favicon untuk dipotong ulang.");
        return;
      }
      setCropTarget("favicon");
      setCropperImageSrc(srcToCrop);
      setCropperOpen(true);
    }
  };

  // Handler Hapus Logo
  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoOriginalSrc(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    toast.info("Logo dihapus.");
  };

  // Handler Hapus Favicon
  const handleRemoveFavicon = () => {
    setFaviconUrl(null);
    setFaviconOriginalSrc(null);
    if (faviconInputRef.current) faviconInputRef.current.value = "";
    if (typeof document !== "undefined") {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = "/favicon.png";
      }
    }
    toast.info("Favicon dihapus.");
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
          tagline: tagline.trim() || null,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          theme: selectedTheme,
          display_mode: displayMode,
          color_preset: selectedColorKey,
          hide_barberin_brand: hideBarberinBrand,
          status: targetStatus,
        },
      });

      setBrandingStatus(targetStatus);
      toast.success(res.message || "Konfigurasi branding berhasil disimpan!");
      setShowPreviewModal(false);
      // Immediately invalidate router cache so parent layout & all pages reload the new branding
      await router.invalidate();
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
      <div className="min-h-screen bg-background flex text-foreground selection:bg-primary selection:text-primary-foreground">
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                  <span>Pengaturan</span>
                  <span>›</span>
                  <span className="text-primary font-semibold">White Labeling</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm">
                    <Palette className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    White Labeling
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-bold border ${
                        brandingStatus === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      ● {brandingStatus}
                    </span>
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Sesuaikan identitas dan tampilan website barbershop Anda dengan brand Anda.
                </p>
              </div>

              {/* Action buttons (Preview & Simpan Perubahan) */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border transition-all shadow-sm active:scale-95"
                >
                  <Eye className="h-4 w-4 text-primary" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={() => handleSave("active")}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md shadow-primary/30 active:scale-95 disabled:opacity-50"
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
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 text-card-foreground">
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Identitas Brand</h2>
                      <p className="text-xs text-muted-foreground">
                        Atur informasi dasar yang akan digunakan untuk menampilkan identitas barbershop Anda.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Nama Brand */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <span>Nama Brand</span>
                        <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={namaBrand}
                        onChange={(e) => setNamaBrand(e.target.value)}
                        placeholder="Contoh: Singgah Barbershop"
                        maxLength={100}
                        className="w-full bg-background border border-input rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Nama utama yang akan tampil pada banner dan nota layanan.
                      </span>
                    </div>

                    {/* Tagline */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Tagline</label>
                      <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Contoh: Potong rapi, tampil percaya diri"
                        maxLength={150}
                        className="w-full bg-background border border-input rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Slogan singkat di bawah nama brand barbershop.
                      </span>
                    </div>
                  </div>

                  {/* Logo & Favicon Upload Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {/* Upload Logo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <span>Logo Barbershop</span>
                            <span className="text-rose-400">*</span>
                          </label>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            1:1 Persegi
                          </span>
                        </div>
                        {logoUrl && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReCrop("logo")}
                              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Crop className="h-3 w-3" />
                              <span>Crop Ulang</span>
                            </button>
                            <span className="text-muted-foreground text-xs">•</span>
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoFile(file);
                        }}
                      />

                      {logoUrl ? (
                        <div className="border border-border bg-card rounded-xl p-4 transition-all space-y-3">
                          <div className="w-full h-24 sm:h-28 rounded-lg bg-muted/40 border border-border flex items-center justify-center p-3 overflow-hidden">
                            <img
                              src={logoUrl}
                              alt="Logo Barbershop"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Logo Terpotong (1:1)</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleReCrop("logo")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Crop className="h-3 w-3" />
                                <span>Crop Ulang</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                              >
                                Ubah Logo
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => logoInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleLogoFile(file);
                          }}
                          className="border-2 border-dashed border-border hover:border-primary/80 bg-muted/40 hover:bg-muted/60 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] group"
                        >
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload className="h-4 w-4" />
                          </div>
                          <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Upload &amp; Crop Logo
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Rasio persegi 1:1 • Klik atau drag file di sini
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground">
                        Format: JPG, PNG, atau WEBP. Maksimal ukuran file 500 KB.
                      </div>
                    </div>

                    {/* Upload Favicon */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-foreground">Favicon Tab</label>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            1:1 Persegi
                          </span>
                        </div>
                        {faviconUrl && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReCrop("favicon")}
                              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Crop className="h-3 w-3" />
                              <span>Crop Ulang</span>
                            </button>
                            <span className="text-muted-foreground text-xs">•</span>
                            <button
                              type="button"
                              onClick={handleRemoveFavicon}
                              className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={faviconInputRef}
                        accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFaviconFile(file);
                        }}
                      />

                      {faviconUrl ? (
                        <div className="border border-border bg-card rounded-xl p-4 transition-all space-y-3">
                          <div className="w-full h-24 sm:h-28 rounded-lg bg-muted/40 border border-border flex items-center justify-center gap-4 p-3">
                            <div className="h-16 w-16 rounded-xl bg-background border border-border flex items-center justify-center p-2 shadow-inner">
                              <img
                                src={faviconUrl}
                                alt="Favicon"
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <div className="text-left space-y-1">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-[11px] font-mono text-muted-foreground">
                                <img src={faviconUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                                <span className="truncate max-w-[120px]">{namaBrand || "Barbershop"}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">Simulasi tab browser</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Favicon Terpotong (1:1)</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleReCrop("favicon")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Crop className="h-3 w-3" />
                                <span>Crop Ulang</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => faviconInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                              >
                                Ubah Favicon
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => faviconInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFaviconFile(file);
                          }}
                          className="border-2 border-dashed border-border hover:border-primary/80 bg-muted/40 hover:bg-muted/60 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] group"
                        >
                          <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload className="h-4 w-4" />
                          </div>
                          <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Upload &amp; Crop Favicon
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Rasio persegi 1:1 • Output 512×512 PNG
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground">
                        Format: PNG, JPG, WEBP, atau ICO. Maksimal 500 KB.
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Tampilan (Image 3) */}
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xl space-y-6 text-card-foreground">
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Tampilan</h2>
                      <p className="text-xs text-muted-foreground">
                        Pilih gaya tampilan yang sesuai dengan karakter brand barbershop Anda.
                      </p>
                    </div>
                  </div>

                  {/* Theme Presets: 4 cards (Default, Secondary, Tertiary, Natural) */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-foreground">Preset Tampilan UI</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 1. Default */}
                      <div
                        onClick={() => setSelectedTheme("default")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "default"
                            ? "border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/40"
                            : "border-border bg-muted/30 hover:border-primary/50"
                        }`}
                      >
                        {selectedTheme === "default" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        {/* Mini window illustration */}
                        <div className="bg-background rounded-lg p-2 space-y-1.5 border border-border mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-blue-600/70 rounded-xs w-3/4" />
                          <div className="h-2 bg-muted rounded-xs w-full" />
                          <div className="h-2 bg-muted/60 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-foreground">Default</div>
                          <div className="text-[10px] text-muted-foreground">Classic Blue</div>
                        </div>
                      </div>

                      {/* 2. Secondary */}
                      <div
                        onClick={() => setSelectedTheme("secondary")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "secondary"
                            ? "border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/40"
                            : "border-border bg-muted/30 hover:border-rose-500/50"
                        }`}
                      >
                        {selectedTheme === "secondary" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-background rounded-lg p-2 space-y-1.5 border border-border mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-rose-600/70 rounded-xs w-3/4" />
                          <div className="h-2 bg-muted rounded-xs w-full" />
                          <div className="h-2 bg-muted/60 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-foreground">Secondary</div>
                          <div className="text-[10px] text-muted-foreground">Bold Rose</div>
                        </div>
                      </div>

                      {/* 3. Tertiary (Purple in Image 3) */}
                      <div
                        onClick={() => setSelectedTheme("tertiary")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "tertiary"
                            ? "border-purple-500 bg-purple-950/40 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10"
                            : "border-border bg-muted/30 hover:border-purple-500/50"
                        }`}
                      >
                        {selectedTheme === "tertiary" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-background rounded-lg p-2 space-y-1.5 border border-border mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-purple-600/80 rounded-xs w-3/4" />
                          <div className="h-2 bg-muted rounded-xs w-full" />
                          <div className="h-2 bg-muted/60 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-foreground">Tertiary</div>
                          <div className="text-[10px] text-primary">Vibrant Purple</div>
                        </div>
                      </div>

                      {/* 4. Natural */}
                      <div
                        onClick={() => setSelectedTheme("natural")}
                        className={`cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden ${
                          selectedTheme === "natural"
                            ? "border-slate-400 bg-slate-900/60 ring-2 ring-slate-400/40"
                            : "border-border bg-muted/30 hover:border-primary/50"
                        }`}
                      >
                        {selectedTheme === "natural" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-slate-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="bg-background rounded-lg p-2 space-y-1.5 border border-border mb-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="h-3 bg-slate-500/80 rounded-xs w-3/4" />
                          <div className="h-2 bg-muted rounded-xs w-full" />
                          <div className="h-2 bg-muted/60 rounded-xs w-1/2" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-foreground">Natural</div>
                          <div className="text-[10px] text-muted-foreground">Minimalist Slate</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Tampilan (Light / Dark) */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-semibold text-foreground">Mode Tampilan</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Pilih skema warna dasar tampilan website barbershop Anda.
                    </p>

                    <div className="inline-flex items-center gap-2 bg-background p-1.5 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => setDisplayMode("light")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                          displayMode === "light"
                            ? "bg-card text-foreground shadow-md font-bold"
                            : "text-muted-foreground hover:text-foreground"
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
                            ? "bg-primary text-primary-foreground shadow-md font-bold shadow-primary/30"
                            : "text-muted-foreground hover:text-foreground"
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
                      <Palette className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Warna</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
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
                                ? "border-primary bg-primary/20 text-foreground ring-2 ring-primary/40 shadow-md"
                                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted"
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

              </div>
            )}
          </main>
        </div>

        <OwnerBottomNav activePath={`/${barbershopSlug}/owner/theme`} />

        {/* MODAL 1: PREVIEW (BPMN Step 3: Klik Preview -> Sesuai?) */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Preview Website Barbershop
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mockup preview canvas */}
              {(() => {
                const previewTokens =
                  PRESET_SEMANTIC_TOKENS[selectedColorKey]?.[displayMode] ||
                  PRESET_SEMANTIC_TOKENS["blue"]![displayMode];
                return (
                  <div
                    className="p-8 space-y-6 transition-colors"
                    style={{
                      backgroundColor: previewTokens.background,
                      color: previewTokens.foreground,
                    }}
                  >
                    {/* Header Mockup */}
                    <div
                      className="p-4 rounded-2xl flex items-center justify-between border shadow-lg"
                      style={{
                        backgroundColor: previewTokens.card,
                        borderColor: previewTokens.border,
                        color: previewTokens.cardForeground,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-10 max-w-[140px] w-auto object-contain rounded-lg"
                          />
                        ) : (
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                            style={{ backgroundColor: previewTokens.primary, color: previewTokens.primaryForeground }}
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
                        className="px-4 py-2 rounded-xl text-xs font-bold shadow-md"
                        style={{
                          backgroundColor: previewTokens.primary,
                          color: previewTokens.primaryForeground,
                        }}
                      >
                        Booking Sekarang
                      </button>
                    </div>

                    {/* Service Card Mockup */}
                    <div
                      className="p-5 rounded-2xl border space-y-3 shadow-md"
                      style={{
                        backgroundColor: previewTokens.card,
                        borderColor: previewTokens.border,
                        color: previewTokens.cardForeground,
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-bold text-sm">Gentlemen Haircut &amp; Wash</div>
                          <div className="text-xs opacity-70">45 Menit • Termasuk pijat kepala</div>
                        </div>
                        <div
                          className="font-extrabold text-sm font-mono px-3 py-1 rounded-lg"
                          style={{
                            backgroundColor: previewTokens.primary,
                            color: previewTokens.primaryForeground,
                          }}
                        >
                          Rp 75.000
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full opacity-20 bg-slate-500" />
                    </div>

                    {/* Footer Mockup */}
                    <div className="text-center text-xs opacity-60 pt-4 border-t border-border">
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
                );
              })()}

              {/* Footer BPMN Decision: Sesuai? */}
              <div className="p-4 bg-card border-t border-border flex items-center justify-between gap-4 text-card-foreground">
                <div className="text-xs text-muted-foreground">
                  <span className="text-amber-500 font-bold">Decision (BPMN):</span> Apakah tampilan sudah sesuai keinginan Anda?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground"
                  >
                    Kembali Edit
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave("active")}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/30"
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
            <div className="bg-card border border-border rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Riwayat Perubahan Branding (Audit Log)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
                {loadingHistories ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Memuat riwayat perubahan...
                  </div>
                ) : histories.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
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
                        className="bg-muted/40 border border-border p-3.5 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>
                            Diubah oleh: <strong className="text-foreground">{h.user?.nama_lengkap || "Owner"}</strong>
                          </span>
                          <span className="font-mono">
                            {new Date(h.created_at).toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-background p-2 rounded border border-border text-muted-foreground">
                            <span className="text-[10px] text-rose-500 block font-sans font-bold">Sebelum:</span>
                            <div>Brand: {beforeObj?.nama_brand || "-"}</div>
                            <div>Warna: {beforeObj?.warna_primary || "-"}</div>
                            <div>Theme: {beforeObj?.theme || "-"}</div>
                          </div>
                          <div className="bg-background p-2 rounded border border-border text-foreground">
                            <span className="text-[10px] text-emerald-500 block font-sans font-bold">Sesudah:</span>
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

              <div className="p-3 bg-muted/40 border-t border-border text-right">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: IMAGE CROPPER (Logo 1:1 & Favicon 1:1) */}
        <ImageCropper
          open={cropperOpen}
          onOpenChange={(isOpen) => {
            setCropperOpen(isOpen);
            if (!isOpen) {
              if (logoInputRef.current) logoInputRef.current.value = "";
              if (faviconInputRef.current) faviconInputRef.current.value = "";
            }
          }}
          imageSrc={cropperImageSrc}
          aspectRatio={1 / 1}
          outputType={cropTarget}
          title={cropTarget === "logo" ? "Crop Logo Barbershop" : "Crop Favicon Tab"}
          description={
            cropTarget === "logo"
              ? "Atur posisi dan perbesaran area logo dengan rasio 1:1 (persegi). Hanya area di dalam bingkai yang akan digunakan."
              : "Atur posisi dan perbesaran area favicon dengan rasio 1:1 (persegi). Hanya area di dalam bingkai yang akan digunakan."
          }
          onCropComplete={handleCropComplete}
        />
      </div>
    </OwnerAuthGuard>
  );
}
