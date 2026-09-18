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
} from "lucide-react";

import {
  OwnerSidebar,
  OwnerHeader,
  OwnerMobileHeader,
  OwnerBottomNav,
} from "@/components/owner/ui";
import { formatRupiah } from "@/lib/format";
import {
  getOwnerAuditActivityDetail,
  type OwnerActivityItem,
} from "@/lib/owner";

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

  useEffect(() => {
    getOwnerAuditActivityDetail({ data: id })
      .then((res) => setActivity(res))
      .catch((err) => {
        console.error("Gagal memuat detail aktivitas:", err);
        setError("Aktivitas tidak ditemukan.");
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Dibatalkan
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        Berhasil
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-activities" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader activePath="/owner/audit-activities" />
        <OwnerHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[900px] w-full mx-auto">
          {/* Back Button */}
          <div>
            <Link
              to={`/${barbershopSlug}/owner/audit-activities` as any}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Audit Aktivitas</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs animate-pulse">
              Memuat detail aktivitas...
            </div>
          ) : error || !activity ? (
            <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <div className="text-white font-semibold text-sm">{error || "Data tidak ditemukan"}</div>
              <button
                type="button"
                onClick={() => navigate({ to: `/${barbershopSlug}/owner/audit-activities` as any })}
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
                    <div className="h-12 w-12 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400">
                          {activity.id}
                        </span>
                      </div>
                      <h2 className="text-lg md:text-xl font-bold text-white mt-1">
                        {activity.aktivitas}
                      </h2>
                      <div className="text-xs text-slate-400 mt-1 font-mono">
                        {activity.dateFormatted} • {activity.timeFormatted}
                      </div>
                    </div>
                  </div>

                  <div>{statusBadge(activity.status)}</div>
                </div>

                {/* Metadata Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Pengguna</div>
                    <div className="text-white font-semibold mt-1">
                      {activity.pengguna}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Role</div>
                    <div className="text-white font-semibold mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-medium border border-blue-500/30">
                        {activity.role}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Data Terkait</div>
                    <div className="text-blue-400 font-mono font-semibold mt-1">
                      {activity.dataTerkait}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Waktu Lengkap</div>
                    <div className="text-slate-200 font-mono mt-1">
                      {activity.dateFormatted} • {activity.timeFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Status Eksekusi</div>
                    <div className="text-slate-200 font-medium mt-1">
                      {activity.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Detail Transaksi (if available) */}
              {activity.details?.nominal !== undefined && (
                <div className="bg-[#0F1D33] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-blue-400" />
                    <span>Detail Transaksi</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Layanan</div>
                      <div className="text-white font-semibold mt-1">
                        {activity.details.serviceNames || "Gentleman Cut"}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Capster Penanggung Jawab</div>
                      <div className="text-white font-semibold mt-1">
                        {activity.details.capsterName || activity.pengguna}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Nominal Transaksi</div>
                      <div className="text-emerald-400 font-bold mt-1">
                        {formatRupiah(activity.details.nominal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Alasan Pembatalan (if cancellation) */}
              {(activity.activityType === "pembatalan" || activity.status === "Dibatalkan") && (
                <div className="bg-[#0F1D33] border border-rose-500/30 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                    <span>Alasan Pembatalan</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Alasan</div>
                      <div className="text-rose-300 font-semibold mt-1">
                        {activity.details?.cancelReason || "Menunggu terlalu lama"}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Dibatalkan Oleh</div>
                      <div className="text-white font-semibold mt-1">
                        {activity.details?.cancelledBy || activity.pengguna}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Waktu Pembatalan</div>
                      <div className="text-slate-300 font-mono mt-1">
                        {activity.details?.cancelTime || `${activity.dateFormatted} • ${activity.timeFormatted}`}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                      <div className="text-slate-400">Catatan Tambahan</div>
                      <div className="text-slate-300 mt-1">
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
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors shadow-md shadow-blue-600/25"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </main>

        <OwnerBottomNav activePath="/owner/audit-activities" />
      </div>
    </div>
  );
}
