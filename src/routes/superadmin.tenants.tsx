import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Store,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Trash2,
  Loader2,
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
  toggleTenantStatus,
  deleteTenantPermanent,
  type SuperadminTenantItem,
  type SuperadminStats,
} from "@/lib/superadmin";
import { useSuperadmin, getSuperadminAuth } from "@/lib/superadmin-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

  // Delete Modal States
  const [tenantToDelete, setTenantToDelete] = useState<SuperadminTenantItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenDeleteModal = (tenant: SuperadminTenantItem) => {
    setTenantToDelete(tenant);
    setConfirmationInput("");
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return;
    if (
      confirmationInput.trim().toLowerCase() !==
      tenantToDelete.nama_barbershop.trim().toLowerCase()
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteTenantPermanent({
        data: {
          id_barbershop: tenantToDelete.id_barbershop,
        },
      });

      toast.success("Akun Owner dan seluruh data barbershop berhasil dihapus secara permanen.");
      setIsDeleteModalOpen(false);
      setTenantToDelete(null);
      setConfirmationInput("");

      // Revalidate fresh list and stats from database
      await fetchData();
    } catch (err: any) {
      console.error("Gagal menghapus akun owner:", err);
      toast.error("Gagal Menghapus Akun Owner", {
        description:
          err?.message ||
          "Gagal menghapus akun Owner. Tidak ada perubahan yang dianggap berhasil sampai proses deletion selesai.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filters & Controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"terbaru" | "terlama" | "name_asc" | "name_desc">("terbaru");

  const inFlightRef = useRef(false);

  const fetchData = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
      inFlightRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Coordinated data-fetch lifecycle (initial load, filter/sort change, debounced search)
  useEffect(() => {
    if (!isLoggedIn && !getSuperadminAuth()) return;
    const timer = setTimeout(
      () => {
        fetchData();
      },
      search ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [isLoggedIn, statusFilter, sortBy, search]);


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
          <div className="border-b border-slate-800/80 pb-5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
              <Store className="h-3.5 w-3.5" />
              <span>Multi-Tenant Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Manajemen Toko & Barbershop
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Kelola seluruh barbershop terdaftar, akun Owner, dan status operasional toko.
            </p>
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
                    : "Belum ada toko yang terdaftar."}
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
                                  disabled={isDeleting}
                                  title={
                                    isSuspended
                                      ? "Aktifkan kembali toko"
                                      : "Suspend toko (blokir akses)"
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer disabled:opacity-50 ${
                                    isSuspended
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                  }`}
                                >
                                  {isSuspended ? "Aktifkan" : "Suspend"}
                                </button>

                                {/* Hapus Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteModal(t)}
                                  disabled={isDeleting}
                                  title="Hapus toko dan seluruh data secara permanen"
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer disabled:opacity-50 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                >
                                  Hapus
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
                        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(t)}
                            disabled={isDeleting}
                            className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                              isSuspended
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                            }`}
                          >
                            {isSuspended ? "Aktifkan Toko" : "Suspend Toko"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(t)}
                            disabled={isDeleting}
                            className="w-full py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                          >
                            Hapus Toko
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

      {/* Modal Konfirmasi Hapus Tenant & Owner Permanen */}
      <Dialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteModalOpen(open);
            if (!open) {
              setTenantToDelete(null);
              setConfirmationInput("");
            }
          }
        }}
      >
        <DialogContent className="max-w-md bg-slate-900 border border-slate-800 text-slate-100 p-6 sm:rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  Hapus Akun Owner?
                </DialogTitle>
                <p className="text-xs text-slate-400">
                  Konfirmasi penghapusan permanen tenant
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-300 font-medium">
              Anda akan menghapus secara permanen:
            </p>

            {/* Detail info box */}
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Barbershop
                </span>
                <span className="font-bold text-white text-sm">
                  {tenantToDelete?.nama_barbershop}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Owner
                </span>
                <span className="font-medium text-slate-200">
                  {tenantToDelete?.owner?.nama_lengkap || "Belum ada Owner"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Email
                </span>
                <span className="font-mono text-blue-400">
                  {tenantToDelete?.owner?.email || "-"}
                </span>
              </div>
            </div>

            {/* Warning Box */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>PERINGATAN</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-200/90">
                Semua data barbershop, akun Owner, data Capster, layanan, transaksi, komisi, notifikasi, subscription, dan file terkait akan dihapus secara permanen.
              </p>
              <p className="text-[11px] font-semibold text-rose-400">
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            {/* Double Confirmation Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Ketik &ldquo;<span className="text-white font-bold select-all">{tenantToDelete?.nama_barbershop}</span>&rdquo; untuk melanjutkan:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                disabled={isDeleting}
                placeholder={tenantToDelete?.nama_barbershop}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setTenantToDelete(null);
                setConfirmationInput("");
              }}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={
                isDeleting ||
                confirmationInput.trim().toLowerCase() !==
                  (tenantToDelete?.nama_barbershop || "").trim().toLowerCase()
              }
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/40"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Hapus Permanen</span>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SuperadminAuthGuard>
  );
}
