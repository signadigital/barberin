import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { BarberinLogo } from "@/components/barberin/ui";
import { requestPasswordReset } from "@/lib/owner-auth";

export const Route = createFileRoute("/owner/forgot-password")({
  head: () => ({
    meta: [
      { title: "Lupa Password Owner — BARBERIN" },
      {
        name: "description",
        content: "Permintaan reset password akun Pemilik Barbershop (Owner) BARBERIN.",
      },
    ],
  }),
  component: OwnerForgotPasswordPage,
});

function OwnerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Email wajib diisi.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Format email tidak valid.");
      return;
    }

    setLoading(true);

    try {
      const clientOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await requestPasswordReset({
        data: {
          email: trimmedEmail,
          clientOrigin,
        },
      });

      setSubmitted(true);
      toast.success("Permintaan Terkirim", {
        description: res.message,
      });
    } catch (err: unknown) {
      console.error("[FORGOT PASSWORD ERROR]", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal memproses permintaan reset password. Silakan coba lagi.";
      setError(msg);
      toast.error("Gagal Mengirim Link", { description: msg });
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

        {/* SUBMITTED STATE */}
        {submitted ? (
          <div className="relative z-10 py-2 space-y-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Link Reset Password Terkirim</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                Jika email tersebut terdaftar, kami telah mengirimkan link untuk reset password.
              </p>
            </div>

            <div className="p-4 bg-[#14233D] border border-slate-700/80 rounded-2xl text-left text-xs space-y-2 text-slate-300">
              <div className="font-semibold text-blue-400 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span>Petunjuk Selanjutnya:</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-400">
                <li>Periksa kotak masuk (inbox) atau folder spam pada email Anda.</li>
                <li>Klik tombol atau tautan reset password yang dikirimkan.</li>
                <li>Buka link melalui browser Chrome untuk mengatur password baru.</li>
                <li>Link reset password berlaku selama 24 jam.</li>
              </ol>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors"
              >
                Kirim Ulang ke Email Lain
              </button>

              <Link
                to="/owner/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Login Owner</span>
              </Link>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <div className="relative z-10 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Lupa Password?</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Masukkan email yang digunakan saat mendaftarkan akun Owner BARBERIN.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Akun Owner
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400 pointer-events-none">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@gmail.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Kami akan mengirimkan tautan pemulihan kata sandi yang aman ke email ini.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Link Reset Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Kembali ke Login Owner */}
              <div className="pt-4 border-t border-slate-800 text-center">
                <Link
                  to="/owner/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-medium transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Login Owner</span>
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
