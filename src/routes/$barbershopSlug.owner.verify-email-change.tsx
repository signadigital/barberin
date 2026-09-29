import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";
import { supabase } from "@/lib/supabase-client";
import { syncOwnerEmailChange } from "@/lib/owner-settings";
import { ownerActions, useOwner } from "@/lib/owner-store";

export const Route = createFileRoute("/$barbershopSlug/owner/verify-email-change")({
  head: () => ({
    meta: [
      { title: "Verifikasi Perubahan Email Owner — BARBERIN" },
      {
        name: "description",
        content: "Konfirmasi dan verifikasi perubahan email akun Owner BARBERIN.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : "",
      type: typeof search["type"] === "string" ? search["type"] : "email_change",
      code: typeof search["code"] === "string" ? search["code"] : "",
      error: typeof search["error"] === "string" ? search["error"] : "",
      error_code: typeof search["error_code"] === "string" ? search["error_code"] : "",
      error_description:
        typeof search["error_description"] === "string" ? search["error_description"] : "",
    };
  },
  component: OwnerVerifyEmailChangePage,
});

function OwnerVerifyEmailChangePage() {
  const { barbershopSlug } = useParams({ from: "/$barbershopSlug/owner/verify-email-change" });
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const ownerState = useOwner();

  const [status, setStatus] = useState<"loading" | "success" | "pending_second_email" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [confirmedEmail, setConfirmedEmail] = useState<string>("");

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

    const processEmailVerification = async () => {
      try {
        if (searchParams.error || searchParams.error_description) {
          throw new Error(
            searchParams.error_description || "Link verifikasi tidak valid atau sudah kedaluwarsa.",
          );
        }

        let activeCode = searchParams.code?.trim() || "";
        let activeTokenHash = searchParams.token_hash?.trim() || "";
        let activeType = searchParams.type?.trim() || "email_change";

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
            console.warn("[VERIFY EMAIL CHANGE] setSession error:", sessError);
          }
        }
        // 2. Prioritas: verifyOtp jika ada token_hash
        else if (activeTokenHash) {
          const typeToTry: any = activeType === "email" ? "email" : "email_change";
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: activeTokenHash,
            type: typeToTry,
          });
          if (otpErr) {
            // Coba fallback ke type alternative jika type email_change gagal
            const altType: any = typeToTry === "email_change" ? "email" : "email_change";
            const { error: altErr } = await supabase.auth.verifyOtp({
              token_hash: activeTokenHash,
              type: altType,
            });
            if (altErr) {
              console.warn("[VERIFY EMAIL CHANGE] verifyOtp error:", altErr);
            }
          }
        }
        // 3. Fallback: PKCE Code Exchange
        else if (activeCode) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(activeCode);
          if (exErr) {
            console.warn("[VERIFY EMAIL CHANGE] exchangeCode error:", exErr);
          }
        }

        sanitizeUrl();

        // 4. Periksa data pengguna saat ini dari Supabase Auth
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          // Cek apakah ada sesi tersimpan
          const { data: sessData } = await supabase.auth.getSession();
          if (!sessData?.session?.user) {
            throw new Error("Sesi verifikasi tidak ditemukan atau sudah kedaluwarsa.");
          }
        }

        const user = userData?.user;
        if (!user) {
          throw new Error("Gagal mengambil data akun yang terverifikasi.");
        }

        // Cek jika secure email change masih menunggu konfirmasi email kedua
        if (user.new_email && user.new_email !== user.email) {
          if (isMounted) {
            setStatus("pending_second_email");
            setConfirmedEmail(user.new_email);
          }
          return;
        }

        // Email telah resmi berubah di Supabase Auth
        const updatedEmail = user.email || "";
        if (!updatedEmail) {
          throw new Error("Email baru tidak ditemukan pada data autentikasi.");
        }

        // Sinkronisasi ke database aplikasi BARBERIN & update cookie sesi
        await syncOwnerEmailChange({
          data: {
            userId: user.id,
            email: updatedEmail,
          },
        });

        // Update local store state
        ownerActions.updateUser({ email: updatedEmail });

        if (isMounted) {
          setConfirmedEmail(updatedEmail);
          setStatus("success");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Link konfirmasi perubahan email sudah kedaluwarsa atau tidak valid.",
        );
      }
    };

    processEmailVerification();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const targetSlug = barbershopSlug || ownerState.user?.barbershopSlug || "barberin";

  return (
    <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <BarberinLogo size="md" />
          </Link>
        </div>

        <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {status === "loading" && (
            <div className="flex flex-col items-center text-center space-y-4 py-8">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center ring-1 ring-blue-500/20">
                <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Memverifikasi Perubahan Email...</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Mohon tunggu sebentar, sistem sedang memvalidasi tautan konfirmasi Supabase Auth
                  Anda.
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Email Berhasil Diperbarui</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Alamat email login Owner Anda telah berhasil diverifikasi dan disinkronkan menjadi{" "}
                  <span className="font-semibold text-white">{confirmedEmail}</span>.
                </p>
              </div>

              <div className="w-full pt-4">
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: `/${targetSlug}/owner/settings` as any, replace: true })
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  <span>Kembali ke Pengaturan</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {status === "pending_second_email" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center ring-1 ring-amber-500/20">
                <Mail className="h-7 w-7 text-amber-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Konfirmasi Tahap 1 Berhasil</h3>
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  Konfirmasi dari link ini telah diterima. Supabase Auth menggunakan fitur keamanan
                  ganda (Secure Email Change).
                </p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-xs text-amber-200/90 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <ShieldCheck className="h-4 w-4" />
                    Langkah Terakhir:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Silakan buka email Anda yang satu lagi dan klik link konfirmasi di dalamnya
                    untuk menyelesaikan pergantian email secara permanen.
                  </p>
                </div>
              </div>

              <div className="w-full pt-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: `/${targetSlug}/owner/settings` as any, replace: true })
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Kembali ke Pengaturan</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center ring-1 ring-rose-500/20">
                <AlertCircle className="h-7 w-7 text-rose-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Verifikasi Email Gagal</h3>
                <p className="text-xs text-rose-300/90 max-w-xs leading-relaxed">{errorMessage}</p>
              </div>

              <div className="w-full pt-4">
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: `/${targetSlug}/owner/settings` as any, replace: true })
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Kembali ke Pengaturan</span>
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
