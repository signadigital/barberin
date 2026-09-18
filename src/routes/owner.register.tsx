import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Lock,
  Mail,
  Phone,
  User,
  Building2,
  MapPin,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Loader2,
  MailCheck,
  ExternalLink,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { BarberinLogo } from "@/components/barberin/ui";
import { MapPicker, type MapLocation } from "@/components/owner/map-picker";
import { registerOwner, resendVerificationEmail } from "@/lib/owner-auth";
import { normalizePhoneNumber } from "@/lib/auth-utils";
import { getOwnerAuth, useOwner } from "@/lib/owner-store";

export const Route = createFileRoute("/owner/register")({
  head: () => ({
    meta: [
      { title: "Registrasi Owner Baru — BARBERIN" },
      {
        name: "description",
        content: "Daftarkan Barbershop dan akun Owner baru di platform BARBERIN.",
      },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("barberin_owner_auth_user");
        if (raw) {
          const u = JSON.parse(raw);
          if (u?.barbershopSlug) {
            throw redirect({ to: `/${u.barbershopSlug}/owner/dashboard` as any });
          }
        }
      } catch {}
    }
  },
  component: OwnerRegisterPage,
});

function OwnerRegisterPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useOwner();

  // Form states
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [noHp, setNoHp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [namaBarbershop, setNamaBarbershop] = useState("");
  const [alamat, setAlamat] = useState("");
  const [location, setLocation] = useState<MapLocation>({
    latitude: -6.2088, // Default Jakarta
    longitude: 106.8456,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    email: string;
    ownerName: string;
    businessName: string;
    barbershopSlug?: string;
    emailSent: boolean;
    emailError: string | null;
    message?: string;
    devLink?: string | undefined;
  } | null>(null);

  // Jika sudah login, alihkan ke dashboard
  useEffect(() => {
    if (isLoggedIn && user.barbershopSlug) {
      navigate({ to: `/${user.barbershopSlug}/owner/dashboard` as any, replace: true });
    }
  }, [isLoggedIn, user.barbershopSlug, navigate]);

  const triggerError = (msg: string) => {
    setError(msg);
    toast.error("Validasi Registrasi", { description: msg });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!namaLengkap.trim()) {
      triggerError("Nama lengkap pemilik wajib diisi.");
      return;
    }

    if (!email.trim()) {
      triggerError("Email wajib diisi.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      triggerError("Format email tidak valid.");
      return;
    }

    if (!noHp.trim()) {
      triggerError("Nomor telepon wajib diisi.");
      return;
    }

    const cleanedPhone = normalizePhoneNumber(noHp);
    if (!/^[0-9]+$/.test(cleanedPhone) || cleanedPhone.length < 8 || cleanedPhone.length > 15) {
      triggerError("Nomor telepon tidak valid. Masukkan minimal 8 digit angka (contoh: 08123456789 atau +628123456789).");
      return;
    }

    if (!password) {
      triggerError("Password wajib diisi.");
      return;
    }

    if (password.length < 6) {
      triggerError("Password minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      triggerError("Konfirmasi password tidak cocok dengan password yang diinput.");
      return;
    }

    if (!namaBarbershop.trim()) {
      triggerError("Nama barbershop wajib diisi.");
      return;
    }

    if (!location.latitude || !location.longitude) {
      triggerError("Titik lokasi barbershop wajib dipilih pada peta.");
      return;
    }

    setLoading(true);

    try {
      const res = await registerOwner({
        data: {
          nama_lengkap: namaLengkap.trim(),
          email: email.trim(),
          no_hp: cleanedPhone,
          password,
          nama_barbershop: namaBarbershop.trim(),
          alamat: alamat.trim() || undefined,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });

      setSuccessData({
        email: res.email,
        ownerName: res.ownerName,
        businessName: res.businessName,
        barbershopSlug: (res as any).slug,
        emailSent: res.emailSent,
        emailError: null,
        message: res.message,
      });

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      toast.success("Registrasi Berhasil!", {
        description: `Email konfirmasi telah dikirim ke ${res.email}. Silakan periksa kotak masuk Gmail Anda.`,
      });
    } catch (err: unknown) {
      console.error(err);
      let msg =
        err instanceof Error ? err.message : "Gagal melakukan registrasi. Silakan coba lagi.";
      if (
        msg.includes("Failed query") ||
        msg.includes("CONNECT_TIMEOUT") ||
        msg.includes("ETIMEDOUT")
      ) {
        msg = "Gagal terhubung ke database. Periksa koneksi internet Anda.";
      }
      setError(msg);
      toast.error("Registrasi Gagal", { description: msg });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!successData?.email || isResending) return;
    setIsResending(true);
    try {
      const res = await resendVerificationEmail({
        data: { email: successData.email },
      });
      setSuccessData((prev) =>
        prev
          ? {
              ...prev,
              emailSent: true,
              emailError: null,
            }
          : null,
      );
      toast.success("Email Terkirim!", {
        description: res.message || `Email konfirmasi berhasil dikirim ke ${successData.email}. Silakan cek inbox Gmail.`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengirim ulang email verifikasi.";
      toast.error("Gagal Mengirim Email", { description: msg });
      setSuccessData((prev) =>
        prev ? { ...prev, emailSent: false, emailError: msg } : null,
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4 py-12 antialiased">
      <div className="w-full max-w-xl bg-[#0F1D33] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <BarberinLogo className="h-16 w-16 mb-4 drop-shadow-lg" />
          <h1 className="text-2xl font-black text-white tracking-wider">BARBERIN</h1>
          <p className="text-xs text-slate-400 mt-1">Owner Registration Portal</p>
          <div className="mt-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Daftar Pemilik & Barbershop Baru</span>
          </div>
        </div>

        {/* SUCCESS STATE */}
        {successData ? (
          <div className="relative z-10 text-center py-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {successData.emailSent ? (
              /* CASE 1: EMAIL RESMI BERHASIL DIKIRIM KE GMAIL RECIPIENT */
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <MailCheck className="h-8 w-8" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white tracking-wide">
                    Registrasi Berhasil!
                  </h2>
                  <p className="text-xs text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                    Email verifikasi resmi telah dikirim ke alamat Gmail Anda:
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-semibold text-blue-300">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>{successData.email}</span>
                  </div>
                </div>

                {/* FLOW UTAMA: PETUNJUK GMAIL */}
                <div className="p-4 bg-[#14233D] border border-blue-500/30 rounded-2xl text-left space-y-3 shadow-inner">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="flex h-5 w-5 rounded-full bg-blue-600 text-[11px] items-center justify-center font-black">
                      !
                    </span>
                    <span>Langkah Selanjutnya (Aktivasi Akun):</span>
                  </div>

                  <ol className="text-xs text-slate-300 space-y-2 pl-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">1.</span>
                      <span>
                        Buka kotak masuk Gmail di{" "}
                        <strong className="text-white">{successData.email}</strong> (periksa folder{" "}
                        <em>Spam</em> atau <em>Promosi</em> jika belum terlihat).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">2.</span>
                      <span>
                        Buka email dari <strong>BARBERIN / Supabase</strong> dengan subjek:{" "}
                        <strong className="text-blue-300">"Confirm Your Signup"</strong> atau{" "}
                        <strong className="text-blue-300">"Verifikasi Email Akun BARBERIN"</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">3.</span>
                      <span>
                        Klik tombol{" "}
                        <strong className="text-emerald-400">"VERIFIKASI EMAIL"</strong> pada email
                        tersebut.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">4.</span>
                      <span>
                        Akun dan Barbershop Anda akan otomatis terverifikasi dan aktif, lalu Anda
                        langsung dialihkan ke <strong>Owner Dashboard</strong>.
                      </span>
                    </li>
                  </ol>

                  <div className="pt-2">
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Buka Kotak Masuk Gmail</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </a>
                  </div>
                </div>
              </>
            ) : (
              /* CASE 2: EMAIL GAGAL DIKIRIM (CONFIG / QUOTA / UNVERIFIED DOMAIN) */
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
                  <AlertTriangle className="h-8 w-8" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Akun Dibuat — Verifikasi Tertunda
                  </h2>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Data Owner dan Barbershop Anda berhasil didaftarkan di sistem, namun pengiriman
                    email verifikasi ke <span className="text-amber-300 font-medium">{successData.email}</span> belum berhasil dikirim.
                  </p>
                </div>

                {/* Error Callout */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-2">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    <span>Detail Kendala Pengiriman Email:</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {successData.emailError ||
                      "Layanan email belum aktif atau konfigurasi API Key / Domain pengirim belum lengkap."}
                  </p>
                </div>

                {/* Tombol Kirim Ulang */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={isResending}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all"
                  >
                    {isResending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>
                      {isResending
                        ? "Mencoba Mengirim Ulang..."
                        : "Kirim Ulang Email Verifikasi"}
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* RINGKASAN DATA AKUN */}
            <div className="p-4 bg-[#14233D] border border-slate-700/80 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Pemilik:</span>
                <span className="text-white font-medium">{successData.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Barbershop:</span>
                <span className="text-white font-medium">{successData.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Akun:</span>
                <span className="text-amber-400 font-medium">Pending Verification</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Masa Berlaku Token:</span>
                <span className="text-slate-300">1 x 24 Jam (Single-use)</span>
              </div>
            </div>

            {/* Tombol Kirim Ulang (Secondary jika email sudah berstatus terkirim) */}
            {successData.emailSent && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
                >
                  {isResending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>Belum menerima email? Kirim ulang link verifikasi</span>
                </button>
              </div>
            )}

            {/* DEV LINK FALLBACK (Tertutup / Sekunder di bawah) */}
            {successData.devLink && (
              <details className="group border border-slate-800 bg-[#0A1424]/60 rounded-xl p-3 text-left">
                <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-400 flex items-center justify-between list-none select-none">
                  <span>🔧 Opsi Pengembang (Development Fallback Link)</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-2.5 text-[11px] text-slate-400 space-y-2 border-t border-slate-800/80 mt-2">
                  <p>
                    Tautan ini hanya disediakan sebagai fallback pengembangan lokal jika inbox email
                    tujuan belum dapat diakses secara langsung:
                  </p>
                  <a
                    href={successData.devLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-xs border border-slate-700 transition-colors"
                  >
                    <span>Buka Link Verifikasi Manual</span>
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </details>
            )}

            <div className="pt-1">
              <Link
                to={successData?.barbershopSlug ? (`/${successData.barbershopSlug}/owner/login` as any) : ("/" as any)}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold border border-slate-800 transition-colors"
              >
                <span>Kembali ke Halaman Login</span>
              </Link>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* Error Alert */}
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: Identitas Pemilik */}
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  1. Identitas Pemilik (Owner)
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Lengkap Pemilik <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Owner <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nomor Telepon <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={noHp}
                      onChange={(e) => setNoHp(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Konfirmasi Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Identitas Bisnis & Barbershop */}
            <div className="space-y-4 pt-2">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  2. Identitas Barbershop / Bisnis
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Barbershop / Bisnis <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={namaBarbershop}
                    onChange={(e) => setNamaBarbershop(e.target.value)}
                    placeholder="Contoh: Barbershop Prime Studio"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Alamat Lengkap Barbershop
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={2}
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Jl. Jenderal Sudirman No. 45, Jakarta Pusat"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* SECTION 3: Address Pointer (Google Maps / Koordinat) */}
              <MapPicker value={location} onChange={(loc) => setLocation(loc)} error={null} />
            </div>

            <div className="pt-2 space-y-3">
              {/* Bottom Error Alert for direct visibility */}
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Mendaftarkan Akun & Barbershop...</span>
                  </>
                ) : (
                  <>
                    <span>Daftar Akun Owner</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center text-xs text-slate-400">
                Sudah memiliki akun Owner?{" "}
                <Link to={"/" as any} className="text-blue-400 hover:text-blue-300 font-semibold">
                  Masuk di sini
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
