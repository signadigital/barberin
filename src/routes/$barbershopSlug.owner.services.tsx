import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Scissors,
  Plus,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Search,
  SlidersHorizontal,
  X,
  AlertTriangle,
  Loader2,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  FileText,
  Wallet,
  ShieldCheck,
  BarChart3,
  ArrowLeft,
  Sparkles,
  Info,
  PowerOff,
  Power,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerAuthGuard,
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah, formatNumberWithDots, parseNumberFromDots } from "@/lib/format";
import {
  getOwnerServices,
  createOwnerService,
  updateOwnerService,
  deleteOwnerService,
  toggleOwnerServiceStatus,
  type OwnerServiceItem,
} from "@/lib/services";

export const Route = createFileRoute("/$barbershopSlug/owner/services")({
  head: () => ({
    meta: [
      { title: "Manajemen Layanan — BARBERIN Owner" },
      { name: "description", content: "Kelola layanan barbershop, harga, dan status layanan." },
    ],
  }),
  component: OwnerServicesPage,
});

// Preset Categories
const SERVICE_CATEGORIES = [
  "Rambut",
  "Paket",
  "Anak",
  "Styling",
  "Warna",
  "Cukur",
  "Perawatan",
  "Lainnya",
] as const;

// Helper to determine service category
function getServiceCategory(service: { nama_layanan: string; deskripsi?: string | null }): string {
  const text = `${service.nama_layanan} ${service.deskripsi || ""}`.toLowerCase();
  if (text.includes("anak") || text.includes("kids")) return "Anak";
  if (text.includes("paket") || text.includes("combo") || text.includes("+")) return "Paket";
  if (text.includes("color") || text.includes("warna") || text.includes("semir")) return "Warna";
  if (text.includes("styling") || text.includes("tata") || text.includes("pomade") || text.includes("wax")) return "Styling";
  if (text.includes("cukur") || text.includes("shaving") || text.includes("kumis") || text.includes("jenggot") || text.includes("beard")) return "Cukur";
  if (text.includes("wash") || text.includes("keramas") || text.includes("cuci") || text.includes("massage") || text.includes("pijat")) return "Perawatan";
  return "Rambut";
}

function OwnerServicesPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const [services, setServices] = useState<OwnerServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<OwnerServiceItem | null>(null);
  const [detailService, setDetailService] = useState<OwnerServiceItem | null>(null);
  const [deactivatingService, setDeactivatingService] = useState<OwnerServiceItem | null>(null);
  const [deletingService, setDeletingService] = useState<OwnerServiceItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string>("Rambut");
  const [formDesc, setFormDesc] = useState("");
  const [formPriceFormatted, setFormPriceFormatted] = useState<string>("50.000");
  const [formDuration, setFormDuration] = useState(30);
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");

  // Custom Wireframe Success Toast (Dark Mode Themed)
  const showCustomToast = (title: string, message: string) => {
    toast.custom((id) => (
      <div className="bg-[#0F1D33] border border-emerald-500/40 text-slate-100 rounded-2xl p-4 shadow-2xl flex items-start gap-3 w-full max-w-sm backdrop-blur-md animate-in fade-in slide-in-from-top-2">
        <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white">{title}</div>
          <div className="text-[11px] text-slate-300 mt-0.5 truncate">{message}</div>
        </div>
        <button
          onClick={() => toast.dismiss(id)}
          className="text-slate-400 hover:text-white p-1 -mr-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ));
  };

  // Load services
  const loadServices = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getOwnerServices();
      setServices(res);
    } catch (err: any) {
      console.error("Gagal memuat layanan:", err);
      toast.error(err?.message || "Gagal memuat daftar layanan.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (!(event.target as HTMLElement).closest(".action-menu-container")) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const category = getServiceCategory(s);
      const matchSearch =
        searchQuery.trim() === "" ||
        s.nama_layanan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.deskripsi && s.deskripsi.toLowerCase().includes(searchQuery.toLowerCase())) ||
        category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === "all" || category === selectedCategory;
      const matchStatus = selectedStatus === "all" || s.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [services, searchQuery, selectedCategory, selectedStatus]);

  // Pagination calculation
  const totalItems = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedServices = filteredServices.slice(startIndex, startIndex + pageSize);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormName("");
    setFormCategory("Rambut");
    setFormDesc("");
    setFormDuration(30);
    setFormPriceFormatted("50.000");
    setFormStatus("active");
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (service: OwnerServiceItem) => {
    setEditingService(service);
    setFormName(service.nama_layanan);
    setFormCategory(getServiceCategory(service));
    setFormDesc(service.deskripsi || "");
    setFormDuration(service.durasi_menit || 30);
    setFormPriceFormatted(formatNumberWithDots(service.harga));
    setFormStatus(service.status);
    setActiveMenuId(null);
    if (detailService) setDetailService(null);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (service: OwnerServiceItem) => {
    setDetailService(service);
    setActiveMenuId(null);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      toast.error("Nama layanan wajib diisi.");
      return;
    }
    const numPrice = parseNumberFromDots(formPriceFormatted);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Harga layanan harus valid dan tidak boleh negatif.");
      return;
    }

    setSubmitting(true);
    try {
      await createOwnerService({
        data: {
          nama_layanan: name,
          deskripsi: formDesc.trim() || undefined,
          durasi_menit: Number(formDuration) || 30,
          harga: numPrice,
          status: formStatus,
        },
      });

      showCustomToast("Layanan berhasil ditambahkan", `Layanan "${name}" telah ditambahkan.`);
      setIsCreateModalOpen(false);
      await loadServices(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menambahkan layanan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    const name = formName.trim();
    if (!name) {
      toast.error("Nama layanan wajib diisi.");
      return;
    }
    const numPrice = parseNumberFromDots(formPriceFormatted);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Harga layanan harus valid dan tidak boleh negatif.");
      return;
    }

    setSubmitting(true);
    try {
      await updateOwnerService({
        data: {
          id_layanan: editingService.id_layanan,
          nama_layanan: name,
          deskripsi: formDesc.trim() || undefined,
          durasi_menit: Number(formDuration) || 30,
          harga: numPrice,
          status: formStatus,
        },
      });

      showCustomToast("Layanan berhasil diperbarui", `Layanan "${name}" telah diperbarui.`);
      setEditingService(null);
      await loadServices(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui layanan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Deactivate (Modal 4)
  const handleDeactivateConfirm = async () => {
    if (!deactivatingService) return;
    setSubmitting(true);
    try {
      const isCurrentlyActive = deactivatingService.status === "active";
      await toggleOwnerServiceStatus({
        data: { id_layanan: deactivatingService.id_layanan },
      });

      if (isCurrentlyActive) {
        showCustomToast(
          "Layanan berhasil dinonaktifkan",
          `Layanan "${deactivatingService.nama_layanan}" telah dinonaktifkan.`,
        );
      } else {
        showCustomToast(
          "Layanan berhasil diaktifkan",
          `Layanan "${deactivatingService.nama_layanan}" telah diaktifkan.`,
        );
      }

      setDeactivatingService(null);
      if (detailService && detailService.id_layanan === deactivatingService.id_layanan) {
        setDetailService(null);
      }
      await loadServices(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status layanan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete (Modal 5)
  const handleDeleteConfirm = async () => {
    if (!deletingService) return;
    setSubmitting(true);
    try {
      const serviceName = deletingService.nama_layanan;
      const res = await deleteOwnerService({
        data: { id_layanan: deletingService.id_layanan },
      });

      if (res.softDeleted) {
        showCustomToast(
          "Layanan berhasil dinonaktifkan",
          `Layanan "${serviceName}" telah dinonaktifkan karena memiliki riwayat transaksi.`,
        );
      } else {
        showCustomToast("Layanan berhasil dihapus", `Layanan "${serviceName}" telah dihapus.`);
      }

      setDeletingService(null);
      if (detailService && detailService.id_layanan === deletingService.id_layanan) {
        setDetailService(null);
      }
      await loadServices(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus layanan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      {/* Sidebar Desktop */}
      <OwnerSidebar activePath="/owner/services" />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (Dark theme matching other owner pages) */}
        <OwnerMobileHeader
          activePath="/owner/services"
          onRefresh={() => loadServices(false)}
          isRefreshing={loading}
        />

        {/* Desktop Header (Dark theme matching other owner pages) */}
        <OwnerHeader
          onRefresh={() => loadServices(false)}
          isRefreshing={loading}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-5 pb-32 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Page Title & Subtitle */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Manajemen Layanan
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Kelola layanan barbershop, harga, dan status layanan.
            </p>
          </div>

          {/* Main Dark Card Container */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl shadow-sm p-4 sm:p-6 space-y-5">
            {/* Top Bar: Search, Filter, & Tambah Layanan */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search & Filter Group */}
              <div className="flex items-center gap-2.5 flex-1 max-w-lg">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama layanan..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-8 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-inner font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdown Button */}
                <div className="relative" ref={filterRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                      selectedCategory !== "all" || selectedStatus !== "all"
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                        : "bg-[#14233D] border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                    <span className="hidden sm:inline">Filter</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {/* Filter Popover Menu */}
                  {isFilterDropdownOpen && (
                    <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-[#0F1D33] border border-slate-700 rounded-2xl shadow-2xl z-30 p-4 space-y-4 animate-in fade-in zoom-in-95 text-slate-200">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-white">Filter Layanan</span>
                        {(selectedCategory !== "all" || selectedStatus !== "all") && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory("all");
                              setSelectedStatus("all");
                            }}
                            className="text-[11px] text-blue-400 hover:underline font-medium"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Status Filter */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Status Layanan
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 text-xs">
                          {(["all", "active", "inactive"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setSelectedStatus(st);
                                setCurrentPage(1);
                              }}
                              className={`py-1.5 px-2 rounded-lg font-medium text-center transition-all ${
                                selectedStatus === st
                                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                                  : "bg-[#14233D] text-slate-400 hover:text-white border border-slate-700/60"
                              }`}
                            >
                              {st === "all" ? "Semua" : st === "active" ? "Aktif" : "Nonaktif"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Category Filter */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Kategori
                        </label>
                        <div className="flex flex-wrap gap-1.5 text-xs max-h-44 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory("all");
                              setCurrentPage(1);
                            }}
                            className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all ${
                              selectedCategory === "all"
                                ? "bg-blue-600 text-white font-semibold"
                                : "bg-[#14233D] text-slate-300 hover:text-white border border-slate-700/60"
                            }`}
                          >
                            Semua Kategori
                          </button>
                          {SERVICE_CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setCurrentPage(1);
                              }}
                              className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all ${
                                selectedCategory === cat
                                  ? "bg-blue-600 text-white font-semibold"
                                  : "bg-[#14233D] text-slate-300 hover:text-white border border-slate-700/60"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop Button: + Tambah Layanan */}
              <div className="hidden sm:block">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-blue-600/25"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Layanan</span>
                </button>
              </div>
            </div>

            {/* Content Display: Loading, Empty, or Table/Cards */}
            {loading ? (
              <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-200">Memuat data layanan...</p>
                <p className="text-xs text-slate-500">Sinkronisasi katalog dari database</p>
              </div>
            ) : totalItems === 0 ? (
              /* EMPTY STATE */
              <div className="p-12 sm:p-16 text-center flex flex-col items-center justify-center gap-3.5 max-w-sm mx-auto">
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                  <FileText className="h-9 w-9" />
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-white">Belum ada layanan</h3>
                <p className="text-xs text-slate-400 -mt-1 leading-relaxed">
                  Mulai tambahkan layanan pertama Anda di sini.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="mt-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Layanan</span>
                </button>
              </div>
            ) : (
              <>
                {/* 1. DESKTOP TABLE VIEW (Tanpa Foto) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-3 w-12 text-center">No.</th>
                        <th className="py-3.5 px-4">Nama Layanan</th>
                        <th className="py-3.5 px-4 w-28">Kategori</th>
                        <th className="py-3.5 px-4 max-w-xs">Deskripsi</th>
                        <th className="py-3.5 px-4 w-32">Harga</th>
                        <th className="py-3.5 px-4 w-28 text-center">Status</th>
                        <th className="py-3.5 px-4 w-24 text-center">Digunakan</th>
                        <th className="py-3.5 px-4 w-28 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {paginatedServices.map((service, index) => {
                        const category = getServiceCategory(service);
                        const isUsed = service.usageCount > 0;
                        const rowNumber = startIndex + index + 1;

                        return (
                          <tr
                            key={service.id_layanan}
                            className="hover:bg-slate-800/30 transition-colors group"
                          >
                            {/* No. */}
                            <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                              {rowNumber}
                            </td>

                            {/* Nama Layanan (Tanpa Foto) */}
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-white text-sm">
                                {service.nama_layanan}
                              </span>
                            </td>

                            {/* Kategori Badge */}
                            <td className="py-3.5 px-4">
                              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {category}
                              </span>
                            </td>

                            {/* Deskripsi */}
                            <td className="py-3.5 px-4 text-slate-400 text-xs max-w-xs leading-relaxed">
                              <span className="line-clamp-2">
                                {service.deskripsi || "—"}
                              </span>
                            </td>

                            {/* Harga */}
                            <td className="py-3.5 px-4 font-bold text-white text-sm whitespace-nowrap">
                              {formatRupiah(service.harga)}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              {service.status === "active" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  Nonaktif
                                </span>
                              )}
                            </td>

                            {/* Digunakan */}
                            <td className="py-3.5 px-4 text-center text-slate-300 font-medium">
                              {isUsed ? "Ya" : "Tidak"}
                            </td>

                            {/* Aksi (Lihat + Three Dots) */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-2 relative action-menu-container">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetailModal(service)}
                                  className="px-3 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold text-xs transition-colors shadow-sm"
                                >
                                  Lihat
                                </button>

                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveMenuId(
                                        activeMenuId === service.id_layanan
                                          ? null
                                          : service.id_layanan,
                                      )
                                    }
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  {activeMenuId === service.id_layanan && (
                                    <div className="absolute right-0 mt-1 w-40 bg-[#14233D] border border-slate-700 rounded-xl shadow-2xl z-20 py-1 text-xs animate-in fade-in zoom-in-95 text-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(service)}
                                        className="w-full px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-700/60 flex items-center gap-2"
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-blue-400" />
                                        <span>Edit Layanan</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuId(null);
                                          setDeactivatingService(service);
                                        }}
                                        className="w-full px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-700/60 flex items-center gap-2"
                                      >
                                        {service.status === "active" ? (
                                          <>
                                            <PowerOff className="h-3.5 w-3.5 text-amber-400" />
                                            <span>Nonaktifkan</span>
                                          </>
                                        ) : (
                                          <>
                                            <Power className="h-3.5 w-3.5 text-emerald-400" />
                                            <span>Aktifkan</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuId(null);
                                          setDeletingService(service);
                                        }}
                                        className="w-full px-3 py-2 text-left font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-slate-700/60"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                        <span>Hapus</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 2. MOBILE CARD LIST VIEW (Tanpa Foto) */}
                <div className="block lg:hidden space-y-3">
                  {paginatedServices.map((service) => {
                    const category = getServiceCategory(service);

                    return (
                      <div
                        key={service.id_layanan}
                        className="bg-[#14233D] rounded-2xl p-4 border border-slate-700/80 shadow-sm flex items-center justify-between gap-3 relative transition-all hover:border-slate-600 action-menu-container"
                      >
                        {/* Center Info (click opens detail) */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleOpenDetailModal(service)}
                        >
                          <h4 className="font-bold text-white text-sm leading-snug truncate">
                            {service.nama_layanan}
                          </h4>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              {category}
                            </span>
                          </div>
                          <div className="font-bold text-white text-sm mt-1.5">
                            {formatRupiah(service.harga)}
                          </div>
                        </div>

                        {/* Right: Menu & Status */}
                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          {/* Three Dots Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuId(
                                  activeMenuId === service.id_layanan
                                    ? null
                                    : service.id_layanan,
                                )
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeMenuId === service.id_layanan && (
                              <div className="absolute right-0 mt-1 w-40 bg-[#0F1D33] border border-slate-700 rounded-xl shadow-2xl z-20 py-1 text-xs animate-in fade-in zoom-in-95 text-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetailModal(service)}
                                  className="w-full px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-700/60 flex items-center gap-2"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Lihat Detail</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(service)}
                                  className="w-full px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-700/60 flex items-center gap-2"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-blue-400" />
                                  <span>Edit Layanan</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeactivatingService(service);
                                  }}
                                  className="w-full px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-700/60 flex items-center gap-2"
                                >
                                  {service.status === "active" ? (
                                    <>
                                      <PowerOff className="h-3.5 w-3.5 text-amber-400" />
                                      <span>Nonaktifkan</span>
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-3.5 w-3.5 text-emerald-400" />
                                      <span>Aktifkan</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeletingService(service);
                                  }}
                                  className="w-full px-3 py-2 text-left font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-slate-700/60"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Status Pill Badge */}
                          {service.status === "active" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Mobile Bottom: + Tambah Layanan Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Tambah Layanan</span>
                    </button>
                  </div>
                </div>

                {/* 3. PAGINATION FOOTER */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                  <div>
                    Menampilkan{" "}
                    <span className="font-semibold text-white">
                      {totalItems === 0 ? 0 : startIndex + 1} -{" "}
                      {Math.min(startIndex + pageSize, totalItems)}
                    </span>{" "}
                    dari <span className="font-semibold text-white">{totalItems}</span> data
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Prev Page */}
                    <button
                      type="button"
                      disabled={validPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-700 bg-[#14233D] text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setCurrentPage(pg)}
                        className={`h-8 w-8 rounded-lg font-bold text-xs transition-all ${
                          validPage === pg
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-700 bg-[#14233D] text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {pg}
                      </button>
                    ))}

                    {/* Next Page */}
                    <button
                      type="button"
                      disabled={validPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-700 bg-[#14233D] text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Page Size Select */}
                    <div className="relative ml-2">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="appearance-none bg-[#14233D] border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value={5}>5 per halaman</option>
                        <option value={10}>10 per halaman</option>
                        <option value={20}>20 per halaman</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <OwnerBottomNav activePath="/owner/services" />
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH LAYANAN (Dark Mode, Otomatis Titik Harga, Tanpa Foto) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-[#0F1D33] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-700/80 overflow-hidden my-auto animate-in zoom-in-95 text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="sm:hidden -ml-2 p-1 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base sm:text-lg font-bold text-white">Tambah Layanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
              {/* Nama Layanan * */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nama Layanan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Potong Rambut"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Kategori (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Kategori (Opsional)
                </label>
                <div className="relative">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium cursor-pointer pr-9"
                  >
                    <option value="">Pilih kategori</option>
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#0F1D33] text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Harga * (Format Otomatis Titik) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Harga <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs sm:text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={formPriceFormatted}
                    onChange={(e) => {
                      const formatted = formatNumberWithDots(e.target.value);
                      setFormPriceFormatted(formatted);
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-bold tracking-wide"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Format otomatis dengan titik pemisah ribuan (contoh: 50.000).
                </p>
              </div>

              {/* Deskripsi * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Deskripsi <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formDesc.length}/500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Jelaskan detail layanan, misalnya termasuk apa saja, produk yang digunakan, dll."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Status Switch */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-300 mb-2">Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formStatus === "active"}
                    onClick={() =>
                      setFormStatus((s) => (s === "active" ? "inactive" : "active"))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formStatus === "active" ? "bg-blue-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        formStatus === "active" ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold text-slate-300">
                    {formStatus === "active" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/25 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT LAYANAN (Dark Mode, Otomatis Titik Harga, Tanpa Foto) */}
      {/* ========================================================================= */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-[#0F1D33] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-700/80 overflow-hidden my-auto animate-in zoom-in-95 text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="sm:hidden -ml-2 p-1 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base sm:text-lg font-bold text-white">Edit Layanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Service Header Info (Tanpa Foto) */}
            <div className="px-6 pt-5 pb-1">
              <div className="p-3.5 rounded-2xl bg-[#14233D] border border-slate-700/60 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {editingService.nama_layanan}
                  </h4>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {getServiceCategory(editingService)}
                  </span>
                </div>
                <div className="font-bold text-white text-sm">
                  {formatRupiah(editingService.harga)}
                </div>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
              {/* Nama Layanan * */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nama Layanan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Kategori (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Kategori (Opsional)
                </label>
                <div className="relative">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium cursor-pointer pr-9"
                  >
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#0F1D33] text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Harga * (Format Otomatis Titik) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Harga <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs sm:text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={formPriceFormatted}
                    onChange={(e) => {
                      const formatted = formatNumberWithDots(e.target.value);
                      setFormPriceFormatted(formatted);
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-bold tracking-wide"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Format otomatis dengan titik pemisah ribuan (contoh: 50.000).
                </p>
              </div>

              {/* Deskripsi * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Deskripsi <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formDesc.length}/500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#14233D] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Alert: Perubahan Harga */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Perubahan harga akan digunakan untuk transaksi baru. Transaksi sebelumnya
                  tetap menggunakan harga saat transaksi dibuat.
                </p>
              </div>

              {/* Status Switch */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-300 mb-2">Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formStatus === "active"}
                    onClick={() =>
                      setFormStatus((s) => (s === "active" ? "inactive" : "active"))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formStatus === "active" ? "bg-blue-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        formStatus === "active" ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold text-slate-300">
                    {formStatus === "active" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/25 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DETAIL LAYANAN (Dark Mode, Tanpa Foto) */}
      {/* ========================================================================= */}
      {detailService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-[#0F1D33] rounded-3xl w-full max-w-xl shadow-2xl border border-slate-700/80 overflow-hidden my-auto animate-in zoom-in-95 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailService(null)}
                  className="sm:hidden -ml-2 p-1 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="text-base sm:text-lg font-bold text-white">Detail Layanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Service Banner (Tanpa Foto) */}
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#14233D] border border-slate-700/60">
                <div>
                  <h4 className="font-bold text-white text-base">
                    {detailService.nama_layanan}
                  </h4>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {getServiceCategory(detailService)}
                  </span>
                </div>

                {detailService.status === "active" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Aktif
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Nonaktif
                  </span>
                )}
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs sm:text-sm">
                {/* Kolom 1: Informasi Layanan */}
                <div className="space-y-3.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                    Informasi Layanan
                  </h5>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-blue-400" />
                      Nama Layanan
                    </span>
                    <span className="font-bold text-white">{detailService.nama_layanan}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <FolderTree className="h-3.5 w-3.5 text-blue-400" />
                      Kategori
                    </span>
                    <span className="font-medium text-slate-200">
                      {getServiceCategory(detailService)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-blue-400" />
                      Harga Saat Ini
                    </span>
                    <span className="font-bold text-white text-sm">
                      {formatRupiah(detailService.harga)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-400" />
                      Deskripsi
                    </span>
                    <p className="text-slate-300 font-medium leading-relaxed">
                      {detailService.deskripsi || "Tidak ada deskripsi rinci untuk layanan ini."}
                    </p>
                  </div>
                </div>

                {/* Kolom 2: Informasi Penggunaan */}
                <div className="space-y-3.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                    Informasi Penggunaan
                  </h5>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Status
                    </span>
                    <span
                      className={`font-bold ${
                        detailService.status === "active" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {detailService.status === "active" ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-xs block mb-0.5 flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                      Digunakan dalam Transaksi
                    </span>
                    <div className="font-bold text-white">
                      {detailService.usageCount > 0 ? (
                        <>
                          Ya{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            (Total {detailService.usageCount} transaksi)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">Belum pernah digunakan</span>
                      )}
                    </div>
                  </div>

                  {/* Info Notice Box */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs mt-3">
                    <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {detailService.usageCount > 0
                        ? "Layanan ini sudah pernah digunakan dalam transaksi. Anda tidak dapat menghapus layanan ini, namun dapat menonaktifkan kembali jika diperlukan."
                        : "Layanan ini belum memiliki riwayat transaksi dan dapat dihapus jika tidak diperlukan lagi."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(detailService)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/25 flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </button>

                {detailService.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setDeactivatingService(detailService)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-rose-600/25"
                  >
                    Nonaktifkan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeactivatingService(detailService)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/25"
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: KONFIRMASI NONAKTIFKAN (Dark Mode) */}
      {/* ========================================================================= */}
      {deactivatingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0F1D33] rounded-3xl w-full max-w-sm shadow-2xl border border-slate-700/80 p-6 text-center space-y-4 animate-in zoom-in-95 text-white">
            {/* Warning Icon */}
            <div className="h-16 w-16 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {deactivatingService.status === "active"
                  ? "Nonaktifkan Layanan?"
                  : "Aktifkan Layanan?"}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {deactivatingService.status === "active" ? (
                  <>
                    Layanan{" "}
                    <span className="font-bold text-white">
                      "{deactivatingService.nama_layanan}"
                    </span>{" "}
                    tidak akan tersedia untuk transaksi baru, tetapi data transaksi sebelumnya
                    tetap tersimpan.
                  </>
                ) : (
                  <>
                    Layanan{" "}
                    <span className="font-bold text-white">
                      "{deactivatingService.nama_layanan}"
                    </span>{" "}
                    akan kembali aktif dan dapat dipilih oleh pelanggan serta capster.
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeactivatingService(null)}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-700 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeactivateConfirm}
                className={`w-full py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm transition-all shadow-md ${
                  deactivatingService.status === "active"
                    ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/25"
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : deactivatingService.status === "active" ? (
                  "Nonaktifkan"
                ) : (
                  "Aktifkan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: KONFIRMASI HAPUS (Dark Mode) */}
      {/* ========================================================================= */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0F1D33] rounded-3xl w-full max-w-sm shadow-2xl border border-slate-700/80 p-6 text-center space-y-4 animate-in zoom-in-95 text-white">
            {/* Trash Icon */}
            <div className="h-16 w-16 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Hapus Layanan?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus layanan{" "}
                <span className="font-bold text-white">
                  "{deletingService.nama_layanan}"
                </span>
                ? Tindakan ini tidak dapat dibatalkan. Layanan hanya dapat dihapus jika belum pernah
                digunakan dalam transaksi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeletingService(null)}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-700 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-rose-600/25"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </OwnerAuthGuard>
  );
}
