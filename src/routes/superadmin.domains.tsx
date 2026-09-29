import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  Globe,
  Search,
  Plus,
  RefreshCw,
  Store,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Clock,
  X,
  Layers,
  FileText,
  Copy,
  Check,
  Trash2,
  Edit2,
  Star,
  Info,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  SuperadminAuthGuard,
  SuperadminSidebar,
  SuperadminHeader,
  SuperadminMobileHeader,
} from "@/components/superadmin/ui";
import {
  getSuperadminDomains,
  addOrEditCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
  setPrimaryCustomDomain,
  getDomainVerificationLogs,
  validateDomainFormat,
} from "@/lib/branding-domains";
import { BPMNViewer } from "@/components/bpmn/bpmn-viewer";

export const Route = createFileRoute("/superadmin/domains")({
  head: () => ({
    meta: [
      { title: "Custom Domain Management — BARBERIN Superadmin" },
      {
        name: "description",
        content: "Kelola, konfigurasi DNS, dan verifikasi domain kustom untuk seluruh tenant barbershop.",
      },
    ],
  }),
  component: SuperadminDomainsPage,
});

function SuperadminDomainsPage() {
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<any[]>([]);
  const [barbershops, setBarbershops] = useState<any[]>([]);
  const [selectedShopFilter, setSelectedShopFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<any | null>(null);
  const [showBpmnModal, setShowBpmnModal] = useState(false);
  const [showDnsModal, setShowDnsModal] = useState<any | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form states
  const [formShopId, setFormShopId] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formDomainType, setFormDomainType] = useState("primary");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Real-time domain format check
  const domainFormatCheck = formDomain ? validateDomainFormat(formDomain) : { isValid: true };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getSuperadminDomains({
        data: {
          barbershopId: selectedShopFilter,
          search: searchQuery,
        },
      });
      if (res) {
        setDomains(res.domains || []);
        setBarbershops(res.barbershops || []);
        if (!formShopId && res.barbershops?.length > 0) {
          setFormShopId(res.barbershops[0].id_barbershop);
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat domain:", err);
      toast.error(err.message || "Gagal memuat daftar custom domain.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedShopFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingDomain(null);
    setFormDomain("");
    setFormDomainType("primary");
    setFormIsPrimary(false);
    if (barbershops.length > 0) {
      setFormShopId(selectedShopFilter !== "all" ? selectedShopFilter : barbershops[0].id_barbershop);
    }
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (dom: any) => {
    setEditingDomain(dom);
    setFormShopId(dom.id_barbershop);
    setFormDomain(dom.domain);
    setFormDomainType(dom.domain_type || "primary");
    setFormIsPrimary(Boolean(dom.is_primary));
    setShowAddModal(true);
  };

  // Submit Domain (BPMN Step 2, 3, 4, 5, 6, 12)
  const handleSubmitDomain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formShopId) {
      toast.error("Silakan pilih barbershop target.");
      return;
    }

    const check = validateDomainFormat(formDomain);
    if (!check.isValid) {
      toast.error(`Format tidak valid: ${check.error}`);
      return;
    }

    try {
      setFormSubmitting(true);
      const res = await addOrEditCustomDomain({
        data: {
          id_domain: editingDomain?.id_domain,
          id_barbershop: formShopId,
          domain: formDomain.trim(),
          domain_type: formDomainType,
          is_primary: formIsPrimary,
        },
      });

      toast.success(res.message);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan domain.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Verify DNS (BPMN Step 8, 9, 13, 14)
  const handleVerifyDns = async (domainObj: any) => {
    try {
      setVerifyingId(domainObj.id_domain);
      toast.loading(`Memeriksa catatan DNS untuk ${domainObj.domain}...`, { id: "verify-dns" });

      const res = await verifyCustomDomain({
        data: { id_domain: domainObj.id_domain },
      });

      toast.success(res.message, { id: "verify-dns" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Verifikasi DNS gagal.", { id: "verify-dns" });
      fetchData();
    } finally {
      setVerifyingId(null);
    }
  };

  // Set Primary
  const handleSetPrimary = async (dom: any) => {
    try {
      const res = await setPrimaryCustomDomain({
        data: {
          id_domain: dom.id_domain,
          id_barbershop: dom.id_barbershop,
        },
      });
      toast.success(res.message);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal mengubah domain utama.");
    }
  };

  // Delete Domain
  const handleDelete = async (dom: any) => {
    if (!confirm(`Hapus custom domain "${dom.domain}"?`)) return;
    try {
      const res = await deleteCustomDomain({ data: dom.id_domain });
      toast.success(res.message);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus custom domain.");
    }
  };

  // Open Logs
  const openLogs = async (dom: any) => {
    setShowLogsModal(dom);
    try {
      setLoadingLogs(true);
      const res = await getDomainVerificationLogs({ data: dom.id_domain });
      setLogs(res || []);
    } catch (err: any) {
      toast.error("Gagal memuat log verifikasi.");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Disalin: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Counts
  const totalDomains = domains.length;
  const activeDomains = domains.filter((d) => d.status === "active").length;
  const pendingDomains = domains.filter((d) => d.status === "pending" || d.status === "verifying").length;
  const failedDomains = domains.filter((d) => d.status === "failed").length;

  return (
    <SuperadminAuthGuard>
      <div className="min-h-screen bg-[#070D18] flex text-slate-100 selection:bg-blue-600 selection:text-white">
        {/* Desktop Sidebar */}
        <SuperadminSidebar activePath="/superadmin/domains" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <SuperadminHeader onRefresh={fetchData} isRefreshing={loading} />
          <SuperadminMobileHeader activePath="/superadmin/domains" onRefresh={fetchData} isRefreshing={loading} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            {/* Header Banner (BPMN Title & Actions) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">
                  <Shield className="h-3.5 w-3.5 inline" />
                  Admin Platform / Superadmin
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <Globe className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    BPMN — CUSTOM DOMAIN
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Admin Platform menambah, mengedit, memvalidasi format, dan memverifikasi domain kustom untuk setiap barbershop.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBpmnModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/30 transition-all shadow-sm active:scale-95"
                >
                  <Layers className="h-4 w-4" />
                  <span>Lihat Diagram BPMN</span>
                </button>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Custom Domain</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0B1424] border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Domain</div>
                <div className="text-2xl font-extrabold text-white mt-1 font-mono">{totalDomains}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Seluruh tenant terdaftar</div>
              </div>

              <div className="bg-[#0B1424] border border-emerald-500/30 p-4 rounded-2xl shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">🟢 Active</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{activeDomains}</div>
                <div className="text-[10px] text-emerald-500/80 mt-0.5">DNS &amp; SSL terverifikasi</div>
              </div>

              <div className="bg-[#0B1424] border border-amber-500/30 p-4 rounded-2xl shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">🟡 Pending / Verifying</div>
                <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">{pendingDomains}</div>
                <div className="text-[10px] text-amber-500/80 mt-0.5">Menunggu propagasi CNAME</div>
              </div>

              <div className="bg-[#0B1424] border border-rose-500/30 p-4 rounded-2xl shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">🔴 Failed</div>
                <div className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">{failedDomains}</div>
                <div className="text-[10px] text-rose-500/80 mt-0.5">Lookup DNS belum sesuai</div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-[#0B1424] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Store className="h-4 w-4 text-blue-400" />
                  <span>Pilih Barbershop:</span>
                </div>
                <select
                  value={selectedShopFilter}
                  onChange={(e) => setSelectedShopFilter(e.target.value)}
                  className="bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="all">Semua Barbershop ({barbershops.length})</option>
                  {barbershops.map((shop) => (
                    <option key={shop.id_barbershop} value={shop.id_barbershop}>
                      {shop.nama_barbershop} ({shop.slug})
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari domain / tenant..."
                  className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </form>
            </div>

            {/* Table of Custom Domains */}
            <div className="bg-[#0B1424] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#081220] border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Domain &amp; Tipe</th>
                      <th className="px-4 py-3.5 font-bold">Barbershop Tenant</th>
                      <th className="px-4 py-3.5 font-bold">Target CNAME / DNS</th>
                      <th className="px-4 py-3.5 font-bold">Status</th>
                      <th className="px-4 py-3.5 font-bold">Terverifikasi</th>
                      <th className="px-5 py-3.5 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                          <span>Memuat daftar custom domain...</span>
                        </td>
                      </tr>
                    ) : domains.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                          <Globe className="h-8 w-8 text-slate-600 mx-auto" />
                          <div className="font-semibold text-white">Belum Ada Custom Domain</div>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Klik tombol "Tambah Custom Domain" di atas untuk mendaftarkan domain bagi tenant barbershop.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      domains.map((dom) => {
                        const isVerifyingThis = verifyingId === dom.id_domain;
                        return (
                          <tr key={dom.id_domain} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white font-mono flex items-center gap-1.5">
                                  {dom.domain}
                                </span>
                                {dom.is_primary && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <Star className="h-2.5 w-2.5 fill-amber-400" />
                                    Utama
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span className="capitalize">{dom.domain_type || "primary"}</span>
                                <span>•</span>
                                <span className="text-slate-500 font-mono">Token: {dom.verification_token}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-semibold text-white">
                                {dom.nama_barbershop || "Tenant"}
                              </div>
                              <div className="text-[11px] text-blue-400 font-mono">
                                /{dom.slug_barbershop}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-mono text-slate-300 text-[11px] bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800 inline-block">
                                <span className="text-blue-400 font-bold">{dom.dns_name}</span> CNAME{" "}
                                <span className="text-emerald-400">{dom.dns_value}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1 items-start">
                                {dom.status === "active" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                                    ● Active
                                  </span>
                                )}
                                {dom.status === "pending" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                    ● Pending
                                  </span>
                                )}
                                {dom.status === "verifying" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                                    ● Verifying
                                  </span>
                                )}
                                {dom.status === "failed" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                                    ● Failed
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  SSL: {dom.ssl_status || "pending"}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-slate-400 text-[11px] font-mono">
                              {dom.verified_at ? (
                                <span className="text-emerald-400">
                                  {new Date(dom.verified_at).toLocaleDateString("id-ID")}
                                </span>
                              ) : (
                                <span className="text-slate-500">Belum</span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Verify DNS Button (BPMN Step 8) */}
                                <button
                                  type="button"
                                  disabled={isVerifyingThis}
                                  onClick={() => handleVerifyDns(dom)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
                                  title="Cek DNS Domain"
                                >
                                  <RefreshCw
                                    className={`h-3 w-3 ${isVerifyingThis ? "animate-spin" : ""}`}
                                  />
                                  <span>{isVerifyingThis ? "Cek..." : "Verifikasi"}</span>
                                </button>

                                {/* DNS Guide */}
                                <button
                                  type="button"
                                  onClick={() => setShowDnsModal(dom)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Instruksi DNS"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>

                                {/* Logs */}
                                <button
                                  type="button"
                                  onClick={() => openLogs(dom)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Riwayat Verifikasi"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                </button>

                                {/* Set as Primary */}
                                {!dom.is_primary && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimary(dom)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950/40 text-slate-400 hover:text-amber-400 transition-colors"
                                    title="Jadikan Domain Utama"
                                  >
                                    <Star className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(dom)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Edit Domain"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(dom)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Hapus Domain"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>

        {/* MODAL 1: TAMBAH / EDIT CUSTOM DOMAIN */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1526] border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F1E36]">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {editingDomain ? "Edit Custom Domain" : "Tambah Custom Domain"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitDomain} className="p-6 space-y-4">
                {/* Barbershop selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Barbershop Tenant <span className="text-rose-400">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingDomain)}
                    value={formShopId}
                    onChange={(e) => setFormShopId(e.target.value)}
                    className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-blue-500 disabled:opacity-60"
                  >
                    {barbershops.map((shop) => (
                      <option key={shop.id_barbershop} value={shop.id_barbershop}>
                        {shop.nama_barbershop} ({shop.slug})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Domain name input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Nama Custom Domain <span className="text-rose-400">*</span>
                    </label>
                    {formDomain && (
                      <span
                        className={`text-[10px] font-mono ${
                          domainFormatCheck.isValid ? "text-emerald-400 font-bold" : "text-rose-400"
                        }`}
                      >
                        {domainFormatCheck.isValid ? "✓ Format Valid" : "✗ Format Tidak Sesuai"}
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value.toLowerCase().trim())}
                    placeholder="Contoh: barberinsinggah.com atau cukur.singgah.id"
                    className={`w-full bg-[#070D18] border rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-hidden transition-colors ${
                      formDomain
                        ? domainFormatCheck.isValid
                          ? "border-emerald-500/80 focus:border-emerald-500"
                          : "border-rose-500/80 focus:border-rose-500"
                        : "border-slate-700 focus:border-blue-500"
                    }`}
                  />

                  {/* Format warning message */}
                  {!domainFormatCheck.isValid && (
                    <p className="text-[11px] text-rose-400 font-medium">
                      ⚠️ {domainFormatCheck.error}
                    </p>
                  )}

                  <div className="text-[10px] text-slate-500">
                    Boleh huruf (a-z), angka (0-9), hyphen (-), dan ekstensi valid (.com, .id, dll). Jangan gunakan http://, spasi, atau path.
                  </div>
                </div>

                {/* Tipe Domain */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Tipe Domain</label>
                    <select
                      value={formDomainType}
                      onChange={(e) => setFormDomainType(e.target.value)}
                      className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="primary">Primary (Domain Utama)</option>
                      <option value="addon">Addon (Domain Tambahan)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#070D18] border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPrimary}
                        onChange={(e) => setFormIsPrimary(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="text-xs font-semibold text-white">Jadikan Domain Utama</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    <span>Informasi Verifikasi Otomatis</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Domain yang didaftarkan akan berstatus <strong>Pending</strong> sampai pemilik domain menambahkan CNAME record ke server BARBERIN.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting || !domainFormatCheck.isValid}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50"
                  >
                    {formSubmitting ? "Menyimpan..." : "Simpan Domain"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: INSTRUKSI DNS (BPMN Step 7) */}
        {showDnsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1526] border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F1E36]">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Instruksi Konfigurasi DNS — {showDnsModal.domain}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDnsModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-300">
                  Tambahkan DNS Record berikut pada dashboard registrar domain (Cloudflare, Niagahoster, Domainesia, dsb):
                </p>

                <div className="bg-[#070D18] border border-slate-800 rounded-xl divide-y divide-slate-800 font-mono text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Record Type</span>
                      <span className="text-blue-400 font-bold">CNAME</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("CNAME", "type")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {copiedKey === "type" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Name / Host</span>
                      <span className="text-white font-bold">{showDnsModal.dns_name || "@"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(showDnsModal.dns_name || "@", "name")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {copiedKey === "name" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Target / Value</span>
                      <span className="text-emerald-400 font-bold">{showDnsModal.dns_value || "cname.barberin.id"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(showDnsModal.dns_value || "cname.barberin.id", "val")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {copiedKey === "val" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <strong>⚠️ Catatan Propagasi:</strong> Perubahan DNS memerlukan waktu propagasi antara beberapa menit hingga 24 jam tergantung penyedia domain Anda.
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDnsModal(null)}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Tutup Panduan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: LOGS VERIFIKASI (BPMN Step 14) */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1526] border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F1E36]">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Log Verifikasi DNS — {showLogsModal.domain}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogsModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 max-h-[380px] overflow-y-auto space-y-2.5">
                {loadingLogs ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Memuat log verifikasi...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada riwayat verifikasi untuk domain ini.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id_log}
                      className="p-3 rounded-xl bg-[#070D18] border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            log.status === "active"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : log.status === "failed"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{log.response_message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-[#081220] border-t border-slate-800 text-right">
                <button
                  type="button"
                  onClick={() => setShowLogsModal(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: BPMN VIEWER */}
        {showBpmnModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
            <div className="max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
              <BPMNViewer
                initialMode="custom_domain"
                onClose={() => setShowBpmnModal(false)}
                className="max-h-[90vh]"
              />
            </div>
          </div>
        )}
      </div>
    </SuperadminAuthGuard>
  );
}
