import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Send,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { BarberinLogo } from "@/components/barberin/ui";
import { loginOwnerBpmn, resendVerificationEmail } from "@/lib/owner-auth";
import { getOwnerAuth, ownerActions, useOwner } from "@/lib/owner-store";

export const Route = createFileRoute("/$barbershopSlug/owner/login")({
  head: () => ({
    meta: [
      { title: "Login Owner — BARBERIN" },
      {
        name: "description",
        content:
          "Masuk ke Dashboard Manajemen Owner BARBERIN menggunakan Email atau Nomor Telepon.",
      },
    ],
  }),
  beforeLoad: ({ params }: { params: { barbershopSlug: string } }) => {
    if (typeof window !== "undefined" && getOwnerAuth(params.barbershopSlug)) {
      throw redirect({ to: `/${params.barbershopSlug}/owner/dashboard` as any });
    }
  },
  component: OwnerLoginPage,
});

function OwnerLoginPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useOwner();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status unverified untuk menampilkan opsi kirim ulang email
  const [isUnverifiedError, setIsUnverifiedError] = useState(false);
  const [resending, setResending] = useState(false);

  // Jika sudah login, alihkan langsung ke dashboard
  useEffect(() => {
    if (isLoggedIn || (typeof window !== "undefined" && getOwnerAuth())) {
      navigate({ to: `/${barbershopSlug}/owner/dashboard` as any, replace: true });
    }
  }, [isLoggedIn, navigate]);

  if (isLoggedIn || (typeof window !== "undefined" && getOwnerAuth())) {
    return null;
  }

  const handleResend = async () => {
    if (!identifier.trim()) return;
    setResending(true);
    try {
      await resendVerificationEmail({
        data: {
          email: identifier.trim(),
        },
      });
      toast.success("Email Verifikasi Terkirim", {
        description: "Tautan verifikasi baru telah dikirim ke alamat email Anda.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Silakan coba lagi beberapa saat lagi.";
      toast.error("Gagal Mengirim Ulang", {
        description: msg,
      });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUnverifiedError(false);

    const trimmedIdentifier = identifier.trim();

    // 1. Validasi Format Input (BPMN 02)
    if (!trimmedIdentifier) {
      setError("Email atau nomor telepon tidak boleh kosong.");
      return;
    }

    if (!password) {
      setError("Password tidak boleh kosong.");
      return;
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    // Deteksi cepat jika format jelas salah
    if (trimmedIdentifier.includes("@")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedIdentifier)) {
        setError("Format email tidak valid.");
        return;
      }
    } else {
      const cleanPhone = trimmedIdentifier.replace(/[\s\-()]/g, "");
      if (!/^[0-9+]+$/.test(cleanPhone) || cleanPhone.replace(/^\+/, "").length < 8) {
        setError("Format nomor telepon tidak valid. Minimal 8 digit angka.");
        return;
      }
    }

    setLoading(true);

    try {
      const res = await loginOwnerBpmn({
        data: {
          identifier: trimmedIdentifier,
          password,
          barbershopSlug,
        },
      });

      ownerActions.login({
        id_user: res.id_user,
        email: res.email,
        nama_lengkap: res.nama_lengkap,
        role: res.role,
        id_barbershop: res.barbershop.id_barbershop,
        barbershopName: res.barbershop.nama_barbershop,
      });

      toast.success("Login Berhasil", {
        description: `Selamat datang kembali, ${res.nama_lengkap}!`,
      });

      navigate({ to: `/${barbershopSlug}/owner/dashboard` as any, replace: true });
    } catch (err: unknown) {
      console.error("Login error:", err);
      let msg = err instanceof Error ? err.message : "Email/nomor telepon atau password salah.";

      if (
        msg.includes("Failed query") ||
        msg.includes("CONNECT_TIMEOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("ETIMEDOUT")
      ) {
        msg = "Gagal terhubung ke server database. Periksa koneksi internet Anda.";
      }

      if (msg.includes("Akun belum terverifikasi")) {
        setIsUnverifiedError(true);
      }

      setError(msg);
      toast.error("Gagal Masuk", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-[#0F1D33] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <BarberinLogo className="h-16 w-16 mb-4 drop-shadow-lg" />
          <h1 className="text-2xl font-black text-white tracking-wider">BARBERIN</h1>
          <p className="text-xs text-slate-400 mt-1">Owner Management System</p>
          <div className="mt-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-semibold text-blue-400">
            Portal Pemilik Barbershop
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-rose-300 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>

            {/* Opsi Kirim Ulang Email jika akun belum terverifikasi */}
            {isUnverifiedError && identifier.includes("@") && (
              <div className="pt-2 border-t border-rose-500/20 flex justify-end">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  <span>{resending ? "Mengirim..." : "Kirim Ulang Link Verifikasi"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* BPMN 02 Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email / Nomor Telepon
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400 pointer-events-none">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="owner@gmail.com atau 081234567890"
                className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Masukkan alamat email atau nomor telepon yang terdaftar.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Registration Navigation Link */}
          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            Belum memiliki akun Barbershop?{" "}
            <Link to={`/${barbershopSlug}/owner/register` as any} className="text-blue-400 hover:text-blue-300 font-semibold">
              Daftar di sini
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
