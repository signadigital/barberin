import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";
import { TenantLogo } from "@/components/tenant/TenantLogo";
import { supabase } from "@/lib/supabase-client";
import { getPendingPasswordState, finalizePasswordChange } from "@/lib/owner-settings";
import { ownerActions } from "@/lib/owner-store";

export const Route = createFileRoute("/$barbershopSlug/owner/verify-password-change")({
  head: () => ({
    meta: [
      { title: "Verifikasi Perubahan Password Owner — BARBERIN" },
      {
        name: "description",
        content: "Konfirmasi dan verifikasi perubahan kata sandi akun Owner BARBERIN.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: typeof search["code"] === "string" ? search["code"] : "",
      token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : "",
      type: typeof search["type"] === "string" ? search["type"] : "recovery",
      error: typeof search["error"] === "string" ? search["error"] : "",
      error_code: typeof search["error_code"] === "string" ? search["error_code"] : "",
      error_description:
        typeof search["error_description"] === "string" ? search["error_description"] : "",
    };
  },
  component: OwnerVerifyPasswordChangePage,
});

function OwnerVerifyPasswordChangePage() {
  const { barbershopSlug } = useParams({ from: "/$barbershopSlug/owner/verify-password-change" });
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // Status: "verifying" | "success" | "manual_input" | "error"
  const [status, setStatus] = useState<"verifying" | "success" | "manual_input" | "error">(
    "verifying",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeUserId, setActiveUserId] = useState<string>("");

  // Manual input form states (jika cookie sesi encrypted tidak ada, misal beda browser)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    let isMounted = true;

    const sanitizeUrl = () => {
      if (typeof window !== "undefined" && window.history && window.location.hash) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    };

    const processPasswordVerification = async () => {
      try {
        if (searchParams.error || searchParams.error_description) {
          throw new Error(
            searchParams.error_description || "Link verifikasi tidak valid atau sudah kedaluwarsa.",
          );
        }

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

          if (window.location.hash) {
            const rawHash = window.location.hash.replace(/^#/, "");
            const hp = new URLSearchParams(rawHash);
            hashAccessToken = hp.get("access_token");
            hashRefreshToken = hp.get("refresh_token");
            hashError = hp.get("error_description") || hp.get("error");
            const hashToken = hp.get("token_hash");
            const hashCode = hp.get("code");
            if (!activeTokenHash && hashToken) activeTokenHash = hashToken.trim();
            if (!activeCode && hashCode) activeCode = hashCode.trim();
          }
        }

        if (hashError) {
          throw new Error(hashError);
        }

        // 1. Prioritas: Set Session dari Access Token di Hash (Implicit Flow)
        if (hashAccessToken) {
          const { error: sessError } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken || "",
          });
          if (sessError) {
            console.warn("[VERIFY PWD CHANGE] setSession error:", sessError);
          }
        }
        // 2. Prioritas: verifyOtp jika ada token_hash
        else if (activeTokenHash) {
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: activeTokenHash,
            type: "recovery",
          });
          if (otpErr) {
            console.warn("[VERIFY PWD CHANGE] verifyOtp error:", otpErr);
          }
        }
        // 3. Fallback: PKCE Code Exchange
        else if (activeCode) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(activeCode);
          if (exErr) {
            console.warn("[VERIFY PWD CHANGE] exchangeCode error:", exErr);
          }
        }

        sanitizeUrl();

        // 4. Periksa sesi aktif dari Supabase Auth
        const { data: sessionData } = await supabase.auth.getSession();
        let user = sessionData?.session?.user ?? undefined;

        if (!user) {
          const { data: userData } = await supabase.auth.getUser();
          user = userData?.user ?? undefined;
        }

        if (!user) {
          throw new Error("Link verifikasi password sudah kedaluwarsa atau tidak valid.");
        }

        if (!isMounted) return;
        setActiveUserId(user.id);

        // 5. Cek apakah ada password pending tersimpan di encrypted cookie browser ini
        const pendingState = await getPendingPasswordState({ data: { userId: user.id } });

        if (pendingState.hasPending && pendingState.pendingPassword) {
          // Otomatis terapkan password baru ke Supabase Auth
          const { error: updateError } = await supabase.auth.updateUser({
            password: pendingState.pendingPassword,
          });

          if (updateError) {
            console.error("[SUPABASE APPLY PWD ERROR]", updateError);
            throw new Error(updateError.message || "Gagal menerapkan password baru.");
          }

          // Bersihkan cookie pending & catat audit
          await finalizePasswordChange({ data: { userId: user.id } });

          // Logout dari sesi recovery agar Owner login ulang dengan password baru
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn("SignOut recovery session non-critical error:", e);
          }
          ownerActions.logout();

          if (isMounted) {
            setStatus("success");
          }
        } else {
          // Buka di browser/perangkat berbeda: minta user memasukkan dan konfirmasi password baru
          if (isMounted) {
            setStatus("manual_input");
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Link verifikasi password sudah kedaluwarsa atau tidak valid.",
        );
      }
    };

    processPasswordVerification();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Handler jika user mengisi password secara manual (jika cookie encrypted tidak ada)
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setFormError("Password baru minimal 6 karakter.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setFormError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Gagal memperbarui password.");
      }

      if (activeUserId) {
        await finalizePasswordChange({ data: { userId: activeUserId } });
      }

      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("SignOut recovery session non-critical error:", e);
      }
      ownerActions.logout();

      setStatus("success");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memperbarui password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <TenantLogo size="md" />
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {status === "verifying" && (
            <div className="flex flex-col items-center text-center space-y-4 py-8">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">
                  Memverifikasi Perubahan Password...
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Sistem sedang memvalidasi kredensial keamanan tautan verifikasi Anda.
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Password Berhasil Diperbarui</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  Kata sandi baru untuk akun Owner Anda telah berhasil diverifikasi dan diaktifkan
                  melalui Supabase Auth.
                </p>
              </div>

              <div className="w-full pt-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/owner/login" as any, replace: true })}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-primary/20"
                >
                  <span>Login dengan Password Baru</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {status === "manual_input" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="text-center space-y-1 pb-2 border-b border-border">
                <div className="inline-flex h-12 w-12 rounded-xl bg-primary/10 text-primary items-center justify-center ring-1 ring-primary/20 mb-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground">Konfirmasi Password Baru</h3>
                <p className="text-xs text-muted-foreground">
                  Verifikasi email berhasil. Masukkan password baru untuk menyelesaikan perubahan
                  akun Anda.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Password Baru */}
              <div className="space-y-1.5 text-xs">
                <label className="text-foreground font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter..."
                    className="w-full px-3.5 py-2.5 pr-10 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password Baru */}
              <div className="space-y-1.5 text-xs">
                <label className="text-foreground font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru..."
                    className="w-full px-3.5 py-2.5 pr-10 bg-background border border-input rounded-xl text-foreground font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Simpan Password Baru</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center ring-1 ring-rose-500/20">
                <AlertCircle className="h-7 w-7 text-rose-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Verifikasi Password Gagal</h3>
                <p className="text-xs text-rose-600 dark:text-rose-300 max-w-xs leading-relaxed">{errorMessage}</p>
              </div>

              <div className="w-full pt-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/owner/login" as any, replace: true })}
                  className="w-full py-2.5 px-4 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Kembali ke Halaman Login</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
