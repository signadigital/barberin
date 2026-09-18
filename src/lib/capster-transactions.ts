import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
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
import { getWibTimeString } from "@/lib/format";
import {
  autoCancelExpiredPendingTransactions,
  isTransactionExpired,
  CANCEL_REASON_DETAIL,
} from "@/lib/auto-cancel";

type CreateManualTransactionInput = {
  customerName: string;
  customerPhone?: string;
  notes?: string;
  capsterId: string;
  serviceIds: string[];
  paymentMethod: "tunai" | "qris" | "transfer";
  cashReceived?: number;
};

function generateStrukNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STR-${ymd}-${rand}`;
}

export const getCapsterTransactions = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            capsterId?: string;
            todayOnly?: boolean;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => {
    // 0. Auto-cancel seluruh transaksi pending yang telah melebihi 2 jam
    await autoCancelExpiredPendingTransactions();

    const targetCapsterId = data?.capsterId?.trim();
    if (!targetCapsterId) {
      return [];
    }

    const conditions = [
      or(
        eq(booking.id_capster, targetCapsterId),
        and(isNull(transaksi.id_booking), eq(shiftCapster.id_capster, targetCapsterId)),
        eq(shiftCapster.id_capster, targetCapsterId),
      ),
    ];

    if (data?.todayOnly) {
      const jakartaDateStr = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });
      const startOfToday = new Date(`${jakartaDateStr}T00:00:00+07:00`);
      const endOfToday = new Date(`${jakartaDateStr}T23:59:59.999+07:00`);
      conditions.push(gte(transaksi.created_at, startOfToday));
      conditions.push(lte(transaksi.created_at, endOfToday));
    }

    const rows = await db
      .select({
        id: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        id_pelanggan: transaksi.id_pelanggan,
        subtotal: transaksi.subtotal,
        discount: transaksi.diskon,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
        customerName: users.nama_lengkap,
        customerPhone: users.no_hp,
      })
      .from(transaksi)
      .innerJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
      .innerJoin(users, eq(pelanggan.id_user, users.id_user))
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(and(...conditions))
      .orderBy(desc(transaksi.created_at));

    if (rows.length === 0) return [];

    const filteredRows = rows;
    const bookingIds = filteredRows
      .map((r) => r.id_booking)
      .filter((b): b is string => Boolean(b));

    const [bookingsWithCapster, allDetails, allPayments] = await Promise.all([
      bookingIds.length > 0
        ? db
            .select({
              id_booking: booking.id_booking,
              id_capster: booking.id_capster,
              status: booking.status,
              catatan: booking.catatan,
              capsterName: users.nama_lengkap,
            })
            .from(booking)
            .leftJoin(capster, eq(booking.id_capster, capster.id_capster))
            .leftJoin(users, eq(capster.id_user, users.id_user))
            .where(inArray(booking.id_booking, bookingIds))
        : Promise.resolve([]),

      bookingIds.length > 0
        ? db
            .select({
              id_booking: detailBooking.id_booking,
              id_layanan: detailBooking.id_layanan,
              nama_layanan: layanan.nama_layanan,
              harga_satuan: detailBooking.harga_satuan,
              qty: detailBooking.qty,
            })
            .from(detailBooking)
            .innerJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
            .where(inArray(detailBooking.id_booking, bookingIds))
        : Promise.resolve([]),

      filteredRows.length > 0
        ? db
            .select({
              id_transaksi: pembayaran.id_transaksi,
              metode_pembayaran: pembayaran.metode_pembayaran,
              status_pembayaran: pembayaran.status_pembayaran,
              referensi: pembayaran.referensi,
            })
            .from(pembayaran)
            .where(
              inArray(
                pembayaran.id_transaksi,
                filteredRows.map((r) => r.id),
              ),
            )
        : Promise.resolve([]),
    ]);

    const bookingMap = new Map(bookingsWithCapster.map((b) => [b.id_booking, b]));
    const detailsMap = new Map<
      string,
      Array<{
        service: {
          id: string;
          name: string;
          price: number;
          category: string;
        };
        quantity: number;
      }>
    >();

    allDetails.forEach((d) => {
      const list = detailsMap.get(d.id_booking) ?? [];
      list.push({
        service: {
          id: d.id_layanan,
          name: d.nama_layanan,
          price: Number(d.harga_satuan),
          category: "Barbershop",
        },
        quantity: d.qty,
      });
      detailsMap.set(d.id_booking, list);
    });

    const paymentMap = new Map(allPayments.map((p) => [p.id_transaksi, p]));

    return filteredRows.map((r) => {
      const bInfo = r.id_booking ? bookingMap.get(r.id_booking) : null;
      const capsterName = bInfo?.capsterName ?? "Capster";
      const capsterId = bInfo?.id_capster ?? targetCapsterId;

      const items = r.id_booking ? (detailsMap.get(r.id_booking) ?? []) : [];
      const serviceNames =
        items.length > 0
          ? items.map((i) => i.service.name).join(" + ")
          : "Layanan Barbershop";

      const pay = paymentMap.get(r.id);
      const cashReceived = pay?.referensi?.startsWith("Tunai: ")
        ? Number(pay.referensi.replace("Tunai: ", ""))
        : Number(r.total);

      const change = Math.max(0, cashReceived - Number(r.total));

      const isExpired = isTransactionExpired(r.created_at, r.status_transaksi);

      let displayStatus: "Selesai" | "Menunggu" | "Batal" = "Menunggu";
      if (r.status_transaksi === "paid") {
        displayStatus = "Selesai";
      } else if (
        r.status_transaksi === "cancelled" ||
        bInfo?.status === "cancelled" ||
        pay?.status_pembayaran === "failed" ||
        isExpired
      ) {
        displayStatus = "Batal";
      }

      return {
        id: r.id,
        date: r.created_at.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }),
        time: r.created_at.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }),
        customerName: r.customerName,
        customerId: r.id_pelanggan,
        customerPhone: r.customerPhone ?? undefined,
        items,
        serviceNames,
        subtotal: Number(r.subtotal),
        discount: Number(r.discount),
        total: Number(r.total),
        paymentMethod: (pay?.metode_pembayaran ?? "tunai") as
          | "tunai"
          | "qris"
          | "transfer",
        cashReceived,
        change,
        status: displayStatus,
        notes: isExpired || displayStatus === "Batal"
          ? (bInfo?.catatan || CANCEL_REASON_DETAIL)
          : (bInfo?.catatan ?? undefined),
        capsterId,
        capsterName,
      };
    });
  });

export const getDashboardMetrics = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            capsterId?: string;
            userId?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => {
    // 0. Auto-cancel seluruh transaksi pending yang telah melebihi 2 jam
    await autoCancelExpiredPendingTransactions();

    let targetCapsterId = data?.capsterId?.trim();

    if (!targetCapsterId && data?.userId) {
      const [c] = await db
        .select({ id_capster: capster.id_capster })
        .from(capster)
        .where(eq(capster.id_user, data.userId))
        .limit(1);
      if (c) targetCapsterId = c.id_capster;
    }

    if (!targetCapsterId) {
      return {
        totalTransaksi: 0,
        deltaTransaksi: "Hari ini",
        totalPendapatan: 0,
        deltaPendapatan: "Hari ini",
        totalLayanan: 0,
        deltaLayanan: "Hari ini",
        capsterAktif: 0,
        deltaCapster: "Belum Aktif",
        statusLayanan: {
          selesai: 0,
          sedangDikerjakan: 0,
          menunggu: 0,
          dibatalkan: 0,
        },
        ringkasanHariIni: {
          totalPendapatan: 0,
          totalTransaksi: 0,
          totalLayanan: 0,
          selesai: 0,
          belumSelesai: 0,
        },
      };
    }

    const jakartaDateStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta",
    });
    const startOfToday = new Date(`${jakartaDateStr}T00:00:00+07:00`);
    const endOfToday = new Date(`${jakartaDateStr}T23:59:59.999+07:00`);

    const txs = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
      })
      .from(transaksi)
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(
        and(
          or(
            eq(booking.id_capster, targetCapsterId),
            and(isNull(transaksi.id_booking), eq(shiftCapster.id_capster, targetCapsterId)),
            eq(shiftCapster.id_capster, targetCapsterId),
          ),
          gte(transaksi.created_at, startOfToday),
          lte(transaksi.created_at, endOfToday),
        ),
      );

    const totalTransaksi = txs.length;
    const totalPendapatan = txs.reduce((sum, t) => {
      return sum + (t.status_transaksi === "paid" ? Number(t.total) : 0);
    }, 0);

    let totalLayanan = 0;
    let selesai = 0;
    let menunggu = 0;
    let dibatalkan = 0;

    for (const t of txs) {
      const isExpired = isTransactionExpired(t.created_at, t.status_transaksi);
      if (t.status_transaksi === "paid") {
        selesai++;
      } else if (
        t.status_transaksi === "cancelled" ||
        t.status_transaksi === "refunded" ||
        isExpired
      ) {
        dibatalkan++;
      } else {
        menunggu++;
      }
    }

    const bookingIdsForLayanan = txs
      .filter(
        (t) =>
          t.id_booking &&
          t.status_transaksi !== "cancelled" &&
          t.status_transaksi !== "refunded",
      )
      .map((t) => t.id_booking as string);

    if (bookingIdsForLayanan.length > 0) {
      const dbRows = await db
        .select({ qty: detailBooking.qty })
        .from(detailBooking)
        .where(inArray(detailBooking.id_booking, bookingIdsForLayanan));
      totalLayanan = dbRows.reduce((s, d) => s + (d.qty || 1), 0);
    }

    // Dapatkan data barbershop dari capster yang sedang login
    const [currentCapsterRecord] = await db
      .select({
        id_capster: capster.id_capster,
        id_barbershop: capster.id_barbershop,
      })
      .from(capster)
      .where(eq(capster.id_capster, targetCapsterId))
      .limit(1);

    let capsterAktif = 0;
    let isSelfActive = false;

    if (currentCapsterRecord?.id_barbershop) {
      // Hitung seluruh capster yang sedang aktif (shift status 'ongoing') di barbershop ini
      const activeShiftsInShop = await db
        .select({ id_capster: shiftCapster.id_capster })
        .from(shiftCapster)
        .innerJoin(capster, eq(shiftCapster.id_capster, capster.id_capster))
        .where(
          and(
            eq(capster.id_barbershop, currentCapsterRecord.id_barbershop),
            eq(shiftCapster.status, "ongoing"),
          ),
        );

      const uniqueActiveCapsterIds = new Set(activeShiftsInShop.map((s) => s.id_capster));
      capsterAktif = uniqueActiveCapsterIds.size;
      isSelfActive = uniqueActiveCapsterIds.has(targetCapsterId);
    } else {
      const activeShift = await db
        .select({ id: shiftCapster.id_shift })
        .from(shiftCapster)
        .where(
          and(
            eq(shiftCapster.id_capster, targetCapsterId),
            eq(shiftCapster.status, "ongoing"),
          ),
        )
        .limit(1);

      capsterAktif = activeShift.length > 0 ? 1 : 0;
      isSelfActive = activeShift.length > 0;
    }

    return {
      totalTransaksi,
      deltaTransaksi: `Hari ini`,
      totalPendapatan,
      deltaPendapatan: `Hari ini`,
      totalLayanan,
      deltaLayanan: `Hari ini`,
      capsterAktif,
      deltaCapster: isSelfActive ? `Shift Aktif` : `Belum Check In`,
      statusLayanan: {
        selesai,
        sedangDikerjakan: 0,
        menunggu,
        dibatalkan,
      },
      ringkasanHariIni: {
        totalPendapatan,
        totalTransaksi,
        totalLayanan,
        selesai,
        belumSelesai: menunggu,
      },
    };
  });

export const createManualTransaction = createServerFn({
  method: "POST",
})
  .validator((data: CreateManualTransactionInput) => data)
  .handler(async ({ data }) => {
    const customerName = data.customerName.trim() || "Pelanggan Umum";
    const customerPhone = data.customerPhone?.trim() || null;
    const notes = data.notes?.trim() || null;

    if (!data.capsterId) {
      throw new Error("Capster belum dipilih.");
    }
    if (data.serviceIds.length === 0) {
      throw new Error("Minimal pilih satu layanan.");
    }

    // 1. Get Capster & Barbershop
    const [capsterRecord] = await db
      .select({
        id_capster: capster.id_capster,
        id_barbershop: capster.id_barbershop,
      })
      .from(capster)
      .where(eq(capster.id_capster, data.capsterId))
      .limit(1);

    if (!capsterRecord) {
      throw new Error("Capster tidak ditemukan.");
    }

    const targetShopId = capsterRecord.id_barbershop;

    // 2. Find or Create User & Pelanggan
    let userRow;
    if (customerPhone) {
      const existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.no_hp, customerPhone), eq(users.role, "pelanggan")))
        .limit(1);
      userRow = existingUser[0];
    }

    if (!userRow) {
      const email = `manual.${Date.now()}.${Math.floor(Math.random() * 1000)}@barberin.local`;
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          nama_lengkap: customerName,
          no_hp: customerPhone,
          role: "pelanggan",
          status: "active",
        })
        .returning();
      userRow = newUser;
    }

    if (!userRow) {
      throw new Error("Gagal memproses akun pengguna.");
    }

    let [pelangganRow] = await db
      .select()
      .from(pelanggan)
      .where(eq(pelanggan.id_user, userRow.id_user))
      .limit(1);

    if (!pelangganRow) {
      [pelangganRow] = await db
        .insert(pelanggan)
        .values({
          id_user: userRow.id_user,
        })
        .returning();
    }

    if (!pelangganRow) {
      throw new Error("Gagal memproses data pelanggan.");
    }

    // 3. Find or Create active shift for capster
    let [activeShift] = await db
      .select()
      .from(shiftCapster)
      .where(
        and(
          eq(shiftCapster.id_capster, data.capsterId),
          eq(shiftCapster.status, "ongoing"),
        ),
      )
      .limit(1);

    if (!activeShift) {
      const now = new Date();
      const timeStr = getWibTimeString(now);
      [activeShift] = await db
        .insert(shiftCapster)
        .values({
          id_capster: data.capsterId,
          tanggal: now,
          waktu_mulai: timeStr,
          status: "ongoing",
          total_transaksi: 0,
          total_pendapatan: "0",
        })
        .returning();
    }

    if (!activeShift) {
      throw new Error("Gagal memproses shift capster.");
    }

    // 4. Fetch services belonging to this barbershop
    const serviceRows = await db
      .select()
      .from(layanan)
      .where(
        and(
          inArray(layanan.id_layanan, data.serviceIds),
          eq(layanan.id_barbershop, targetShopId),
        ),
      );

    if (serviceRows.length === 0) {
      throw new Error("Layanan tidak ditemukan.");
    }

    const subtotal = serviceRows.reduce((sum, s) => sum + Number(s.harga), 0);
    const discount = 0;
    const total = subtotal - discount;

    if (data.paymentMethod === "tunai") {
      const received = data.cashReceived ?? total;
      if (received < total) {
        throw new Error("Jumlah uang yang diterima belum mencukupi.");
      }
    }

    const cashReceived =
      data.paymentMethod === "tunai"
        ? Math.max(data.cashReceived ?? total, total)
        : total;

    const change = Math.max(0, cashReceived - total);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 5. Create Booking
    const [bookingRow] = await db
      .insert(booking)
      .values({
        id_pelanggan: pelangganRow.id_pelanggan,
        id_barbershop: targetShopId,
        id_capster: data.capsterId,
        tanggal_booking: now,
        waktu_booking: timeStr,
        status: "completed",
        catatan: notes,
      })
      .returning();

    if (!bookingRow) {
      throw new Error("Gagal membuat data booking.");
    }

    // 6. Create Detail Booking
    for (const s of serviceRows) {
      await db.insert(detailBooking).values({
        id_booking: bookingRow.id_booking,
        id_layanan: s.id_layanan,
        harga_satuan: String(s.harga),
        qty: 1,
        subtotal: String(s.harga),
      });
    }

    // 7. Create Transaksi
    const [transaksiRow] = await db
      .insert(transaksi)
      .values({
        id_barbershop: targetShopId,
        id_booking: bookingRow.id_booking,
        id_shift: activeShift.id_shift,
        id_pelanggan: pelangganRow.id_pelanggan,
        subtotal: String(subtotal),
        diskon: String(discount),
        total: String(total),
        status_transaksi: "paid",
      })
      .returning();

    if (!transaksiRow) {
      throw new Error("Gagal membuat data transaksi.");
    }

    // 8. Create Pembayaran
    await db.insert(pembayaran).values({
      id_transaksi: transaksiRow.id_transaksi,
      metode_pembayaran: data.paymentMethod,
      jumlah_bayar: String(total),
      status_pembayaran: "success",
      waktu_bayar: now,
      referensi:
        data.paymentMethod === "tunai" ? `Tunai: ${cashReceived}` : "Non-tunai",
    });

    // 9. Create Struk
    const no_struk = generateStrukNumber();
    await db.insert(struk).values({
      id_transaksi: transaksiRow.id_transaksi,
      no_struk,
      tanggal_cetak: now,
    });

    // Fetch capster name
    const [capsterUser] = await db
      .select({ nama_lengkap: users.nama_lengkap })
      .from(capster)
      .innerJoin(users, eq(capster.id_user, users.id_user))
      .where(eq(capster.id_capster, data.capsterId))
      .limit(1);

    return {
      success: true,
      transactionId: transaksiRow.id_transaksi,
      noStruk: no_struk,
      customerId: pelangganRow.id_pelanggan,
      customerName: userRow.nama_lengkap,
      capsterId: data.capsterId,
      capsterName: capsterUser?.nama_lengkap ?? "Capster",
      subtotal,
      discount,
      total,
      paymentMethod: data.paymentMethod,
      cashReceived,
      change,
      serviceNames: serviceRows.map((s) => s.nama_layanan).join(" + "),
    };
  });