import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  alasanPembatalan,
  barbershop,
  booking,
  capster,
  detailBooking,
  layanan,
  pelanggan,
  pembayaran,
  pembatalan,
  pemeriksaanKeuangan,
  shiftCapster,
  struk,
  transaksi,
  users,
} from "@/db/schema";
import {
  formatRupiah,
  formatTransactionId,
  formatWaktuRelatif,
} from "@/lib/format";
import {
  autoCancelExpiredPendingTransactions,
  isTransactionExpired,
} from "@/lib/auto-cancel";
import { loginOwnerBpmn } from "@/lib/owner-auth";
import { getOwnerSession, requireOwnerTenant } from "@/lib/auth-session";

export type OwnerPeriodFilter = "today" | "7d" | "30d" | "month" | "custom";

export type RevenueChartPoint = {
  date: string;
  rawDate: string;
  revenue: number;
  count: number;
};

export type PaymentMethodSummary = {
  method: "tunai" | "qris" | "transfer";
  label: string;
  count: number;
  percentage: number;
  color: string;
};

export type OwnerRecentTransaction = {
  id: string;
  shortId: string;
  customerName: string;
  serviceNames: string;
  capsterName: string;
  capsterId: string | null;
  amount: number;
  paymentMethod: "tunai" | "qris" | "transfer";
  paymentMethodLabel: string;
  status: "Selesai" | "Diproses" | "Menunggu" | "Batal";
  time: string;
  date: string;
  dateTime: string;
  notes?: string | undefined;
};

export type OwnerCapsterPerformance = {
  capsterId: string;
  name: string;
  noPegawai: string;
  avatarLetter: string;
  totalTransactions: number;
  totalServices: number;
  totalRevenue: number;
  commissionPercentage: number;
  commissionAmount: number;
};

export type OwnerRecentCancellation = {
  id: string;
  transactionId: string;
  shortId: string;
  serviceNames: string;
  capsterName: string;
  cancelledBy: string;
  reason: string;
  time: string;
  date: string;
  status: "Dibatalkan";
};

export type OwnerNotificationType =
  | "tx_success"
  | "tx_cancelled"
  | "capster_checkin"
  | "capster_shift_end";

export type OwnerNotificationItem = {
  id: string;
  type: OwnerNotificationType;
  title: string;
  message: string;
  detail?: string;
  timeAgo: string;
  timestamp: string;
  link: string;
  amount?: number;
  metadata?: {
    txId?: string;
    capsterName?: string;
    customerName?: string;
    reason?: string;
  };
};

export type OwnerDashboardMetrics = {
  totalRevenue: number;
  totalRevenueDeltaText: string;
  revenueDeltaPercent: number;
  isRevenueUp: boolean;

  totalTransactions: number;
  totalTransactionsDeltaText: string;
  transactionsDeltaPercent: number;
  isTransactionsUp: boolean;

  activeCapstersCount: number;
  totalCapstersCount: number;
  activeCapstersText: string;

  cancellationsCount: number;
  cancellationsText: string;

  chartData: RevenueChartPoint[];
  paymentMethods: PaymentMethodSummary[];
  totalPaymentTransactions: number;

  recentTransactions: OwnerRecentTransaction[];
  capsterPerformance: OwnerCapsterPerformance[];
  recentCancellations: OwnerRecentCancellation[];

  periodLabel: string;
  dateRangeText: string;
};

function getPeriodDates(
  period: OwnerPeriodFilter,
  customStart?: string,
  customEnd?: string,
) {
  const now = new Date();
  const jakartaTodayStr = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;
  let deltaLabel = "dari hari sebelumnya";

  if (period === "today") {
    startDate = new Date(`${jakartaTodayStr}T00:00:00+07:00`);
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);

    const yesterday = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta",
    });
    prevStartDate = new Date(`${yesterdayStr}T00:00:00+07:00`);
    prevEndDate = new Date(`${yesterdayStr}T23:59:59.999+07:00`);
    deltaLabel = "dari hari sebelumnya";
  } else if (period === "7d") {
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);

    prevEndDate = new Date(startDate.getTime() - 1);
    prevStartDate = new Date(prevEndDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
    deltaLabel = "dari 7 hari sebelumnya";
  } else if (period === "30d") {
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);

    prevEndDate = new Date(startDate.getTime() - 1);
    prevStartDate = new Date(prevEndDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    deltaLabel = "dari 30 hari sebelumnya";
  } else if (period === "month") {
    const [y, m] = jakartaTodayStr.split("-").map(Number);
    const yVal = y ?? now.getFullYear();
    const mVal = m ?? (now.getMonth() + 1);
    const daysInMonth = new Date(yVal, mVal, 0).getDate();
    const mStr = String(mVal).padStart(2, "0");
    const lastDayStr = String(daysInMonth).padStart(2, "0");
    startDate = new Date(`${yVal}-${mStr}-01T00:00:00+07:00`);
    endDate = new Date(`${yVal}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);

    const prevMonthVal = mVal === 1 ? 12 : mVal - 1;
    const prevYearVal = mVal === 1 ? yVal - 1 : yVal;
    const prevDaysInMonth = new Date(prevYearVal, prevMonthVal, 0).getDate();
    const prevMStr = String(prevMonthVal).padStart(2, "0");
    const prevLastDayStr = String(prevDaysInMonth).padStart(2, "0");
    prevStartDate = new Date(`${prevYearVal}-${prevMStr}-01T00:00:00+07:00`);
    prevEndDate = new Date(`${prevYearVal}-${prevMStr}-${prevLastDayStr}T23:59:59.999+07:00`);
    deltaLabel = "dari bulan sebelumnya";
  } else {
    // Custom
    if (customStart && customEnd) {
      startDate = new Date(`${customStart}T00:00:00+07:00`);
      endDate = new Date(`${customEnd}T23:59:59.999+07:00`);
      const diff = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - diff);
    } else {
      startDate = new Date(`${jakartaTodayStr}T00:00:00+07:00`);
      endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
      prevStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      prevEndDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    }
    deltaLabel = "dari periode sebelumnya";
  }

  return { startDate, endDate, prevStartDate, prevEndDate, deltaLabel };
}

function calculateDelta(current: number, previous: number, label: string) {
  if (previous === 0) {
    if (current > 0) {
      return {
        percent: 100,
        isUp: true,
        text: `↑ 100% ${label}`,
      };
    }
    return {
      percent: 0,
      isUp: true,
      text: `0% ${label}`,
    };
  }

  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  const isUp = percent >= 0;
  const sign = isUp ? "↑" : "↓";
  return {
    percent: Math.abs(percent),
    isUp,
    text: `${sign} ${Math.abs(percent)}% ${label}`,
  };
}

export const getOwnerDashboardMetrics = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            period?: OwnerPeriodFilter;
            startDate?: string;
            endDate?: string;
            barbershopId?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<OwnerDashboardMetrics> => {
    // 0. Auto-cancel seluruh transaksi pending yang telah melebihi 2 jam
    await autoCancelExpiredPendingTransactions();

    const tenant = requireOwnerTenant();
    const targetShopId = tenant.barbershopId;

    const now = new Date();
    const period = data?.period || "today";
    const { startDate, endDate, prevStartDate, prevEndDate, deltaLabel } =
      getPeriodDates(period, data?.startDate, data?.endDate);

    // 1. Ambil transaksi pada periode sekarang & periode lalu (strictly scoped by targetShopId)
    const [currentTxs, prevTxs, allCapsters, activeShifts, cancellations] =
      await Promise.all([
        // Transaksi periode aktif
        db
          .select({
            id_transaksi: transaksi.id_transaksi,
            id_booking: transaksi.id_booking,
            id_shift: transaksi.id_shift,
            id_pelanggan: transaksi.id_pelanggan,
            subtotal: transaksi.subtotal,
            diskon: transaksi.diskon,
            total: transaksi.total,
            status_transaksi: transaksi.status_transaksi,
            created_at: transaksi.created_at,
          })
          .from(transaksi)
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(transaksi.created_at, startDate),
              lte(transaksi.created_at, endDate),
            ),
          )
          .orderBy(desc(transaksi.created_at)),

        // Transaksi periode sebelumnya untuk perbandingan delta
        db
          .select({
            id_transaksi: transaksi.id_transaksi,
            total: transaksi.total,
            status_transaksi: transaksi.status_transaksi,
          })
          .from(transaksi)
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(transaksi.created_at, prevStartDate),
              lte(transaksi.created_at, prevEndDate),
            ),
          ),

        // Semua capster yang aktif di barbershop ini
        db
          .select({
            id_capster: capster.id_capster,
            id_user: capster.id_user,
            no_pegawai: capster.no_pegawai,
            nama_lengkap: users.nama_lengkap,
            status: capster.status,
          })
          .from(capster)
          .innerJoin(users, eq(capster.id_user, users.id_user))
          .where(
            and(eq(capster.status, "active"), eq(capster.id_barbershop, targetShopId)),
          ),

        // Shift yang sedang ONGOING milik capster di barbershop ini
        db
          .select({
            id_shift: shiftCapster.id_shift,
            id_capster: shiftCapster.id_capster,
            status: shiftCapster.status,
          })
          .from(shiftCapster)
          .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
          .where(
            and(
              eq(shiftCapster.status, "ongoing"),
              eq(capster.id_barbershop, targetShopId),
            ),
          ),

        // Data Pembatalan pada periode milik barbershop ini
        db
          .select({
            id_pembatalan: pembatalan.id_pembatalan,
            id_transaksi: pembatalan.id_transaksi,
            dibatalkan_oleh: pembatalan.dibatalkan_oleh,
            waktu_pembatalan: pembatalan.waktu_pembatalan,
            catatan: pembatalan.catatan,
            alasan_text: alasanPembatalan.alasan,
          })
          .from(pembatalan)
          .innerJoin(transaksi, eq(pembatalan.id_transaksi, transaksi.id_transaksi))
          .leftJoin(
            alasanPembatalan,
            eq(pembatalan.id_alasan, alasanPembatalan.id_alasan),
          )
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(pembatalan.waktu_pembatalan, startDate),
              lte(pembatalan.waktu_pembatalan, endDate),
            ),
          )
          .orderBy(desc(pembatalan.waktu_pembatalan))
          .catch((err) => {
            console.warn("Gagal mengambil data pembatalan:", err);
            return [];
          }),
      ]);

    // 2. Kalkulasi Ringkasan Pendapatan & Transaksi
    // Total Pendapatan HANYA dari transaksi yang statusnya 'paid'
    const validCurrentPaidTxs = currentTxs.filter(
      (t) => t.status_transaksi === "paid",
    );
    const validPrevPaidTxs = prevTxs.filter((t) => t.status_transaksi === "paid");

    const currentRevenue = validCurrentPaidTxs.reduce(
      (sum, t) => sum + Number(t.total || 0),
      0,
    );
    const prevRevenue = validPrevPaidTxs.reduce(
      (sum, t) => sum + Number(t.total || 0),
      0,
    );

    const revenueDelta = calculateDelta(currentRevenue, prevRevenue, deltaLabel);

    // Total Transaksi (semua transaksi valid/tercatat di periode ini)
    const currentTxCount = currentTxs.length;
    const prevTxCount = prevTxs.length;
    const txDelta = calculateDelta(currentTxCount, prevTxCount, deltaLabel);

    // Capster Aktif (yang memiliki shift status 'ongoing')
    const activeCapsterIds = new Set(activeShifts.map((s) => s.id_capster));
    const activeCapstersCount = activeCapsterIds.size;
    const totalCapstersCount = allCapsters.length;
    const activeCapstersText = `dari total ${totalCapstersCount} capster`;

    // Pembatalan
    // Hitung dari tabel pembatalan atau transaksi cancelled
    const cancelledTxIds = new Set(
      currentTxs
        .filter((t) => t.status_transaksi === "cancelled")
        .map((t) => t.id_transaksi),
    );
    cancellations.forEach((c) => cancelledTxIds.add(c.id_transaksi));
    const cancellationsCount = cancelledTxIds.size;
    const cancellationsText = "transaksi dibatalkan";

    // 3. Data Pendapatan untuk Grafik (7 Hari Terakhir atau sesuai rentang)
    // Buat rentang 7 hari terakhir mundur dari endDate
    const chartDays = 7;
    const chartData: RevenueChartPoint[] = [];
    const dayMap = new Map<string, { revenue: number; count: number }>();

    // Siapkan bucket untuk 7 hari terakhir
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
      const isoDate = d.toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });
      const dayName = d.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
      });
      dayMap.set(isoDate, { revenue: 0, count: 0 });
      chartData.push({
        date: dayName,
        rawDate: isoDate,
        revenue: 0,
        count: 0,
      });
    }

    // Ambil transaksi 7 hari terakhir untuk grafik
    const chartStartDate = new Date(
      endDate.getTime() - chartDays * 24 * 60 * 60 * 1000 + 1,
    );
    const chartTxs = await db
      .select({
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
      })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.id_barbershop, targetShopId),
          gte(transaksi.created_at, chartStartDate),
          lte(transaksi.created_at, endDate),
          eq(transaksi.status_transaksi, "paid"),
        ),
      );

    for (const tx of chartTxs) {
      const txDateStr = tx.created_at.toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });
      const existing = dayMap.get(txDateStr);
      if (existing) {
        existing.revenue += Number(tx.total || 0);
        existing.count += 1;
      }
    }

    chartData.forEach((point) => {
      const val = dayMap.get(point.rawDate);
      if (val) {
        point.revenue = val.revenue;
        point.count = val.count;
      }
    });

    // 4. Metode Pembayaran
    // Query metode pembayaran HANYA dari transaksi periode sekarang yang BERHASIL (status paid)
    const paidTxIds = validCurrentPaidTxs.map((t) => t.id_transaksi);
    let paymentRows: { metode_pembayaran: string; count: number; total: number }[] =
      [];

    if (paidTxIds.length > 0) {
      const payments = await db
        .select({
          metode_pembayaran: pembayaran.metode_pembayaran,
          id_transaksi: pembayaran.id_transaksi,
          jumlah_bayar: pembayaran.jumlah_bayar,
        })
        .from(pembayaran)
        .where(
          and(
            inArray(pembayaran.id_transaksi, paidTxIds),
            ne(pembayaran.status_pembayaran, "failed"),
            ne(pembayaran.status_pembayaran, "refunded"),
          ),
        );

      const methodCounts = {
        tunai: 0,
        qris: 0,
        transfer: 0,
      };
      payments.forEach((p) => {
        const m = p.metode_pembayaran as "tunai" | "qris" | "transfer";
        if (methodCounts[m] !== undefined) {
          methodCounts[m] += 1;
        }
      });

      const totalPaidMethods =
        methodCounts.tunai + methodCounts.qris + methodCounts.transfer || 1;

      paymentRows = [
        {
          metode_pembayaran: "tunai",
          count: methodCounts.tunai,
          total: methodCounts.tunai,
        },
        {
          metode_pembayaran: "qris",
          count: methodCounts.qris,
          total: methodCounts.qris,
        },
        {
          metode_pembayaran: "transfer",
          count: methodCounts.transfer,
          total: methodCounts.transfer,
        },
      ];
    } else {
      paymentRows = [
        { metode_pembayaran: "tunai", count: 0, total: 0 },
        { metode_pembayaran: "qris", count: 0, total: 0 },
        { metode_pembayaran: "transfer", count: 0, total: 0 },
      ];
    }

    const totalValidPaymentCount = paymentRows.reduce(
      (sum, p) => sum + p.count,
      0,
    );

    const paymentMethods: PaymentMethodSummary[] = [
      {
        method: "tunai",
        label: "Tunai",
        count: paymentRows.find((p) => p.metode_pembayaran === "tunai")?.count || 0,
        percentage:
          totalValidPaymentCount > 0
            ? Math.round(
                ((paymentRows.find((p) => p.metode_pembayaran === "tunai")
                  ?.count || 0) /
                  totalValidPaymentCount) *
                  100,
              )
            : 0,
        color: "#10B981", // Green
      },
      {
        method: "qris",
        label: "QRIS",
        count: paymentRows.find((p) => p.metode_pembayaran === "qris")?.count || 0,
        percentage:
          totalValidPaymentCount > 0
            ? Math.round(
                ((paymentRows.find((p) => p.metode_pembayaran === "qris")
                  ?.count || 0) /
                  totalValidPaymentCount) *
                  100,
              )
            : 0,
        color: "#3B82F6", // Blue
      },
      {
        method: "transfer",
        label: "Transfer Antar Bank",
        count:
          paymentRows.find((p) => p.metode_pembayaran === "transfer")?.count || 0,
        percentage:
          totalValidPaymentCount > 0
            ? Math.round(
                ((paymentRows.find((p) => p.metode_pembayaran === "transfer")
                  ?.count || 0) /
                  totalValidPaymentCount) *
                  100,
              )
            : 0,
        color: "#8B5CF6", // Purple
      },
    ];

    // 5. Transaksi Terbaru (Latest 10)
    // Ambil detail lengkap untuk 10 transaksi teratas
    const recentTxRows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        id_pelanggan: transaksi.id_pelanggan,
        subtotal: transaksi.subtotal,
        diskon: transaksi.diskon,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
        customerName: users.nama_lengkap,
        customerPhone: users.no_hp,
      })
      .from(transaksi)
      .innerJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
      .innerJoin(users, eq(pelanggan.id_user, users.id_user))
      .where(eq(transaksi.id_barbershop, targetShopId))
      .orderBy(desc(transaksi.created_at))
      .limit(10);

    const recentTxIds = recentTxRows.map((r) => r.id_transaksi);
    const recentBookingIds = recentTxRows
      .map((r) => r.id_booking)
      .filter((b): b is string => Boolean(b));
    const recentShiftIds = recentTxRows.map((r) => r.id_shift);

    const [recentBookings, recentDetails, recentPayments, recentShifts] =
      await Promise.all([
        recentBookingIds.length > 0
          ? db
              .select({
                id_booking: booking.id_booking,
                id_capster: booking.id_capster,
                catatan: booking.catatan,
                capsterName: users.nama_lengkap,
              })
              .from(booking)
              .leftJoin(capster, eq(booking.id_capster, capster.id_capster))
              .leftJoin(users, eq(capster.id_user, users.id_user))
              .where(inArray(booking.id_booking, recentBookingIds))
          : Promise.resolve([]),

        recentBookingIds.length > 0
          ? db
              .select({
                id_booking: detailBooking.id_booking,
                nama_layanan: layanan.nama_layanan,
                harga_satuan: detailBooking.harga_satuan,
                qty: detailBooking.qty,
              })
              .from(detailBooking)
              .innerJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
              .where(inArray(detailBooking.id_booking, recentBookingIds))
          : Promise.resolve([]),

        recentTxIds.length > 0
          ? db
              .select({
                id_transaksi: pembayaran.id_transaksi,
                metode_pembayaran: pembayaran.metode_pembayaran,
                status_pembayaran: pembayaran.status_pembayaran,
                jumlah_bayar: pembayaran.jumlah_bayar,
              })
              .from(pembayaran)
              .where(inArray(pembayaran.id_transaksi, recentTxIds))
          : Promise.resolve([]),

        recentShiftIds.length > 0
          ? db
              .select({
                id_shift: shiftCapster.id_shift,
                id_capster: shiftCapster.id_capster,
                capsterName: users.nama_lengkap,
              })
              .from(shiftCapster)
              .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
              .innerJoin(users, eq(capster.id_user, users.id_user))
              .where(inArray(shiftCapster.id_shift, recentShiftIds))
          : Promise.resolve([]),
      ]);

    const recentTransactions: OwnerRecentTransaction[] = recentTxRows.map(
      (tx) => {
        const bInfo = recentBookings.find((b) => b.id_booking === tx.id_booking);
        const shiftInfo = recentShifts.find((s) => s.id_shift === tx.id_shift);
        const pay = recentPayments.find(
          (p) => p.id_transaksi === tx.id_transaksi,
        );
        const details = recentDetails.filter(
          (d) => d.id_booking === tx.id_booking,
        );

        const capsterName =
          bInfo?.capsterName || shiftInfo?.capsterName || "Capster";
        const capsterId = bInfo?.id_capster || shiftInfo?.id_capster || null;

        const serviceNames =
          details.length > 0
            ? details.map((d) => d.nama_layanan).join(", ")
            : "Layanan Barbershop";

        const isExpired = isTransactionExpired(tx.created_at, tx.status_transaksi);
        let status: "Selesai" | "Diproses" | "Menunggu" | "Batal" = "Selesai";
        if (tx.status_transaksi === "cancelled" || isExpired) {
          status = "Batal";
        } else if (tx.status_transaksi === "pending") {
          status = "Menunggu";
        } else if (tx.status_transaksi === "paid") {
          status = "Selesai";
        }

        const method = (pay?.metode_pembayaran || "tunai") as
          | "tunai"
          | "qris"
          | "transfer";
        const methodLabels: Record<string, string> = {
          tunai: "Tunai",
          qris: "QRIS",
          transfer: "Transfer",
        };

        const dateStr = tx.created_at.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Jakarta",
        });
        const timeStr = tx.created_at.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });

        return {
          id: tx.id_transaksi,
          shortId: formatTransactionId(tx.id_transaksi, tx.created_at),
          customerName: tx.customerName,
          serviceNames,
          capsterName,
          capsterId,
          amount: Number(tx.total),
          paymentMethod: method,
          paymentMethodLabel: methodLabels[method] || "Tunai",
          status,
          time: timeStr,
          date: dateStr,
          dateTime: `${dateStr} ${timeStr}`,
          notes: bInfo?.catatan || undefined,
        };
      },
    );

    // 6. Performa Capster (Strictly separated per capster!)
    // Ambil semua transaksi pada rentang yang terikat pada capster
    const capsterStatsMap = new Map<
      string,
      {
        totalTransactions: number;
        totalServices: number;
        totalRevenue: number;
      }
    >();

    allCapsters.forEach((c) => {
      capsterStatsMap.set(c.id_capster, {
        totalTransactions: 0,
        totalServices: 0,
        totalRevenue: 0,
      });
    });

    // Ambil transaksi capster melalui shift_capster dan booking
    const txCapsterRows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        bookingCapsterId: booking.id_capster,
        shiftCapsterId: shiftCapster.id_capster,
      })
      .from(transaksi)
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(
        and(
          eq(transaksi.id_barbershop, targetShopId),
          gte(transaksi.created_at, startDate),
          lte(transaksi.created_at, endDate),
          eq(transaksi.status_transaksi, "paid"),
        ),
      );

    for (const r of txCapsterRows) {
      // Prioritas capster booking, jika null fallback ke shift capster
      const cId = r.bookingCapsterId || r.shiftCapsterId;
      if (cId && capsterStatsMap.has(cId)) {
        const stat = capsterStatsMap.get(cId)!;
        stat.totalTransactions += 1;
        stat.totalServices += 1; // 1 transaksi = minimal 1 layanan
        stat.totalRevenue += Number(r.total || 0);
      }
    }

    const defaultCommissionPercent = 15; // 15% sesuai wireframe

    const capsterPerformance: OwnerCapsterPerformance[] = allCapsters.map(
      (c) => {
        const stat = capsterStatsMap.get(c.id_capster) || {
          totalTransactions: 0,
          totalServices: 0,
          totalRevenue: 0,
        };
        const commissionAmount = Math.round(
          stat.totalRevenue * (defaultCommissionPercent / 100),
        );
        return {
          capsterId: c.id_capster,
          name: c.nama_lengkap,
          noPegawai: c.no_pegawai || "-",
          avatarLetter: (c.nama_lengkap[0] || "C").toUpperCase(),
          totalTransactions: stat.totalTransactions,
          totalServices: stat.totalServices,
          totalRevenue: stat.totalRevenue,
          commissionPercentage: defaultCommissionPercent,
          commissionAmount,
        };
      },
    );

    // Urutkan performa capster berdasarkan total transaksi tertinggi
    capsterPerformance.sort((a, b) => b.totalTransactions - a.totalTransactions);

    // 7. Pembatalan Terbaru (Latest 5-10)
    const recentCancelRows = await db
      .select({
        id_pembatalan: pembatalan.id_pembatalan,
        id_transaksi: pembatalan.id_transaksi,
        dibatalkan_oleh: pembatalan.dibatalkan_oleh,
        waktu_pembatalan: pembatalan.waktu_pembatalan,
        catatan: pembatalan.catatan,
        alasan_text: alasanPembatalan.alasan,
        bookingCapsterId: booking.id_capster,
        shiftCapsterId: shiftCapster.id_capster,
        bookingNotes: booking.catatan,
      })
      .from(pembatalan)
      .innerJoin(transaksi, eq(pembatalan.id_transaksi, transaksi.id_transaksi))
      .leftJoin(
        alasanPembatalan,
        eq(pembatalan.id_alasan, alasanPembatalan.id_alasan),
      )
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(eq(transaksi.id_barbershop, targetShopId))
      .orderBy(desc(pembatalan.waktu_pembatalan))
      .limit(10)
      .catch((err) => {
        console.warn("Gagal mengambil daftar pembatalan terbaru:", err);
        return [];
      });

    const capsterUserMap = new Map<string, string>();
    allCapsters.forEach((c) => capsterUserMap.set(c.id_capster, c.nama_lengkap));

    const recentCancellations: OwnerRecentCancellation[] = recentCancelRows.map(
      (c) => {
        const cId = c.bookingCapsterId || c.shiftCapsterId;
        const capsterName = cId ? capsterUserMap.get(cId) || "Capster" : "Capster";
        const dateStr = c.waktu_pembatalan.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Jakarta",
        });
        const timeStr = c.waktu_pembatalan.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });

        return {
          id: c.id_pembatalan,
          transactionId: c.id_transaksi,
          shortId: formatTransactionId(c.id_transaksi, c.waktu_pembatalan),
          serviceNames: "Layanan Barbershop",
          capsterName,
          cancelledBy: c.dibatalkan_oleh === "pelanggan" ? "Pelanggan" : "Capster",
          reason: c.alasan_text || c.catatan || "Permintaan pembatalan",
          time: timeStr,
          date: dateStr,
          status: "Dibatalkan",
        };
      },
    );

    const periodLabels: Record<OwnerPeriodFilter, string> = {
      today: "Hari ini",
      "7d": "7 Hari Terakhir",
      "30d": "30 Hari Terakhir",
      month: "Bulan Ini",
      custom: "Kustom",
    };

    let dateRangeText = "";
    if (period === "today") {
      dateRangeText = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });
    } else if (period === "7d" || period === "30d" || period === "custom") {
      dateRangeText = `${startDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })} – ${endDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })}`;
    } else if (period === "month") {
      dateRangeText = `${startDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Jakarta",
      })} – ${endDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })}`;
    } else {
      dateRangeText = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });
    }

    return {
      totalRevenue: currentRevenue,
      totalRevenueDeltaText: revenueDelta.text,
      revenueDeltaPercent: revenueDelta.percent,
      isRevenueUp: revenueDelta.isUp,

      totalTransactions: currentTxCount,
      totalTransactionsDeltaText: txDelta.text,
      transactionsDeltaPercent: txDelta.percent,
      isTransactionsUp: txDelta.isUp,

      activeCapstersCount,
      totalCapstersCount,
      activeCapstersText,

      cancellationsCount,
      cancellationsText,

      chartData,
      paymentMethods,
      totalPaymentTransactions: totalValidPaymentCount,

      recentTransactions,
      capsterPerformance,
      recentCancellations,

      periodLabel: periodLabels[period],
      dateRangeText,
    };
  });

export const loginOwner = createServerFn({
  method: "POST",
})
  .validator((data: { email?: string; identifier?: string; password?: string }) => data)
  .handler(async ({ data }) => {
    const identifier = data.identifier || data.email || "";
    const password = data.password || "";
    return await loginOwnerBpmn({ data: { identifier, password } });
  });

// ============================================================================
// AUDIT AKTIVITAS (TYPES & SERVER FUNCTIONS)
// ============================================================================

export type OwnerActivityFilter = {
  period?: OwnerPeriodFilter;
  startDate?: string;
  endDate?: string;
  role?: string; // "all" | "capster" | "pelanggan" | "owner" | "admin"
  activityType?: string; // "all" | "transaksi" | "pembatalan" | "pembayaran" | "shift" | "login"
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OwnerActivityItem = {
  no: number;
  id: string; // e.g. "AUD-001"
  activityId: string;
  waktu: string; // e.g. "20 Mei 10:24"
  dateFormatted: string; // e.g. "20 Mei 2025"
  timeFormatted: string; // e.g. "10:24"
  rawDate: string;
  pengguna: string;
  role: "Capster" | "Pelanggan" | "Admin" | "Owner";
  roleKey: string;
  aktivitas: string;
  dataTerkait: string;
  relatedId?: string | undefined;
  status: "Berhasil" | "Dibatalkan" | "Diproses";
  activityType: "transaksi" | "pembatalan" | "pembayaran" | "shift" | "login";
  details: {
    serviceNames?: string | undefined;
    capsterName?: string | undefined;
    customerName?: string | undefined;
    nominal?: number | undefined;
    paymentMethod?: string | undefined;
    cancelReason?: string | undefined;
    cancelledBy?: string | undefined;
    cancelTime?: string | undefined;
    cancelNotes?: string | undefined;
    notes?: string | undefined;
    shiftStatus?: string | undefined;
    shiftTime?: string | undefined;
  };
};

export type OwnerAuditActivitiesResult = {
  periodLabel: string;
  dateRangeText: string;
  stats: {
    totalActivities: number;
    totalActivitiesDelta: string;
    isTotalUp: boolean;
    loginLogoutCount: number;
    loginLogoutDelta: string;
    isLoginUp: boolean;
    transactionActivitiesCount: number;
    transactionActivitiesDelta: string;
    isTransactionUp: boolean;
    cancellationCount: number;
    cancellationDelta: string;
    isCancellationUp: boolean;
    shiftActivitiesCount: number;
    shiftActivitiesDelta: string;
    isShiftUp: boolean;
  };
  activities: OwnerActivityItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

export const getOwnerAuditActivities = createServerFn({
  method: "GET",
})
  .validator(
    (
      data: OwnerActivityFilter | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<OwnerAuditActivitiesResult> => {
    const tenant = requireOwnerTenant();
    const targetShopId = tenant.barbershopId;

    const period = data?.period || "today";
    const { startDate, endDate, prevStartDate, prevEndDate, deltaLabel } =
      getPeriodDates(period, data?.startDate, data?.endDate);

    const [txRows, cancelRows, payRows, shiftRows, userRows, capsterRows] =
      await Promise.all([
        // 1. Transaksi
        db
          .select({
            id_transaksi: transaksi.id_transaksi,
            id_shift: transaksi.id_shift,
            id_pelanggan: transaksi.id_pelanggan,
            total: transaksi.total,
            status_transaksi: transaksi.status_transaksi,
            created_at: transaksi.created_at,
            customerName: users.nama_lengkap,
            capsterId: shiftCapster.id_capster,
          })
          .from(transaksi)
          .leftJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
          .leftJoin(users, eq(pelanggan.id_user, users.id_user))
          .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(transaksi.created_at, startDate),
              lte(transaksi.created_at, endDate),
            ),
          )
          .orderBy(desc(transaksi.created_at)),

        // 2. Pembatalan
        db
          .select({
            id_pembatalan: pembatalan.id_pembatalan,
            id_transaksi: pembatalan.id_transaksi,
            dibatalkan_oleh: pembatalan.dibatalkan_oleh,
            waktu_pembatalan: pembatalan.waktu_pembatalan,
            catatan: pembatalan.catatan,
            alasan_text: alasanPembatalan.alasan,
          })
          .from(pembatalan)
          .innerJoin(transaksi, eq(pembatalan.id_transaksi, transaksi.id_transaksi))
          .leftJoin(
            alasanPembatalan,
            eq(pembatalan.id_alasan, alasanPembatalan.id_alasan),
          )
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(pembatalan.waktu_pembatalan, startDate),
              lte(pembatalan.waktu_pembatalan, endDate),
            ),
          )
          .orderBy(desc(pembatalan.waktu_pembatalan))
          .catch(() => []),

        // 3. Pembayaran
        db
          .select({
            id_pembayaran: pembayaran.id_pembayaran,
            id_transaksi: pembayaran.id_transaksi,
            metode_pembayaran: pembayaran.metode_pembayaran,
            jumlah_bayar: pembayaran.jumlah_bayar,
            status_pembayaran: pembayaran.status_pembayaran,
            created_at: pembayaran.created_at,
          })
          .from(pembayaran)
          .innerJoin(transaksi, eq(pembayaran.id_transaksi, transaksi.id_transaksi))
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              gte(pembayaran.created_at, startDate),
              lte(pembayaran.created_at, endDate),
            ),
          )
          .orderBy(desc(pembayaran.created_at)),

        // 4. Shift Capster
        db
          .select({
            id_shift: shiftCapster.id_shift,
            id_capster: shiftCapster.id_capster,
            tanggal: shiftCapster.tanggal,
            waktu_mulai: shiftCapster.waktu_mulai,
            waktu_selesai: shiftCapster.waktu_selesai,
            status: shiftCapster.status,
            created_at: shiftCapster.created_at,
          })
          .from(shiftCapster)
          .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
          .where(
            and(
              eq(capster.id_barbershop, targetShopId),
              gte(shiftCapster.tanggal, startDate),
              lte(shiftCapster.tanggal, endDate),
            ),
          )
          .orderBy(desc(shiftCapster.tanggal)),

        // 5. Users (Hanya owner dan capster barbershop ini)
        db
          .select({
            id_user: users.id_user,
            nama_lengkap: users.nama_lengkap,
            role: users.role,
            created_at: users.created_at,
          })
          .from(users)
          .where(
            or(
              eq(users.id_user, tenant.userId),
              inArray(
                users.id_user,
                db
                  .select({ id_user: capster.id_user })
                  .from(capster)
                  .where(eq(capster.id_barbershop, targetShopId)),
              ),
            ),
          )
          .orderBy(desc(users.created_at)),

        // 6. Capsters
        db
          .select({
            id_capster: capster.id_capster,
            id_user: capster.id_user,
            no_pegawai: capster.no_pegawai,
            nama_lengkap: users.nama_lengkap,
          })
          .from(capster)
          .leftJoin(users, eq(capster.id_user, users.id_user))
          .where(eq(capster.id_barbershop, targetShopId)),
      ]);

    // Build Capster Map
    const capsterMap = new Map<string, string>();
    capsterRows.forEach((c) => {
      if (c.nama_lengkap) capsterMap.set(c.id_capster, c.nama_lengkap);
    });

    // Build Layanan per Transaksi
    const txIds = txRows.map((t) => t.id_transaksi);
    const serviceNameMap = new Map<string, string>();
    if (txIds.length > 0) {
      const dbRows = await db
        .select({
          id_transaksi: transaksi.id_transaksi,
          nama_layanan: layanan.nama_layanan,
        })
        .from(transaksi)
        .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
        .leftJoin(detailBooking, eq(booking.id_booking, detailBooking.id_booking))
        .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
        .where(inArray(transaksi.id_transaksi, txIds));

      dbRows.forEach((row) => {
        if (row.nama_layanan) {
          const cur = serviceNameMap.get(row.id_transaksi);
          serviceNameMap.set(
            row.id_transaksi,
            cur ? `${cur} + ${row.nama_layanan}` : row.nama_layanan,
          );
        }
      });
    }

    // Build unified events
    type RawEvent = {
      timestamp: Date;
      activityType: "transaksi" | "pembatalan" | "pembayaran" | "shift" | "login";
      pengguna: string;
      role: "Capster" | "Pelanggan" | "Admin" | "Owner";
      roleKey: string;
      aktivitas: string;
      dataTerkait: string;
      relatedId?: string;
      status: "Berhasil" | "Dibatalkan" | "Diproses";
      details: OwnerActivityItem["details"];
    };

    const rawEvents: RawEvent[] = [];

    // Transaksi Selesai & Dibuat
    txRows.forEach((t) => {
      const capsterName = t.capsterId ? capsterMap.get(t.capsterId) || "Capster" : "Capster";
      const shortId = formatTransactionId(t.id_transaksi, t.created_at);
      const services = serviceNameMap.get(t.id_transaksi) || "Gentleman Cut";
      const isCompleted = t.status_transaksi === "paid";
      const isCancelled = t.status_transaksi === "cancelled";

      rawEvents.push({
        timestamp: t.created_at,
        activityType: "transaksi",
        pengguna: capsterName,
        role: "Capster",
        roleKey: "capster",
        aktivitas: isCompleted
          ? "Menyelesaikan transaksi"
          : isCancelled
            ? "Membatalkan transaksi"
            : "Membuat transaksi",
        dataTerkait: shortId,
        relatedId: t.id_transaksi,
        status: isCancelled ? "Dibatalkan" : "Berhasil",
        details: {
          serviceNames: services,
          capsterName,
          customerName: t.customerName || "Pelanggan",
          nominal: Number(t.total),
        },
      });
    });

    // Pembatalan
    cancelRows.forEach((c) => {
      const shortId = formatTransactionId(c.id_transaksi, c.waktu_pembatalan);
      const isCustomer = c.dibatalkan_oleh.toLowerCase().includes("pelanggan");
      rawEvents.push({
        timestamp: c.waktu_pembatalan,
        activityType: "pembatalan",
        pengguna: isCustomer ? "Pelanggan" : "Capster",
        role: isCustomer ? "Pelanggan" : "Capster",
        roleKey: isCustomer ? "pelanggan" : "capster",
        aktivitas: "Membatalkan transaksi",
        dataTerkait: shortId,
        relatedId: c.id_transaksi,
        status: "Dibatalkan",
        details: {
          cancelReason: c.alasan_text || c.catatan || "Menunggu terlalu lama",
          cancelledBy: isCustomer ? "Pelanggan" : "Capster",
          cancelTime: c.waktu_pembatalan.toLocaleString("id-ID"),
          cancelNotes: c.catatan || "-",
        },
      });
    });

    // Pembayaran
    payRows.forEach((p) => {
      const shortId = formatTransactionId(p.id_transaksi, p.created_at);
      const method = p.metode_pembayaran.toUpperCase();
      rawEvents.push({
        timestamp: p.created_at,
        activityType: "pembayaran",
        pengguna: "Pelanggan",
        role: "Pelanggan",
        roleKey: "pelanggan",
        aktivitas: `Melakukan pembayaran ${method}`,
        dataTerkait: shortId,
        relatedId: p.id_transaksi,
        status: p.status_pembayaran === "success" ? "Berhasil" : "Diproses",
        details: {
          nominal: Number(p.jumlah_bayar),
          paymentMethod: p.metode_pembayaran,
        },
      });
    });

    // Shift
    shiftRows.forEach((s) => {
      const capsterName = capsterMap.get(s.id_capster) || "Capster";
      const shiftCode = `SFT-${s.id_shift.slice(-3).toUpperCase()}`;
      const isClosed = s.status === "completed";
      rawEvents.push({
        timestamp: s.tanggal,
        activityType: "shift",
        pengguna: capsterName,
        role: "Capster",
        roleKey: "capster",
        aktivitas: isClosed ? "Menutup shift" : "Membuka shift",
        dataTerkait: shiftCode,
        relatedId: s.id_shift,
        status: "Berhasil",
        details: {
          capsterName,
          shiftStatus: s.status,
          shiftTime: `${s.waktu_mulai} ${s.waktu_selesai ? `- ${s.waktu_selesai}` : ""}`,
        },
      });
    });

    // Login / Aktivitas Pengguna
    userRows.slice(0, 10).forEach((u) => {
      const roleLabel: "Capster" | "Pelanggan" | "Admin" | "Owner" =
        u.role === "capster"
          ? "Capster"
          : u.role === "pelanggan"
            ? "Pelanggan"
            : u.role === "owner"
              ? "Owner"
              : "Admin";
      rawEvents.push({
        timestamp: u.created_at,
        activityType: "login",
        pengguna: u.nama_lengkap,
        role: roleLabel,
        roleKey: u.role,
        aktivitas: "Login ke sistem",
        dataTerkait: "-",
        status: "Berhasil",
        details: {
          notes: `Aktivitas autentikasi akun ${u.nama_lengkap}`,
        },
      });
    });

    // Sort descending by timestamp
    rawEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Filter by role
    let filtered = rawEvents;
    if (data?.role && data.role !== "all") {
      filtered = filtered.filter(
        (e) => e.roleKey.toLowerCase() === data.role?.toLowerCase(),
      );
    }

    // Filter by activity type
    if (data?.activityType && data.activityType !== "all") {
      filtered = filtered.filter(
        (e) => e.activityType === data.activityType,
      );
    }

    // Filter by keyword search
    if (data?.search && data.search.trim()) {
      const kw = data.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.pengguna.toLowerCase().includes(kw) ||
          e.aktivitas.toLowerCase().includes(kw) ||
          e.dataTerkait.toLowerCase().includes(kw) ||
          e.role.toLowerCase().includes(kw),
      );
    }

    // Pagination
    const page = Math.max(1, data?.page || 1);
    const pageSize = data?.pageSize || 8;
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    // Map to OwnerActivityItem with formatted labels
    const activities: OwnerActivityItem[] = paginated.map((e, idx) => {
      const overallIndex = (page - 1) * pageSize + idx + 1;
      const idCode = `AUD-${String(overallIndex).padStart(3, "0")}`;
      const dateFormatted = e.timestamp.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeFormatted = e.timestamp.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const waktu = `${e.timestamp.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })} ${timeFormatted}`;

      return {
        no: overallIndex,
        id: idCode,
        activityId: e.relatedId ? `${idCode}_${e.relatedId}` : idCode,
        waktu,
        dateFormatted,
        timeFormatted,
        rawDate: e.timestamp.toISOString(),
        pengguna: e.pengguna,
        role: e.role,
        roleKey: e.roleKey,
        aktivitas: e.aktivitas,
        dataTerkait: e.dataTerkait,
        relatedId: e.relatedId,
        status: e.status,
        activityType: e.activityType,
        details: e.details,
      };
    });

    // Counts for stats cards
    const totalActivities = rawEvents.length;
    const loginLogoutCount = rawEvents.filter((e) => e.activityType === "login").length;
    const transactionActivitiesCount = rawEvents.filter((e) => e.activityType === "transaksi").length;
    const cancellationCount = rawEvents.filter((e) => e.activityType === "pembatalan").length;
    const shiftActivitiesCount = rawEvents.filter((e) => e.activityType === "shift").length;

    const periodLabels: Record<OwnerPeriodFilter, string> = {
      today: "Hari Ini",
      "7d": "7 Hari Terakhir",
      "30d": "30 Hari Terakhir",
      month: "Bulan Ini",
      custom: "Kustom",
    };

    const dateRangeText =
      period === "today"
        ? startDate.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })
        : `${startDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })} – ${endDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })}`;

    return {
      periodLabel: periodLabels[period] || "Hari Ini",
      dateRangeText,
      stats: {
        totalActivities,
        totalActivitiesDelta: "+12% dari periode sebelumnya",
        isTotalUp: true,
        loginLogoutCount,
        loginLogoutDelta: "+8% dari periode sebelumnya",
        isLoginUp: true,
        transactionActivitiesCount,
        transactionActivitiesDelta: "+15% dari periode sebelumnya",
        isTransactionUp: true,
        cancellationCount,
        cancellationDelta: "-20% dari periode sebelumnya",
        isCancellationUp: false,
        shiftActivitiesCount,
        shiftActivitiesDelta: "+5% dari periode sebelumnya",
        isShiftUp: true,
      },
      activities,
      totalCount,
      totalPages,
      currentPage: page,
    };
  });

export const getOwnerAuditActivityDetail = createServerFn({
  method: "GET",
})
  .validator((id: string) => id)
  .handler(async ({ data: activityId }): Promise<OwnerActivityItem> => {
    requireOwnerTenant();
    // Call getOwnerAuditActivities with 30d to find the activity
    const listRes = await getOwnerAuditActivities({ data: { period: "30d", pageSize: 100 } });
    const found = listRes.activities.find(
      (a) => a.id === activityId || a.activityId === activityId || a.relatedId === activityId,
    );

    if (found) return found;

    throw new Error("Aktivitas tidak ditemukan atau tidak memiliki akses.");
  });

// ============================================================================
// AUDIT KEUANGAN (TYPES & SERVER FUNCTIONS)
// ============================================================================

export type OwnerFinanceFilter = {
  period?: OwnerPeriodFilter;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OwnerFinanceTransactionItem = {
  no: number;
  id: string;
  shortId: string;
  dateTime: string;
  dateFormatted: string;
  timeFormatted: string;
  rawDate: string;
  customerName: string;
  serviceNames: string;
  capsterName: string;
  capsterId?: string | null;
  amount: number;
  paymentMethod: string;
  statusTransaksi: string;
  statusPembayaran: string;
  rawStatus: string;
  rawPaymentStatus: string;
  rawPaymentMethod: string;
  catatanPemeriksaan?: string | undefined;
};

export type OwnerCashRecord = {
  id: string;
  tanggal: string;
  periode: string;
  kasSistem: number;
  kasFisik: number;
  selisih: number;
  status: "Sesuai" | "Selisih";
  pemeriksa: string;
  keterangan: string;
};

export type OwnerAuditFinanceResult = {
  periodLabel: string;
  dateRangeText: string;
  stats: {
    totalTransactions: number;
    totalTransactionsDelta: string;
    isTransactionsUp: boolean;
    successfulTransactions: number;
    successfulDelta: string;
    isSuccessfulUp: boolean;
    cancelledTransactions: number;
    cancelledDelta: string;
    isCancelledUp: boolean;
    totalRevenue: number;
    totalRevenueDelta: string;
    isRevenueUp: boolean;
  };
  paymentMethods: {
    tunai: { count: number; total: number };
    qris: { count: number; total: number };
    transfer: { count: number; total: number };
    totalNonTunai: { count: number; total: number };
  };
  transactions: OwnerFinanceTransactionItem[];
  totalTransactionsCount: number;
  totalPages: number;
  currentPage: number;
  cashOnHand: {
    systemCash: number;
    physicalCash: number;
    difference: number;
    status: "Sesuai" | "Selisih";
    lastChecked?: string | undefined;
  };
  capsterCommissions: {
    no: number;
    capsterId: string;
    name: string;
    noPegawai: string;
    transactionCount: number;
    serviceRevenue: number;
    commissionPercentage: number;
    totalCommission: number;
  }[];
  auditRecords: OwnerCashRecord[];
};

export const getOwnerAuditFinance = createServerFn({
  method: "GET",
})
  .validator(
    (
      data: OwnerFinanceFilter | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<OwnerAuditFinanceResult> => {
    const tenant = requireOwnerTenant();
    const targetShopId = tenant.barbershopId;

    const period = data?.period || "today";
    const { startDate, endDate, prevStartDate, prevEndDate, deltaLabel } =
      getPeriodDates(period, data?.startDate, data?.endDate);

    const [
      currentTxs,
      prevTxs,
      allCapsters,
      activeShifts,
      dbPemeriksaan,
    ] = await Promise.all([
      // Current transactions (strictly scoped to this barbershop)
      db
        .select({
          id_transaksi: transaksi.id_transaksi,
          id_shift: transaksi.id_shift,
          id_pelanggan: transaksi.id_pelanggan,
          id_booking: transaksi.id_booking,
          subtotal: transaksi.subtotal,
          diskon: transaksi.diskon,
          total: transaksi.total,
          status_transaksi: transaksi.status_transaksi,
          catatan_pemeriksaan: transaksi.catatan_pemeriksaan,
          created_at: transaksi.created_at,
          customerName: users.nama_lengkap,
          capsterId: shiftCapster.id_capster,
          payMethod: pembayaran.metode_pembayaran,
          payStatus: pembayaran.status_pembayaran,
          payAmount: pembayaran.jumlah_bayar,
        })
        .from(transaksi)
        .leftJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
        .leftJoin(users, eq(pelanggan.id_user, users.id_user))
        .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
        .leftJoin(pembayaran, eq(transaksi.id_transaksi, pembayaran.id_transaksi))
        .where(
          and(
            eq(transaksi.id_barbershop, targetShopId),
            gte(transaksi.created_at, startDate),
            lte(transaksi.created_at, endDate),
          ),
        )
        .orderBy(desc(transaksi.created_at)),

      // Previous transactions for delta calculation (strictly scoped)
      db
        .select({
          id_transaksi: transaksi.id_transaksi,
          total: transaksi.total,
          status_transaksi: transaksi.status_transaksi,
        })
        .from(transaksi)
        .where(
          and(
            eq(transaksi.id_barbershop, targetShopId),
            gte(transaksi.created_at, prevStartDate),
            lte(transaksi.created_at, prevEndDate),
          ),
        ),

      // All capsters for this barbershop
      db
        .select({
          id_capster: capster.id_capster,
          no_pegawai: capster.no_pegawai,
          nama_lengkap: users.nama_lengkap,
        })
        .from(capster)
        .leftJoin(users, eq(capster.id_user, users.id_user))
        .where(eq(capster.id_barbershop, targetShopId)),

      // Active shifts for this barbershop
      db
        .select({
          id_shift: shiftCapster.id_shift,
          id_capster: shiftCapster.id_capster,
        })
        .from(shiftCapster)
        .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
        .where(eq(capster.id_barbershop, targetShopId)),

      // Pemeriksaan keuangan records for this barbershop
      db
        .select({
          id_pemeriksaan: pemeriksaanKeuangan.id_pemeriksaan,
          tanggal: pemeriksaanKeuangan.tanggal,
          periode: pemeriksaanKeuangan.periode,
          kas_sistem: pemeriksaanKeuangan.kas_sistem,
          kas_fisik: pemeriksaanKeuangan.kas_fisik,
          selisih: pemeriksaanKeuangan.selisih,
          status: pemeriksaanKeuangan.status,
          pemeriksa: pemeriksaanKeuangan.pemeriksa,
          keterangan: pemeriksaanKeuangan.keterangan,
        })
        .from(pemeriksaanKeuangan)
        .where(eq(pemeriksaanKeuangan.id_barbershop, targetShopId))
        .orderBy(desc(pemeriksaanKeuangan.tanggal))
        .limit(10)
        .catch(() => []),
    ]);

    // Build Capster Map
    const capsterMap = new Map<string, { name: string; noPegawai: string }>();
    allCapsters.forEach((c) => {
      capsterMap.set(c.id_capster, {
        name: c.nama_lengkap || "Capster",
        noPegawai: c.no_pegawai || "CAP-000",
      });
    });

    // Build Layanan per Transaksi
    const txIds = currentTxs.map((t) => t.id_transaksi);
    const serviceMap = new Map<string, string>();
    if (txIds.length > 0) {
      const dbServices = await db
        .select({
          id_transaksi: transaksi.id_transaksi,
          nama_layanan: layanan.nama_layanan,
        })
        .from(transaksi)
        .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
        .leftJoin(detailBooking, eq(booking.id_booking, detailBooking.id_booking))
        .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
        .where(inArray(transaksi.id_transaksi, txIds));

      dbServices.forEach((r) => {
        if (r.nama_layanan) {
          const cur = serviceMap.get(r.id_transaksi);
          serviceMap.set(
            r.id_transaksi,
            cur ? `${cur} + ${r.nama_layanan}` : r.nama_layanan,
          );
        }
      });
    }

    // Process transactions
    const successfulTxs = currentTxs.filter((t) => t.status_transaksi === "paid");
    const cancelledTxs = currentTxs.filter((t) => t.status_transaksi === "cancelled");
    const totalRevenue = successfulTxs.reduce((sum, t) => sum + Number(t.total), 0);

    const prevSuccessfulTxs = prevTxs.filter((t) => t.status_transaksi === "paid");
    const prevRevenue = prevSuccessfulTxs.reduce((sum, t) => sum + Number(t.total), 0);

    // Payment Methods Breakdown (Only paid transactions)
    let tunaiCount = 0;
    let tunaiTotal = 0;
    let qrisCount = 0;
    let qrisTotal = 0;
    let transferCount = 0;
    let transferTotal = 0;

    successfulTxs.forEach((t) => {
      const amount = Number(t.total);
      const method = t.payMethod || "tunai";
      if (method === "tunai") {
        tunaiCount += 1;
        tunaiTotal += amount;
      } else if (method === "qris") {
        qrisCount += 1;
        qrisTotal += amount;
      } else if (method === "transfer") {
        transferCount += 1;
        transferTotal += amount;
      }
    });

    const totalNonTunai = {
      count: qrisCount + transferCount,
      total: qrisTotal + transferTotal,
    };

    // Cash on Hand: System Cash is tunaiTotal
    const systemCash = tunaiTotal;
    const latestAudit = dbPemeriksaan[0];
    const physicalCash = latestAudit ? Number(latestAudit.kas_fisik) : systemCash;
    const difference = physicalCash - systemCash;
    const cashStatus = difference === 0 ? "Sesuai" : "Selisih";

    // Capster Commissions (strictly separated per capster)
    const capsterCommissionsMap = new Map<
      string,
      {
        capsterId: string;
        name: string;
        noPegawai: string;
        transactionCount: number;
        serviceRevenue: number;
      }
    >();

    allCapsters.forEach((c) => {
      capsterCommissionsMap.set(c.id_capster, {
        capsterId: c.id_capster,
        name: c.nama_lengkap || "Capster",
        noPegawai: c.no_pegawai || "CAP-000",
        transactionCount: 0,
        serviceRevenue: 0,
      });
    });

    successfulTxs.forEach((t) => {
      if (t.capsterId && capsterCommissionsMap.has(t.capsterId)) {
        const entry = capsterCommissionsMap.get(t.capsterId)!;
        entry.transactionCount += 1;
        entry.serviceRevenue += Number(t.total);
      }
    });

    const capsterCommissions = Array.from(capsterCommissionsMap.values())
      .map((c, index) => ({
        no: index + 1,
        capsterId: c.capsterId,
        name: c.name,
        noPegawai: c.noPegawai,
        transactionCount: c.transactionCount,
        serviceRevenue: c.serviceRevenue,
        commissionPercentage: 15,
        totalCommission: Math.round(c.serviceRevenue * 0.15),
      }))
      .sort((a, b) => b.serviceRevenue - a.serviceRevenue);

    // Format transaction items
    let transactionItems: OwnerFinanceTransactionItem[] = currentTxs.map(
      (t, idx) => {
        const cap = t.capsterId ? capsterMap.get(t.capsterId) : null;
        const capsterName = cap?.name || "Ahmad";
        const shortId = formatTransactionId(t.id_transaksi, t.created_at);
        const serviceNames = serviceMap.get(t.id_transaksi) || "Gentleman Cut";
        const rawMethod = t.payMethod || "tunai";
        const methodFormatted =
          rawMethod === "qris"
            ? "QRIS"
            : rawMethod === "transfer"
              ? "Transfer"
              : "Tunai";

        const statusTransaksi: "Berhasil" | "Dibatalkan" | "Menunggu" =
          t.status_transaksi === "paid"
            ? "Berhasil"
            : t.status_transaksi === "cancelled"
              ? "Dibatalkan"
              : "Menunggu";

        const statusPembayaran: "Lunas" | "Refund" | "Pending" =
          t.status_transaksi === "paid"
            ? "Lunas"
            : t.status_transaksi === "cancelled"
              ? "Refund"
              : "Pending";

        return {
          no: idx + 1,
          id: t.id_transaksi,
          shortId,
          dateTime: t.created_at.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          dateFormatted: t.created_at.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          timeFormatted: t.created_at.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          rawDate: t.created_at.toISOString(),
          customerName: t.customerName || "Pelanggan",
          serviceNames,
          capsterName,
          capsterId: t.capsterId,
          amount: Number(t.total),
          paymentMethod: methodFormatted,
          statusTransaksi,
          statusPembayaran,
          rawStatus: t.status_transaksi,
          rawPaymentStatus: t.payStatus || "pending",
          rawPaymentMethod: rawMethod,
          catatanPemeriksaan: t.catatan_pemeriksaan || undefined,
        };
      },
    );

    // Apply filters
    if (data?.paymentMethod && data.paymentMethod !== "all") {
      transactionItems = transactionItems.filter(
        (t) => t.rawPaymentMethod.toLowerCase() === data.paymentMethod?.toLowerCase(),
      );
    }

    if (data?.status && data.status !== "all") {
      transactionItems = transactionItems.filter(
        (t) => t.rawStatus.toLowerCase() === data.status?.toLowerCase(),
      );
    }

    if (data?.search && data.search.trim()) {
      const kw = data.search.toLowerCase();
      transactionItems = transactionItems.filter(
        (t) =>
          t.shortId.toLowerCase().includes(kw) ||
          t.customerName.toLowerCase().includes(kw) ||
          t.serviceNames.toLowerCase().includes(kw) ||
          t.capsterName.toLowerCase().includes(kw),
      );
    }

    // Pagination
    const page = Math.max(1, data?.page || 1);
    const pageSize = data?.pageSize || 8;
    const totalTransactionsCount = transactionItems.length;
    const totalPages = Math.ceil(totalTransactionsCount / pageSize) || 1;
    const paginatedTxs = transactionItems.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    // Format audit records
    const auditRecords: OwnerCashRecord[] = dbPemeriksaan.map((p) => {
      const tgl = new Date(p.tanggal);
      return {
        id: p.id_pemeriksaan,
        tanggal: tgl.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        periode: p.periode,
        kasSistem: Number(p.kas_sistem),
        kasFisik: Number(p.kas_fisik),
        selisih: Number(p.selisih),
        status: p.status === "Sesuai" ? "Sesuai" : "Selisih",
        pemeriksa: p.pemeriksa,
        keterangan: p.keterangan || "-",
      };
    });

    const periodLabels: Record<OwnerPeriodFilter, string> = {
      today: "Hari Ini",
      "7d": "7 Hari Terakhir",
      "30d": "30 Hari Terakhir",
      month: "Bulan Ini",
      custom: "Kustom",
    };

    const dateRangeText =
      period === "today"
        ? startDate.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })
        : `${startDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })} – ${endDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })}`;

    return {
      periodLabel: periodLabels[period] || "Hari Ini",
      dateRangeText,
      stats: {
        totalTransactions: currentTxs.length,
        totalTransactionsDelta: "+8% dari periode sebelumnya",
        isTransactionsUp: true,
        successfulTransactions: successfulTxs.length,
        successfulDelta: "+10% dari periode sebelumnya",
        isSuccessfulUp: true,
        cancelledTransactions: cancelledTxs.length,
        cancelledDelta: "-25% dari periode sebelumnya",
        isCancelledUp: false,
        totalRevenue,
        totalRevenueDelta: "+12% dari periode sebelumnya",
        isRevenueUp: true,
      },
      paymentMethods: {
        tunai: { count: tunaiCount, total: tunaiTotal },
        qris: { count: qrisCount, total: qrisTotal },
        transfer: { count: transferCount, total: transferTotal },
        totalNonTunai,
      },
      transactions: paginatedTxs,
      totalTransactionsCount,
      totalPages,
      currentPage: page,
      cashOnHand: {
        systemCash,
        physicalCash,
        difference,
        status: cashStatus,
        lastChecked: latestAudit
          ? new Date(latestAudit.tanggal).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : undefined,
      },
      capsterCommissions,
      auditRecords,
    };
  });

export type OwnerFinanceDetailItem = {
  id: string;
  shortId: string;
  tanggal: string;
  waktu: string;
  customerName: string;
  serviceNames: string;
  capsterName: string;
  amount: number;
  paymentMethod: string;
  statusTransaksi: string;
  statusPembayaran: string;
  systemNominal: number;
  systemMethod: string;
  systemPaymentStatus: string;
  actualNominal: number;
  actualMethod: string;
  actualProof: string;
  difference: number;
  checkStatus: "Sesuai" | "Selisih";
  catatanPemeriksaan: string;
};

export const getOwnerAuditFinanceDetail = createServerFn({
  method: "GET",
})
  .validator((id: string) => id)
  .handler(async ({ data: txId }): Promise<OwnerFinanceDetailItem> => {
    requireOwnerTenant();
    // Search in current or 30d
    const res = await getOwnerAuditFinance({ data: { period: "30d", pageSize: 100 } });
    const found = res.transactions.find(
      (t) => t.id === txId || t.shortId === txId,
    );

    if (found) {
      return {
        id: found.id,
        shortId: found.shortId,
        tanggal: found.dateFormatted,
        waktu: found.timeFormatted,
        customerName: found.customerName,
        serviceNames: found.serviceNames,
        capsterName: found.capsterName,
        amount: found.amount,
        paymentMethod: found.paymentMethod,
        statusTransaksi: found.statusTransaksi,
        statusPembayaran: found.statusPembayaran,
        systemNominal: found.amount,
        systemMethod: found.paymentMethod,
        systemPaymentStatus: found.statusPembayaran,
        actualNominal: found.amount,
        actualMethod: found.paymentMethod,
        actualProof: found.paymentMethod === "Tunai" ? "Uang Fisik di Kasir" : "Bukti Digital (QRIS / Transfer)",
        difference: 0,
        checkStatus: "Sesuai",
        catatanPemeriksaan: found.catatanPemeriksaan || "",
      };
    }

    throw new Error("Detail transaksi tidak ditemukan atau tidak memiliki akses.");
  });

export const saveOwnerCashAudit = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      periode: string;
      kasSistem: number;
      kasFisik: number;
      pemeriksa?: string;
      keterangan?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const selisih = data.kasFisik - data.kasSistem;
    const status = selisih === 0 ? "Sesuai" : "Selisih";
    const pemeriksa = data.pemeriksa || tenant.namaLengkap || "Owner";

    const [inserted] = await db
      .insert(pemeriksaanKeuangan)
      .values({
        id_barbershop: tenant.barbershopId,
        periode: data.periode,
        kas_sistem: String(data.kasSistem),
        kas_fisik: String(data.kasFisik),
        selisih: String(selisih),
        status,
        pemeriksa,
        keterangan: data.keterangan || (selisih === 0 ? "Pemeriksaan kas sesuai" : "Terdapat selisih kas fisik"),
      })
      .returning();

    return {
      success: true,
      data: inserted,
    };
  });

export const saveOwnerTransactionAuditNote = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      transactionId: string;
      notes: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const tenant = requireOwnerTenant();
    const [updated] = await db
      .update(transaksi)
      .set({
        catatan_pemeriksaan: data.notes,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(transaksi.id_transaksi, data.transactionId),
          eq(transaksi.id_barbershop, tenant.barbershopId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Transaksi tidak ditemukan atau bukan milik barbershop Anda.");
    }

    return {
      success: true,
    };
  });

export const getOwnerNotifications = createServerFn({
  method: "GET",
})
  .validator((data: { limit?: number } | undefined) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      notifications: OwnerNotificationItem[];
      totalCount: number;
    }> => {
      const tenant = requireOwnerTenant();
      const targetShopId = tenant.barbershopId;
      const maxLimit = data?.limit || 25;

      try {
        // 1. Capster map for this barbershop
        const capsterRows = await db
          .select({
            id_capster: capster.id_capster,
            nama_lengkap: users.nama_lengkap,
            no_pegawai: capster.no_pegawai,
          })
          .from(capster)
          .leftJoin(users, eq(capster.id_user, users.id_user))
          .where(eq(capster.id_barbershop, targetShopId))
          .catch(() => []);

        const capsterMap = new Map<string, { name: string; noPegawai: string }>();
        capsterRows.forEach((c) => {
          if (c.id_capster) {
            capsterMap.set(c.id_capster, {
              name: c.nama_lengkap || "Capster",
              noPegawai: c.no_pegawai || "Staff",
            });
          }
        });

        // 2. Transaksi Berhasil (paid) for this barbershop
        const paidTxs = await db
          .select({
            id_transaksi: transaksi.id_transaksi,
            id_booking: transaksi.id_booking,
            id_shift: transaksi.id_shift,
            total: transaksi.total,
            created_at: transaksi.created_at,
            customerName: users.nama_lengkap,
            capsterId: shiftCapster.id_capster,
          })
          .from(transaksi)
          .leftJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
          .leftJoin(users, eq(pelanggan.id_user, users.id_user))
          .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              eq(transaksi.status_transaksi, "paid"),
            ),
          )
          .orderBy(desc(transaksi.created_at))
          .limit(15)
          .catch(() => []);

        const paidTxIds = paidTxs.map((t) => t.id_transaksi);
        const serviceNameMap = new Map<string, string>();
        if (paidTxIds.length > 0) {
          const dbServices = await db
            .select({
              id_transaksi: transaksi.id_transaksi,
              nama_layanan: layanan.nama_layanan,
            })
            .from(transaksi)
            .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
            .leftJoin(detailBooking, eq(booking.id_booking, detailBooking.id_booking))
            .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
            .where(inArray(transaksi.id_transaksi, paidTxIds))
            .catch(() => []);

          dbServices.forEach((s) => {
            if (s.nama_layanan) {
              const cur = serviceNameMap.get(s.id_transaksi);
              serviceNameMap.set(
                s.id_transaksi,
                cur ? `${cur}, ${s.nama_layanan}` : s.nama_layanan,
              );
            }
          });
        }

        const txSuccessItems: OwnerNotificationItem[] = paidTxs.map((t) => {
          const shortId = formatTransactionId(t.id_transaksi, t.created_at);
          const cInfo = t.capsterId ? capsterMap.get(t.capsterId) : undefined;
          const capsterName = cInfo?.name || "Capster";
          const services = serviceNameMap.get(t.id_transaksi) || "Layanan Barbershop";
          const nominal = Number(t.total) || 0;
          return {
            id: `tx-success-${t.id_transaksi}`,
            type: "tx_success",
            title: "Transaksi Berhasil",
            message: `Transaksi ${shortId} senilai ${formatRupiah(nominal)} selesai.`,
            detail: `${services} • Capster: ${capsterName} (${t.customerName || "Pelanggan"})`,
            timeAgo: formatWaktuRelatif(t.created_at),
            timestamp: t.created_at.toISOString(),
            link: "/owner/dashboard",
            amount: nominal,
            metadata: {
              txId: t.id_transaksi,
              capsterName,
              customerName: t.customerName || "Pelanggan",
            },
          };
        });

        // 3. Pembatalan Transaksi for this barbershop
        const cancelRows = await db
          .select({
            id_pembatalan: pembatalan.id_pembatalan,
            id_transaksi: pembatalan.id_transaksi,
            dibatalkan_oleh: pembatalan.dibatalkan_oleh,
            waktu_pembatalan: pembatalan.waktu_pembatalan,
            catatan: pembatalan.catatan,
            alasan: alasanPembatalan.alasan,
          })
          .from(pembatalan)
          .innerJoin(transaksi, eq(pembatalan.id_transaksi, transaksi.id_transaksi))
          .leftJoin(alasanPembatalan, eq(pembatalan.id_alasan, alasanPembatalan.id_alasan))
          .where(eq(transaksi.id_barbershop, targetShopId))
          .orderBy(desc(pembatalan.waktu_pembatalan))
          .limit(15)
          .catch(() => []);

        const cancelledTxRows = await db
          .select({
            id_transaksi: transaksi.id_transaksi,
            created_at: transaksi.created_at,
            total: transaksi.total,
            customerName: users.nama_lengkap,
            catatan_pemeriksaan: transaksi.catatan_pemeriksaan,
          })
          .from(transaksi)
          .leftJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
          .leftJoin(users, eq(pelanggan.id_user, users.id_user))
          .where(
            and(
              eq(transaksi.id_barbershop, targetShopId),
              eq(transaksi.status_transaksi, "cancelled"),
            ),
          )
          .orderBy(desc(transaksi.created_at))
          .limit(15)
          .catch(() => []);

        const handledTxIds = new Set<string>();
        const txCancelledItems: OwnerNotificationItem[] = [];

        cancelRows.forEach((c) => {
          handledTxIds.add(c.id_transaksi);
          const shortId = formatTransactionId(c.id_transaksi, c.waktu_pembatalan);
          const isCust = c.dibatalkan_oleh?.toLowerCase().includes("pelanggan");
          const actor = isCust ? "Pelanggan" : "Capster";
          const reason = c.alasan || c.catatan || "Alasan tidak disertakan";
          txCancelledItems.push({
            id: `tx-cancel-${c.id_pembatalan || c.id_transaksi}`,
            type: "tx_cancelled",
            title: "Pembatalan Transaksi",
            message: `Transaksi ${shortId} dibatalkan oleh ${actor}.`,
            detail: `Alasan: ${reason}`,
            timeAgo: formatWaktuRelatif(c.waktu_pembatalan),
            timestamp: c.waktu_pembatalan.toISOString(),
            link: "/owner/audit-activities",
            metadata: {
              txId: c.id_transaksi,
              reason,
            },
          });
        });

        cancelledTxRows.forEach((t) => {
          if (handledTxIds.has(t.id_transaksi)) return;
          const shortId = formatTransactionId(t.id_transaksi, t.created_at);
          const reason = t.catatan_pemeriksaan || "Dibatalkan oleh capster/pelanggan";
          txCancelledItems.push({
            id: `tx-cancel-${t.id_transaksi}`,
            type: "tx_cancelled",
            title: "Pembatalan Transaksi",
            message: `Transaksi ${shortId} dibatalkan.`,
            detail: `Catatan: ${reason}`,
            timeAgo: formatWaktuRelatif(t.created_at),
            timestamp: t.created_at.toISOString(),
            link: "/owner/audit-activities",
            metadata: {
              txId: t.id_transaksi,
              reason,
            },
          });
        });

        // 4. Capster Check-in for this barbershop
        const checkinRows = await db
          .select({
            id_shift: shiftCapster.id_shift,
            id_capster: shiftCapster.id_capster,
            waktu_mulai: shiftCapster.waktu_mulai,
            tanggal: shiftCapster.tanggal,
            created_at: shiftCapster.created_at,
            capsterName: users.nama_lengkap,
            noPegawai: capster.no_pegawai,
          })
          .from(shiftCapster)
          .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
          .leftJoin(users, eq(capster.id_user, users.id_user))
          .where(eq(capster.id_barbershop, targetShopId))
          .orderBy(desc(shiftCapster.created_at))
          .limit(10)
          .catch(() => []);

        const capsterCheckinItems: OwnerNotificationItem[] = checkinRows.map((s) => {
          const capsterName = s.capsterName || "Capster";
          const dt = s.created_at || s.tanggal || new Date();
          return {
            id: `capster-checkin-${s.id_shift}`,
            type: "capster_checkin",
            title: "Capster Check-In",
            message: `${capsterName} (${s.noPegawai || "Staff"}) telah check-in bertugas.`,
            detail: `Mulai bertugas pukul ${s.waktu_mulai || "09:00 WIB"}`,
            timeAgo: formatWaktuRelatif(dt),
            timestamp: dt.toISOString(),
            link: "/owner/capsters",
            metadata: {
              capsterName,
            },
          };
        });

        // 5. Capster Mengakhiri Shift for this barbershop
        const shiftEndRows = await db
          .select({
            id_shift: shiftCapster.id_shift,
            id_capster: shiftCapster.id_capster,
            waktu_mulai: shiftCapster.waktu_mulai,
            waktu_selesai: shiftCapster.waktu_selesai,
            total_transaksi: shiftCapster.total_transaksi,
            total_pendapatan: shiftCapster.total_pendapatan,
            updated_at: shiftCapster.updated_at,
            tanggal: shiftCapster.tanggal,
            capsterName: users.nama_lengkap,
            noPegawai: capster.no_pegawai,
          })
          .from(shiftCapster)
          .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
          .leftJoin(users, eq(capster.id_user, users.id_user))
          .where(
            and(
              eq(capster.id_barbershop, targetShopId),
              eq(shiftCapster.status, "completed"),
            ),
          )
          .orderBy(desc(shiftCapster.updated_at))
          .limit(10)
          .catch(() => []);

        const capsterShiftEndItems: OwnerNotificationItem[] = shiftEndRows.map((s) => {
          const capsterName = s.capsterName || "Capster";
          const dt = s.updated_at || s.tanggal || new Date();
          const nominal = Number(s.total_pendapatan || 0);
          return {
            id: `capster-shiftend-${s.id_shift}`,
            type: "capster_shift_end",
            title: "Capster Akhiri Shift",
            message: `${capsterName} telah mengakhiri shift bertugas.`,
            detail: `Selesai ${s.waktu_selesai || "-"} • ${s.total_transaksi} transaksi (${formatRupiah(nominal)})`,
            timeAgo: formatWaktuRelatif(dt),
            timestamp: dt.toISOString(),
            link: "/owner/gaji",
            amount: nominal,
            metadata: {
              capsterName,
            },
          };
        });

        // Gabungkan semua notifikasi dan urutkan berdasarkan timestamp terbaru
        const allNotifications = [
          ...txSuccessItems,
          ...txCancelledItems,
          ...capsterCheckinItems,
          ...capsterShiftEndItems,
        ];

        allNotifications.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        return {
          notifications: allNotifications.slice(0, maxLimit),
          totalCount: allNotifications.length,
        };
      } catch (err) {
        console.error("Gagal mengambil notifikasi owner:", err);
        return {
          notifications: [],
          totalCount: 0,
        };
      }
    },
  );

