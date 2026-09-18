import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { BarberinLogo } from "@/components/barberin/ui";
import { verifyOwnerEmail } from "@/lib/owner-auth";
import { ownerActions } from "@/lib/owner-store";

// Module-level deduplication to prevent double execution across React StrictMode or component remounts
const clientProcessedKeys = new Set<string>();

export const Route = createFileRoute("/owner/verify-email")({
  head: () => ({
    meta: [
      { title: "Verifikasi Email Owner — BARBERIN" },
      { name: "description", content: "Verifikasi alamat email akun Owner BARBERIN." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token_hash: typeof search["token_hash"] === "string" ? search["token_hash"] : "",
      type: typeof search["type"] === "string" ? search["type"] : "email",
      code: typeof search["code"] === "string" ? search["code"] : "",
      token: typeof search["token"] === "string" ? search["token"] : "",
    };
  },
  component: OwnerVerifyEmailPage,
});

function OwnerVerifyEmailPage() {
  const { token_hash, type, code, token } = Route.useSearch();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [verifiedUser, setVerifiedUser] = useState<{
    id_user?: string;
    nama_lengkap?: string;
    barbershopName?: string;
  } | null>(null);

  // Mencegah double call di instance yang sama
  const verificationInitiated = useRef(false);

  useEffect(() => {
    if (verificationInitiated.current) return;

    // Deteksi parameter token_hash, code, atau token legacy
    let activeTokenHash = (token_hash || "").trim();
    let activeCode = (code || "").trim();
    let activeToken = (token || "").trim();
    let activeType = (type || "email").trim();

    // Fallback: periksa langsung dari window.location.search jika belum terisi dari search params
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const queryTokenHash = searchParams.get("token_hash");
      if (!activeTokenHash && queryTokenHash) {
        activeTokenHash = queryTokenHash.trim();
      }
      const queryType = searchParams.get("type");
      if (queryType) {
        activeType = queryType.trim();
      }
      const queryCode = searchParams.get("code");
      if (!activeCode && queryCode) {
        activeCode = queryCode.trim();
      }
      const queryToken = searchParams.get("token");
      if (!activeToken && queryToken) {
        activeToken = queryToken.trim();
      }

      // Cek juga kemungkinan token_hash di hash fragment (#token_hash=... atau #access_token=...) jika ada
      if (!activeTokenHash && !activeCode && !activeToken && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const hashToken = hashParams.get("token_hash");
        const hashCode = hashParams.get("code");
        const hashType = hashParams.get("type");
        if (hashToken) activeTokenHash = hashToken.trim();
        if (hashCode) activeCode = hashCode.trim();
        if (hashType) activeType = hashType.trim();
      }
    }

    if (!activeTokenHash && !activeCode && !activeToken) {
      setStatus("error");
      setErrorMessage("Parameter verifikasi (token_hash atau code) tidak ditemukan dalam tautan email.");
      return;
    }

    const verificationKey = activeTokenHash
      ? `hash:${activeTokenHash}`
      : activeCode
        ? `code:${activeCode}`
        : `token:${activeToken}`;

    // Cegah eksekusi ulang pada key yang sama
    if (clientProcessedKeys.has(verificationKey)) {
      console.log("[CLIENT VERIFY-EMAIL] Verifikasi untuk token ini sudah diproses/sedang berjalan.");
      return;
    }

    verificationInitiated.current = true;
    clientProcessedKeys.add(verificationKey);

    // Safe Diagnostic Logging (TIDAK mengekspos token lengkap)
    const tokenPreview = activeTokenHash
      ? `${activeTokenHash.slice(0, 4)}...${activeTokenHash.slice(-4)}`
      : null;
    console.log("[CLIENT VERIFY-EMAIL] Memulai verifikasi email callback:", {
      pathname: typeof window !== "undefined" ? window.location.pathname : "",
      token_hash_present: Boolean(activeTokenHash),
      token_hash_len: activeTokenHash ? activeTokenHash.length : 0,
      token_preview: tokenPreview,
      type_param: activeType,
      is_type_email: activeType === "email",
      code_present: Boolean(activeCode),
    });

    const runVerification = async () => {
      try {
        const res = await verifyOwnerEmail({
          data: {
            token_hash: activeTokenHash || undefined,
            type: activeType,
            code: activeCode || undefined,
            token: activeToken || undefined,
          },
        });

        console.log("[CLIENT VERIFY-EMAIL SUCCESS] Verifikasi berhasil untuk:", res.user.email);

        // Set session di frontend store
        const targetSlug = (res.user as any).barbershopSlug || "barberin";
        ownerActions.login({
          id_user: res.user.id_user,
          email: res.user.email,
          nama_lengkap: res.user.nama_lengkap,
          role: res.user.role,
          id_barbershop: res.user.id_barbershop,
          barbershopSlug: targetSlug,
          barbershopName: res.user.barbershopName,
        });

        setVerifiedUser(res.user);
        setStatus("success");

        // Otomatis redirect ke dashboard setelah 2 detik
        setTimeout(() => {
          navigate({ to: `/${targetSlug}/owner/dashboard` as any, replace: true });
        }, 2000);
      } catch (err: unknown) {
        console.error("[CLIENT VERIFY-EMAIL ERROR] Gagal memverifikasi email:", err);
        // Hapus dari processedKeys jika error agar user bisa mencoba kembali jika ingin refresh
        clientProcessedKeys.delete(verificationKey);
        verificationInitiated.current = false;

        const msg =
          err instanceof Error
            ? err.message
            : "Link verifikasi tidak valid, sudah kedaluwarsa, atau sudah pernah digunakan.";
        setStatus("error");
        setErrorMessage(msg);
      }
    };

    runVerification();
  }, [token_hash, type, code, token, navigate]);

  return (
    <div className="min-h-screen bg-[#070D18] flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-[#0F1D33] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <BarberinLogo className="h-14 w-14 mb-3 drop-shadow-lg" />
          <h1 className="text-2xl font-black text-white tracking-wider">BARBERIN</h1>
          <p className="text-xs text-slate-400 mt-0.5">Verifikasi Akun Pemilik</p>
        </div>

        {/* STATE: LOADING */}
        {status === "loading" && (
          <div className="relative z-10 py-8 space-y-4 animate-in fade-in">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
            <h2 className="text-base font-bold text-white">Memverifikasi Email Anda...</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Sistem sedang memvalidasi token verifikasi dan menyiapkan akun Anda. Mohon tunggu
              sebentar.
            </p>
          </div>
        )}

        {/* STATE: SUCCESS */}
        {status === "success" && (
          <div className="relative z-10 py-6 space-y-5 animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white mb-1">Email Berhasil Diverifikasi!</h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Akun Owner untuk <strong>{verifiedUser?.barbershopName}</strong> kini telah aktif.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Membuat sesi dan mengalihkan ke Dashboard...</span>
            </div>

            <div className="pt-2">
              <Link
                to={`/${(verifiedUser as any)?.barbershopSlug || "barberin"}/owner/dashboard` as any}
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                <span>Buka Dashboard Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* STATE: ERROR */}
        {status === "error" && (
          <div className="relative z-10 py-6 space-y-5 animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white mb-1">Gagal Memverifikasi Email</h2>
              <p className="text-xs text-rose-300 max-w-xs mx-auto leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="p-3 bg-[#14233D] border border-slate-700/80 rounded-xl text-xs text-slate-400 text-left space-y-1">
              <div className="font-semibold text-slate-300">Kemungkinan penyebab:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Link verifikasi tidak valid atau tautan terpotong</li>
                <li>Link sudah kedaluwarsa (masa berlaku maksimal 24 jam)</li>
                <li>Token verifikasi sudah pernah digunakan sebelumnya</li>
              </ul>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                to={"/owner/login" as any}
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                <span>Masuk ke Halaman Login</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/owner/register"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Daftar Ulang Akun Baru</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
