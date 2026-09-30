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
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-finance" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/audit-finance" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[900px] w-full mx-auto">
          {/* Back Button */}
          <div>
            <Link
              to={`/${barbershopSlug}/owner/audit-finance` as any}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Audit Keuangan</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-muted-foreground text-xs animate-pulse">
              Memuat detail transaksi audit...
            </div>
          ) : error || !detail ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3 text-foreground">
              <AlertCircle className="h-8 w-8 text-rose-500 dark:text-rose-400 mx-auto" />
              <div className="text-foreground font-semibold text-sm">
                {error || "Transaksi tidak ditemukan"}
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-finance` as any })}
                className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground"
              >
                Kembali
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Card */}
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base md:text-lg font-bold font-mono text-foreground">
                          {detail.shortId}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        {detail.tanggal} • {detail.waktu}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        detail.statusTransaksi === "Berhasil"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {detail.statusTransaksi}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Informasi Transaksi */}
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Informasi Transaksi</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-muted-foreground font-medium">Pelanggan</div>
                    <div className="text-foreground font-semibold mt-1">
                      {detail.customerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Layanan</div>
                    <div className="text-foreground font-semibold mt-1 truncate">
                      {detail.serviceNames}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Capster</div>
                    <div className="text-foreground font-semibold mt-1">
                      {detail.capsterName}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Nominal</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                      {formatRupiah(detail.amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Metode Pembayaran</div>
                    <div className="text-foreground font-semibold mt-1">
                      {detail.paymentMethod}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Status Transaksi</div>
                    <div className="text-foreground font-semibold mt-1">
                      {detail.statusTransaksi}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Status Pembayaran</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      {detail.statusPembayaran}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Data Sistem vs Data Aktual (Grid 2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data Sistem */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Data Sistem</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-border">
                      <span className="text-muted-foreground">Nominal (Sistem):</span>
                      <span className="font-bold text-foreground">
                        {formatRupiah(detail.systemNominal)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-border">
                      <span className="text-muted-foreground">Metode Pembayaran Sistem:</span>
                      <span className="text-foreground font-semibold">
                        {detail.systemMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status Pembayaran:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {detail.systemPaymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Data Aktual */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Data Aktual</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-border">
                      <span className="text-muted-foreground">Nominal Diterima:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(detail.actualNominal)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-border">
                      <span className="text-muted-foreground">Metode Aktual:</span>
                      <span className="text-foreground font-semibold">
                        {detail.actualMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bukti Pembayaran:</span>
                      <span className="text-foreground font-medium">
                        {detail.actualProof}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Selisih & Status */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">
                    Kesesuaian Keuangan
                  </div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">
                    Selisih:{" "}
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(detail.difference)}
                    </span>
                  </div>
                </div>
                <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {detail.checkStatus}
                </span>
              </div>

              {/* 4. Catatan Pemeriksaan */}
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-foreground">Catatan Pemeriksaan</h3>
                <p className="text-xs text-muted-foreground">
                  Owner dapat menambahkan catatan rekonsiliasi atau verifikasi transaksi ini.
                </p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan pemeriksaan transaksi ini..."
                  className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between pt-1">
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Catatan berhasil disimpan!</span>
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={handleSaveNotes}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors disabled:opacity-50 cursor-pointer"
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
                  className="w-full py-3 border border-border bg-card hover:bg-muted rounded-xl text-xs font-semibold text-foreground transition-colors cursor-pointer"
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
