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
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { useOwner, ownerActions } from "@/lib/owner-store";
import {
  getOwnerSettings,
  updateOwnerSettings,
  type OwnerSettingsData,
} from "@/lib/owner-settings";

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

  // Form states - Owner
  const [userId, setUserId] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [noHpOwner, setNoHpOwner] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load settings from DB on mount
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getOwnerSettings();
      setSavedData(data);

      // Set Barbershop fields
      setBarbershopId(data.barbershop.id_barbershop);
      setNamaBarbershop(data.barbershop.nama_barbershop || storeUser.barbershopName || "Barbershop");
      setAlamat(data.barbershop.alamat || "Jl. Jenderal Soedirman No. 123, Purbalingga");
      setNoHpBarbershop(data.barbershop.no_hp || "0812-3456-7890");
      setJamBuka(data.barbershop.jam_buka?.replace(" WIB", "") || "08:00");
      setJamTutup(data.barbershop.jam_tutup?.replace(" WIB", "") || "21:00");

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

    return (
      namaBarbershop !== savedData.barbershop.nama_barbershop ||
      alamat !== (savedData.barbershop.alamat || "") ||
      noHpBarbershop !== (savedData.barbershop.no_hp || "") ||
      jamBuka !== initialBuka ||
      jamTutup !== initialTutup ||
      namaLengkap !== savedData.owner.nama_lengkap ||
      email !== savedData.owner.email ||
      noHpOwner !== (savedData.owner.no_hp || "") ||
      newPassword.trim().length > 0
    );
  }, [
    savedData,
    namaBarbershop,
    alamat,
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
    setNamaLengkap(savedData.owner.nama_lengkap);
    setEmail(savedData.owner.email);
    setNoHpOwner(savedData.owner.no_hp || "");
    setNewPassword("");
    toast.info("Perubahan formulir dikembalikan ke data tersimpan.");
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
    if (newPassword && newPassword.length < 4) {
      toast.error("Password baru minimal 4 karakter.");
      return;
    }

    setSaving(true);
    try {
      const formattedJamBuka = jamBuka.includes("WIB") ? jamBuka : `${jamBuka} WIB`;
      const formattedJamTutup = jamTutup.includes("WIB") ? jamTutup : `${jamTutup} WIB`;

      const res = await updateOwnerSettings({
        data: {
          id_barbershop: barbershopId || undefined,
          nama_barbershop: namaBarbershop.trim(),
          alamat: alamat.trim(),
          no_hp_barbershop: noHpBarbershop.trim(),
          jam_buka: formattedJamBuka,
          jam_tutup: formattedJamTutup,
          id_user: userId || undefined,
          nama_lengkap: namaLengkap.trim(),
          email: email.trim().toLowerCase(),
          no_hp_owner: noHpOwner.trim(),
          new_password: newPassword.trim() || undefined,
        },
      });

      // Update saved data
      setSavedData(res.data);
      setNewPassword("");

      // Update client store state immediately
      ownerActions.updateUser({
        barbershopName: res.data.barbershop.nama_barbershop,
        nama_lengkap: res.data.owner.nama_lengkap,
        email: res.data.owner.email,
        no_hp: res.data.owner.no_hp,
        alamat: res.data.barbershop.alamat,
        jam_buka: res.data.barbershop.jam_buka,
        jam_tutup: res.data.barbershop.jam_tutup,
        no_hp_barbershop: res.data.barbershop.no_hp,
      });

      toast.success(res.message || "Setelan berhasil diperbarui!");
    } catch (err: any) {
      console.error("Gagal menyimpan setelan:", err);
      toast.error(err?.message || "Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/settings" />
      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/settings" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-28 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Top Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0F1D33]/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                  Konfigurasi Sistem
                </span>
                {isDirty && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                    Ada perubahan belum disimpan
                  </span>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mt-1.5 flex items-center gap-2">
                <Settings className="h-6 w-6 text-blue-400" />
                Setelan Operasional
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
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
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
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
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 ring-2 ring-blue-400/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-70"
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
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-sm text-slate-300 font-medium">Memuat data profil dan setelan...</p>
              <p className="text-xs text-slate-500">Menghubungkan ke database server</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* KIRI: Profil Barbershop (7 Cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center ring-1 ring-blue-500/30 shadow-inner">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white flex items-center gap-2">
                            Profil Barbershop
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              OUTLET AKTIF
                            </span>
                          </h2>
                          <p className="text-xs text-slate-400">
                            Informasi identitas outlet yang ditampilkan kepada pelanggan
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Nama Barbershop */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <Building2 className="h-3.5 w-3.5 text-blue-400" />
                          Nama Barbershop <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={namaBarbershop}
                          onChange={(e) => setNamaBarbershop(e.target.value)}
                          placeholder="Masukkan nama barbershop..."
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Nama ini akan muncul pada judul nota/struk, sistem booking, dan header aplikasi.
                        </p>
                      </div>

                      {/* No HP / WhatsApp Outlet */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <Phone className="h-3.5 w-3.5 text-emerald-400" />
                          Nomor Telepon / WhatsApp Outlet
                        </label>
                        <input
                          type="text"
                          value={noHpBarbershop}
                          onChange={(e) => setNoHpBarbershop(e.target.value)}
                          placeholder="Contoh: 0812-3456-7890"
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Nomor kontak untuk konfirmasi booking dan layanan pelanggan.
                        </p>
                      </div>

                      {/* Alamat Outlet */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <MapPin className="h-3.5 w-3.5 text-rose-400" />
                          Alamat Outlet Barbershop
                        </label>
                        <textarea
                          rows={3}
                          value={alamat}
                          onChange={(e) => setAlamat(e.target.value)}
                          placeholder="Alamat lengkap lokasi fisik outlet..."
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm resize-y"
                        />
                      </div>

                      {/* Jam Operasional */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-2.5">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          Jam Operasional Harian
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="bg-[#14233D] border border-slate-700/80 rounded-xl p-3">
                            <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                              Jam Buka
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={jamBuka.replace(" WIB", "")}
                                onChange={(e) => setJamBuka(e.target.value)}
                                className="w-full bg-[#0F1D33] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs font-semibold text-slate-400">WIB</span>
                            </div>
                          </div>

                          <div className="bg-[#14233D] border border-slate-700/80 rounded-xl p-3">
                            <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                              Jam Tutup
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={jamTutup.replace(" WIB", "")}
                                onChange={(e) => setJamTutup(e.target.value)}
                                className="w-full bg-[#0F1D33] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs font-semibold text-slate-400">WIB</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Live Preview Tampilan Publik */}
                  <div className="bg-gradient-to-br from-[#0F1D33] to-[#122340] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        Preview Tampilan Pelanggan
                      </span>
                      <span className="text-[11px] text-slate-400">Live Preview</span>
                    </div>

                    <div className="bg-[#0B1526] border border-slate-700/60 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">
                          {namaBarbershop || "Nama Barbershop"}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          BUKA: {jamBuka} - {jamTutup}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{alamat || "Belum ada alamat diisi"}</span>
                      </p>
                      {noHpBarbershop && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                          <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>WhatsApp: {noHpBarbershop}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* KANAN: Akun Pemilik & Keamanan (5 Cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center ring-1 ring-purple-500/30 shadow-inner">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white">Akun Pemilik (Owner)</h2>
                          <p className="text-xs text-slate-400">Kredensial login & data profil pemilik</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Nama Lengkap Owner */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <User className="h-3.5 w-3.5 text-purple-400" />
                          Nama Lengkap Pemilik <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={namaLengkap}
                          onChange={(e) => setNamaLengkap(e.target.value)}
                          placeholder="Nama lengkap Anda..."
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
                        />
                      </div>

                      {/* Email Owner */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <Mail className="h-3.5 w-3.5 text-blue-400" />
                          Email Login <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="email@barberin.test"
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
                        />
                      </div>

                      {/* No HP Owner */}
                      <div>
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <Phone className="h-3.5 w-3.5 text-emerald-400" />
                          Nomor Telepon Pribadi
                        </label>
                        <input
                          type="text"
                          value={noHpOwner}
                          onChange={(e) => setNoHpOwner(e.target.value)}
                          placeholder="Contoh: 0812-3456-7890"
                          className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
                        />
                      </div>

                      {/* Ganti Password */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                          Ganti Password Baru
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Biarkan kosong jika tidak ganti"
                            className="w-full px-3.5 py-2.5 pr-10 bg-[#14233D] border border-slate-700/80 rounded-xl text-white font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Minimal 4 karakter. Hanya diisi saat Anda ingin memperbarui sandi login.
                        </p>
                      </div>

                      {/* Role Hak Akses */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <div>
                          <label className="text-slate-400 block mb-0.5">Peran Sistem</label>
                          <span className="text-xs text-slate-300 font-medium">Akses Tertinggi (Super User)</span>
                        </div>
                        <span className="inline-block px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold uppercase tracking-wider text-[11px]">
                          OWNER (PENGELOLA)
                        </span>
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
    </div>
  );
}
