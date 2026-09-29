import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Phone,
  BadgeCheck,
  Clock,
  Plus,
  Mail,
  Calendar,
  Pencil,
  Trash2,
  Search,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Receipt,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import {
  getOwnerCapsters,
  createOwnerCapster,
  updateOwnerCapster,
  deleteOwnerCapster,
  toggleOwnerCapsterStatus,
  type OwnerCapsterItem,
} from "@/lib/capsters";

export const Route = createFileRoute("/$barbershopSlug/owner/capsters")({
  head: () => ({
    meta: [
      { title: "Manajemen Capster — BARBERIN Owner" },
      { name: "description", content: "Kelola akun staf, nomor pegawai, jadwal, dan hak akses capster." },
    ],
  }),
  component: OwnerCapstersPage,
});

function OwnerCapstersPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const [capsters, setCapsters] = useState<OwnerCapsterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "shift">("all");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCapster, setEditingCapster] = useState<OwnerCapsterItem | null>(null);
  const [deletingCapster, setDeletingCapster] = useState<OwnerCapsterItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNoPegawai, setFormNoPegawai] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [submitting, setSubmitting] = useState(false);

  // Load capsters data
  const loadCapsters = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getOwnerCapsters();
      setCapsters(res);
    } catch (err: any) {
      console.error("Gagal memuat data capster:", err);
      toast.error(err?.message || "Gagal memuat daftar capster");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadCapsters();
  }, []);

  // Filtered list
  const filteredCapsters = useMemo(() => {
    return capsters.filter((c) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.no_pegawai && c.no_pegawai.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.status === "active") ||
        (statusFilter === "inactive" && c.status === "inactive") ||
        (statusFilter === "shift" && c.isShiftActive);

      return matchSearch && matchStatus;
    });
  }, [capsters, searchQuery, statusFilter]);

  const activeCount = useMemo(
    () => capsters.filter((c) => c.status === "active").length,
    [capsters],
  );
  const inactiveCount = useMemo(
    () => capsters.filter((c) => c.status === "inactive").length,
    [capsters],
  );
  const shiftCount = useMemo(
    () => capsters.filter((c) => c.isShiftActive).length,
    [capsters],
  );

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const nextNum = capsters.length + 1;
    const defaultNo = `CAP-${String(nextNum).padStart(3, "0")}`;
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormNoPegawai(defaultNo);
    setFormPassword("password123");
    setFormStatus("active");
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (capsterItem: OwnerCapsterItem) => {
    setEditingCapster(capsterItem);
    setFormName(capsterItem.name);
    setFormEmail(capsterItem.email);
    setFormPhone(capsterItem.phone || "");
    setFormNoPegawai(capsterItem.no_pegawai || "");
    setFormPassword("");
    setFormStatus(capsterItem.status);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Nama lengkap capster wajib diisi.");
      return;
    }
    if (!formEmail.trim()) {
      toast.error("Email akun wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      await createOwnerCapster({
        data: {
          nama_lengkap: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          no_hp: formPhone.trim() || undefined,
          no_pegawai: formNoPegawai.trim().toUpperCase() || undefined,
          password: formPassword.trim() || undefined,
          status: formStatus,
        },
      });
      toast.success("Akun capster baru berhasil dibuat!");
      setIsCreateModalOpen(false);
      await loadCapsters(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menambahkan capster.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCapster) return;
    if (!formName.trim()) {
      toast.error("Nama lengkap capster wajib diisi.");
      return;
    }
    if (!formEmail.trim()) {
      toast.error("Email wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      await updateOwnerCapster({
        data: {
          id_capster: editingCapster.id_capster,
          nama_lengkap: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          no_hp: formPhone.trim() || undefined,
          password: formPassword.trim() || undefined,
          status: formStatus,
        },
      });
      toast.success("Data capster berhasil diperbarui!");
      setEditingCapster(null);
      await loadCapsters(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui capster.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (capsterItem: OwnerCapsterItem) => {
    try {
      const res = await toggleOwnerCapsterStatus({
        data: { id_capster: capsterItem.id_capster },
      });
      toast.success(res.message);
      await loadCapsters(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status capster.");
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingCapster) return;
    setSubmitting(true);
    try {
      const res = await deleteOwnerCapster({
        data: { id_capster: deletingCapster.id_capster },
      });
      toast.success(res.message);
      setDeletingCapster(null);
      await loadCapsters(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses penghapusan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/capsters" />
      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/capsters" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Top Title & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Manajemen Akun Capster
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Daftar staf barbershop, nomor pegawai, status shift, dan hak akses.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-all self-start sm:self-auto shadow-lg shadow-primary/25 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Capster</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm text-card-foreground">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari capster berdasarkan nama, no. pegawai, atau kontak..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-input rounded-xl pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills & Refresh */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border border-input"
                }`}
              >
                Semua ({capsters.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "active"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border border-input"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Aktif ({activeCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("shift")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "shift"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border border-input"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Sedang Shift ({shiftCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "inactive"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border border-input"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span>Nonaktif ({inactiveCount})</span>
              </button>
              <button
                type="button"
                onClick={() => loadCapsters(true)}
                title="Muat Ulang Data"
                className="p-2 bg-background hover:bg-muted border border-input rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Capsters Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-muted/60 rounded-2xl border border-border"
                />
              ))}
            </div>
          ) : filteredCapsters.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center text-card-foreground">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-foreground">Tidak ada capster ditemukan</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada staf yang cocok dengan kata kunci "${searchQuery}".`
                  : "Belum ada staf capster terdaftar. Silakan klik tombol 'Tambah Capster' untuk mendaftarkan akun baru."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-3 py-1.5 bg-primary/15 text-primary rounded-lg text-xs font-medium hover:bg-primary/25 transition-colors"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCapsters.map((c) => {
                const isActive = c.status === "active";
                const isOnline = c.isShiftActive;

                return (
                  <div
                    key={c.id_capster}
                    className={`bg-card border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm text-card-foreground ${
                      isActive
                        ? "border-border hover:border-primary/50"
                        : "border-border/60 opacity-75 hover:opacity-100 bg-muted/20"
                    }`}
                  >
                    <div>
                      {/* Top Row: Avatar, Info, Status & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-bold text-base shadow-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                              <span>{c.name}</span>
                              <BadgeCheck className="h-4 w-4 text-primary" />
                            </h3>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              <span className="text-primary font-semibold">{c.no_pegawai || "CAP-000"}</span>
                              {" • "}
                              <span>{c.role}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions (Edit & Delete) */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Akun Capster"
                            className="p-1.5 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-input transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCapster(c)}
                            title="Hapus Akun Capster"
                            className="p-1.5 rounded-lg bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-input transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Status Badges Row */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {/* Shift Status */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
                            isOnline
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/60"
                            }`}
                          />
                          <span>{isOnline ? "Sedang Shift" : "Offline"}</span>
                        </span>

                        {/* Account Status (Toggleable) */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          title={
                            isActive
                              ? "Klik untuk menonaktifkan akun"
                              : "Klik untuk mengaktifkan akun"
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25"
                              : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                              <span>Status: Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-muted-foreground" />
                              <span>Status: Nonaktif</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Contact & Email */}
                      <div className="mt-3.5 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                          <span>{c.phone || "Belum ada nomor HP"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Stats (Transactions & Revenue) */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                        <Receipt className="h-3.5 w-3.5 text-primary" />
                        <span>{c.totalTransactions} transaksi</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground mr-1">Omset:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(c.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/capsters" />
      </div>

      {/* ================= MODAL: TAMBAH CAPSTER ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 text-card-foreground">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Tambah Capster Baru</h3>
                  <p className="text-xs text-muted-foreground">
                    Pendaftaran staf barbershop dan pembuatan akun sistem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dedi Kurniawan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Nomor Pegawai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CAP-003"
                    value={formNoPegawai}
                    onChange={(e) => setFormNoPegawai(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Email Akun <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="dedi@barberin.local"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Password Awal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="password123"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Status Akun
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus("active")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      formStatus === "active"
                        ? "bg-emerald-600/25 border border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-semibold"
                        : "bg-background border border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Aktif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus("inactive")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      formStatus === "inactive"
                        ? "bg-muted border border-border text-foreground font-semibold"
                        : "bg-background border border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Nonaktif</span>
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-md shadow-primary/25 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{submitting ? "Mendaftarkan..." : "Simpan Capster"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CAPSTER ================= */}
      {editingCapster && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 text-card-foreground">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Edit Profil Capster</h3>
                  <p className="text-xs text-muted-foreground">
                    Perbarui nama, kontak, kata sandi, atau status akun capster.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setEditingCapster(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                    <span>Nomor Pegawai</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(Identitas Tetap)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    tabIndex={-1}
                    value={formNoPegawai}
                    title="Nomor pegawai adalah identitas tetap dan tidak dapat diubah"
                    className="w-full bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 text-xs text-muted-foreground font-mono cursor-not-allowed select-none focus:outline-none uppercase opacity-80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Email Akun <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Ganti Password (Opsional)
                  </label>
                  <input
                    type="password"
                    placeholder="Kosongkan jika tetap"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Status Akun
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus("active")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      formStatus === "active"
                        ? "bg-emerald-600/25 border border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-semibold"
                        : "bg-background border border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Aktif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus("inactive")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      formStatus === "inactive"
                        ? "bg-muted border border-border text-foreground font-semibold"
                        : "bg-background border border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Nonaktif</span>
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setEditingCapster(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-md shadow-primary/25 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: KONFIRMASI HAPUS ================= */}
      {deletingCapster && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 p-6 space-y-4 text-card-foreground">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Hapus Akun Capster?</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus staf{" "}
                  <strong className="text-foreground">"{deletingCapster.name}"</strong> (
                  <span className="font-mono text-primary">{deletingCapster.no_pegawai}</span>)?
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 leading-relaxed">
                  ⚠️ Jika capster ini memiliki riwayat shift atau transaksi, sistem akan
                  otomatis menonaktifkan akunnya agar rekap omset dan laporan komisi tetap
                  konsisten dan aman.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeletingCapster(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/25 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{submitting ? "Memproses..." : "Ya, Hapus Capster"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </OwnerAuthGuard>
  );
}

