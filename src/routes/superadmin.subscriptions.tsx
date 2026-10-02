import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  Plus,
  RefreshCw,
  Store,
  CheckCircle2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Calendar,
  Zap,
  Filter,
  AlertCircle,
  Tag,
  KeyRound,
  ShieldCheck,
  History,
} from "lucide-react";
import { toast } from "sonner";

import {
  SuperadminAuthGuard,
  SuperadminSidebar,
  SuperadminHeader,
  SuperadminMobileHeader,
} from "@/components/superadmin/ui";
import {
  superadminGetSubscriptions,
  superadminGetCodes,
  superadminGenerateCode,
  superadminTriggerExpiryJob,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/superadmin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Manajemen Subscription & Paket — BARBERIN Superadmin" },
      {
        name: "description",
        content:
          "Kelola status langganan tenant, paket Free/Pro/Enterprise, dan generate kode langganan.",
      },
    ],
  }),
  component: SuperadminSubscriptionsPage,
});

function SuperadminSubscriptionsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"tenants" | "codes">("tenants");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "FREE" | "PRO" | "ENTERPRISE">("all");

  // Generate Code Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"PRO" | "ENTERPRISE">("PRO");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [codeNotes, setCodeNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    code: string;
    planName: string;
    durationDays: number;
  } | null>(null);

  // Copied state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Trigger Expiry Job
  const [isRunningExpiry, setIsRunningExpiry] = useState(false);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const [tList, cList] = await Promise.all([
        superadminGetSubscriptions(),
        superadminGetCodes(),
      ]);
      setTenants(tList);
      setCodes(cList);
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat data subscription");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Kode ${code} disalin ke clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await superadminGenerateCode({
        data: {
          planName: selectedPlan,
          durationDays: Number(durationDays),
          ...(codeNotes.trim() ? { notes: codeNotes.trim() } : {}),
        },
      });

      if (res?.success) {
        toast.success(`Kode ${res.code} berhasil digenerate!`);
        setGeneratedResult(res);
        await fetchData();
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat kode langganan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunExpiryJob = async () => {
    if (
      !confirm(
        "Jalankan cron pengecekan masa aktif paket sekarang? Subscription yang melewati batas akhir akan otomatis diturunkan ke Free.",
      )
    ) {
      return;
    }
    setIsRunningExpiry(true);
    try {
      const result = await superadminTriggerExpiryJob();
      toast.success(
        `Pengecekan selesai! ${result.expiredCount} tenant kadaluarsa diproses kembali ke Free.`,
      );
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menjalankan job kadaluarsa");
    } finally {
      setIsRunningExpiry(false);
    }
  };

  // Stats calculation
  const totalTenants = tenants.length;
  const freeCount = tenants.filter((t) => t.subscription?.planName === "FREE").length;
  const proCount = tenants.filter((t) => t.subscription?.planName === "PRO").length;
  const entCount = tenants.filter((t) => t.subscription?.planName === "ENTERPRISE").length;
  const unusedCodes = codes.filter((c) => c.status === "unused").length;

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.nama_barbershop?.toLowerCase().includes(search.toLowerCase()) ||
      t.slug?.toLowerCase().includes(search.toLowerCase()) ||
      t.nama_owner?.toLowerCase().includes(search.toLowerCase()) ||
      t.email_owner?.toLowerCase().includes(search.toLowerCase());

    const matchesPlan = planFilter === "all" || t.subscription?.planName === planFilter;

    return matchesSearch && matchesPlan;
  });

  return (
    <SuperadminAuthGuard>
      <div className="min-h-screen bg-[#070D18] flex flex-col lg:flex-row text-slate-100">
        <SuperadminSidebar activePath="/superadmin/subscriptions" />

        <div className="flex-1 flex flex-col min-w-0">
          <SuperadminMobileHeader
            activePath="/superadmin/subscriptions"
            onRefresh={fetchData}
            isRefreshing={isRefreshing}
          />
          <SuperadminHeader onRefresh={fetchData} isRefreshing={isRefreshing} />

          <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  <CreditCard className="h-6 w-6 text-blue-400" />
                  Manajemen Subscription & Paket
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Kontrol tier subscription aktif per tenant, generate token voucher kode, dan
                  monitoring masa aktif.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleRunExpiryJob}
                  disabled={isRunningExpiry}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  title="Jalankan job verifikasi masa aktif"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-blue-400 ${isRunningExpiry ? "animate-spin" : ""}`}
                  />
                  <span>{isRunningExpiry ? "Memproses..." : "Cek Kadaluarsa"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGeneratedResult(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Generate Kode Langganan</span>
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-[#0A1424] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Toko
                </span>
                <span className="text-2xl font-black text-white mt-1">{totalTenants}</span>
                <span className="text-[10px] text-slate-500 mt-1">Semua tenant terdaftar</span>
              </div>

              <div className="bg-[#0A1424] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Paket Free
                </span>
                <span className="text-2xl font-black text-slate-300 mt-1">{freeCount}</span>
                <span className="text-[10px] text-emerald-400 mt-1">Rp0 / bulan</span>
              </div>

              <div className="bg-[#0A1424] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                  Paket Pro
                </span>
                <span className="text-2xl font-black text-blue-400 mt-1">{proCount}</span>
                <span className="text-[10px] text-blue-300/80 mt-1">Rp99.000 / bulan</span>
              </div>

              <div className="bg-[#0A1424] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                  Enterprise
                </span>
                <span className="text-2xl font-black text-purple-400 mt-1">{entCount}</span>
                <span className="text-[10px] text-purple-300/80 mt-1">Rp199.000 / bulan</span>
              </div>

              <div className="bg-[#0A1424] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Kode Tersedia
                </span>
                <span className="text-2xl font-black text-amber-400 mt-1">{unusedCodes}</span>
                <span className="text-[10px] text-slate-500 mt-1">Belum diredeem tenant</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("tenants")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "tenants"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Store className="h-4 w-4" />
                <span>Status Tenant ({tenants.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("codes")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "codes"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Riwayat & Daftar Kode ({codes.length})</span>
              </button>
            </div>

            {/* Tab 1: Tenants List */}
            {activeTab === "tenants" && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari barbershop, slug, atau nama owner..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0A1424] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value as any)}
                      className="px-3 py-2 rounded-xl bg-[#0A1424] border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">Semua Paket</option>
                      <option value="FREE">Hanya FREE</option>
                      <option value="PRO">Hanya PRO</option>
                      <option value="ENTERPRISE">Hanya ENTERPRISE</option>
                    </select>
                  </div>
                </div>

                {/* Table Container */}
                <div className="bg-[#0A1424] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0F1D33] text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5">Barbershop / Tenant</th>
                          <th className="px-5 py-3.5">Owner Terdaftar</th>
                          <th className="px-5 py-3.5">Paket Aktif</th>
                          <th className="px-5 py-3.5">Masa Berlaku</th>
                          <th className="px-5 py-3.5">Sisa Hari</th>
                          <th className="px-5 py-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                              Memuat status langganan...
                            </td>
                          </tr>
                        ) : filteredTenants.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                              Tidak ada tenant yang cocok dengan pencarian.
                            </td>
                          </tr>
                        ) : (
                          filteredTenants.map((t) => {
                            const sub = t.subscription;
                            const isPro = sub?.planName === "PRO";
                            const isEnterprise = sub?.planName === "ENTERPRISE";

                            return (
                              <tr
                                key={t.id_barbershop}
                                className="hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="px-5 py-4">
                                  <div className="font-bold text-white text-sm">
                                    {t.nama_barbershop}
                                  </div>
                                  <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                                    /{t.slug}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="font-semibold text-slate-200">
                                    {t.nama_owner || "—"}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {t.email_owner || t.phone_owner || "—"}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      isEnterprise
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : isPro
                                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                          : "bg-slate-800 text-slate-400 border border-slate-700"
                                    }`}
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    {sub?.planName || "FREE"}
                                  </span>
                                </td>

                                <td className="px-5 py-4 font-mono text-[11px]">
                                  {sub?.isFree ? (
                                    <span className="text-slate-500">Permanen (Free)</span>
                                  ) : sub?.endDate ? (
                                    <span>
                                      s/d{" "}
                                      {new Date(sub.endDate).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  {sub?.isFree ? (
                                    <span className="text-slate-500">∞</span>
                                  ) : sub?.remainingDays !== null ? (
                                    <span
                                      className={`font-bold ${
                                        sub.remainingDays <= 3
                                          ? "text-rose-400"
                                          : sub.remainingDays <= 7
                                            ? "text-amber-400"
                                            : "text-emerald-400"
                                      }`}
                                    >
                                      {sub.remainingDays} hari
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlan("PRO");
                                      setDurationDays(30);
                                      setCodeNotes(
                                        `Untuk barbershop ${t.nama_barbershop} (${t.slug})`,
                                      );
                                      setIsModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all cursor-pointer"
                                  >
                                    Generate Kode
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Subscription Codes List */}
            {activeTab === "codes" && (
              <div className="bg-[#0A1424] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0F1D33] text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">Kode Voucher</th>
                        <th className="px-5 py-3.5">Paket</th>
                        <th className="px-5 py-3.5">Durasi</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5">Digunakan Oleh</th>
                        <th className="px-5 py-3.5">Waktu Dibuat / Digunakan</th>
                        <th className="px-5 py-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {codes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                            Belum ada kode langganan yang digenerate.
                          </td>
                        </tr>
                      ) : (
                        codes.map((c) => {
                          const isUsed = c.status === "used";
                          const isCopied = copiedCode === c.code;

                          return (
                            <tr key={c.id_code} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-5 py-4 font-mono font-bold text-white text-xs">
                                <span className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-md text-amber-300">
                                  {c.code}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    c.plan_name === "ENTERPRISE"
                                      ? "bg-purple-500/20 text-purple-300"
                                      : "bg-blue-500/20 text-blue-300"
                                  }`}
                                >
                                  {c.plan_name}
                                </span>
                              </td>

                              <td className="px-5 py-4 font-medium text-slate-200">
                                {c.durasi_hari} Hari
                              </td>

                              <td className="px-5 py-4">
                                {isUsed ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    Sudah Dipakai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                                    Tersedia
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-4">
                                {c.used_by_barbershop ? (
                                  <div>
                                    <div className="font-semibold text-white">
                                      {c.used_by_barbershop}
                                    </div>
                                    <div className="text-[10px] text-blue-400 font-mono">
                                      /{c.used_by_slug}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              <td className="px-5 py-4 text-[11px] text-slate-400">
                                <div>
                                  Dibuat:{" "}
                                  {new Date(c.created_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </div>
                                {c.used_at && (
                                  <div className="text-emerald-400/80 text-[10px]">
                                    Digunakan:{" "}
                                    {new Date(c.used_at).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(c.code)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Salin Kode"
                                >
                                  {isCopied ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Modal Generate Kode */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-[#0A1424] border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative animate-in fade-in zoom-in-95">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-400" />
                Generate Kode Langganan Baru
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kode voucher aktivasi unik berstandar kriptografi untuk diberikan kepada Owner
                setelah verifikasi transfer manual.
              </p>

              {generatedResult ? (
                <div className="mt-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <span className="text-xs font-semibold text-emerald-400 block mb-1">
                      Kode Berhasil Dibuat!
                    </span>
                    <div className="text-xl font-mono font-black text-amber-300 tracking-wider select-all py-1">
                      {generatedResult.code}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-1">
                      Paket {generatedResult.planName} • {generatedResult.durationDays} Hari
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(generatedResult.code)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Salin Kode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedResult(null);
                        setIsModalOpen(false);
                      }}
                      className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerate} className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Pilih Paket Layanan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("PRO")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                          selectedPlan === "PRO"
                            ? "bg-blue-600/20 border-blue-500 text-blue-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        PRO (Rp99.000)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("ENTERPRISE")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                          selectedPlan === "ENTERPRISE"
                            ? "bg-purple-600/20 border-purple-500 text-purple-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        ENTERPRISE (Rp199.000)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Durasi Masa Aktif
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[30, 90, 365].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDurationDays(d)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                            durationDays === d
                              ? "bg-blue-600/20 border-blue-500 text-white"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {d === 30
                            ? "30 Hari (1 Bln)"
                            : d === 90
                              ? "90 Hari (3 Bln)"
                              : "365 Hari (1 Thn)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Catatan / Referensi Tenant (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pembayaran transfer BCA a.n Budi"
                      value={codeNotes}
                      onChange={(e) => setCodeNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isGenerating}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <span>Generate Sekarang</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </SuperadminAuthGuard>
  );
}
