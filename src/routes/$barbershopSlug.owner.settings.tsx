import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Settings,
  Store,
  Clock,
  Phone,
  MapPin,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
  OwnerAuthGuard,
} from "@/components/owner/ui";
import { useOwner, ownerActions } from "@/lib/owner-store";
import {
  getOwnerSettings,
  updateOwnerSettings,
  validateNewOwnerEmail,
  requestOwnerPasswordChange,
  type OwnerSettingsData,
} from "@/lib/owner-settings";
import { supabase } from "@/lib/supabase-client";
import { MapPicker, type MapLocation } from "@/components/owner/map-picker";

export const Route = createFileRoute("/$barbershopSlug/owner/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan Barbershop — BARBERIN Owner" },
      { name: "description", content: "Pengaturan profil outlet dan preferensi operasional." },
    ],
  }),
  component: OwnerSettingsPage,
});

function OwnerSettingsPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const storeUser = useOwner().user;

  // Server data state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedData, setSavedData] = useState<OwnerSettingsData | null>(null);

  // Form states - Barbershop
  const [barbershopId, setBarbershopId] = useState("");
  const [namaBarbershop, setNamaBarbershop] = useState("");
  const [alamat, setAlamat] = useState("");
  const [noHpBarbershop, setNoHpBarbershop] = useState("");
  const [jamBuka, setJamBuka] = useState("08:00");
  const [jamTutup, setJamTutup] = useState("21:00");

  // Location state for Leaflet Map
  const [location, setLocation] = useState<MapLocation>({
    latitude: -6.2088,
    longitude: 106.8456,
  });

  // Form states - Owner
  const [userId, setUserId] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [noHpOwner, setNoHpOwner] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Verification & Security states
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [hasPendingPasswordVerification, setHasPendingPasswordVerification] = useState(false);

  // Security reauthentication modal
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [pendingEmailTarget, setPendingEmailTarget] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [isReauthing, setIsReauthing] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  // Load settings from DB on mount
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getOwnerSettings();
      setSavedData(data);

      // Set Barbershop fields
      setBarbershopId(data.barbershop.id_barbershop);
      setNamaBarbershop(
        data.barbershop.nama_barbershop || storeUser.barbershopName || "Barbershop",
      );
      setAlamat(data.barbershop.alamat || "");
      setNoHpBarbershop(data.barbershop.no_hp || "");
      setJamBuka(data.barbershop.jam_buka?.replace(" WIB", "") || "08:00");
      setJamTutup(data.barbershop.jam_tutup?.replace(" WIB", "") || "21:00");

      const initialLat =
        data.barbershop.latitude != null && !isNaN(Number(data.barbershop.latitude))
          ? Number(data.barbershop.latitude)
          : -6.2088;
      const initialLng =
        data.barbershop.longitude != null && !isNaN(Number(data.barbershop.longitude))
          ? Number(data.barbershop.longitude)
          : 106.8456;

      setLocation({
        latitude: initialLat,
        longitude: initialLng,
      });

      // Set Owner fields
      setUserId(data.owner.id_user);
      setNamaLengkap(data.owner.nama_lengkap || storeUser.nama_lengkap || "Owner Barbershop");
      setEmail(data.owner.email || storeUser.email || "owner@barberin.test");
      setNoHpOwner(data.owner.no_hp || "0812-3456-7890");

      // Sync with global store so header/sidebar immediately show correct data
      ownerActions.updateUser({
        nama_lengkap: data.owner.nama_lengkap || storeUser.nama_lengkap,
        email: data.owner.email || storeUser.email,
        barbershopName: data.barbershop.nama_barbershop || storeUser.barbershopName,
      });
    } catch (err: any) {
      console.error("Gagal memuat pengaturan:", err);
      toast.error(err?.message || "Gagal memuat pengaturan terkini.");
      // Fallback to store
      setNamaBarbershop(storeUser.barbershopName || "Barbershop");
      setNamaLengkap(storeUser.nama_lengkap || "Owner Barbershop");
      setEmail(storeUser.email || "owner@barberin.test");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!savedData) return false;
    const initialBuka = savedData.barbershop.jam_buka?.replace(" WIB", "") || "08:00";
    const initialTutup = savedData.barbershop.jam_tutup?.replace(" WIB", "") || "21:00";

    const savedLat =
      savedData.barbershop.latitude != null && !isNaN(Number(savedData.barbershop.latitude))
        ? Number(savedData.barbershop.latitude)
        : null;
    const savedLng =
      savedData.barbershop.longitude != null && !isNaN(Number(savedData.barbershop.longitude))
        ? Number(savedData.barbershop.longitude)
        : null;

    const isLocationChanged =
      savedLat === null
        ? location.latitude !== -6.2088 || location.longitude !== 106.8456
        : Math.abs(location.latitude - savedLat) > 0.000001 ||
          Math.abs(location.longitude - (savedLng ?? 0)) > 0.000001;

    const currentSavedEmail = (savedData.owner.email || "").trim().toLowerCase();
    const enteredEmail = email.trim().toLowerCase();
    const isEmailDifferent = enteredEmail !== currentSavedEmail;

    return (
      namaBarbershop !== savedData.barbershop.nama_barbershop ||
      alamat !== (savedData.barbershop.alamat || "") ||
      isLocationChanged ||
      noHpBarbershop !== (savedData.barbershop.no_hp || "") ||
      jamBuka !== initialBuka ||
      jamTutup !== initialTutup ||
      namaLengkap !== savedData.owner.nama_lengkap ||
      isEmailDifferent ||
      noHpOwner !== (savedData.owner.no_hp || "") ||
      newPassword.trim().length > 0
    );
  }, [
    savedData,
    namaBarbershop,
    alamat,
    location,
    noHpBarbershop,
    jamBuka,
    jamTutup,
    namaLengkap,
    email,
    noHpOwner,
    newPassword,
  ]);

  // Reset form to saved data
  const handleReset = () => {
    if (!savedData) return;
    setNamaBarbershop(savedData.barbershop.nama_barbershop);
    setAlamat(savedData.barbershop.alamat || "");
    setNoHpBarbershop(savedData.barbershop.no_hp || "");
    setJamBuka(savedData.barbershop.jam_buka?.replace(" WIB", "") || "08:00");
    setJamTutup(savedData.barbershop.jam_tutup?.replace(" WIB", "") || "21:00");

    const resetLat =
      savedData.barbershop.latitude != null && !isNaN(Number(savedData.barbershop.latitude))
        ? Number(savedData.barbershop.latitude)
        : -6.2088;
    const resetLng =
      savedData.barbershop.longitude != null && !isNaN(Number(savedData.barbershop.longitude))
        ? Number(savedData.barbershop.longitude)
        : 106.8456;
    setLocation({ latitude: resetLat, longitude: resetLng });

    setNamaLengkap(savedData.owner.nama_lengkap);
    setEmail(savedData.owner.email);
    setNoHpOwner(savedData.owner.no_hp || "");
    setNewPassword("");
    setPendingEmail(null);
    setHasPendingPasswordVerification(false);
    toast.info("Perubahan formulir dikembalikan ke data tersimpan.");
  };

  // Kirim ulang link verifikasi email
  const handleResendEmailVerification = async () => {
    if (!pendingEmail || !savedData) return;
    setIsResendingEmail(true);
    try {
      const targetSlug = barbershopSlug || storeUser.barbershopSlug || "barberin";
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/${targetSlug}/owner/verify-email-change`;

      const { error } = await supabase.auth.updateUser(
        { email: pendingEmail },
        { emailRedirectTo: redirectUrl },
      );

      if (error) {
        if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
          toast.error(
            "Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba kembali.",
          );
        } else {
          toast.error(error.message || "Gagal mengirim ulang link verifikasi.");
        }
      } else {
        toast.success("Link verifikasi telah dikirim ulang ke email lama dan email baru Anda.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim ulang verifikasi.");
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Submit reauthentication modal untuk update email
  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError(null);
    setIsReauthing(true);
    try {
      const currentSavedEmail = (savedData?.owner.email || "").trim().toLowerCase();
      const targetSlug = barbershopSlug || storeUser.barbershopSlug || "barberin";

      // 1. Authenticate with Supabase using current password
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: currentSavedEmail,
        password: currentPasswordInput,
      });

      if (authErr || !authData.session) {
        throw new Error("Password akun yang Anda masukkan salah. Silakan coba lagi.");
      }

      // 2. Sesi Supabase terkonfirmasi, jalankan updateUser email
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/${targetSlug}/owner/verify-email-change`;
      const { error: changeErr } = await supabase.auth.updateUser(
        { email: pendingEmailTarget },
        { emailRedirectTo: redirectUrl },
      );

      if (changeErr) {
        if (
          changeErr.message.toLowerCase().includes("already registered") ||
          changeErr.status === 422
        ) {
          throw new Error("Email tersebut sudah digunakan oleh akun lain.");
        }
        throw new Error(changeErr.message || "Gagal memulai verifikasi perubahan email.");
      }

      setPendingEmail(pendingEmailTarget);
      setEmail(currentSavedEmail);
      setIsReauthModalOpen(false);
      setCurrentPasswordInput("");
      toast.success(
        "Link verifikasi telah dikirim. Silakan cek email untuk mengonfirmasi perubahan alamat email.",
      );
    } catch (err: any) {
      setReauthError(err.message || "Gagal mengonfirmasi password.");
    } finally {
      setIsReauthing(false);
    }
  };

  // Submit updates
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!namaBarbershop.trim()) {
      toast.error("Nama Barbershop tidak boleh kosong.");
      return;
    }
    if (!namaLengkap.trim()) {
      toast.error("Nama Lengkap Pemilik tidak boleh kosong.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Email tidak valid.");
      return;
    }
    if (newPassword && newPassword.trim().length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }

    setSaving(true);
    try {
      const currentSavedEmail = (savedData?.owner.email || "").trim().toLowerCase();
      const enteredEmail = email.trim().toLowerCase();
      const isEmailChanged = enteredEmail !== currentSavedEmail;
      const hasNewPassword = newPassword.trim().length > 0;
      const targetSlug = barbershopSlug || storeUser.barbershopSlug || "barberin";

      // 1. Validasi & Inisiasi Pergantian Email (Verifikasi Email Aman)
      if (isEmailChanged) {
        await validateNewOwnerEmail({
          data: { newEmail: enteredEmail },
        });

        // Periksa apakah client Supabase memiliki sesi aktif
        const { data: sessData } = await supabase.auth.getSession();
        if (!sessData?.session) {
          setPendingEmailTarget(enteredEmail);
          setIsReauthModalOpen(true);
          setSaving(false);
          return;
        }

        // Supabase updateUser email
        const baseUrl = window.location.origin;
        const redirectUrl = `${baseUrl}/${targetSlug}/owner/verify-email-change`;
        const { error: changeErr } = await supabase.auth.updateUser(
          { email: enteredEmail },
          { emailRedirectTo: redirectUrl },
        );

        if (changeErr) {
          if (changeErr.message.toLowerCase().includes("session") || changeErr.status === 401) {
            setPendingEmailTarget(enteredEmail);
            setIsReauthModalOpen(true);
            setSaving(false);
            return;
          }
          if (
            changeErr.message.toLowerCase().includes("already registered") ||
            changeErr.status === 422
          ) {
            throw new Error("Email tersebut sudah digunakan oleh akun lain.");
          }
          throw new Error(changeErr.message || "Gagal memulai verifikasi perubahan email.");
        }

        setPendingEmail(enteredEmail);
        setEmail(currentSavedEmail); // Kembalikan nilai form ke email yang saat ini terverifikasi
        toast.success(
          "Link verifikasi telah dikirim. Silakan cek email untuk mengonfirmasi perubahan alamat email.",
        );
      }

      // 2. Validasi & Request Perubahan Password (Verifikasi dikirim ke Email Terdaftar)
      if (hasNewPassword) {
        const trimmedNewPassword = newPassword.trim();
        const pwdRes = await requestOwnerPasswordChange({
          data: {
            newPassword: trimmedNewPassword,
            clientOrigin: window.location.origin,
          },
        });

        setNewPassword("");
        setHasPendingPasswordVerification(true);
        toast.success(pwdRes.message, { duration: 6000 });
      }

      // 3. Update Profil Non-Sensitif & Pengaturan Barbershop
      const initialBuka = savedData?.barbershop.jam_buka?.replace(" WIB", "") || "08:00";
      const initialTutup = savedData?.barbershop.jam_tutup?.replace(" WIB", "") || "21:00";
      const formattedJamBuka = jamBuka.includes("WIB") ? jamBuka : `${jamBuka} WIB`;
      const formattedJamTutup = jamTutup.includes("WIB") ? jamTutup : `${jamTutup} WIB`;

      const savedLat =
        savedData?.barbershop.latitude != null && !isNaN(Number(savedData.barbershop.latitude))
          ? Number(savedData.barbershop.latitude)
          : null;
      const savedLng =
        savedData?.barbershop.longitude != null && !isNaN(Number(savedData.barbershop.longitude))
          ? Number(savedData.barbershop.longitude)
          : null;

      const isLocationChanged =
        savedLat === null
          ? location.latitude !== -6.2088 || location.longitude !== 106.8456
          : Math.abs(location.latitude - savedLat) > 0.000001 ||
            Math.abs(location.longitude - (savedLng ?? 0)) > 0.000001;

      const isProfileOrShopChanged =
        namaBarbershop.trim() !== (savedData?.barbershop.nama_barbershop || "") ||
        alamat.trim() !== (savedData?.barbershop.alamat || "") ||
        noHpBarbershop.trim() !== (savedData?.barbershop.no_hp || "") ||
        jamBuka !== initialBuka ||
        jamTutup !== initialTutup ||
        namaLengkap.trim() !== (savedData?.owner.nama_lengkap || "") ||
        noHpOwner.trim() !== (savedData?.owner.no_hp || "") ||
        isLocationChanged;

      if (isProfileOrShopChanged) {
        const res = await updateOwnerSettings({
          data: {
            id_barbershop: barbershopId || undefined,
            nama_barbershop: namaBarbershop.trim(),
            alamat: alamat.trim(),
            latitude: location.latitude,
            longitude: location.longitude,
            no_hp_barbershop: noHpBarbershop.trim(),
            jam_buka: formattedJamBuka,
            jam_tutup: formattedJamTutup,
            id_user: userId || undefined,
            nama_lengkap: namaLengkap.trim(),
            no_hp_owner: noHpOwner.trim(),
          },
        });

        // Update saved data
        setSavedData(res.data);

        // Update client store state immediately
        ownerActions.updateUser({
          barbershopName: res.data.barbershop.nama_barbershop,
          nama_lengkap: res.data.owner.nama_lengkap,
          no_hp: res.data.owner.no_hp,
          alamat: res.data.barbershop.alamat,
          jam_buka: res.data.barbershop.jam_buka,
          jam_tutup: res.data.barbershop.jam_tutup,
          no_hp_barbershop: res.data.barbershop.no_hp,
        });

        if (!isEmailChanged && !hasNewPassword) {
          toast.success(res.message || "Setelan operasional dan profil owner berhasil diperbarui!");
        }
      }
    } catch (err: any) {
      console.error("Gagal menyimpan setelan:", err);
      toast.error(err?.message || "Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
        <OwnerSidebar activePath="/owner/settings" />
        <div className="flex-1 flex flex-col min-w-0">
          <OwnerMobileHeader activePath="/owner/settings" />
          <OwnerHeader />

          <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-28 lg:pb-12 max-w-[1600px] w-full mx-auto">
            {/* Top Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                    Konfigurasi Sistem
                  </span>
                  {isDirty && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                      Ada perubahan belum disimpan
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight mt-1.5 flex items-center gap-2">
                  <Settings className="h-6 w-6 text-blue-500" />
                  Setelan Operasional
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Kelola profil barbershop, kontak, jam operasional outlet, dan profil akun pemilik.
                </p>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2.5">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving || loading}
                    className="px-4 py-2.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving || loading || !isDirty}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-[0.98] ${
                    isDirty
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-70"
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-foreground font-medium">
                  Memuat data profil dan setelan...
                </p>
                <p className="text-xs text-muted-foreground">Menghubungkan ke database server</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* KIRI: Profil Barbershop (7 Cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30 shadow-inner">
                            <Store className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                              Profil Barbershop
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                OUTLET AKTIF
                              </span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              Informasi identitas outlet yang ditampilkan kepada pelanggan
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        {/* Nama Barbershop */}
                        <div>
                          <label className="text-foreground font-semibold flex items-center gap-1.5 mb-1.5">
                            <Building2 className="h-3.5 w-3.5 text-blue-500" />
                            Nama Barbershop <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={namaBarbershop}
                            onChange={(e) => setNamaBarbershop(e.target.value)}
                            placeholder="Masukkan nama barbershop..."
                            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Nama ini akan muncul pada judul nota/struk, sistem booking, dan header
                            aplikasi.
                          </p>
                        </div>

                        {/* No HP / WhatsApp Outlet */}
                        <div>
                          <label className="text-foreground font-semibold flex items-center gap-1.5 mb-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                            Nomor Telepon / WhatsApp Outlet
                          </label>
                          <input
                            type="text"
                            value={noHpBarbershop}
                            onChange={(e) => setNoHpBarbershop(e.target.value)}
                            placeholder="Contoh: 0812-3456-7890"
                            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Nomor kontak untuk konfirmasi booking dan layanan pelanggan.
                          </p>
                        </div>

                        {/* Alamat Outlet & Titik Lokasi Maps */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-foreground font-semibold flex items-center gap-1.5 mb-1.5">
                              <MapPin className="h-3.5 w-3.5 text-rose-500" />
                              Alamat Outlet Barbershop
                            </label>
                            <textarea
                              rows={2}
                              value={alamat}
                              onChange={(e) => setAlamat(e.target.value)}
                              placeholder="Alamat lengkap lokasi fisik outlet..."
                              className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm resize-none"
                            />
                          </div>

                          {/* Interactive Leaflet Maps with Marker matching Register */}
                          <MapPicker
                            value={location}
                            onChange={(loc) => {
                              setLocation(loc);
                              if (loc.address) {
                                setAlamat(loc.address);
                              }
                            }}
                            error={null}
                          />
                        </div>

                        {/* Jam Operasional */}
                        <div className="pt-2 border-t border-border">
                          <label className="text-foreground font-semibold flex items-center gap-1.5 mb-2.5">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            Jam Operasional Harian
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="bg-muted/30 border border-border rounded-xl p-3">
                              <span className="text-[11px] text-muted-foreground block mb-1 font-medium">
                                Jam Buka
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={jamBuka.replace(" WIB", "")}
                                  onChange={(e) => setJamBuka(e.target.value)}
                                  className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-xs font-semibold text-muted-foreground">WIB</span>
                              </div>
                            </div>

                            <div className="bg-muted/30 border border-border rounded-xl p-3">
                              <span className="text-[11px] text-muted-foreground block mb-1 font-medium">
                                Jam Tutup
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={jamTutup.replace(" WIB", "")}
                                  onChange={(e) => setJamTutup(e.target.value)}
                                  className="w-full bg-background border border-input text-foreground rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-xs font-semibold text-muted-foreground">WIB</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card: Live Preview Tampilan Publik */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          Preview Tampilan Pelanggan
                        </span>
                        <span className="text-[11px] text-muted-foreground">Live Preview</span>
                      </div>

                      <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-foreground text-sm">
                            {namaBarbershop || "Nama Barbershop"}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            BUKA: {jamBuka} - {jamTutup}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span>{alamat || "Belum ada alamat diisi"}</span>
                        </p>
                        {location.latitude && location.longitude ? (
                          <div className="pt-0.5">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>
                                Preview Tautan Google Maps ({location.latitude.toFixed(4)},{" "}
                                {location.longitude.toFixed(4)})
                              </span>
                            </a>
                          </div>
                        ) : null}
                        {noHpBarbershop && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                            <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>WhatsApp: {noHpBarbershop}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KANAN: Akun Pemilik & Keamanan (5 Cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30 shadow-inner">
                            <ShieldCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-foreground">Akun Pemilik (Owner)</h2>
                            <p className="text-xs text-muted-foreground">
                              Kredensial login & data profil pemilik
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        {/* Nama Lengkap Owner */}
                        <div>
                          <label className="text-foreground font-semibold flex items-center gap-1.5 mb-1.5">
                            <User className="h-3.5 w-3.5 text-primary" />
                            Nama Lengkap Pemilik <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={namaLengkap}
                            onChange={(e) => setNamaLengkap(e.target.value)}
                            placeholder="Nama lengkap Anda..."
                            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                          />
                        </div>

                        {/* Email Owner */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-foreground font-semibold flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-blue-500" />
                              Email Login <span className="text-rose-500">*</span>
                            </label>
                            {pendingEmail && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Verifikasi Tertunda
                              </span>
                            )}
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@barberin.test"
                            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Perubahan email login memerlukan verifikasi link aman yang dikirim ke
                            email terdaftar Anda.
                          </p>

                          {/* Status Pending Verification Banner */}
                          {pendingEmail && (
                            <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2">
                              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-300">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                                <div className="text-xs">
                                  <p className="font-semibold text-amber-600 dark:text-amber-300">
                                    Menunggu Verifikasi Perubahan Email
                                  </p>
                                  <p className="text-[11px] text-amber-700 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                                    Link verifikasi telah dikirim. Silakan cek email lama (
                                    <span className="font-semibold text-foreground">
                                      {savedData?.owner.email}
                                    </span>
                                    ) dan email baru (
                                    <span className="font-semibold text-foreground">{pendingEmail}</span>
                                    ) untuk mengonfirmasi perubahan alamat email.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/20 text-[11px]">
                                <button
                                  type="button"
                                  onClick={handleResendEmailVerification}
                                  disabled={isResendingEmail}
                                  className="text-amber-600 dark:text-amber-300 hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <RefreshCw
                                    className={`h-3 w-3 ${isResendingEmail ? "animate-spin" : ""}`}
                                  />
                                  <span>Kirim Ulang Link Verifikasi</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingEmail(null)}
                                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                  Batalkan Permintaan
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* No HP Owner */}
                        <div>
                          <label className="text-foreground font-semibold flex items-center gap-1.5 mb-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                            Nomor Telepon Pribadi
                          </label>
                          <input
                            type="text"
                            value={noHpOwner}
                            onChange={(e) => setNoHpOwner(e.target.value)}
                            placeholder="Contoh: 0812-3456-7890"
                            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                          />
                        </div>

                        {/* Ganti Password */}
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-foreground font-semibold flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5 text-amber-500" />
                              Ganti Password Baru
                            </label>
                            {hasPendingPasswordVerification && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Verifikasi Terkirim
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Biarkan kosong jika tidak ganti"
                              className="w-full px-3.5 py-2.5 pr-10 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Minimal 6 karakter. Password tidak langsung aktif saat tombol Simpan
                            ditekan, melainkan diverifikasi melalui link yang dikirim ke email
                            terdaftar Anda.
                          </p>

                          {/* Status Pending Password Verification Banner */}
                          {hasPendingPasswordVerification && (
                            <div className="mt-2.5 p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl space-y-1.5">
                              <div className="flex items-start gap-2 text-blue-600 dark:text-blue-300">
                                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                                <div className="text-xs">
                                  <p className="font-semibold text-blue-600 dark:text-blue-300">
                                    Verifikasi Keamanan Password Terkirim
                                  </p>
                                  <p className="text-[11px] text-blue-700 dark:text-blue-200/80 mt-0.5 leading-relaxed">
                                    Tautan verifikasi keamanan telah dikirim ke email terdaftar Anda
                                    (
                                    <span className="font-semibold text-foreground">
                                      {savedData?.owner.email}
                                    </span>
                                    ). Password baru belum aktif sampai Anda membuka email dan
                                    mengklik tautan verifikasi tersebut.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </main>

          <OwnerBottomNav activePath="/owner/settings" />
        </div>

        {/* Modal Konfirmasi Keamanan (Re-authentication) */}
        {isReauthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30 shadow-inner">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Konfirmasi Keamanan Owner</h3>
                  <p className="text-xs text-muted-foreground">Verifikasi identitas pemilik akun</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Untuk mengajukan pergantian email login ke{" "}
                <span className="font-semibold text-primary">{pendingEmailTarget}</span>, masukkan
                kata sandi akun Owner Anda saat ini.
              </p>

              {reauthError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{reauthError}</span>
                </div>
              )}

              <form onSubmit={handleReauthSubmit} className="space-y-4">
                <div className="space-y-1.5 text-xs">
                  <label className="text-foreground font-semibold flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Password Saat Ini <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showReauthPassword ? "text" : "password"}
                      required
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Masukkan password Anda saat ini..."
                      className="w-full px-3.5 py-2.5 pr-10 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReauthPassword(!showReauthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showReauthPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReauthModalOpen(false);
                      setCurrentPasswordInput("");
                      setReauthError(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isReauthing || !currentPasswordInput}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-primary/20"
                  >
                    {isReauthing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <span>Verifikasi & Lanjutkan</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </OwnerAuthGuard>
  );
}
