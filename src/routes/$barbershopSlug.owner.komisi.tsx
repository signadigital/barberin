import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Settings,
  AlertCircle,
  ChevronRight,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { getOwnerSalaryData } from "@/lib/salary";
import {
  useCommissionStore,
  commissionActions,
  type CapsterCommissionItem,
} from "@/lib/commission-store";

export const Route = createFileRoute("/$barbershopSlug/owner/komisi")({
  head: () => ({
    meta: [
      { title: "Pengaturan Komisi Capster — BARBERIN Owner" },
      {
        name: "description",
        content: "Atur persentase komisi untuk setiap capster sebagai dasar perhitungan gaji dan komisi.",
      },
    ],
  }),
  component: OwnerKomisiPage,
});

function OwnerKomisiPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const store = useCommissionStore();
  const navigate = useNavigate();

  // Load and sync live salary & capsters from database
  useEffect(() => {
    let isMounted = true;
    getOwnerSalaryData({ data: { period: "month", barbershopSlug } })
      .then((liveSummary) => {
        if (isMounted && liveSummary) {
          commissionActions.syncWithLiveSalaryData(liveSummary);
        }
      })
      .catch((err) => {
        console.warn("Gagal sinkron komisi dengan database:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [barbershopSlug]);

  const [topSearch, setTopSearch] = useState("");
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [editingCapster, setEditingCapster] = useState<CapsterCommissionItem | null>(null);
  const [inputPercentage, setInputPercentage] = useState<string>("15");

  const handleOpenCommissionModal = (c: CapsterCommissionItem) => {
    setEditingCapster(c);
    setInputPercentage(
      c.commissionPercentage !== null ? String(c.commissionPercentage) : "15",
    );
    setIsCommissionModalOpen(true);
  };

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCapster) return;
    const num = Number(inputPercentage);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error("Persentase komisi harus berupa angka antara 0 dan 100.");
      return;
    }

    commissionActions.setCommissionPercentage(editingCapster.capsterId, num);
    setIsCommissionModalOpen(false);
    toast.success(
      `Persentase komisi ${editingCapster.name} berhasil diatur ke ${num}%.`,
    );
  };

  const filteredCapsters = store.capsters.filter((c) => {
    if (!topSearch.trim()) return true;
    const q = topSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.noPegawai.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased font-sans">
      <OwnerSidebar activePath="/owner/gaji" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/gaji" />
        <OwnerHeader
          variant="dark"
          searchPlaceholder="Cari nama capster atau ID capster..."
          searchValue={topSearch}
          onSearchChange={setTopSearch}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Top Title & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/gaji` as any })}
                className="p-2 rounded-xl bg-[#0F1D33] border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
                title="Kembali ke Gaji"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Pengaturan Komisi Capster
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                  Atur persentase komisi untuk setiap capster sebagai dasar perhitungan gaji dan komisi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: `/${barbershopSlug}/owner/gaji` as any })}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-[#0F1D33] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Halaman Gaji</span>
            </button>
          </div>

          {/* Table / Card Container */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">No.</th>
                    <th className="py-3 px-3">Nama Capster</th>
                    <th className="py-3 px-3">ID Capster</th>
                    <th className="py-3 px-3">Persentase Komisi</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredCapsters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        Belum ada akun capster yang terdaftar untuk barbershop ini.
                      </td>
                    </tr>
                  ) : (
                    filteredCapsters.map((c, index) => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-3 text-slate-400">{index + 1}</td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                              {c.avatarLetter}
                            </div>
                            <span className="font-semibold text-white">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 font-mono text-slate-400">{c.noPegawai}</td>
                        <td className="py-4 px-3 font-semibold text-white">
                          {c.commissionPercentage !== null ? `${c.commissionPercentage}%` : "-"}
                        </td>
                        <td className="py-4 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              c.statusCommission === "Diatur"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {c.statusCommission}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          {c.statusCommission === "Diatur" ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCommissionModal(c)}
                              className="text-blue-400 hover:text-blue-300 font-semibold text-xs hover:underline"
                            >
                              Ubah
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCommissionModal(c)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                            >
                              Atur Komisi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List View */}
            <div className="block md:hidden divide-y divide-slate-800/50">
              {filteredCapsters.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada akun capster yang terdaftar untuk barbershop ini.
                </div>
              ) : (
                filteredCapsters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleOpenCommissionModal(c)}
                    className="py-3.5 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-800/40 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                        {c.avatarLetter}
                      </div>
                      <div>
                      <div className="text-sm font-bold text-white">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.noPegawai}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {c.commissionPercentage !== null ? (
                      <div className="text-sm font-bold text-white">
                        {c.commissionPercentage}%
                      </div>
                    ) : null}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        c.statusCommission === "Diatur"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {c.statusCommission}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
              <div>Menampilkan 1 - {filteredCapsters.length} dari {store.capsters.length} data</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                >
                  &lt;
                </button>
                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold shadow-xs">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg border border-slate-800 text-slate-600 cursor-not-allowed"
                >
                  &gt;
                </button>
                <span className="ml-2 text-slate-400 font-medium">10 per halaman</span>
              </div>
            </div>
          </div>

          {/* Information Card */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Informasi</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed pl-1">
              <li>Persentase komisi ditentukan oleh Owner.</li>
              <li>Jika belum diatur, sistem tidak akan menghitung komisi.</li>
              <li>Komisi dihitung dari transaksi layanan yang berhasil.</li>
              <li>Transaksi yang dibatalkan tidak dihitung sebagai komisi.</li>
              <li>Perubahan persentase komisi akan tercatat di Audit Aktivitas.</li>
            </ol>
          </div>
        </main>

        <OwnerBottomNav activePath="/owner/gaji" />
      </div>

      {/* Modal Atur / Ubah Komisi */}
      {isCommissionModalOpen && editingCapster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F1D33] border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingCapster.commissionPercentage !== null
                  ? "Ubah Persentase Komisi"
                  : "Atur Persentase Komisi"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCommissionModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommission} className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0A1424] border border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
                  {editingCapster.avatarLetter}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{editingCapster.name}</div>
                  <div className="text-[11px] text-slate-400">
                    ID Capster: {editingCapster.noPegawai}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Persentase Komisi</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={inputPercentage}
                    onChange={(e) => setInputPercentage(e.target.value)}
                    placeholder="15"
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-700 bg-[#0A1424] text-white font-semibold text-sm outline-hidden focus:border-blue-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan persentase komisi (contoh: 15)
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCommissionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
