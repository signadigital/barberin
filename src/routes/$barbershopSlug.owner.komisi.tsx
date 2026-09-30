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
import {
  useCommissionStore,
  commissionActions,
  type CapsterCommissionItem,
} from "@/lib/commission-store";
import {
  getOwnerCommissionRequests,
  approveCommissionRequest,
  rejectCommissionRequest,
  payCommissionRequest,
} from "@/lib/commissions";
import { updateCapsterCommissionPercentage } from "@/lib/capsters";
import { formatRupiah } from "@/lib/format";
import { getOwnerSalaryData } from "@/lib/salary";
import { FeatureLockedCard } from "@/components/subscription/FeatureLockedCard";

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
      .catch((err: any) => {
        if (err?.code === "FEATURE_LOCKED" || err?.message?.includes("paket Pro")) {
          setIsLocked(true);
        }
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

  // Requests state
  const [isLocked, setIsLocked] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingRequest, setPayingRequest] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState<"transfer" | "tunai" | "qris">("transfer");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const loadRequests = () => {
    getOwnerCommissionRequests({ data: { barbershopSlug } })
      .then((res: any) => {
        if (res?.requests) setRequests(res.requests);
      })
      .catch((e: any) => {
        if (e?.code === "FEATURE_LOCKED" || e?.message?.includes("paket Pro")) {
          setIsLocked(true);
        }
        console.error("Gagal memuat pengajuan komisi:", e);
      });
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 8000);
    return () => clearInterval(interval);
  }, [barbershopSlug]);

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
    updateCapsterCommissionPercentage({
      data: {
        capsterId: editingCapster.capsterId,
        percentage: num,
        barbershopSlug,
      },
    }).catch((err) => console.error("Gagal sinkron komisi ke DB:", err));

    setIsCommissionModalOpen(false);
    toast.success(
      `Persentase komisi ${editingCapster.name} berhasil diatur ke ${num}%.`,
    );
  };

  const handleApprove = async (idPengajuan: string) => {
    setIsSubmittingAction(true);
    try {
      await approveCommissionRequest({ data: { pengajuanId: idPengajuan, barbershopSlug } });
      toast.success("Pengajuan komisi berhasil disetujui!");
      loadRequests();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyetujui pengajuan");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest || !rejectReason.trim()) {
      toast.error("Silakan masukkan alasan penolakan.");
      return;
    }
    setIsSubmittingAction(true);
    try {
      await rejectCommissionRequest({
        data: {
          pengajuanId: rejectingRequest.idPengajuan,
          alasan: rejectReason.trim(),
          barbershopSlug,
        },
      });
      toast.success("Pengajuan komisi telah ditolak.");
      setIsRejectModalOpen(false);
      setRejectingRequest(null);
      setRejectReason("");
      loadRequests();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menolak pengajuan");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmPay = async () => {
    if (!payingRequest) return;
    setIsSubmittingAction(true);
    try {
      await payCommissionRequest({
        data: {
          pengajuanId: payingRequest.idPengajuan,
          metodePembayaran: payMethod,
          catatan: payNotes || `Pembayaran komisi ${payingRequest.capsterName}`,
          barbershopSlug,
        },
      });
      toast.success(`Pembayaran komisi ${payingRequest.capsterName} (${formatRupiah(payingRequest.jumlah)}) berhasil! Saldo bisnis telah dipotong.`);
      setIsPayModalOpen(false);
      setPayingRequest(null);
      setPayNotes("");
      loadRequests();
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses pembayaran komisi");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredCapsters = store.capsters.filter((c) => {
    if (!topSearch.trim()) return true;
    const q = topSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.noPegawai.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased font-sans">
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
          {isLocked ? (
            <FeatureLockedCard
              featureName="Komisi & Bagi Hasil Capster"
              description="Fitur persentase komisi, pencatatan otomatis per layanan, pengajuan penarikan, dan pembayaran bagi hasil capster tersedia eksklusif pada paket Pro."
              requiredPlan="PRO"
            />
          ) : (
            <>
          {/* Top Title & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/gaji` as any })}
                className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
                title="Kembali ke Gaji"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Pengaturan Komisi Capster
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  Atur persentase komisi untuk setiap capster sebagai dasar perhitungan gaji dan komisi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: `/${barbershopSlug}/owner/gaji` as any })}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Halaman Gaji</span>
            </button>
          </div>

          {/* Table / Card Container */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-muted-foreground border-b border-border font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">No.</th>
                    <th className="py-3 px-3">Nama Capster</th>
                    <th className="py-3 px-3">ID Capster</th>
                    <th className="py-3 px-3">Persentase Komisi</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCapsters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                        Belum ada akun capster yang terdaftar untuk barbershop ini.
                      </td>
                    </tr>
                  ) : (
                    filteredCapsters.map((c, index) => (
                      <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-3 text-muted-foreground">{index + 1}</td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/25 text-primary font-bold flex items-center justify-center text-xs">
                              {c.avatarLetter}
                            </div>
                            <span className="font-semibold text-foreground">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 font-mono text-muted-foreground">{c.noPegawai}</td>
                        <td className="py-4 px-3 font-semibold text-foreground">
                          {c.commissionPercentage !== null ? `${c.commissionPercentage}%` : "-"}
                        </td>
                        <td className="py-4 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              c.statusCommission === "Diatur"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
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
                              className="text-primary hover:text-primary/80 font-semibold text-xs hover:underline cursor-pointer"
                            >
                              Ubah
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCommissionModal(c)}
                              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
            <div className="block md:hidden divide-y divide-border">
              {filteredCapsters.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  Belum ada akun capster yang terdaftar untuk barbershop ini.
                </div>
              ) : (
                filteredCapsters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleOpenCommissionModal(c)}
                    className="py-3.5 flex items-center justify-between gap-3 cursor-pointer active:bg-muted/50 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold flex items-center justify-center text-sm">
                        {c.avatarLetter}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.noPegawai}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.commissionPercentage !== null ? (
                        <div className="text-sm font-bold text-foreground">
                          {c.commissionPercentage}%
                        </div>
                      ) : null}

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          c.statusCommission === "Diatur"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border text-xs text-muted-foreground">
              <div>Menampilkan 1 - {filteredCapsters.length} dari {store.capsters.length} data</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg border border-border text-muted-foreground/40 cursor-not-allowed"
                >
                  &lt;
                </button>
                <span className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-semibold shadow-xs">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg border border-border text-muted-foreground/40 cursor-not-allowed"
                >
                  &gt;
                </button>
                <span className="ml-2 text-muted-foreground font-medium">10 per halaman</span>
              </div>
            </div>
          </div>

          {/* Section: Pengajuan Penarikan Komisi Capster */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  Pengajuan Penarikan Komisi Capster
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daftar pengajuan pencairan komisi dari capster untuk diverifikasi dan dibayarkan.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {requests.filter((r) => r.status === "pending").length} Menunggu Persetujuan
              </span>
            </div>

            {requests.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs bg-muted/30 rounded-xl border border-border">
                Belum ada pengajuan penarikan komisi dari capster.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 px-3">Capster</th>
                      <th className="py-3 px-3">Waktu Pengajuan</th>
                      <th className="py-3 px-3">Jumlah Penarikan</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {requests.map((r) => (
                      <tr key={r.idPengajuan} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-foreground">{r.capsterName}</div>
                          <div className="text-[11px] text-muted-foreground">{r.noPegawai} • Komisi {r.persentaseKomisi}%</div>
                        </td>
                        <td className="py-3.5 px-3 text-muted-foreground">{r.diajukanAt}</td>
                        <td className="py-3.5 px-3 font-bold text-foreground text-sm">
                          {formatRupiah(r.jumlah)}
                        </td>
                        <td className="py-3.5 px-3">
                          {r.status === "pending" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              Menunggu Persetujuan
                            </span>
                          )}
                          {r.status === "approved" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                              Menunggu Pembayaran
                            </span>
                          )}
                          {r.status === "paid" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                              Sudah Terbayar
                            </span>
                          )}
                          {r.status === "rejected" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30" title={r.alasanPenolakan}>
                              Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isSubmittingAction}
                                  onClick={() => handleApprove(r.idPengajuan)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shadow-xs cursor-pointer"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmittingAction}
                                  onClick={() => {
                                    setRejectingRequest(r);
                                    setIsRejectModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 font-medium text-[11px] border border-rose-500/30 cursor-pointer"
                                >
                                  Tolak
                                </button>
                              </>
                            )}
                            {r.status === "approved" && (
                              <button
                                type="button"
                                disabled={isSubmittingAction}
                                onClick={() => {
                                  setPayingRequest(r);
                                  setIsPayModalOpen(true);
                                }}
                                className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] shadow-xs cursor-pointer transition-colors"
                              >
                                Bayar Komisi
                              </button>
                            )}
                            {r.status === "paid" && (
                              <span className="text-[11px] text-muted-foreground">Selesai</span>
                            )}
                            {r.status === "rejected" && (
                              <span className="text-[11px] text-muted-foreground" title={r.alasanPenolakan || "Ditolak"}>
                                {r.alasanPenolakan ? `Ditolak: ${r.alasanPenolakan}` : "Ditolak"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Information Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Informasi</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground leading-relaxed pl-1">
              <li>Persentase komisi ditentukan oleh Owner.</li>
              <li>Jika belum diatur, sistem tidak akan menghitung komisi.</li>
              <li>Komisi dihitung dari transaksi layanan yang berhasil.</li>
              <li>Transaksi yang dibatalkan tidak dihitung sebagai komisi.</li>
              <li>Perubahan persentase komisi akan tercatat di Audit Aktivitas.</li>
            </ol>
          </div>
          </>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/gaji" />
      </div>

      {/* Modal Atur / Ubah Komisi */}
      {isCommissionModalOpen && editingCapster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                {editingCapster.commissionPercentage !== null
                  ? "Ubah Persentase Komisi"
                  : "Atur Persentase Komisi"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCommissionModalOpen(false)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommission} className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border">
                <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold flex items-center justify-center text-sm">
                  {editingCapster.avatarLetter}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{editingCapster.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ID Capster: {editingCapster.noPegawai}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Persentase Komisi</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={inputPercentage}
                    onChange={(e) => setInputPercentage(e.target.value)}
                    placeholder="15"
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-input bg-background text-foreground font-semibold text-sm outline-hidden focus:border-primary"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Masukkan persentase komisi (contoh: 15)
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCommissionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-lg shadow-primary/25 transition-all active:scale-95"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Tolak Pengajuan */}
      {isRejectModalOpen && rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 text-foreground shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Tolak Pengajuan Komisi</h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tolak pengajuan komisi dari <strong className="text-foreground">{rejectingRequest.capsterName}</strong> sebesar{" "}
              <strong className="text-foreground">{formatRupiah(rejectingRequest.jumlah)}</strong>. Komisi akan dikembalikan ke status belum dibayar.
            </p>
            <div>
              <label className="text-xs font-semibold text-foreground">Alasan Penolakan</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Dokumen absensi belum sesuai, silakan ajukan kembali"
                rows={3}
                className="w-full mt-1.5 bg-background border border-input rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 py-2 text-xs font-medium rounded-xl border border-border bg-background text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleConfirmReject}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isSubmittingAction ? "Menyimpan..." : "Tolak Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bayar Komisi (Atomic Saldo Deduction) */}
      {isPayModalOpen && payingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 text-foreground shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Konfirmasi Pembayaran Komisi</h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-1 text-center">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Pembayaran</span>
              <p className="text-xl font-bold text-foreground">{formatRupiah(payingRequest.jumlah)}</p>
              <p className="text-[11px] text-muted-foreground">Penerima: {payingRequest.capsterName} ({payingRequest.noPegawai})</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Metode Pembayaran</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full mt-1.5 bg-background border border-input rounded-xl p-2.5 text-xs text-foreground focus:outline-hidden focus:border-primary"
              >
                <option value="transfer">Transfer Bank</option>
                <option value="tunai">Tunai / Cash</option>
                <option value="qris">QRIS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Catatan / Referensi</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Contoh: Transfer BCA Ref 908123"
                className="w-full mt-1.5 bg-background border border-input rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
              />
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-300 leading-relaxed bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              Perhatian: Pembayaran akan memotong saldo bisnis barbershop secara otomatis dan mengirim notifikasi ke capster.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="flex-1 py-2 text-xs font-medium rounded-xl border border-border bg-background text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleConfirmPay}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              >
                {isSubmittingAction ? "Memproses..." : "Konfirmasi & Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
