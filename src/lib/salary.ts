import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  barbershop,
  booking,
  capster,
  detailBooking,
  layanan,
  pelanggan,
  pembayaran,
  shiftCapster,
  struk,
  transaksi,
  users,
} from "@/db/schema";
import { formatTransactionId } from "@/lib/format";
import { requireOwnerTenant } from "@/lib/auth-session";

export type SalaryPeriod = "today" | "7d" | "30d" | "month" | "all" | "custom";

export type LiveCapsterSalaryItem = {
  id: string;
  capsterId: string;
  name: string;
  noPegawai: string;
  avatarLetter: string;
  period: string;
  transactionCount: number;
  serviceRevenue: number;
};

export type LiveSalarySummary = {
  period: SalaryPeriod;
  periodLabel: string;
  dateRangeText: string;
  totalCapsters: number;
  totalTransactions: number;
  totalRevenue: number;
  capsters: LiveCapsterSalaryItem[];
};

export type LiveCapsterBaseTransaction = {
  id: string;
  transactionNumber: string;
  dateTime: string;
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: "Tunai" | "QRIS" | "Transfer";
  status: "Berhasil" | "Dibatalkan";
  paymentStatus: "Lunas" | "Batal";
  countedInCommission: boolean;
};

function getSalaryDateRange(
  period: SalaryPeriod,
  customStart?: string,
  customEnd?: string,
) {
  const now = new Date();
  const jakartaTodayStr = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let dateRangeText = "";
  let periodLabel = "";

  if (period === "today") {
    startDate = new Date(`${jakartaTodayStr}T00:00:00+07:00`);
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    periodLabel = "Hari Ini";
    dateRangeText = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  } else if (period === "7d") {
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
    periodLabel = "7 Hari Terakhir";
    dateRangeText = `${startDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jakarta",
    })} - ${endDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    })}`;
  } else if (period === "30d") {
    endDate = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    periodLabel = "30 Hari Terakhir";
    dateRangeText = `${startDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jakarta",
    })} - ${endDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    })}`;
  } else if (period === "month") {
    const [y, m] = jakartaTodayStr.split("-").map(Number);
    const yVal = y ?? now.getFullYear();
    const mVal = m ?? (now.getMonth() + 1);
    const daysInMonth = new Date(yVal, mVal, 0).getDate();
    const mStr = String(mVal).padStart(2, "0");
    const lastDayStr = String(daysInMonth).padStart(2, "0");
    startDate = new Date(`${yVal}-${mStr}-01T00:00:00+07:00`);
    endDate = new Date(`${yVal}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);
    const monthName = startDate.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    periodLabel = `Bulan Ini (${monthName})`;
    dateRangeText = `1 - ${daysInMonth} ${monthName}`;
  } else if (period === "custom" && customStart && customEnd) {
    startDate = new Date(`${customStart}T00:00:00+07:00`);
    endDate = new Date(`${customEnd}T23:59:59.999+07:00`);
    periodLabel = "Periode Khusus";
    dateRangeText = `${startDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} - ${endDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  } else {
    // "all" or fallback
    startDate = null;
    endDate = null;
    periodLabel = "Semua Periode";
    dateRangeText = "Semua Transaksi";
  }

  return { startDate, endDate, periodLabel, dateRangeText };
}

// 1. Get Live Salary & Commission Summary for All Capsters
export const getOwnerSalaryData = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            period?: SalaryPeriod;
            startDate?: string;
            endDate?: string;
            barbershopSlug?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }): Promise<LiveSalarySummary> => {
    let barbershopId: string | null = null;
    try {
      const tenant = requireOwnerTenant();
      barbershopId = tenant.barbershopId;
    } catch {
      // Direct access or fallback from URL slug
    }

    if (!barbershopId && data?.barbershopSlug) {
      const [found] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);
      if (found) {
        barbershopId = found.id_barbershop;
      }
    }

    const period = data?.period || "month";
    const { startDate, endDate, periodLabel, dateRangeText } =
      getSalaryDateRange(period, data?.startDate, data?.endDate);

    if (!barbershopId) {
      return {
        period,
        periodLabel,
        dateRangeText,
        totalCapsters: 0,
        totalTransactions: 0,
        totalRevenue: 0,
        capsters: [],
      };
    }

    // Fetch active capsters strictly from current owner's barbershop
    const capsterRows = await db
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
        and(
          eq(capster.status, "active"),
          eq(capster.id_barbershop, barbershopId),
        ),
      )
      .orderBy(capster.no_pegawai);

    // Build conditions for transactions strictly scoped to current owner's barbershop
    const txConditions = [
      inArray(transaksi.status_transaksi, ["paid", "completed"]),
      eq(transaksi.id_barbershop, barbershopId),
    ];
    if (startDate) {
      txConditions.push(gte(transaksi.created_at, startDate));
    }
    if (endDate) {
      txConditions.push(lte(transaksi.created_at, endDate));
    }

    // Query paid transactions in period
    const txRows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        bookingCapsterId: booking.id_capster,
        shiftCapsterId: shiftCapster.id_capster,
      })
      .from(transaksi)
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(and(...txConditions));

    // Map transactions to capsters
    const statsMap = new Map<
      string,
      {
        transactionCount: number;
        serviceRevenue: number;
      }
    >();

    capsterRows.forEach((c) => {
      statsMap.set(c.id_capster, {
        transactionCount: 0,
        serviceRevenue: 0,
      });
    });

    for (const tx of txRows) {
      const capsterId = tx.bookingCapsterId || tx.shiftCapsterId;
      if (capsterId && statsMap.has(capsterId)) {
        const stat = statsMap.get(capsterId)!;
        stat.transactionCount += 1;
        stat.serviceRevenue += Number(tx.total || 0);
      }
    }

    const capsterResults: LiveCapsterSalaryItem[] = capsterRows.map((c) => {
      const stat = statsMap.get(c.id_capster) || {
        transactionCount: 0,
        serviceRevenue: 0,
      };

      return {
        id: c.id_capster,
        capsterId: c.id_capster,
        name: c.nama_lengkap,
        noPegawai: c.no_pegawai || "CAP-000",
        avatarLetter: (c.nama_lengkap.trim()[0] || "C").toUpperCase(),
        period: periodLabel,
        transactionCount: stat.transactionCount,
        serviceRevenue: stat.serviceRevenue,
      };
    });

    const totalCapsters = capsterResults.length;
    const totalTransactions = capsterResults.reduce(
      (acc, c) => acc + c.transactionCount,
      0,
    );
    const totalRevenue = capsterResults.reduce(
      (acc, c) => acc + c.serviceRevenue,
      0,
    );

    return {
      period,
      periodLabel,
      dateRangeText,
      totalCapsters,
      totalTransactions,
      totalRevenue,
      capsters: capsterResults,
    };
  });

// 2. Get Live Base Transactions for a specific Capster
export const getOwnerCapsterBaseTransactions = createServerFn({
  method: "GET",
})
  .validator(
    (data: {
      capsterId: string;
      period?: SalaryPeriod;
      startDate?: string;
      endDate?: string;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<LiveCapsterBaseTransaction[]> => {
    let barbershopId: string | null = null;
    try {
      const tenant = requireOwnerTenant();
      barbershopId = tenant.barbershopId;
    } catch {
      // Fallback from slug
    }

    if (!barbershopId && data?.barbershopSlug) {
      const [found] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);
      if (found) {
        barbershopId = found.id_barbershop;
      }
    }

    if (!barbershopId) {
      return [];
    }

    const { capsterId, period = "all", startDate: customStart, endDate: customEnd } = data;
    const { startDate, endDate } = getSalaryDateRange(
      period,
      customStart,
      customEnd,
    );

    // Verify capster belongs to this tenant
    const [capsterCheck] = await db
      .select({ id_capster: capster.id_capster })
      .from(capster)
      .where(
        and(
          eq(capster.id_capster, capsterId),
          eq(capster.id_barbershop, barbershopId),
        ),
      )
      .limit(1);

    if (!capsterCheck) {
      throw new Error("Capster tidak ditemukan atau bukan staf dari toko Anda.");
    }

    // Match transactions for this capster strictly for this barbershop
    const txConditions = [eq(transaksi.id_barbershop, barbershopId)];
    if (startDate) {
      txConditions.push(gte(transaksi.created_at, startDate));
    }
    if (endDate) {
      txConditions.push(lte(transaksi.created_at, endDate));
    }

    const txRows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
        customerName: users.nama_lengkap,
        bookingCapsterId: booking.id_capster,
        shiftCapsterId: shiftCapster.id_capster,
      })
      .from(transaksi)
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .leftJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
      .leftJoin(users, eq(pelanggan.id_user, users.id_user))
      .where(and(...txConditions))
      .orderBy(desc(transaksi.created_at));

    // Filter to this capster
    const capsterTxs = txRows.filter((tx) => {
      const match =
        tx.bookingCapsterId === capsterId || tx.shiftCapsterId === capsterId;
      return match;
    });

    if (capsterTxs.length === 0) {
      return [];
    }

    const txIds = capsterTxs.map((t) => t.id_transaksi);
    const bookingIds = capsterTxs
      .map((t) => t.id_booking)
      .filter((b): b is string => Boolean(b));

    // Batch fetch payments
    const payments =
      txIds.length > 0
        ? await db
            .select({
              id_transaksi: pembayaran.id_transaksi,
              metode_pembayaran: pembayaran.metode_pembayaran,
              status_pembayaran: pembayaran.status_pembayaran,
            })
            .from(pembayaran)
            .where(inArray(pembayaran.id_transaksi, txIds))
        : [];

    // Batch fetch services
    const services =
      bookingIds.length > 0
        ? await db
            .select({
              id_booking: detailBooking.id_booking,
              nama_layanan: layanan.nama_layanan,
            })
            .from(detailBooking)
            .innerJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
            .where(inArray(detailBooking.id_booking, bookingIds))
        : [];

    // Batch fetch receipts
    const receipts =
      txIds.length > 0
        ? await db
            .select({
              id_transaksi: struk.id_transaksi,
              no_struk: struk.no_struk,
            })
            .from(struk)
            .where(inArray(struk.id_transaksi, txIds))
        : [];

    return capsterTxs.map((tx) => {
      const pay = payments.find((p) => p.id_transaksi === tx.id_transaksi);
      const strk = receipts.find((s) => s.id_transaksi === tx.id_transaksi);
      const bookingServices = services
        .filter((s) => s.id_booking === tx.id_booking)
        .map((s) => s.nama_layanan);

      const serviceName =
        bookingServices.length > 0
          ? bookingServices.join(", ")
          : "Potong Rambut (Gentle Cut)";

      const rawMethod = (pay?.metode_pembayaran || "tunai").toLowerCase();
      let paymentMethod: "Tunai" | "QRIS" | "Transfer" = "Tunai";
      if (rawMethod === "qris") paymentMethod = "QRIS";
      else if (rawMethod === "transfer") paymentMethod = "Transfer";

      const isPaid =
        tx.status_transaksi === "paid" || tx.status_transaksi === "completed";
      const isCancelled =
        tx.status_transaksi === "cancelled" || tx.status_transaksi === "refunded";

      const dateStr = tx.created_at.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });
      const timeStr = tx.created_at.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });

      const txNumber =
        strk?.no_struk || formatTransactionId(tx.id_transaksi, tx.created_at);

      return {
        id: tx.id_transaksi,
        transactionNumber: txNumber,
        dateTime: `${dateStr} ${timeStr}`,
        customerName: tx.customerName || "Pelanggan Umum",
        serviceName,
        amount: Number(tx.total || 0),
        paymentMethod,
        status: isCancelled ? "Dibatalkan" : "Berhasil",
        paymentStatus: isCancelled ? "Batal" : "Lunas",
        countedInCommission: isPaid,
      };
    });
  });
