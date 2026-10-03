import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Users,
  Eye,
  Clock,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  MousePointerClick,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  TrendingUp,
  Tag,
  MapPin,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

import {
  SuperadminAuthGuard,
  SuperadminSidebar,
  SuperadminHeader,
  SuperadminMobileHeader,
  SuperadminStatCard,
} from "@/components/superadmin/ui";
import { getSuperadminAnalytics, type WebsiteAnalyticsResult } from "@/lib/analytics";

export const Route = createFileRoute("/superadmin/analytics")({
  head: () => ({
    meta: [
      { title: "Website Analytics — BARBERIN Superadmin" },
      {
        name: "description",
        content: "Analitik traffic website publik BARBERIN.",
      },
    ],
  }),
  component: SuperadminAnalyticsPage,
});

type DateRangeOption = "today" | "yesterday" | "7d" | "30d" | "custom";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 detik";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDateLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    return `${d} ${months[parseInt(m, 10) - 1]}`;
  } catch {
    return dateStr;
  }
}

function SuperadminAnalyticsPage() {
  const [data, setData] = useState<WebsiteAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<DateRangeOption>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = useCallback(
    async (isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await getSuperadminAnalytics({
          data: {
            range,
            startDate: range === "custom" ? customStart : undefined,
            endDate: range === "custom" ? customEnd : undefined,
          },
        });
        setData(res);
      } catch (err: unknown) {
        console.error("Gagal memuat analytics:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat data analytics.");
        toast.error("Gagal memuat data analytics");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [range, customStart, customEnd],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overview = data?.overview;
  const isZeroData =
    !loading &&
    !error &&
    overview &&
    overview.visitors === 0 &&
    overview.sessions === 0 &&
    overview.pageViews === 0;

  return (
    <SuperadminAuthGuard>
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col lg:flex-row antialiased">
        <SuperadminSidebar activePath="/superadmin/analytics" />

        <div className="flex-1 flex flex-col min-w-0">
          <SuperadminMobileHeader
            activePath="/superadmin/analytics"
            onRefresh={() => fetchData(true)}
            isRefreshing={isRefreshing}
          />
          <SuperadminHeader onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />

          <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Platform Website Analytics</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  Website Analytics
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Analitik traffic website publik BARBERIN (WIB Timezone)
                </p>
              </div>

              {/* Date Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-[#0F1D33] p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRange("today")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === "today"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setRange("yesterday")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === "yesterday"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => setRange("7d")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === "7d"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => setRange("30d")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === "30d"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    30 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => setRange("custom")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === "custom"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Kustom
                  </button>
                </div>

                {range === "custom" && (
                  <div className="flex items-center gap-2 bg-[#0F1D33] p-1.5 rounded-xl border border-slate-800 text-xs">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-transparent border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-hidden focus:border-blue-500"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-transparent border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => fetchData()}
                      disabled={!customStart || !customEnd}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                    >
                      Terapkan
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-[#0A1424] border border-slate-800/80 rounded-2xl shadow-sm">
                <Loader2 className="h-9 w-9 text-blue-500 animate-spin mb-3.5" />
                <p className="text-sm font-bold text-white tracking-wide">Memuat analytics...</p>
                <p className="text-xs text-slate-400 mt-1">
                  Mengagregasi data pengunjung dan sesi website
                </p>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center p-14 text-center bg-[#0A1424] border border-rose-500/25 rounded-2xl shadow-sm">
                <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
                <h3 className="text-base font-bold text-white">Gagal memuat analytics</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-md">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            )}

            {/* Empty State Banner */}
            {isZeroData && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-[#0A1424] border border-slate-800/80 rounded-2xl">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Belum ada data analytics pada periode ini.
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Kunjungi halaman marketing publik (<code>/</code>) untuk mulai merekam kunjungan,
                  atau pilih rentang waktu lain.
                </p>
              </div>
            )}

            {/* Dashboard Content */}
            {!loading && !error && data && (
              <div className="space-y-6">
                {/* 1. Overview Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  <SuperadminStatCard
                    title="Visitors"
                    value={overview?.visitors.toLocaleString("id-ID") || 0}
                    subtext="Pengunjung unik (anonym)"
                    icon={Users}
                    variant="blue"
                  />
                  <SuperadminStatCard
                    title="Sessions"
                    value={overview?.sessions.toLocaleString("id-ID") || 0}
                    subtext="Total sesi kunjungan"
                    icon={Activity}
                    variant="purple"
                  />
                  <SuperadminStatCard
                    title="Page Views"
                    value={overview?.pageViews.toLocaleString("id-ID") || 0}
                    subtext="Total tayangan halaman"
                    icon={Eye}
                    variant="emerald"
                  />
                  <SuperadminStatCard
                    title="Avg. Session Duration"
                    value={formatDuration(overview?.averageSessionDurationSeconds || 0)}
                    subtext="Rata-rata durasi sesi"
                    icon={Clock}
                    variant="amber"
                  />
                </div>

                {/* 2. Main Time Series Line Chart */}
                <div className="rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-400" />
                        <span>Tren Visitors & Sessions</span>
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Statistik harian pengunjung unik dan sesi kunjungan website
                      </p>
                    </div>
                  </div>

                  {data.timeSeries.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                      Tidak ada data deret waktu pada periode ini.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data.timeSeries}
                          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatDateLabel}
                            stroke="#64748B"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: "#334155" }}
                          />
                          <YAxis
                            stroke="#64748B"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: "#334155" }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0F1D33",
                              borderColor: "#334155",
                              borderRadius: "0.75rem",
                              color: "#F8FAFC",
                              fontSize: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
                            }}
                            labelFormatter={(label) => `Tanggal: ${label}`}
                          />
                          <Legend
                            wrapperStyle={{
                              paddingTop: "12px",
                              fontSize: "12px",
                              color: "#CBD5E1",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="visitors"
                            name="Visitors"
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            dot={{ fill: "#3B82F6", r: 3 }}
                            activeDot={{ r: 5, stroke: "#60A5FA", strokeWidth: 2 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="sessions"
                            name="Sessions"
                            stroke="#A855F7"
                            strokeWidth={2.5}
                            dot={{ fill: "#A855F7", r: 3 }}
                            activeDot={{ r: 5, stroke: "#C084FC", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 3. Traffic Sources & Devices Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Traffic Sources (7 cols) */}
                  <div className="lg:col-span-7 rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                        <div>
                          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-400" />
                            <span>Traffic Sources</span>
                          </h2>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Sumber traffic (UTM Campaign, Referrer, Direct)
                          </p>
                        </div>
                      </div>

                      {data.trafficSources.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500">
                          Belum ada data sumber traffic.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="pb-2.5">Source</th>
                                <th className="pb-2.5 text-right">Sessions</th>
                                <th className="pb-2.5 text-right w-24">Persentase</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {data.trafficSources.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="py-2.5 font-medium text-slate-200">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                                      <span>{item.source}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 text-right font-semibold text-white">
                                    {item.sessions.toLocaleString("id-ID")}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ width: `${item.percentage}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-slate-300">
                                        {item.percentage}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Devices Breakdown (5 cols) */}
                  <div className="lg:col-span-5 rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                        <div>
                          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-emerald-400" />
                            <span>Devices</span>
                          </h2>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Perangkat yang digunakan pengunjung website
                          </p>
                        </div>
                      </div>

                      {data.devices.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500">
                          Belum ada data perangkat.
                        </div>
                      ) : (
                        <div className="space-y-3.5 pt-1">
                          {data.devices.map((dev, idx) => {
                            const Icon =
                              dev.device === "Mobile"
                                ? Smartphone
                                : dev.device === "Tablet"
                                  ? Tablet
                                  : Monitor;
                            return (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-[#0F1D33] border border-slate-800/80 flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-white">{dev.device}</div>
                                    <div className="text-[10px] text-slate-400">
                                      {dev.sessions.toLocaleString("id-ID")} sesi
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-bold font-mono text-emerald-400">
                                    {dev.percentage}%
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Top Pages & Marketing Events Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Top Pages (6 cols) */}
                  <div className="lg:col-span-6 rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <Eye className="h-4 w-4 text-purple-400" />
                          <span>Top Pages</span>
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Halaman website publik paling banyak dikunjungi
                        </p>
                      </div>
                    </div>

                    {data.topPages.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500">
                        Belum ada data tayangan halaman.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-2.5">Path</th>
                              <th className="pb-2.5 text-right">Page Views</th>
                              <th className="pb-2.5 text-right w-24">Persentase</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {data.topPages.map((page, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 font-mono text-slate-200">{page.path}</td>
                                <td className="py-2.5 text-right font-semibold text-white">
                                  {page.pageViews.toLocaleString("id-ID")}
                                </td>
                                <td className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full bg-purple-500 rounded-full"
                                        style={{ width: `${page.percentage}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-slate-300">
                                      {page.percentage}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Marketing Events & CTA Breakdown (6 cols) */}
                  <div className="lg:col-span-6 rounded-2xl bg-[#0A1424] border border-slate-800/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <MousePointerClick className="h-4 w-4 text-amber-400" />
                          <span>Marketing Events</span>
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Aksi konversi pengguna (CTA click, Pricing view, Login, Register, Kontak)
                        </p>
                      </div>
                    </div>

                    {data.events.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500">
                        Belum ada aktivitas marketing event.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Event Pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {data.events.map((evt, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-[#0F1D33] border border-slate-800/80 flex flex-col justify-between"
                            >
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate">
                                {evt.eventName}
                              </span>
                              <span className="text-base font-extrabold text-white mt-1">
                                {evt.count.toLocaleString("id-ID")}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* CTA Breakdown Table */}
                        {data.ctaBreakdown.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60">
                            <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                              <Tag className="h-3 w-3 text-amber-400" />
                              <span>Rincian Klik CTA (Label / Lokasi)</span>
                            </div>
                            <div className="space-y-1.5">
                              {data.ctaBreakdown.map((cta, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-semibold text-white truncate">
                                      {cta.label}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                      {cta.location}
                                    </span>
                                  </div>
                                  <span className="font-bold text-amber-400 font-mono shrink-0 pl-2">
                                    {cta.count}x
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SuperadminAuthGuard>
  );
}
