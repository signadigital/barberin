import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  DollarSign,
  Wallet,
  Receipt,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Search,
  SlidersHorizontal,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  ArrowRight,
  Plus,
  QrCode,
  Building2,
  CreditCard,
  Banknote,
  X,
  AlertCircle,
  Scissors,
  Loader2,
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
  getOwnerAuditFinance,
  saveOwnerCashAudit,
  type OwnerAuditFinanceResult,
  type OwnerPeriodFilter,
  type OwnerFinanceTransactionItem,
} from "@/lib/owner";
import { OwnerDateRangePicker, type DateRangeResult } from "@/components/owner/date-range-picker";

export const Route = createFileRoute("/$barbershopSlug/owner/audit-finance")({
  head: () => ({
    meta: [
      { title: "Audit Keuangan — BARBERIN Owner" },
      {
        name: "description",
        content: "Periksa dan cocokkan data keuangan berdasarkan transaksi yang tercatat di sistem.",
      },
    ],
  }),
  component: OwnerAuditFinancePage,
});

function OwnerAuditFinancePage() {
  const { barbershopSlug } = (Route as any).useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<OwnerAuditFinanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState<OwnerPeriodFilter>("today");
  const todayStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }, []);

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerContainerRef = useRef<HTMLDivElement>(null);

  // Outside click listener for Date Range Picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerContainerRef.current &&
        !datePickerContainerRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    if (isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDatePickerOpen]);

  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Modal Input Uang Fisik
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [inputPhysicalCash, setInputPhysicalCash] = useState<string>("");
  const [cashNotes, setCashNotes] = useState<string>("");
  const [savingCash, setSavingCash] = useState(false);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getOwnerAuditFinance({
        data: {
          period,
          startDate: period === "custom" ? startDate : undefined,
          endDate: period === "custom" ? endDate : undefined,
          paymentMethod,
          status,
          search,
          page,
          pageSize: 8,
        },
      });
      setData(res);
      if (res.cashOnHand) {
        setInputPhysicalCash(formatNumberWithDots(res.cashOnHand.physicalCash));
      }
    } catch (err: any) {
      console.error("Gagal memuat audit keuangan:", err);
      setError(err?.message || "Gagal memuat data keuangan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [period, startDate, endDate, paymentMethod, status, page]);

  const handleApplyFilter = () => {
    setPage(1);
    fetchFinanceData();
  };

  const handleSaveCashAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    try {
      setSavingCash(true);
      const physical = parseNumberFromDots(inputPhysicalCash);
      await saveOwnerCashAudit({
        data: {
          periode: data.periodLabel,
          kasSistem: data.cashOnHand.systemCash,
          kasFisik: physical,
          keterangan: cashNotes || "Input kas fisik oleh Owner",
        },
      });
      setIsCashModalOpen(false);
      setCashNotes("");
      await fetchFinanceData();
    } catch (err) {
      console.error("Gagal menyimpan audit kas fisik:", err);
    } finally {
      setSavingCash(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    try {
      setIsExportingPdf(true);
      if (!data || data.totalTransactionsCount === 0) {
        toast.error("Tidak ada data transaksi untuk diekspor.");
        return;
      }

      // Ambil seluruh data transaksi sesuai filter yang sedang aktif
      let listToExport: OwnerFinanceTransactionItem[] = [];
      if (data.totalTransactionsCount <= data.transactions.length) {
        listToExport = data.transactions;
      } else {
        const res = await getOwnerAuditFinance({
          data: {
            period,
            startDate: period === "custom" ? startDate : undefined,
            endDate: period === "custom" ? endDate : undefined,
            paymentMethod,
            status,
            search,
            page: 1,
            pageSize: Math.max(data.totalTransactionsCount, 10000),
          },
        });
        listToExport = res?.transactions ?? data.transactions;
      }

      if (!listToExport || listToExport.length === 0) {
        toast.error("Tidak ada data transaksi yang cocok dengan filter.");
        return;
      }

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const marginX = 36;
      const contentWidth = pageWidth - marginX * 2;

      // Color palette
      const slateMuted = [100, 116, 139];
      const slateText = [51, 65, 85];
      const borderLight = [226, 232, 240];
      const bgZebra = [248, 250, 252];
      const primaryBlue = [37, 99, 235];
      const emeraldGreen = [16, 185, 129];
      const roseRed = [225, 29, 72];
      const amberOrange = [217, 119, 6];

      let currentY = 32;

      // 1. Header Banner Box
      doc.setFillColor(13, 21, 39); // Deep dark navy
      doc.roundedRect(marginX, currentY, contentWidth, 54, 6, 6, "F");

      // Brand Logo / Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(229, 166, 94); // Gold / Amber
      doc.text("BARBERIN", marginX + 16, currentY + 24);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Modern Barbershop Management System", marginX + 16, currentY + 39);

      // Report Title on Right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(
        "LAPORAN AUDIT TRANSAKSI KEUANGAN",
        marginX + contentWidth - 16,
        currentY + 23,
        { align: "right" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      const printDate = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const periodName =
        period === "today"
          ? "Hari Ini"
          : period === "7d"
            ? "7 Hari Terakhir"
            : period === "30d"
              ? "30 Hari Terakhir"
              : "Semua Waktu";
      doc.text(
        `Barbershop: ${barbershopSlug || "Semua"}   |   Periode: ${periodName}   |   Waktu Unduh: ${printDate}`,
        marginX + contentWidth - 16,
        currentY + 39,
        { align: "right" }
      );

      currentY += 64;

      // 2. Statistics Summary Cards
      if (data?.stats) {
        const kpiWidth = (contentWidth - 30) / 4;
        const kpis = [
          {
            label: "Total Transaksi",
            value: `${data.stats.totalTransactions} Transaksi`,
            color: [15, 23, 42],
          },
          {
            label: "Transaksi Berhasil",
            value: `${data.stats.successfulTransactions} Transaksi`,
            color: emeraldGreen,
          },
          {
            label: "Transaksi Dibatalkan",
            value: `${data.stats.cancelledTransactions} Transaksi`,
            color: roseRed,
          },
          {
            label: "Total Pendapatan",
            value: formatRupiah(data.stats.totalRevenue),
            color: primaryBlue,
          },
        ];

        kpis.forEach((item, i) => {
          const boxX = marginX + i * (kpiWidth + 10);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
          doc.roundedRect(boxX, currentY, kpiWidth, 34, 4, 4, "FD");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
          doc.text(item.label, boxX + 10, currentY + 13);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(item.color[0], item.color[1], item.color[2]);
          doc.text(item.value, boxX + 10, currentY + 27);
        });

        currentY += 44;
      }

      // Table Columns Configuration
      const columns = [
        { header: "No", width: 26, align: "center" as const },
        { header: "No. Transaksi", width: 80, align: "left" as const },
        { header: "Tanggal & Waktu", width: 92, align: "left" as const },
        { header: "Pelanggan", width: 86, align: "left" as const },
        { header: "Layanan", width: 136, align: "left" as const },
        { header: "Capster", width: 75, align: "left" as const },
        { header: "Nominal", width: 80, align: "right" as const },
        { header: "Metode", width: 55, align: "center" as const },
        { header: "Status Transaksi", width: 75, align: "center" as const },
        { header: "Status Bayar", width: 65, align: "center" as const },
      ];

      const drawTableHeader = (y: number) => {
        doc.setFillColor(30, 41, 59); // Slate-800
        doc.rect(marginX, y, contentWidth, 22, "F");

        let curX = marginX;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);

        columns.forEach((col) => {
          let textX = curX + 6;
          if (col.align === "center") {
            textX = curX + col.width / 2;
          } else if (col.align === "right") {
            textX = curX + col.width - 6;
          }
          doc.text(col.header, textX, y + 14, { align: col.align });
          curX += col.width;
        });

        return y + 22;
      };

      currentY = drawTableHeader(currentY);

      const rowHeight = 19;
      const truncate = (str: string | undefined | null, len: number) => {
        if (!str) return "-";
        return str.length > len ? str.slice(0, len - 1) + "…" : str;
      };

      listToExport.forEach((tx, idx) => {
        if (currentY + rowHeight > pageHeight - 45) {
          doc.addPage();
          currentY = 36;
          currentY = drawTableHeader(currentY);
        }

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(bgZebra[0], bgZebra[1], bgZebra[2]);
        }
        doc.rect(marginX, currentY, contentWidth, rowHeight, "F");

        // Border line under row
        doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

        let curX = marginX;

        // 1. No
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
        doc.text(String(idx + 1), curX + columns[0].width / 2, currentY + 12.5, { align: "center" });
        curX += columns[0].width;

        // 2. No. Transaksi
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.text(tx.shortId || "-", curX + 6, currentY + 12.5);
        curX += columns[1].width;

        // 3. Tanggal & Waktu
        doc.setFont("helvetica", "normal");
        doc.setTextColor(slateText[0], slateText[1], slateText[2]);
        doc.text(truncate(tx.dateTime, 18), curX + 6, currentY + 12.5);
        curX += columns[2].width;

        // 4. Pelanggan
        doc.setFont("helvetica", "normal");
        doc.setTextColor(slateText[0], slateText[1], slateText[2]);
        doc.text(truncate(tx.customerName, 17), curX + 6, currentY + 12.5);
        curX += columns[3].width;

        // 5. Layanan
        doc.text(truncate(tx.serviceNames, 28), curX + 6, currentY + 12.5);
        curX += columns[4].width;

        // 6. Capster
        doc.text(truncate(tx.capsterName, 15), curX + 6, currentY + 12.5);
        curX += columns[5].width;

        // 7. Nominal
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatRupiah(tx.amount), curX + columns[6].width - 6, currentY + 12.5, { align: "right" });
        curX += columns[6].width;

        // 8. Metode
        doc.setFont("helvetica", "normal");
        doc.setTextColor(slateText[0], slateText[1], slateText[2]);
        doc.text(tx.paymentMethod || "-", curX + columns[7].width / 2, currentY + 12.5, { align: "center" });
        curX += columns[7].width;

        // 9. Status Transaksi
        if (tx.statusTransaksi === "Berhasil") {
          doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
        } else if (tx.statusTransaksi === "Dibatalkan") {
          doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
        } else {
          doc.setTextColor(amberOrange[0], amberOrange[1], amberOrange[2]);
        }
        doc.setFont("helvetica", "bold");
        doc.text(tx.statusTransaksi || "-", curX + columns[8].width / 2, currentY + 12.5, { align: "center" });
        curX += columns[8].width;

        // 10. Status Bayar
        if (tx.statusPembayaran === "Lunas") {
          doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
        } else if (tx.statusPembayaran === "Refund") {
          doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
        } else {
          doc.setTextColor(amberOrange[0], amberOrange[1], amberOrange[2]);
        }
        doc.setFont("helvetica", "bold");
        doc.text(tx.statusPembayaran || "-", curX + columns[9].width / 2, currentY + 12.5, { align: "center" });

        currentY += rowHeight;
      });

      // Pagination Footers
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);

        doc.text(
          "BARBERIN — Laporan Resmi Audit Keuangan & Transaksi",
          marginX,
          pageHeight - 20
        );

        doc.text(
          `Halaman ${p} dari ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 20,
          { align: "right" }
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeSlug = (barbershopSlug || "barberin").replace(/[^a-zA-Z0-9_-]/g, "");
      doc.save(`audit-transaksi-${safeSlug}-${period}-${dateStr}.pdf`);

      toast.success(`Berhasil mengunduh PDF (${listToExport.length} transaksi).`);
    } catch (err: any) {
      console.error("Gagal mengekspor PDF:", err);
      toast.error(err?.message || "Gagal membuat berkas PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      if (!data || data.totalTransactionsCount === 0) {
        toast.error("Tidak ada data transaksi untuk diekspor.");
        return;
      }

      // Ambil seluruh data transaksi sesuai filter yang sedang aktif
      let listToExport: OwnerFinanceTransactionItem[] = [];
      if (data.totalTransactionsCount <= data.transactions.length) {
        listToExport = data.transactions;
      } else {
        const res = await getOwnerAuditFinance({
          data: {
            period,
            startDate: period === "custom" ? startDate : undefined,
            endDate: period === "custom" ? endDate : undefined,
            paymentMethod,
            status,
            search,
            page: 1,
            pageSize: Math.max(data.totalTransactionsCount, 10000),
          },
        });
        listToExport = res?.transactions ?? data.transactions;
      }

      if (!listToExport || listToExport.length === 0) {
        toast.error("Tidak ada data transaksi yang cocok dengan filter.");
        return;
      }

      const headers = [
        "No",
        "No. Transaksi",
        "ID Transaksi",
        "Tanggal & Waktu",
        "Nama Pelanggan",
        "Layanan",
        "Capster",
        "Nominal (Rp)",
        "Metode Pembayaran",
        "Status Transaksi",
        "Status Pembayaran",
        "Catatan Pemeriksaan",
      ];

      const escapeCsv = (val: string | number | undefined | null) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).trim();
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvRows = [
        headers.map(escapeCsv).join(","),
        ...listToExport.map((tx, idx) =>
          [
            idx + 1,
            tx.shortId,
            tx.id,
            tx.dateTime,
            tx.customerName,
            tx.serviceNames,
            tx.capsterName,
            tx.amount,
            tx.paymentMethod,
            tx.statusTransaksi,
            tx.statusPembayaran,
            tx.catatanPemeriksaan || "-",
          ]
            .map(escapeCsv)
            .join(","),
        ),
      ];

      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeSlug = (barbershopSlug || "barberin").replace(/[^a-zA-Z0-9_-]/g, "");
      link.href = url;
      link.setAttribute(
        "download",
        `audit-keuangan-${safeSlug}-${period}-${dateStr}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Berhasil mengekspor ${listToExport.length} transaksi ke CSV.`);
    } catch (err: any) {
      console.error("Gagal mengekspor CSV:", err);
      toast.error(err?.message || "Gagal mengekspor data transaksi.");
    } finally {
      setIsExporting(false);
    }
  };

  const statusBadge = (st: string) => {
    if (st === "Berhasil") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Berhasil
        </span>
      );
    }
    if (st === "Dibatalkan") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Dibatalkan
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Menunggu
      </span>
    );
  };

  const paymentStatusBadge = (pst: string) => {
    if (pst === "Lunas") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300">
          Lunas
        </span>
      );
    }
    if (pst === "Refund") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300">
          Refund
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300">
        Pending
      </span>
    );
  };

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row antialiased">
      <OwnerSidebar activePath="/owner/audit-finance" />

      <div className="flex-1 flex flex-col min-w-0">
        <OwnerMobileHeader
          activePath="/owner/audit-finance"
          onRefresh={fetchFinanceData}
          isRefreshing={loading}
        />
        <OwnerHeader onRefresh={fetchFinanceData} isRefreshing={loading} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 lg:pb-12 max-w-[1600px] w-full mx-auto">
          {/* Header Title & Date Range */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Audit Keuangan
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Periksa dan cocokkan data keuangan berdasarkan transaksi yang tercatat di sistem.
              </p>
            </div>

            {/* Date Range Picker Trigger & Popover */}
            <div className="relative self-start sm:self-auto" ref={datePickerContainerRef}>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#0F1D33] hover:bg-[#152744] border border-slate-700/80 hover:border-slate-600 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-xs"
              >
                <Calendar className="h-4 w-4 text-blue-400" />
                <span>
                  {data?.dateRangeText ||
                    (period === "today"
                      ? new Date().toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "Asia/Jakarta",
                        })
                      : "Pilih Tanggal")}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isDatePickerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDatePickerOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <OwnerDateRangePicker
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    appliedStart={startDate}
                    appliedEnd={endDate}
                    appliedPreset={
                      period === "today"
                        ? "today"
                        : period === "7d"
                          ? "7d"
                          : period === "month"
                            ? "month"
                            : "custom"
                    }
                    onApply={(result) => {
                      setPeriod(result.preset === "custom" ? "custom" : (result.preset as OwnerPeriodFilter));
                      setStartDate(result.startDate);
                      setEndDate(result.endDate);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-3 shadow-xs">
            {/* Quick Period Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0A1424] rounded-xl border border-slate-800/80">
              {[
                { key: "today", label: "Hari ini" },
                { key: "7d", label: "Minggu ini" },
                { key: "month", label: "Bulan ini" },
                { key: "custom", label: "Custom" },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => {
                    if (b.key === "custom") {
                      setIsDatePickerOpen(true);
                      return;
                    }
                    setPeriod(b.key as OwnerPeriodFilter);
                    const todayD = new Date();
                    const tStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(todayD);
                    if (b.key === "today") {
                      setStartDate(tStr);
                      setEndDate(tStr);
                    } else if (b.key === "7d") {
                      const day = todayD.getDay();
                      const diffToMonday = day === 0 ? -6 : 1 - day;
                      const monday = new Date(todayD.getTime() + diffToMonday * 86400000);
                      const sunday = new Date(monday.getTime() + 6 * 86400000);
                      setStartDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(monday));
                      setEndDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(sunday));
                    } else if (b.key === "month") {
                      const y = todayD.getFullYear();
                      const m = todayD.getMonth();
                      const first = new Date(y, m, 1, 12);
                      const last = new Date(y, m + 1, 0, 12);
                      setStartDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(first));
                      setEndDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(last));
                    }
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === b.key || (b.key === "custom" && period === "custom")
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                  placeholder="Cari transaksi..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0A1424] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={handleApplyFilter}
              className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-colors shadow-md shadow-primary/20"
            >
              Terapkan Filter
            </button>
          </div>

          {/* 4 Statistics Cards (Desktop 4 cols, Mobile 2x2) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
            {/* Total Transaksi */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Receipt className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Total Transaksi</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.totalTransactions ?? 0}{" "}
                  <span className="text-sm font-normal text-slate-400">transaksi</span>
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.totalTransactionsDelta || "+8%"}</span>
                </div>
              </div>
            </div>

            {/* Transaksi Berhasil */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Transaksi Berhasil</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.successfulTransactions ?? 0}{" "}
                  <span className="text-sm font-normal text-slate-400">transaksi</span>
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.successfulDelta || "+10%"}</span>
                </div>
              </div>
            </div>

            {/* Transaksi Dibatalkan */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Transaksi Dibatalkan</div>
                <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                  {data?.stats.cancelledTransactions ?? 0}{" "}
                  <span className="text-sm font-normal text-slate-400">transaksi</span>
                </div>
                <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingDown className="h-3 w-3" />
                  <span>{data?.stats.cancelledDelta || "-25%"}</span>
                </div>
              </div>
            </div>

            {/* Total Pendapatan */}
            <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-400 font-medium">Total Pendapatan</div>
                <div className="text-xl md:text-2xl font-bold text-white tracking-tight mt-0.5 truncate">
                  {formatRupiah(data?.stats.totalRevenue ?? 0)}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  <span>{data?.stats.totalRevenueDelta || "+12%"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Metode Pembayaran (Di Dalam Kotakan Card Sesuai Gambar 2) */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
                Metode Pembayaran
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
              {/* Tunai */}
              <div className="bg-[#0A1424] border border-slate-700/60 rounded-xl p-3.5 md:p-4 flex items-center gap-3.5 hover:border-slate-600 transition-colors">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-blue-400 font-semibold">Tunai</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">
                    {data?.paymentMethods.tunai.count || 0} transaksi
                  </div>
                  <div className="text-sm md:text-base font-extrabold text-white truncate mt-0.5">
                    {formatRupiah(data?.paymentMethods.tunai.total || 0)}
                  </div>
                </div>
              </div>

              {/* QRIS */}
              <div className="bg-[#0A1424] border border-slate-700/60 rounded-xl p-3.5 md:p-4 flex items-center gap-3.5 hover:border-slate-600 transition-colors">
                <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-blue-400 font-semibold">QRIS</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">
                    {data?.paymentMethods.qris.count || 0} transaksi
                  </div>
                  <div className="text-sm md:text-base font-extrabold text-white truncate mt-0.5">
                    {formatRupiah(data?.paymentMethods.qris.total || 0)}
                  </div>
                </div>
              </div>

              {/* Transfer */}
              <div className="bg-[#0A1424] border border-slate-700/60 rounded-xl p-3.5 md:p-4 flex items-center gap-3.5 hover:border-slate-600 transition-colors">
                <div className="h-11 w-11 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-blue-400 font-semibold truncate">Transfer Antar Bank</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">
                    {data?.paymentMethods.transfer.count || 0} transaksi
                  </div>
                  <div className="text-sm md:text-base font-extrabold text-white truncate mt-0.5">
                    {formatRupiah(data?.paymentMethods.transfer.total || 0)}
                  </div>
                </div>
              </div>

              {/* Total Non-Tunai */}
              <div className="bg-[#0A1424] border border-slate-700/60 rounded-xl p-3.5 md:p-4 flex items-center gap-3.5 hover:border-slate-600 transition-colors">
                <div className="h-11 w-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-blue-400 font-semibold">Total Non-Tunai</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">
                    {data?.paymentMethods.totalNonTunai.count || 0} transaksi
                  </div>
                  <div className="text-sm md:text-base font-extrabold text-white truncate mt-0.5">
                    {formatRupiah(data?.paymentMethods.totalNonTunai.total || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Detail Transaksi */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Detail Transaksi</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar seluruh transaksi yang diverifikasi pada audit keuangan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Metode Dropdown */}
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs text-slate-300 hover:border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                >
                  <option value="all">Semua Metode</option>
                  <option value="tunai">Tunai</option>
                  <option value="qris">QRIS</option>
                  <option value="transfer">Transfer</option>
                </select>

                {/* Status Dropdown */}
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs text-slate-300 hover:border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                >
                  <option value="all">Semua Status</option>
                  <option value="paid">Berhasil / Lunas</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="pending">Menunggu</option>
                </select>

                {/* Export PDF Button (Primary) */}
                <button
                  type="button"
                  disabled={isExportingPdf || loading || !data || data.totalTransactionsCount === 0}
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 hover:bg-primary/25 border border-primary/40 rounded-xl text-xs font-semibold text-primary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                  title="Unduh laporan transaksi dalam format dokumen PDF"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>{isExportingPdf ? "Membuat PDF..." : "Export PDF"}</span>
                </button>

                {/* Export CSV Button (Secondary) */}
                <button
                  type="button"
                  disabled={isExporting || loading || !data || data.totalTransactionsCount === 0}
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0A1424] border border-slate-700/80 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Unduh data mentah transaksi dalam format CSV"
                >
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs animate-pulse">
                Memuat data transaksi audit...
              </div>
            ) : data && data.transactions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                Tidak ada transaksi yang cocok dengan filter.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 pt-2">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-medium">
                        <th className="py-3 px-2.5">No</th>
                        <th className="py-3 px-2.5">No. Transaksi</th>
                        <th className="py-3 px-2.5">Tanggal & Waktu</th>
                        <th className="py-3 px-2.5">Pelanggan</th>
                        <th className="py-3 px-2.5">Layanan</th>
                        <th className="py-3 px-2.5">Capster</th>
                        <th className="py-3 px-2.5">Nominal</th>
                        <th className="py-3 px-2.5">Metode</th>
                        <th className="py-3 px-2.5">Status Transaksi</th>
                        <th className="py-3 px-2.5">Status Pembayaran</th>
                        <th className="py-3 px-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data?.transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-2.5 text-slate-400">{tx.no}</td>
                          <td className="py-3.5 px-2.5 font-mono text-blue-400 font-semibold">
                            {tx.shortId}
                          </td>
                          <td className="py-3.5 px-2.5 text-slate-300 font-mono text-[11px]">
                            {tx.dateTime}
                          </td>
                          <td className="py-3.5 px-2.5 text-white font-medium">
                            {tx.customerName}
                          </td>
                          <td className="py-3.5 px-2.5 text-slate-300 max-w-[180px] truncate">
                            {tx.serviceNames}
                          </td>
                          <td className="py-3.5 px-2.5 text-slate-300">
                            {tx.capsterName}
                          </td>
                          <td className="py-3.5 px-2.5 font-semibold text-white">
                            {formatRupiah(tx.amount)}
                          </td>
                          <td className="py-3.5 px-2.5 text-slate-300">
                            {tx.paymentMethod}
                          </td>
                          <td className="py-3.5 px-2.5">
                            {statusBadge(tx.statusTransaksi)}
                          </td>
                          <td className="py-3.5 px-2.5">
                            {paymentStatusBadge(tx.statusPembayaran)}
                          </td>
                          <td className="py-3.5 px-2.5 text-right">
                            <Link
                              to={`/${barbershopSlug}/owner/audit-finance/${tx.id}` as any}
                              className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 hover:underline"
                            >
                              <span>Lihat</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="lg:hidden space-y-3 pt-3">
                  {data?.transactions.map((tx) => (
                    <Link
                      key={tx.id}
                      to={`/${barbershopSlug}/owner/audit-finance/${tx.id}` as any}
                      className="block bg-[#0A1424] border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/60">
                        <span className="font-mono text-blue-400 font-bold">
                          {tx.shortId}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {statusBadge(tx.statusTransaksi)}
                          {paymentStatusBadge(tx.statusPembayaran)}
                        </div>
                      </div>
                      <div className="pt-2.5 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-white">
                            {formatRupiah(tx.amount)}
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5">
                            {tx.customerName} • {tx.serviceNames}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Capster: <span className="text-slate-200">{tx.capsterName}</span> ({tx.paymentMethod})
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                          {tx.dateTime}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                  <div>
                    Menampilkan{" "}
                    <span className="text-white font-medium">
                      {(page - 1) * 8 + 1}
                    </span>{" "}
                    -{" "}
                    <span className="text-white font-medium">
                      {Math.min(page * 8, data?.totalTransactionsCount || 0)}
                    </span>{" "}
                    dari{" "}
                    <span className="text-white font-medium">
                      {data?.totalTransactionsCount || 0}
                    </span>{" "}
                    transaksi
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: Math.min(5, data?.totalPages || 1) }).map(
                      (_, i) => (
                        <button
                          key={i + 1}
                          type="button"
                          onClick={() => setPage(i + 1)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            page === i + 1
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-[#0A1424] border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={page >= (data?.totalPages || 1)}
                      onClick={() =>
                        setPage((p) => Math.min(data?.totalPages || 1, p + 1))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Section: 2 Columns: Cash on Hand & Komisi Capster */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Cash on Hand (Uang Tunai) */}
            <div className="lg:col-span-6 bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-400" />
                    <span>Cash on Hand (Uang Tunai)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kesesuaian kas fisik di laci dengan transaksi tunai sistem.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInputPhysicalCash(
                      data?.cashOnHand?.physicalCash
                        ? formatNumberWithDots(data.cashOnHand.physicalCash)
                        : ""
                    );
                    setIsCashModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Input Uang Fisik</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {/* Uang Tunai Sistem */}
                <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                  <div className="text-[11px] text-slate-400">Uang Tunai (Sistem)</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {formatRupiah(data?.cashOnHand.systemCash || 0)}
                  </div>
                </div>

                {/* Uang Tunai Fisik */}
                <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                  <div className="text-[11px] text-slate-400">Uang Tunai (Fisik)</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {formatRupiah(data?.cashOnHand.physicalCash || 0)}
                  </div>
                </div>

                {/* Selisih */}
                <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80">
                  <div className="text-[11px] text-slate-400">Selisih</div>
                  <div
                    className={`text-sm font-bold mt-1 ${
                      data?.cashOnHand.difference === 0
                        ? "text-slate-300"
                        : "text-rose-400"
                    }`}
                  >
                    {formatRupiah(data?.cashOnHand.difference || 0)}
                  </div>
                </div>

                {/* Status */}
                <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800/80 flex flex-col justify-center items-center">
                  <div className="text-[11px] text-slate-400 mb-1">Status</div>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                      data?.cashOnHand.status === "Sesuai"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {data?.cashOnHand.status || "Sesuai"}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Komisi Capster (Strictly Separated Per Capster) */}
            <div className="lg:col-span-6 bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-blue-400" />
                    <span>Komisi Capster</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bagi hasil berdasarkan transaksi capster masing-masing.
                  </p>
                </div>
                <Link
                  to={`/${barbershopSlug}/owner/gaji` as any}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 font-medium">
                      <th className="py-2.5">No</th>
                      <th className="py-2.5">Nama Capster</th>
                      <th className="py-2.5">Transaksi</th>
                      <th className="py-2.5">Pendapatan Layanan</th>
                      <th className="py-2.5">Persentase</th>
                      <th className="py-2.5 text-right">Total Komisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data?.capsterCommissions.slice(0, 4).map((c, i) => (
                      <tr key={c.capsterId} className="hover:bg-slate-800/30">
                        <td className="py-2.5 text-slate-500">{i + 1}</td>
                        <td className="py-2.5 font-semibold text-white">{c.name}</td>
                        <td className="py-2.5 text-slate-300">{c.transactionCount}</td>
                        <td className="py-2.5 text-slate-300">
                          {formatRupiah(c.serviceRevenue)}
                        </td>
                        <td className="py-2.5 text-slate-400">{c.commissionPercentage}%</td>
                        <td className="py-2.5 text-right font-bold text-emerald-400">
                          {formatRupiah(c.totalCommission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section: Riwayat Pemeriksaan Keuangan */}
          <div className="bg-[#0F1D33] border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Riwayat Pemeriksaan Keuangan
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit berkala fisik kas dan rekonsiliasi sistem.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 font-medium">
                    <th className="py-3 px-3">No</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Periode</th>
                    <th className="py-3 px-3">Kas Sistem</th>
                    <th className="py-3 px-3">Kas Fisik</th>
                    <th className="py-3 px-3">Selisih</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Pemeriksa</th>
                    <th className="py-3 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data?.auditRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        Belum ada riwayat pemeriksaan keuangan.
                      </td>
                    </tr>
                  ) : (
                    data?.auditRecords.map((rec, idx) => (
                      <tr key={rec.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3 text-slate-300 font-mono">
                          {rec.tanggal}
                        </td>
                        <td className="py-3 px-3 text-white">{rec.periode}</td>
                        <td className="py-3 px-3 text-slate-300">
                          {formatRupiah(rec.kasSistem)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">
                          {formatRupiah(rec.kasFisik)}
                        </td>
                        <td
                          className={`py-3 px-3 font-semibold ${
                            rec.selisih === 0 ? "text-slate-400" : "text-rose-400"
                          }`}
                        >
                          {formatRupiah(rec.selisih)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              rec.status === "Sesuai"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{rec.pemeriksa}</td>
                        <td className="py-3 px-3 text-slate-400 max-w-[220px] truncate">
                          {rec.keterangan}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <OwnerBottomNav activePath="/owner/audit-finance" />
      </div>

      {/* Modal: Input Uang Fisik */}
      {isCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsCashModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#0F1D33] border border-slate-800 rounded-2xl p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-400" />
                <span>Input Uang Fisik Kasir</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCashModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashAudit} className="space-y-4 text-xs">
              <div className="p-3 bg-[#0A1424] rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Kas Tunai Sistem:</span>
                  <span className="font-bold text-white">
                    {formatRupiah(data?.cashOnHand.systemCash || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Periode:</span>
                  <span className="text-slate-300">{data?.periodLabel}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Nominal Uang Fisik Dihitung (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={inputPhysicalCash}
                    onChange={(e) => setInputPhysicalCash(formatNumberWithDots(e.target.value))}
                    placeholder="Contoh: 500.000"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0A1424] border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-blue-500 tracking-wide font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Catatan Pemeriksaan
                </label>
                <textarea
                  rows={3}
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  placeholder="Tambahkan catatan jika ada selisih kas..."
                  className="w-full px-3.5 py-2.5 bg-[#0A1424] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={savingCash}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground transition-colors"
                >
                  {savingCash ? "Menyimpan..." : "Simpan Pemeriksaan"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 rounded-xl text-xs font-medium text-slate-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </OwnerAuthGuard>
  );
}
