import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
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
import { logAudit } from "./audit";
import { sweepExpiredRequestsAndPayments } from "./expiration";
import { calculateQueueEstimations } from "./estimation";

type CreateManualTransactionInput = {
  customerName: string;
  customerPhone?: string;
  notes?: string;
  capsterId: string;
  serviceIds: string[];
  paymentMethod: "tunai" | "qris" | "transfer";
  cashReceived?: number;
  isQueueOnly?: boolean; // Jika true, hanya dimasukkan ke antrean (waiting)
};

function generateStrukNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STR-${ymd}-${rand}`;
}

/**
 * 1. GET CAPSTER TRANSACTIONS (TENANT & CAPSTER SCOPED)
 */
export const getCapsterTransactions = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            capsterId?: string;
            barbershopSlug?: string;
            barbershopId?: string;
            todayOnly?: boolean;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => {
    let targetShopId = data?.barbershopId;
    if (data?.barbershopSlug) {
      const [shop] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);
      if (!shop) return [];
      targetShopId = shop.id_barbershop;
    }

    // Jalankan background expiration sweeper untuk barbershop ini
    await sweepExpiredRequestsAndPayments(targetShopId);

    const targetCapsterId = data?.capsterId?.trim();
    if (!targetCapsterId) {
      return [];
    }

    const conditions = [
      or(
        eq(transaksi.id_capster, targetCapsterId),
        eq(booking.id_capster, targetCapsterId),
        and(isNull(transaksi.id_booking), eq(shiftCapster.id_capster, targetCapsterId)),
        eq(shiftCapster.id_capster, targetCapsterId),
      ),
    ];

    if (targetShopId) {
      conditions.push(eq(transaksi.id_barbershop, targetShopId));
    }

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
        id_barbershop: transaksi.id_barbershop,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        id_capster: transaksi.id_capster,
        id_pelanggan: transaksi.id_pelanggan,
        subtotal: transaksi.subtotal,
        discount: transaksi.diskon,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        batas_pembayaran: transaksi.batas_pembayaran,
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

    const bookingIds = rows
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
              cancel_reason: booking.cancel_reason,
              waktu_permintaan: booking.waktu_permintaan,
              batas_konfirmasi: booking.batas_konfirmasi,
              source: booking.source,
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
              nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
              durasi_menit_snapshot: detailBooking.durasi_menit_snapshot,
              nama_layanan: layanan.nama_layanan,
              harga_satuan: detailBooking.harga_satuan,
              qty: detailBooking.qty,
            })
            .from(detailBooking)
            .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
            .where(inArray(detailBooking.id_booking, bookingIds))
        : Promise.resolve([]),

      rows.length > 0
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
                rows.map((r) => r.id),
              ),
            )
        : Promise.resolve([]),
    ]);

    // Ambil estimasi queue real-time untuk capster ini (menggunakan mesin estimasi yang sama)
    let estimationsMap = new Map<string, any>();
    if (targetShopId && targetCapsterId) {
      try {
        const queueList = await calculateQueueEstimations(targetShopId, targetCapsterId);
        for (const item of queueList) {
          estimationsMap.set(item.bookingId, item);
        }
      } catch (err) {
        console.error("Gagal menghitung queue estimation untuk capster:", err);
      }
    }

    const bookingMap = new Map(bookingsWithCapster.map((b) => [b.id_booking, b]));
    const paymentMap = new Map(allPayments.map((p) => [p.id_transaksi, p]));

    const detailsMap = new Map<
      string,
      {
        service: {
          id: string;
          name: string;
          price: number;
          durationMinutes: number;
          category: string;
        };
        quantity: number;
      }[]
    >();

    allDetails.forEach((d) => {
      const list = detailsMap.get(d.id_booking) || [];
      const duration = (d.durasi_menit_snapshot && d.durasi_menit_snapshot > 0) ? d.durasi_menit_snapshot : 30;
      list.push({
        service: {
          id: d.id_layanan,
          name: d.nama_layanan_snapshot || d.nama_layanan || "Layanan",
          price: Number(d.harga_satuan),
          durationMinutes: duration,
          category: "Layanan",
        },
        quantity: d.qty,
      });
      detailsMap.set(d.id_booking, list);
    });

    return rows.map((r) => {
      const bInfo = r.id_booking ? bookingMap.get(r.id_booking) : null;
      const pay = paymentMap.get(r.id);
      const items = r.id_booking ? detailsMap.get(r.id_booking) || [] : [];
      const serviceNames = items.map((i) => i.service.name).join(" + ") || "Layanan Barbershop";

      const capsterId = r.id_capster || bInfo?.id_capster || targetCapsterId;
      const capsterName = bInfo?.capsterName || "Capster";

      const cashReceived = pay?.referensi?.startsWith("Tunai: ")
        ? Number(pay.referensi.replace("Tunai: ", ""))
        : Number(r.total);

      const change = Math.max(0, cashReceived - Number(r.total));

      let displayStatus: "Selesai" | "Menunggu" | "Sedang Dilayani" | "Batal" | "Kedaluwarsa" = "Menunggu";
      if (r.status_transaksi === "completed" || r.status_transaksi === "paid") {
        displayStatus = "Selesai";
      } else if (r.status_transaksi === "ongoing" || bInfo?.status === "in_service") {
        displayStatus = "Sedang Dilayani";
      } else if (r.status_transaksi === "expired" || bInfo?.status === "expired" || pay?.status_pembayaran === "expired") {
        displayStatus = "Kedaluwarsa";
      } else if (r.status_transaksi === "cancelled" || bInfo?.status === "cancelled" || pay?.status_pembayaran === "failed") {
        displayStatus = "Batal";
      } else {
        displayStatus = "Menunggu";
      }

      // Hubungkan dengan estimation engine
      const est = r.id_booking ? estimationsMap.get(r.id_booking) : null;
      const itemsDuration = items.reduce((s, it) => s + (it.service.durationMinutes * it.quantity), 0);
      const totalDurationMinutes = est?.totalDurationMinutes ?? (itemsDuration > 0 ? itemsDuration : 30);
      const remainingMinutes = est ? est.remainingMinutes : (displayStatus === "Sedang Dilayani" ? totalDurationMinutes : undefined);
      const waitTimeMinutes = est ? est.waitTimeMinutes : undefined;
      const positionInQueue = est ? est.positionInQueue : undefined;

      return {
        id: r.id,
        bookingId: r.id_booking,
        bookingStatus: bInfo?.status ?? "waiting",
        source: bInfo?.source ?? "scan",
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
        paymentMethod: (pay?.metode_pembayaran ?? "tunai") as "tunai" | "qris" | "transfer",
        cashReceived,
        change,
        status: displayStatus,
        notes: bInfo?.cancel_reason ? `Batal: ${bInfo.cancel_reason}` : (bInfo?.catatan ?? undefined),
        capsterId,
        capsterName,
        batasKonfirmasi: bInfo?.batas_konfirmasi?.toISOString() ?? undefined,
        batasPembayaran: r.batas_pembayaran?.toISOString() ?? undefined,
        totalDurationMinutes,
        remainingMinutes,
        waitTimeMinutes,
        positionInQueue,
      };
    });
  });

/**
 * 2. GET DASHBOARD METRICS (TENANT & CAPSTER SCOPED)
 */
export const getDashboardMetrics = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            capsterId?: string;
            userId?: string;
            barbershopSlug?: string;
            barbershopId?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => {
    let targetShopId = data?.barbershopId;
    if (data?.barbershopSlug) {
      const [shop] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);
      if (shop) targetShopId = shop.id_barbershop;
    }

    await sweepExpiredRequestsAndPayments(targetShopId);

    let targetCapsterId = data?.capsterId?.trim();

    if (!targetCapsterId && data?.userId) {
      const [c] = await db
        .select({ id_capster: capster.id_capster, id_barbershop: capster.id_barbershop })
        .from(capster)
        .where(eq(capster.id_user, data.userId))
        .limit(1);
      if (c) {
        targetCapsterId = c.id_capster;
        if (!targetShopId) targetShopId = c.id_barbershop;
      }
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

    const conditions = [
      or(
        eq(transaksi.id_capster, targetCapsterId),
        eq(booking.id_capster, targetCapsterId),
        and(isNull(transaksi.id_booking), eq(shiftCapster.id_capster, targetCapsterId)),
        eq(shiftCapster.id_capster, targetCapsterId),
      ),
      gte(transaksi.created_at, startOfToday),
      lte(transaksi.created_at, endOfToday),
    ];

    if (targetShopId) {
      conditions.push(eq(transaksi.id_barbershop, targetShopId));
    }

    const txs = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        created_at: transaksi.created_at,
        bookingStatus: booking.status,
      })
      .from(transaksi)
      .leftJoin(booking, eq(transaksi.id_booking, booking.id_booking))
      .leftJoin(shiftCapster, eq(transaksi.id_shift, shiftCapster.id_shift))
      .where(and(...conditions));

    const totalTransaksi = txs.length;
    const totalPendapatan = txs.reduce((sum, t) => {
      const isPaid = t.status_transaksi === "completed" || t.status_transaksi === "paid";
      return sum + (isPaid ? Number(t.total) : 0);
    }, 0);

    let totalLayanan = 0;
    let selesai = 0;
    let sedangDikerjakan = 0;
    let menunggu = 0;
    let dibatalkan = 0;

    for (const t of txs) {
      if (t.status_transaksi === "completed" || t.status_transaksi === "paid") {
        selesai++;
      } else if (t.status_transaksi === "ongoing" || t.bookingStatus === "in_service") {
        sedangDikerjakan++;
      } else if (
        t.status_transaksi === "cancelled" ||
        t.status_transaksi === "expired" ||
        t.bookingStatus === "cancelled" ||
        t.bookingStatus === "expired"
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
          t.status_transaksi !== "expired",
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
        sedangDikerjakan,
        menunggu,
        dibatalkan,
      },
      ringkasanHariIni: {
        totalPendapatan,
        totalTransaksi,
        totalLayanan,
        selesai,
        belumSelesai: menunggu + sedangDikerjakan,
      },
    };
  });

/**
 * 3. CREATE MANUAL TRANSACTION (BPMN SECTION N)
 * Pesanan manual Capster HARUS menggunakan mesin estimasi yang sama.
 * Source = 'manual'
 * Snapshot layanan tersimpan permanen.
 */
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
          id_barbershop: targetShopId,
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
          id_barbershop: targetShopId,
          nama_pelanggan: customerName,
          no_hp: customerPhone,
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
          id_barbershop: targetShopId,
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

    // Tentukan apakah transaksi manual langsung selesai atau masuk antrean
    const isCompletedImmediately = !data.isQueueOnly;

    // 5. Create Booking dengan source: 'manual'
    const [bookingRow] = await db
      .insert(booking)
      .values({
        id_pelanggan: pelangganRow.id_pelanggan,
        id_barbershop: targetShopId,
        id_capster: data.capsterId,
        tanggal_booking: now,
        waktu_booking: timeStr,
        status: isCompletedImmediately ? "completed" : "waiting",
        catatan: notes,
        waktu_permintaan: now,
        waktu_konfirmasi: now,
        waktu_mulai_layanan: isCompletedImmediately ? now : null,
        source: "manual",
      })
      .returning();

    if (!bookingRow) {
      throw new Error("Gagal membuat data booking.");
    }

    // 6. Create Detail Booking dengan SNAPSHOT
    for (const s of serviceRows) {
      await db.insert(detailBooking).values({
        id_booking: bookingRow.id_booking,
        id_barbershop: targetShopId,
        id_layanan: s.id_layanan,
        nama_layanan_snapshot: s.nama_layanan,
        durasi_menit_snapshot: s.durasi_menit || 30,
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
        id_capster: data.capsterId,
        id_pelanggan: pelangganRow.id_pelanggan,
        subtotal: String(subtotal),
        diskon: String(discount),
        total: String(total),
        status_transaksi: isCompletedImmediately ? "completed" : "pending",
        waktu_selesai_layanan: isCompletedImmediately ? now : null,
      })
      .returning();

    if (!transaksiRow) {
      throw new Error("Gagal membuat data transaksi.");
    }

    // 8. Create Pembayaran
    await db.insert(pembayaran).values({
      id_barbershop: targetShopId,
      id_transaksi: transaksiRow.id_transaksi,
      metode_pembayaran: data.paymentMethod,
      jumlah_bayar: String(total),
      status_pembayaran: isCompletedImmediately ? "success" : "pending",
      waktu_bayar: isCompletedImmediately ? now : null,
      referensi:
        data.paymentMethod === "tunai" ? `Tunai: ${cashReceived}` : "Non-tunai",
    });

    // 9. Create Struk jika transaksi selesai
    let no_struk = null;
    if (isCompletedImmediately) {
      no_struk = generateStrukNumber();
      await db.insert(struk).values({
        id_barbershop: targetShopId,
        id_transaksi: transaksiRow.id_transaksi,
        no_struk,
        tanggal_cetak: now,
      });

      await logAudit({
        barbershopId: targetShopId,
        aksi: "transaction completion",
        entityType: "transaksi",
        entityId: transaksiRow.id_transaksi,
        alasan: "Pesanan manual capster",
      });
    } else {
      await logAudit({
        barbershopId: targetShopId,
        aksi: "create request",
        entityType: "permintaan_layanan",
        entityId: bookingRow.id_booking,
        alasan: "Pesanan manual capster dimasukkan ke antrean",
      });
    }

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
      bookingId: bookingRow.id_booking,
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