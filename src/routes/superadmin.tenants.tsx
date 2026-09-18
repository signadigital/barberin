import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Search,
  Plus,
  RefreshCw,
  Store,
  CheckCircle2,
  XCircle,
  LogIn,
  AlertTriangle,
  SlidersHorizontal,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  Phone,
  Mail,
  MapPin,
  Clock,
  X,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import {
  SuperadminAuthGuard,
  SuperadminSidebar,
  SuperadminHeader,
  SuperadminMobileHeader,
  SuperadminStatCard,
} from "@/components/superadmin/ui";
import {
  getSuperadminTenants,
  createTenantWithTransaction,
  toggleTenantStatus,
  logSuperadminAction,
  type SuperadminTenantItem,
  type SuperadminStats,
} from "@/lib/superadmin";
import { superadminActions, useSuperadmin, getSuperadminAuth } from "@/lib/superadmin-store";

export const Route = createFileRoute("/superadmin/tenants")({
  head: () => ({
    meta: [
      { title: "Manajemen Toko / Tenants — BARBERIN Superadmin" },
      {
        name: "description",
        content: "Kelola seluruh barbershop dan tenant di platform BARBERIN.",
      },
    ],
  }),
  component: SuperadminTenantsPage,
});

function SuperadminTenantsPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useSuperadmin();

  const [tenants, setTenants] = useState<SuperadminTenantItem[]>([]);
  const [stats, setStats] = useState<SuperadminStats>({
    totalTenants: 0,
    activeTenants: 0,
    suspendedTenants: 0,
    totalOwners: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"terbaru" | "terlama" | "name_asc" | "name_desc">("terbaru");

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<SuperadminTenantItem | null>(null);

  // Form Tambah Toko
  const [formNamaBarbershop, setFormNamaBarbershop] = useState("");
  const [formNamaOwner, setFormNamaOwner] = useState("");
  const [formEmailOwner, setFormEmailOwner] = useState("");
  const [formPasswordAwal, setFormPasswordAwal] = useState("");
  const [formAlamat, setFormAlamat] = useState("");
  const [formNoHp, setFormNoHp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const res = await getSuperadminTenants({
        data: {
          search,
          status: statusFilter,
          sort: sortBy,
        },
      });
      setTenants(res.tenants);
      setStats(res.stats);
    } catch (err: any) {
      console.error("Gagal memuat daftar tenant:", err);
      toast.error("Gagal Memuat Data", {
        description: err?.message || "Terjadi kesalahan saat memuat tenant.",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn || getSuperadminAuth()) {
      fetchData();
    }
  }, [isLoggedIn, statusFilter, sortBy]);

  // Debounced search
  useEffect(() => {
    if (!isLoggedIn && !getSuperadminAuth()) return;
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Tambah Toko Baru (Database Transaction)
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await createTenantWithTransaction({
        data: {
          nama_barbershop: formNamaBarbershop,
          nama_owner: formNamaOwner,
          email_owner: formEmailOwner,
          password_awal: formPasswordAwal,
          alamat: formAlamat,
          no_hp_barbershop: formNoHp,
          actor_email: user?.email || "superadmin@barberin.test",
        },
      });

      toast.success("Toko Berhasil Ditambahkan", {
        description: `Toko '${formNamaBarbershop}' dan akun Owner telah dibuat via DB Transaction.`,
      });

      // Reset form & close modal
      setFormNamaBarbershop("");
      setFormNamaOwner("");
      setFormEmailOwner("");
      setFormPasswordAwal("");
      setFormAlamat("");
      setFormNoHp("");
      setIsAddModalOpen(false);

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error("Gagal tambah toko:", err);
      const msg = err?.message || "Toko gagal dibuat. Tidak ada data yang disimpan.";
      setFormError(msg);
      toast.error("Gagal Tambah Toko", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active ↔ Suspended
  const handleToggleStatus = async (tenant: SuperadminTenantItem) => {
    const targetStatus = tenant.status === "active" ? "suspended" : "active";
    const confirmText =
      targetStatus === "suspended"
        ? `Apakah Anda yakin ingin MENONAKTIFKAN (Suspend) toko '${tenant.nama_barbershop}'? Owner dan Capster tidak akan dapat mengakses sistem.`
        : `Apakah Anda yakin ingin MENGAKTIFKAN kembali toko '${tenant.nama_barbershop}'?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const res = await toggleTenantStatus({
        data: {
          id_barbershop: tenant.id_barbershop,
          targetStatus,
          actor_email: user?.email || "superadmin@barberin.test",
        },
      });

      toast.success("Status Toko Diperbarui", {
        description: res.message,
      });

      // Update state locally
      setTenants((prev) =>
        prev.map((t) =>
          t.id_barbershop === tenant.id_barbershop
            ? { ...t, status: targetStatus }
            : t,
        ),
      );

      // Refresh statistik
      fetchData();
    } catch (err: any) {
      console.error("Gagal mengubah status:", err);
      toast.error("Gagal Mengubah Status", {
        description: err?.message || "Terjadi kesalahan.",
      });
    }
  };

  // Handle Impersonate Toko
  const handleImpersonate = async (tenant: SuperadminTenantItem) => {
    if (tenant.status === "suspended") {
      toast.error("Tidak Dapat Impersonate", {
        description: "Toko ini sedang disuspend. Aktifkan terlebih dahulu sebelum impersonate.",
      });
      return;
    }

    // Set impersonate state
    superadminActions.startImpersonate(
      {
        id_barbershop: tenant.id_barbershop,
        nama_barbershop: tenant.nama_barbershop,
        slug: tenant.slug,
        alamat: tenant.alamat,
        no_hp: tenant.no_hp,
      },
      tenant.owner,
    );

    // Catat log audit
    await logSuperadminAction({
      data: {
        action: "impersonate",
        actor_email: user?.email || "superadmin@barberin.test",
        target_tenant_id: tenant.id_barbershop,
        target_tenant_name: tenant.nama_barbershop,
        details: `Superadmin masuk sebagai Owner toko '${tenant.nama_barbershop}'.`,
      },
    }).catch(() => {});

    toast.success("Masuk sebagai Toko Ini", {
      description: `Beralih ke konteks ${tenant.nama_barbershop}.`,
    });

    navigate({ to: `/${tenant.slug}/owner/dashboard` as any });
  };

  return (
    <SuperadminAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <SuperadminSidebar activePath="/superadmin/tenants" />

      <div className="flex-1 flex flex-col min-w-0">
        <SuperadminMobileHeader
          activePath="/superadmin/tenants"
          onRefresh={fetchData}
          isRefreshing={isRefreshing}
        />
        <SuperadminHeader onRefresh={fetchData} isRefreshing={isRefreshing} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                <Store className="h-3.5 w-3.5" />
                <span>Multi-Tenant Management</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Manajemen Toko & Barbershop
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Kelola seluruh barbershop terdaftar, akun Owner, status operasional, dan impersonasi toko.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Toko Baru</span>
            </button>
          </div>

          {/* Statistics Cards (Real Database Data) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <SuperadminStatCard
              title="Total Toko"
              value={stats.totalTenants}
              subtext="Seluruh barbershop terdaftar"
              icon={Store}
              variant="blue"
            />
            <SuperadminStatCard
              title="Toko Aktif"
              value={stats.activeTenants}
              subtext="Dapat mengakses sistem"
              icon={CheckCircle2}
              variant="emerald"
            />
            <SuperadminStatCard
              title="Toko Suspended"
              value={stats.suspendedTenants}
              subtext="Akses diblokir oleh platform"
              icon={AlertTriangle}
              variant="amber"
            />
            <SuperadminStatCard
              title="Total Owner"
              value={stats.totalOwners}
              subtext="Akun pemilik terdaftar"
              icon={Users}
              variant="purple"
            />
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama barbershop, owner, email, atau ID..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter Status Tabs */}
              <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/80 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === "active"
                      ? "bg-emerald-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("suspended")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === "suspended"
                      ? "bg-amber-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Suspended
                </button>
              </div>

              {/* Sorting Select */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Urutkan daftar toko"
                  className="bg-transparent border-none outline-hidden text-xs text-white cursor-pointer"
                >
                  <option value="terbaru" className="bg-[#0F1D33] text-white">
                    Terbaru
                  </option>
                  <option value="terlama" className="bg-[#0F1D33] text-white">
                    Terlama
                  </option>
                  <option value="name_asc" className="bg-[#0F1D33] text-white">
                    Nama A-Z
                  </option>
                  <option value="name_desc" className="bg-[#0F1D33] text-white">
                    Nama Z-A
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Tenants List (Responsive: Desktop Table & Mobile Cards) */}
          <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500 mb-2" />
                <p className="text-xs">Memuat daftar tenant...</p>
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-16 text-center text-slate-400 p-6">
                <Store className="mx-auto h-10 w-10 text-slate-600 mb-3 opacity-60" />
                <p className="text-sm font-bold text-white">Tidak Ada Toko Ditemukan</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {search
                    ? `Tidak ada hasil untuk pencarian "${search}". Coba kata kunci lain.`
                    : "Belum ada toko yang terdaftar. Klik tombol 'Tambah Toko Baru' untuk menambahkan toko pertama."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View: Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A1424] text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-5">Toko / Barbershop</th>
                        <th className="py-3.5 px-5">Owner Akun</th>
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-5">Kapasitas</th>
                        <th className="py-3.5 px-5">Terdaftar</th>
                        <th className="py-3.5 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tenants.map((t) => {
                        const isSuspended = t.status === "suspended";
                        return (
                          <tr
                            key={t.id_barbershop}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            {/* Barbershop */}
                            <td className="py-4 px-5">
                              <div className="font-bold text-white text-sm">
                                {t.nama_barbershop}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                                {t.alamat || "Alamat belum diatur"}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                ID: {t.id_barbershop}
                              </div>
                            </td>

                            {/* Owner */}
                            <td className="py-4 px-5">
                              {t.owner ? (
                                <div>
                                  <div className="font-medium text-white">
                                    {t.owner.nama_lengkap}
                                  </div>
                                  <div className="text-[11px] text-blue-400">
                                    {t.owner.email}
                                  </div>
                                  {t.owner.no_hp && (
                                    <div className="text-[10px] text-slate-400">
                                      {t.owner.no_hp}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic">
                                  Belum terhubung
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-4 px-5">
                              {isSuspended ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <AlertTriangle className="h-3 w-3" />
                                  Suspended
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </span>
                              )}
                            </td>

                            {/* Kapasitas */}
                            <td className="py-4 px-5">
                              <div className="text-slate-300">
                                <span className="font-semibold">{t.capsterCount}</span> Capster
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {t.serviceCount} Layanan
                              </div>
                            </td>

                            {/* Terdaftar */}
                            <td className="py-4 px-5 text-slate-400 text-[11px]">
                              {new Date(t.created_at).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Toggle Status */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(t)}
                                  title={
                                    isSuspended
                                      ? "Aktifkan kembali toko"
                                      : "Suspend toko (blokir akses)"
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                                    isSuspended
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                  }`}
                                >
                                  {isSuspended ? "Aktifkan" : "Suspend"}
                                </button>

                                {/* Impersonate Button */}
                                <button
                                  type="button"
                                  onClick={() => handleImpersonate(t)}
                                  disabled={isSuspended}
                                  title="Masuk sebagai Owner Toko Ini"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-all cursor-pointer"
                                >
                                  <LogIn className="h-3.5 w-3.5" />
                                  <span>Impersonate</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Cards */}
                <div className="lg:hidden divide-y divide-slate-800/60">
                  {tenants.map((t) => {
                    const isSuspended = t.status === "suspended";
                    return (
                      <div key={t.id_barbershop} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-white text-base">
                              {t.nama_barbershop}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {t.alamat || "Alamat belum diatur"}
                            </p>
                          </div>
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                              <AlertTriangle className="h-3 w-3" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                          <div className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                            Owner Terdaftar
                          </div>
                          <div className="font-semibold text-white">
                            {t.owner?.nama_lengkap || "Belum ada Owner"}
                          </div>
                          <div className="text-blue-400 text-[11px]">
                            {t.owner?.email || "-"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <div>
                            {t.capsterCount} Capster • {t.serviceCount} Layanan
                          </div>
                          <div>
                            {new Date(t.created_at).toLocaleDateString("id-ID")}
                          </div>
                        </div>

                        {/* Mobile Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(t)}
                            className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors ${
                              isSuspended
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {isSuspended ? "Aktifkan Toko" : "Suspend Toko"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleImpersonate(t)}
                            disabled={isSuspended}
                            className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center gap-1.5"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            <span>Impersonate</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ==================================================================== */}
      {/* MODAL TAMBAH TOKO BARU (DB TRANSACTION) */}
      {/* ==================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#0F1D33] border border-slate-700/90 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Tambah Toko / Tenant Baru
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Proses pembuatan otomatis via Database Transaction
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
              {/* Seksi Toko */}
              <div className="space-y-3">
                <div className="text-[11px] uppercase font-bold text-blue-400 tracking-wider">
                  1. Informasi Toko / Barbershop
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nama Barbershop <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNamaBarbershop}
                    onChange={(e) => setFormNamaBarbershop(e.target.value)}
                    placeholder="Contoh: BARBERIN Platinum Purwokerto"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Alamat Lengkap Toko
                  </label>
                  <input
                    type="text"
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    placeholder="Jl. Merdeka No. 45, Purwokerto Barat"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    No. Telepon / WhatsApp Toko
                  </label>
                  <input
                    type="text"
                    value={formNoHp}
                    onChange={(e) => setFormNoHp(e.target.value)}
                    placeholder="0812-3456-7890"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Seksi Owner */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                  2. Akun Owner Barbershop
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nama Lengkap Owner <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNamaOwner}
                    onChange={(e) => setFormNamaOwner(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email Owner (Untuk Login) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmailOwner}
                    onChange={(e) => setFormEmailOwner(e.target.value)}
                    placeholder="owner@tokoanda.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Password Awal <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formPasswordAwal}
                      onChange={(e) => setFormPasswordAwal(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* DB Transaction Guarantee Note */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Sistem mengeksekusi pembuatan toko dan akun owner secara <strong>atomic via DB Transaction</strong>. Jika terjadi kegagalan, seluruh perubahan akan di-rollback tanpa sisa data yatim.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Menyimpan (DB Transaction)...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Simpan & Aktifkan Toko</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </SuperadminAuthGuard>
  );
}
