import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Activity,
  Scissors,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getOwnerAuditActivityDetail,
  deleteOwnerTransactions,
  type OwnerActivityItem,
} from "@/lib/owner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/$barbershopSlug/owner/audit-activities/$id")({
  head: () => ({
    meta: [
      { title: "Detail Aktivitas — BARBERIN Owner" },
      { name: "description", content: "Detail riwayat aktivitas sistem barbershop." },
    ],
  }),
  component: OwnerAuditActivityDetailPage,
});

function OwnerAuditActivityDetailPage() {
  const { barbershopSlug } = (Route as any).useParams();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<OwnerActivityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    getOwnerAuditActivityDetail({ data: id })
      .then((res) => setActivity(res))
      .catch((err) => {
        console.error("Gagal memuat detail aktivitas:", err);
        setError("Aktivitas tidak ditemukan.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleteTransaction = async () => {
    if (!activity?.transactionId) return;
    try {
      setIsDeleting(true);
      const res = await deleteOwnerTransactions({
        data: { transactionIds: [activity.transactionId] },
      });
      toast.success(res.message || "Transaksi berhasil dihapus permanen.");
      setIsDeleteDialogOpen(false);
      navigate({ to: `/${barbershopSlug}/owner/audit-activities` as any });
    } catch (err: any) {
      console.error("Gagal menghapus transaksi:", err);
      toast.error(
        err?.message ||
          "Gagal menghapus transaksi. Data tidak berhasil dihapus dari database."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getActivityIcon = (type?: string) => {
    switch (type) {
      case "pembatalan":
        return <XCircle className="h-6 w-6 text-rose-400" />;
      case "transaksi":
        return <Scissors className="h-6 w-6 text-blue-400" />;
      case "shift":
        return <Clock className="h-6 w-6 text-purple-400" />;
      default:
        return <Activity className="h-6 w-6 text-emerald-400" />;
    }
  };

  const statusBadge = (s?: string) => {
    if (s === "Dibatalkan") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          Dibatalkan
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        Berhasil
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-activities" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/audit-activities" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[900px] w-full mx-auto">
          {/* Back Button */}
          <div>
            <Link
              to={`/${barbershopSlug}/owner/audit-activities` as any}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Audit Aktivitas</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-muted-foreground text-xs animate-pulse">
              Memuat detail aktivitas...
            </div>
          ) : error || !activity ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <div className="text-foreground font-semibold text-sm">{error || "Data tidak ditemukan"}</div>
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-activities` as any })}
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
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary">
                          {activity.id}
                        </span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-foreground mt-1">
                        {activity.aktivitas}
                      </h2>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        {activity.dateFormatted} • {activity.timeFormatted}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {statusBadge(activity.status)}
                    {activity.transactionId && (
                      <button
                        type="button"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="px-3 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Hapus transaksi ini secara permanen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus Transaksi</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-border text-xs">
                  <div>
                    <div className="text-muted-foreground font-medium">Pengguna</div>
                    <div className="text-foreground font-semibold mt-1">
                      {activity.pengguna}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Role</div>
                    <div className="text-foreground font-semibold mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-300 font-medium border border-blue-500/30">
                        {activity.role}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Data Terkait</div>
                    <div className="text-blue-600 dark:text-blue-400 font-mono font-semibold mt-1">
                      {activity.dataTerkait}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Waktu Lengkap</div>
                    <div className="text-foreground font-mono mt-1">
                      {activity.dateFormatted} • {activity.timeFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-medium">Status Eksekusi</div>
                    <div className="text-foreground font-medium mt-1">
                      {activity.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Detail Transaksi (if available) */}
              {activity.details?.nominal !== undefined && (
                <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-blue-500" />
                    <span>Detail Transaksi</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Layanan</div>
                      <div className="text-foreground font-semibold mt-1">
                        {activity.details.serviceNames || "Gentleman Cut"}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Capster Penanggung Jawab</div>
                      <div className="text-foreground font-semibold mt-1">
                        {activity.details.capsterName || activity.pengguna}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Nominal Transaksi</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                        {formatRupiah(activity.details.nominal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Alasan Pembatalan (if cancellation) */}
              {(activity.activityType === "pembatalan" || activity.status === "Dibatalkan") && (
                <div className="bg-card border border-rose-500/30 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                    <span>Alasan Pembatalan</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Alasan</div>
                      <div className="text-rose-600 dark:text-rose-400 font-semibold mt-1">
                        {activity.details?.cancelReason || "Menunggu terlalu lama"}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Dibatalkan Oleh</div>
                      <div className="text-foreground font-semibold mt-1">
                        {activity.details?.cancelledBy || activity.pengguna}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Waktu Pembatalan</div>
                      <div className="text-foreground font-mono mt-1">
                        {activity.details?.cancelTime || `${activity.dateFormatted} • ${activity.timeFormatted}`}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <div className="text-muted-foreground">Catatan Tambahan</div>
                      <div className="text-foreground mt-1">
                        {activity.details?.cancelNotes || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-activities` as any })}
                  className="w-full py-3 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-colors shadow-md shadow-primary/25"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/audit-activities" />
      </div>

      {/* Confirmation Dialog for Permanent Deletion */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => !isDeleting && !open && setIsDeleteDialogOpen(false)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-destructive pb-1">
              <div className="p-2 rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Hapus transaksi?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-3 pt-2 text-left">
              <span>
                Anda akan menghapus transaksi:
              </span>
              <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1.5 font-mono text-xs">
                <div className="font-bold text-primary font-mono text-sm">
                  {activity?.dataTerkait}
                </div>
                {activity?.details?.nominal !== undefined && (
                  <div className="text-muted-foreground font-sans text-xs">
                    Nominal: <strong className="text-foreground">{formatRupiah(activity.details.nominal)}</strong>
                  </div>
                )}
                <div className="text-muted-foreground font-sans text-xs">
                  Pengguna: <strong className="text-foreground">{activity?.pengguna}</strong> ({activity?.role})
                </div>
                <div className="text-muted-foreground font-sans text-xs">
                  Waktu: {activity?.dateFormatted} • {activity?.timeFormatted}
                </div>
              </div>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                Data transaksi dan data terkait yang memang menjadi bagian dari transaksi akan dihapus secara permanen.
              </div>
              <div className="font-semibold text-foreground text-xs">
                Tindakan ini tidak dapat dibatalkan.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs rounded-xl"
            >
              Batal
            </AlertDialogCancel>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteTransaction}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "text-xs font-semibold gap-1.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus Permanen</span>
                </>
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
