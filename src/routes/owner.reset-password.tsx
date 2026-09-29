import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { BarberinLogo } from "@/components/barberin/ui";
import { supabase } from "@/lib/supabase-client";
import { ownerActions } from "@/lib/owner-store";
import { validateOwnerRecoveryContext } from "@/lib/owner-auth";

export const Route = createFileRoute("/owner/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Password Baru — BARBERIN" },
      {
        name: "description",
        content: "Atur password baru untuk mengamankan akun Owner BARBERIN Anda.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: typeof search["code"] === "string" ? search["code"] : "",
      token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : "",
      type: typeof search["type"] === "string" ? search["type"] : "",
      error: typeof search["error"] === "string" ? search["error"] : "",
      error_code: typeof search["error_code"] === "string" ? search["error_code"] : "",
      error_description:
        typeof search["error_description"] === "string" ? search["error_description"] : "",
    };
  },
  component: OwnerResetPasswordPage,
});

function OwnerResetPasswordPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // Status sesi: "verifying" | "valid" | "invalid"
  const [sessionStatus, setSessionStatus] = useState<"verifying" | "valid" | "invalid">(
    "verifying",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Form states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validationStarted = useRef(false);

  useEffect(() => {
    if (validationStarted.current) return;
    validationStarted.current = true;

    let isMounted = true;

    // Helper untuk memverifikasi role Owner di database server (DIFF 9)
    const verifyOwnerRole = async (userId: string) => {
      const res = await validateOwnerRecoveryContext({ data: { userId } });
      return res;
    };

    // Bersihkan hash fragment atau parameter sensitif dari URL bar (DIFF 8)
    const sanitizeUrlBar = () => {
      if (typeof window !== "undefined" && window.history && window.location.hash) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    };

    // 1. Dengarkan event auth Supabase untuk mendeteksi event PASSWORD_RECOVERY secara realtime
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session?.user)) {
        try {
          if (session?.user?.id) {
            await verifyOwnerRole(session.user.id);
            if (isMounted) {
              setSessionStatus("valid");
              sanitizeUrlBar();
            }
          }
        } catch (err: unknown) {
          console.warn("[RESET-PASSWORD] Owner role verification error:", err);
          if (isMounted) {
            setSessionStatus("invalid");
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
            );
          }
        }
      }
    });

    const verifyRecoverySession = async () => {
      try {
        // Cek jika Supabase mengirimkan error langsung di query params atau hash
        if (searchParams.error || searchParams.error_description) {
          throw new Error(
            "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
          );
        }

        // Kumpulkan parameter dari URL
        let activeCode = searchParams.code?.trim() || "";
        let activeTokenHash = searchParams.token_hash?.trim() || "";
        let activeType = searchParams.type?.trim() || "recovery";

        let hashAccessToken: string | null = null;
        let hashRefreshToken: string | null = null;
        let hashError: string | null = null;

        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          if (!activeCode && urlParams.get("code")) activeCode = urlParams.get("code")!.trim();
          if (!activeTokenHash && urlParams.get("token_hash"))
            activeTokenHash = urlParams.get("token_hash")!.trim();
          if (urlParams.get("type")) activeType = urlParams.get("type")!.trim();

          // Periksa hash fragment (#access_token=... atau #error_description=...)
          if (window.location.hash) {
            const rawHash = window.location.hash.replace(/^#/, "");
            const hashParams = new URLSearchParams(rawHash);
            hashAccessToken = hashParams.get("access_token");
            hashRefreshToken = hashParams.get("refresh_token");
            hashError = hashParams.get("error") || hashParams.get("error_description");
            const hashToken = hashParams.get("token_hash");
            const hashCode = hashParams.get("code");
            if (!activeTokenHash && hashToken) activeTokenHash = hashToken.trim();
            if (!activeCode && hashCode) activeCode = hashCode.trim();
          }
        }

        if (hashError) {
          throw new Error(
            "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
          );
        }

        // PRIORITAS 1: Hash Fragment Access Token (Aliran pemulihan resmi tanpa dependensi PKCE storage)
        if (hashAccessToken) {
          const { data: sessData, error: sessError } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken || "",
          });

          if (sessError || !sessData.session?.user) {
            throw new Error(
              "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
            );
          }

          // Verifikasi bahwa user adalah Owner BARBERIN yang aktif (DIFF 9)
          await verifyOwnerRole(sessData.session.user.id);

          if (isMounted) {
            setSessionStatus("valid");
            sanitizeUrlBar();
          }
          return;
        }

        // PRIORITAS 2: Token Hash OTP Verify (Dukungan token_hash langsung via verifyOtp)
        if (activeTokenHash) {
          const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: activeTokenHash,
            type: "recovery",
          });

          if (otpError || !otpData.session?.user) {
            throw new Error(
              "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
            );
          }

          await verifyOwnerRole(otpData.session.user.id);

          if (isMounted) {
            setSessionStatus("valid");
            sanitizeUrlBar();
          }
          return;
        }

        // PRIORITAS 3: Cek sesi aktif yang sudah terverifikasi (misal dari onAuthStateChange otomatis)
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user) {
          await verifyOwnerRole(currentSession.session.user.id);
          if (isMounted) {
            setSessionStatus("valid");
            sanitizeUrlBar();
          }
          return;
        }

        // PRIORITAS 4: PKCE Code Exchange (Fallback graceful)
        if (activeCode) {
          try {
            const { data: exData, error: exError } =
              await supabase.auth.exchangeCodeForSession(activeCode);

            if (exError || !exData.session?.user) {
              throw exError || new Error("Exchange code gagal.");
            }

            await verifyOwnerRole(exData.session.user.id);

            if (isMounted) {
              setSessionStatus("valid");
              sanitizeUrlBar();
            }
            return;
          } catch {
            throw new Error(
              "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
            );
          }
        }

        // Jika tidak ada kredensial pemulihan apapun
        throw new Error(
          "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
        );
      } catch (err: unknown) {
        if (!isMounted) return;
        setSessionStatus("invalid");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi.",
        );
      }
    };

    verifyRecoverySession();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    // 1. Validasi Input (DIFF 11 H & I)
    if (!trimmedPassword) {
      setFormError("Password baru wajib diisi.");
      return;
    }

    if (trimmedPassword.length < 6) {
      setFormError("Password minimal 6 karakter.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setFormError("Konfirmasi password tidak sama.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Update password melalui Supabase Auth (DIFF 7)
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (updateError) {
        console.error("[SUPABASE UPDATE PASSWORD ERROR]", updateError.status, updateError.message);
        let msg = updateError.message;
        if (msg.toLowerCase().includes("same_password")) {
          msg = "Password baru tidak boleh sama dengan password lama Anda.";
        } else {
          msg = "Gagal memperbarui password. Silakan coba lagi beberapa saat lagi.";
        }
        throw new Error(msg);
      }

      // 3. Keluarkan dari recovery session & hapus local state agar Owner login ulang dengan password baru (DIFF 7 & 9)
      try {
        await supabase.auth.signOut();
      } catch {}
      ownerActions.logout();

      setIsSuccess(true);
      toast.success("Password Berhasil Diubah", {
        description:
          "Password Owner Anda telah berhasil diperbarui. Silakan login menggunakan password baru.",
      });

      // 4. Arahkan kembali ke Login Owner setelah 2.5 detik (DIFF 7)
      setTimeout(() => {
        navigate({ to: "/owner/login", replace: true });
      }, 2500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal memperbarui password. Silakan coba lagi beberapa saat lagi.";
      setFormError(msg);
      toast.error("Gagal Mengubah Password", { description: msg });
    } finally {
      setIsSubmitting(false);
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

        {/* STATE 1: VERIFYING SESSION */}
        {sessionStatus === "verifying" && (
          <div className="relative z-10 py-8 space-y-4 text-center animate-in fade-in">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
            <h2 className="text-base font-bold text-white">Memvalidasi Link Reset Password...</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Sistem sedang memverifikasi token pemulihan akun Anda. Mohon tunggu sebentar.
            </p>
          </div>
        )}

        {/* STATE 2: INVALID TOKEN / LINK EXPIRED (DIFF 5 & 6) */}
        {sessionStatus === "invalid" && (
          <div className="relative z-10 py-4 space-y-5 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Link Reset Password Tidak Valid</h2>
              <p className="text-xs text-rose-300 max-w-xs mx-auto leading-relaxed">
                {errorMessage ||
                  "Link reset password sudah kedaluwarsa, sudah digunakan, atau tidak dapat diverifikasi."}
              </p>
            </div>

            <div className="p-3.5 bg-[#14233D] border border-slate-700/80 rounded-2xl text-left text-xs space-y-1.5 text-slate-400">
              <div className="font-semibold text-slate-300">Kemungkinan penyebab:</div>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Link sudah kedaluwarsa (masa aktif maksimal 24 jam)</li>
                <li>Link sudah pernah digunakan sebelumnya</li>
                <li>Tautan terpotong atau dibuka melalui aplikasi yang tidak mendukung</li>
              </ul>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                to="/owner/forgot-password"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Kirim Link Baru</span>
              </Link>

              <Link
                to="/owner/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali ke Login</span>
              </Link>
            </div>
          </div>
        )}

        {/* STATE 3: SUCCESS STATE (DIFF 7) */}
        {sessionStatus === "valid" && isSuccess && (
          <div className="relative z-10 py-6 space-y-5 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white">Password Berhasil Diubah</h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Password Owner Anda telah berhasil diperbarui. Silakan login menggunakan password
                baru.
              </p>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Mengarahkan ke halaman login...</span>
            </div>

            <div className="pt-2">
              <Link
                to="/owner/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                <span>Masuk Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* STATE 4: VALID SESSION FORM (DIFF 5 & 6) */}
        {sessionStatus === "valid" && !isSuccess && (
          <div className="relative z-10 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Atur Password Baru</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Buat password baru untuk mengamankan akun Owner BARBERIN Anda.
              </p>
            </div>

            {/* Error Alert */}
            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="font-medium leading-relaxed">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
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
                <p className="text-[10px] text-slate-500 mt-1">Minimal 6 karakter.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#14233D] text-sm text-white placeholder-slate-500 border border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span>Simpan Password Baru</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-slate-800 text-center">
                <Link
                  to="/owner/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-medium transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Batal dan Kembali ke Login</span>
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
