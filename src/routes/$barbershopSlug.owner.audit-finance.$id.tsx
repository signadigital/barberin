import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Scissors,
  User,
  CreditCard,
  Building,
  Banknote,
  Calendar,
  Clock,
  ShieldCheck,
  Save,
  FileText,
} from "lucide-react";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import {
  getOwnerAuditFinanceDetail,
  saveOwnerTransactionAuditNote,
  type OwnerFinanceDetailItem,
} from "@/lib/owner";

export const Route = createFileRoute("/$barbershopSlug/owner/audit-finance/$id")({
  head: () => ({
    meta: [
      { title: "Detail Transaksi Keuangan — BARBERIN Owner" },
      {
        name: "description",
        content: "Detail audit transaksi dan rekonsiliasi pembayaran barbershop.",
      },
    ],
  }),
  component: OwnerAuditFinanceDetailPage,
});

function OwnerAuditFinanceDetailPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OwnerFinanceDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    getOwnerAuditFinanceDetail({ data: id })
      .then((res) => {
        setDetail(res);
        setNotes(res.catatanPemeriksaan || "");
      })
      .catch((err) => {
        console.error("Gagal memuat detail transaksi:", err);
        setError("Data transaksi tidak ditemukan.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveNotes = async () => {
    if (!detail) return;
    try {
      setSavingNote(true);
      await saveOwnerTransactionAuditNote({
        data: {
          transactionId: detail.id,
          notes,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Gagal menyimpan catatan:", err);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-finance" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/audit-finance" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[900px] w-full mx-auto">
          {/* Back Button */}
          <div>
            <Link
              to={`/${barbershopSlug}/owner/audit-finance` as any}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Audit Keuangan</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs animate-pulse">
              Memuat detail transaksi audit...
            </div>
          ) : error || !detail ? (
            <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <div className="text-white font-semibold text-sm">
                {error || "Transaksi tidak ditemukan"}
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-finance` as any })}
                className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-semibold text-white"
              >
                Kembali
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Card */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base md:text-lg font-bold font-mono text-white">
                          {detail.shortId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono">
                        {detail.tanggal} • {detail.waktu}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        detail.statusTransaksi === "Berhasil"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {detail.statusTransaksi}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Informasi Transaksi */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>Informasi Transaksi</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Pelanggan</div>
                    <div className="text-white font-semibold mt-1">
                      {detail.customerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Layanan</div>
                    <div className="text-white font-semibold mt-1 truncate">
                      {detail.serviceNames}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Capster</div>
                    <div className="text-white font-semibold mt-1">
                      {detail.capsterName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Nominal</div>
                    <div className="text-emerald-400 font-bold mt-1">
                      {formatRupiah(detail.amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Metode Pembayaran</div>
                    <div className="text-slate-200 font-semibold mt-1">
                      {detail.paymentMethod}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Status Transaksi</div>
                    <div className="text-slate-200 font-semibold mt-1">
                      {detail.statusTransaksi}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Status Pembayaran</div>
                    <div className="text-emerald-400 font-semibold mt-1">
                      {detail.statusPembayaran}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Data Sistem vs Data Aktual (Grid 2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data Sistem */}
                <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-blue-400 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Data Sistem</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Nominal (Sistem):</span>
                      <span className="font-bold text-white">
                        {formatRupiah(detail.systemNominal)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Metode Pembayaran Sistem:</span>
                      <span className="text-slate-200 font-semibold">
                        {detail.systemMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status Pembayaran:</span>
                      <span className="text-emerald-400 font-semibold">
                        {detail.systemPaymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Data Aktual */}
                <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Data Aktual</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Nominal Diterima:</span>
                      <span className="font-bold text-emerald-400">
                        {formatRupiah(detail.actualNominal)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-slate-800/80">
                      <span className="text-slate-400">Metode Aktual:</span>
                      <span className="text-slate-200 font-semibold">
                        {detail.actualMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bukti Pembayaran:</span>
                      <span className="text-slate-300 font-medium">
                        {detail.actualProof}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Selisih & Status */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">
                    Kesesuaian Keuangan
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    Selisih:{" "}
                    <span className="font-mono text-emerald-400">
                      {formatRupiah(detail.difference)}
                    </span>
                  </div>
                </div>
                <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {detail.checkStatus}
                </span>
              </div>

              {/* 4. Catatan Pemeriksaan */}
              <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-white">Catatan Pemeriksaan</h3>
                <p className="text-xs text-slate-400">
                  Owner dapat menambahkan catatan rekonsiliasi atau verifikasi transaksi ini.
                </p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan pemeriksaan transaksi ini..."
                  className="w-full px-3.5 py-2.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center justify-between pt-1">
                  {saveSuccess && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Catatan berhasil disimpan!</span>
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={handleSaveNotes}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      <span>{savingNote ? "Menyimpan..." : "Simpan Catatan"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div>
                <button
                  type="button"
                  onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-finance` as any })}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/audit-finance" />
      </div>
    </div>
  );
}
