import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import { calculateQueueEstimations, getBookingEstimation } from "./estimation";

type CreateBookingInput = {
  customerName: string;
  customerPhone?: string | undefined;
  capsterId: string;
  items: { serviceId: string; quantity: number }[];
  paymentMethod: "tunai" | "qris" | "transfer";
  barbershopId?: string | undefined;
  barbershopSlug?: string | undefined;
  source?: "scan" | "manual";
};

function generateStrukNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STR-${ymd}-${rand}`;
}

/**
 * 1. PELANGGAN MEMBUAT PERMINTAAN LAYANAN (BPMN)
 * Status awal: pending_confirmation
 * Batas konfirmasi: 5 menit dari waktu_permintaan
 */
export const createCustomerBookingAndTransaction = createServerFn({
  method: "POST",
})
  .validator((data: CreateBookingInput) => data)
  .handler(async ({ data }) => {
    const customerName = data.customerName.trim() || "Pelanggan Umum";
    const customerPhone = data.customerPhone?.trim() || null;

    if (!data.capsterId) {
      throw new Error("Capster wajib dipilih.");
    }
    if (!data.items || data.items.length === 0) {
      throw new Error("Minimal pilih satu layanan.");
    }

    // 1. Resolve Barbershop strictly (NO default fallback!)
    let shop;
    if (data.barbershopId) {
      const [found] = await db
        .select()
        .from(barbershop)
        .where(
          and(
            eq(barbershop.id_barbershop, data.barbershopId),
            eq(barbershop.status, "active"),
          ),
        )
        .limit(1);
      shop = found;
    } else if (data.barbershopSlug) {
      const [found] = await db
        .select()
        .from(barbershop)
        .where(
          and(
            eq(barbershop.slug, data.barbershopSlug),
            eq(barbershop.status, "active"),
          ),
        )
        .limit(1);
      shop = found;
    }

    if (!shop) {
      throw new Error("Barbershop tidak ditemukan atau sedang tidak aktif.");
    }

    // 2. Verifikasi Capster berada di barbershop ini
    const [capsterRecord] = await db
      .select({ id_capster: capster.id_capster, nama_capster: capster.nama_capster })
      .from(capster)
      .where(
        and(
          eq(capster.id_capster, data.capsterId),
          eq(capster.id_barbershop, shop.id_barbershop),
        ),
      )
      .limit(1);

    if (!capsterRecord) {
      throw new Error("Capster tidak valid untuk barbershop ini.");
    }

    // 3. Find or Create User & Pelanggan with tenant isolation (id_barbershop)
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
      const email = `pelanggan.${Date.now()}.${Math.floor(Math.random() * 1000)}@barberin.local`;
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          nama_lengkap: customerName,
          no_hp: customerPhone,
          role: "pelanggan",
          status: "active",
          id_barbershop: shop.id_barbershop,
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
          id_barbershop: shop.id_barbershop,
          nama_pelanggan: customerName,
          no_hp: customerPhone,
        })
        .returning();
    }

    if (!pelangganRow) {
      throw new Error("Gagal memproses data pelanggan.");
    }

    // 4. Find or create active shift for selected capster
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
          id_barbershop: shop.id_barbershop,
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

    // 5. Fetch service details to calculate prices & SNAPSHOTS
    const serviceIds = data.items.map((i) => i.serviceId);
    const serviceRows = await db
      .select()
      .from(layanan)
      .where(
        and(
          inArray(layanan.id_layanan, serviceIds),
          eq(layanan.id_barbershop, shop.id_barbershop),
        ),
      );

    if (serviceRows.length === 0) {
      throw new Error("Layanan tidak valid untuk barbershop ini.");
    }

    let subtotalNum = 0;
    const itemsToInsert: {
      serviceId: string;
      serviceName: string;
      durationMinutes: number;
      price: number;
      qty: number;
      subtotal: number;
    }[] = [];

    for (const item of data.items) {
      const svc = serviceRows.find((s) => s.id_layanan === item.serviceId);
      if (svc) {
        const p = Number(svc.harga);
        const st = p * item.quantity;
        subtotalNum += st;
        itemsToInsert.push({
          serviceId: svc.id_layanan,
          serviceName: svc.nama_layanan,
          durationMinutes: svc.durasi_menit || 30,
          price: p,
          qty: item.quantity,
          subtotal: st,
        });
      }
    }

    const discountNum = 0;
    const totalNum = subtotalNum - discountNum;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    // Batas konfirmasi: tepat 5 menit dari waktu permintaan
    const batasKonfirmasi = new Date(now.getTime() + 5 * 60 * 1000);

    // 6. Create Permintaan Layanan (Booking)
    const [bookingRow] = await db
      .insert(booking)
      .values({
        id_pelanggan: pelangganRow.id_pelanggan,
        id_barbershop: shop.id_barbershop,
        id_capster: data.capsterId,
        tanggal_booking: now,
        waktu_booking: timeStr,
        status: "pending_confirmation",
        waktu_permintaan: now,
        batas_konfirmasi: batasKonfirmasi,
        source: data.source || "scan",
      })
      .returning();

    if (!bookingRow) {
      throw new Error("Gagal membuat data permintaan layanan.");
    }

    // 7. Create Detail Permintaan (dengan SNAPSHOT nama dan durasi)
    for (const item of itemsToInsert) {
      await db.insert(detailBooking).values({
        id_booking: bookingRow.id_booking,
        id_barbershop: shop.id_barbershop,
        id_layanan: item.serviceId,
        nama_layanan_snapshot: item.serviceName,
        durasi_menit_snapshot: item.durationMinutes,
        harga_satuan: String(item.price),
        qty: item.qty,
        subtotal: String(item.subtotal),
      });
    }

    // 8. Create Transaksi
    const [transaksiRow] = await db
      .insert(transaksi)
      .values({
        id_barbershop: shop.id_barbershop,
        id_booking: bookingRow.id_booking,
        id_shift: activeShift.id_shift,
        id_pelanggan: pelangganRow.id_pelanggan,
        id_capster: data.capsterId,
        subtotal: String(subtotalNum),
        diskon: String(discountNum),
        total: String(totalNum),
        status_transaksi: "pending",
      })
      .returning();

    if (!transaksiRow) {
      throw new Error("Gagal membuat data transaksi.");
    }

    // 9. Create Pembayaran
    await db
      .insert(pembayaran)
      .values({
        id_barbershop: shop.id_barbershop,
        id_transaksi: transaksiRow.id_transaksi,
        metode_pembayaran: data.paymentMethod,
        jumlah_bayar: String(totalNum),
        status_pembayaran: "pending",
      })
      .returning();

    // 10. Catat Audit Log
    await logAudit({
      barbershopId: shop.id_barbershop,
      userId: userRow.id_user,
      aksi: "create request",
      entityType: "permintaan_layanan",
      entityId: bookingRow.id_booking,
    });

    // Fetch capster user name
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
      bookingStatus: "pending_confirmation",
      batasKonfirmasi: batasKonfirmasi.toISOString(),
      customerId: pelangganRow.id_pelanggan,
      customerName: userRow.nama_lengkap,
      capsterId: data.capsterId,
      capsterName: capsterUser?.nama_lengkap ?? "Capster",
      total: totalNum,
      subtotal: subtotalNum,
      paymentMethod: data.paymentMethod,
      serviceNames: itemsToInsert.map((i) => i.serviceName).join(" + "),
      createdAt: now.toISOString(),
    };
  });

/**
 * 2. CAPSTER MENGONFIRMASI PERMINTAAN LAYANAN (BPMN)
 * Batas: maksimal 5 menit dari waktu_permintaan.
 * Jika > 5 menit -> EXPIRED (tidak masuk estimasi).
 * Jika dikonfirmasi -> status WAITING dan hitung estimasi awal.
 */
export const capsterConfirmBooking = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      bookingId: string;
      capsterId?: string;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    // 0. Jalankan pembersihan background expiration
    await sweepExpiredRequestsAndPayments();

    const [b] = await db
      .select()
      .from(booking)
      .where(eq(booking.id_booking, data.bookingId))
      .limit(1);

    if (!b) {
      throw new Error("Permintaan layanan tidak ditemukan.");
    }

    if (data.capsterId && b.id_capster && b.id_capster !== data.capsterId) {
      throw new Error("Akses ditolak. Permintaan layanan ini milik capster lain.");
    }

    const now = new Date();

    // Validasi batas waktu konfirmasi (5 menit)
    const isPastDeadline = b.batas_konfirmasi ? now.getTime() > b.batas_konfirmasi.getTime() : false;
    if (b.status === "expired" || isPastDeadline) {
      if (b.status !== "expired") {
        await db
          .update(booking)
          .set({ status: "expired", updated_at: now })
          .where(eq(booking.id_booking, b.id_booking));

        await logAudit({
          barbershopId: b.id_barbershop,
          aksi: "expire request",
          entityType: "permintaan_layanan",
          entityId: b.id_booking,
          alasan: "Melebihi batas waktu konfirmasi 5 menit",
        });
      }
      throw new Error(
        "Permintaan telah kedaluwarsa (melebihi batas konfirmasi 5 menit) dan tidak dapat dikonfirmasi.",
      );
    }

    if (b.status !== "pending_confirmation") {
      throw new Error(`Permintaan tidak dapat dikonfirmasi karena status saat ini: ${b.status}`);
    }

    // Set status ke WAITING dan catat waktu_konfirmasi
    await db
      .update(booking)
      .set({
        status: "waiting",
        waktu_konfirmasi: now,
        updated_at: now,
      })
      .where(eq(booking.id_booking, b.id_booking));

    // Hitung estimasi waktu tunggu otomatis
    let waitTimeMinutes = 0;
    let estimatedStartTime = now;
    if (b.id_capster) {
      const queue = await calculateQueueEstimations(b.id_barbershop, b.id_capster, now);
      const myEst = queue.find((q) => q.bookingId === b.id_booking);
      if (myEst) {
        waitTimeMinutes = myEst.waitTimeMinutes;
        estimatedStartTime = myEst.estimatedStartTime;
        await db
          .update(booking)
          .set({
            estimasi_tunggu_menit: waitTimeMinutes,
            estimasi_mulai: estimatedStartTime,
          })
          .where(eq(booking.id_booking, b.id_booking));
      }
    }

    // Catat Audit Log
    await logAudit({
      barbershopId: b.id_barbershop,
      aksi: "confirm request",
      entityType: "permintaan_layanan",
      entityId: b.id_booking,
    });

    return {
      success: true,
      bookingId: b.id_booking,
      status: "waiting",
      waitTimeMinutes,
      estimatedStartTime: estimatedStartTime.toISOString(),
    };
  });

/**
 * 3. CAPSTER MEMULAI LAYANAN (BPMN)
 * Status: IN_SERVICE
 * Waktu mulai pelayanan dicatat (waktu_mulai_layanan)
 */
export const capsterStartService = createServerFn({
  method: "POST",
})
  .validator((data: { bookingId: string; capsterId?: string }) => data)
  .handler(async ({ data }) => {
    const [b] = await db
      .select()
      .from(booking)
      .where(eq(booking.id_booking, data.bookingId))
      .limit(1);

    if (!b) {
      throw new Error("Permintaan layanan tidak ditemukan.");
    }

    if (data.capsterId && b.id_capster && b.id_capster !== data.capsterId) {
      throw new Error("Akses ditolak. Layanan ini ditangani oleh capster lain.");
    }

    const now = new Date();

    // Update status booking -> in_service
    await db
      .update(booking)
      .set({
        status: "in_service",
        waktu_mulai_layanan: now,
        updated_at: now,
      })
      .where(eq(booking.id_booking, b.id_booking));

    // Update status transaksi -> ongoing
    await db
      .update(transaksi)
      .set({
        status_transaksi: "ongoing",
        updated_at: now,
      })
      .where(eq(transaksi.id_booking, b.id_booking));

    // Catat Audit Log
    await logAudit({
      barbershopId: b.id_barbershop,
      aksi: "start service",
      entityType: "permintaan_layanan",
      entityId: b.id_booking,
    });

    return {
      success: true,
      bookingId: b.id_booking,
      status: "in_service",
      startedAt: now.toISOString(),
    };
  });

/**
 * 4. PELAYANAN FISIK SELESAI (BPMN)
 * Status: AWAITING_PAYMENT (Bukan completed!)
 * Batas pembayaran: 2 jam setelah pelayanan selesai.
 */
export const capsterFinishService = createServerFn({
  method: "POST",
})
  .validator((data: { bookingId: string; capsterId?: string }) => data)
  .handler(async ({ data }) => {
    const [b] = await db
      .select()
      .from(booking)
      .where(eq(booking.id_booking, data.bookingId))
      .limit(1);

    if (!b) {
      throw new Error("Permintaan layanan tidak ditemukan.");
    }

    if (data.capsterId && b.id_capster && b.id_capster !== data.capsterId) {
      throw new Error("Akses ditolak. Layanan ini ditangani oleh capster lain.");
    }

    const now = new Date();
    // Batas pembayaran: 2 jam dari waktu selesai fisik pelayanan
    const batasPembayaran = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Update status booking -> awaiting_payment
    await db
      .update(booking)
      .set({
        status: "awaiting_payment",
        updated_at: now,
      })
      .where(eq(booking.id_booking, b.id_booking));

    // Update transaksi: simpan waktu_selesai_layanan & batas_pembayaran
    await db
      .update(transaksi)
      .set({
        waktu_selesai_layanan: now,
        batas_pembayaran: batasPembayaran,
        updated_at: now,
      })
      .where(eq(transaksi.id_booking, b.id_booking));

    // Update pembayaran: simpan batas_pembayaran
    const [tx] = await db
      .select({ id_transaksi: transaksi.id_transaksi })
      .from(transaksi)
      .where(eq(transaksi.id_booking, b.id_booking))
      .limit(1);

    if (tx) {
      await db
        .update(pembayaran)
        .set({
          batas_pembayaran: batasPembayaran,
          updated_at: now,
        })
        .where(eq(pembayaran.id_transaksi, tx.id_transaksi));
    }

    // Catat Audit Log
    await logAudit({
      barbershopId: b.id_barbershop,
      aksi: "finish service",
      entityType: "permintaan_layanan",
      entityId: b.id_booking,
    });

    return {
      success: true,
      bookingId: b.id_booking,
      status: "awaiting_payment",
      waktuSelesaiLayanan: now.toISOString(),
      batasPembayaran: batasPembayaran.toISOString(),
    };
  });

/**
 * 5. KONFIRMASI PEMBAYARAN OLEH CAPSTER & GENERATE STRUK (BPMN)
 * Transaksi baru menjadi COMPLETED setelah konfirmasi pembayaran berhasil.
 * Batas waktu: maksimal 2 jam setelah pelayanan selesai.
 */
export const confirmPaymentAndGenerateStruk = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      transactionId: string;
      capsterId?: string;
      cashReceived?: number;
      referensi?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    // 0. Bersihkan transaksi/pembayaran yang telah melebihi batas waktu 2 jam
    await sweepExpiredRequestsAndPayments();

    const [txRecord] = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_barbershop: transaksi.id_barbershop,
        id_booking: transaksi.id_booking,
        id_capster: transaksi.id_capster,
        id_shift: transaksi.id_shift,
        status_transaksi: transaksi.status_transaksi,
        waktu_selesai_layanan: transaksi.waktu_selesai_layanan,
        batas_pembayaran: transaksi.batas_pembayaran,
        created_at: transaksi.created_at,
      })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, data.transactionId))
      .limit(1);

    if (!txRecord) {
      throw new Error("Transaksi tidak ditemukan.");
    }

    // Validasi isolasi Capster
    if (data.capsterId && txRecord.id_capster && txRecord.id_capster !== data.capsterId) {
      throw new Error(
        "Akses ditolak. Anda tidak berhak mengonfirmasi transaksi milik capster lain.",
      );
    }

    const now = new Date();

    // Validasi timeout pembayaran (2 jam)
    const isPaymentTimeout = txRecord.batas_pembayaran
      ? now.getTime() > txRecord.batas_pembayaran.getTime()
      : false;

    if (txRecord.status_transaksi === "expired" || isPaymentTimeout) {
      if (txRecord.status_transaksi !== "expired") {
        await db
          .update(transaksi)
          .set({ status_transaksi: "expired", updated_at: now })
          .where(eq(transaksi.id_transaksi, data.transactionId));

        await db
          .update(pembayaran)
          .set({ status_pembayaran: "expired", updated_at: now })
          .where(eq(pembayaran.id_transaksi, data.transactionId));
      }
      throw new Error(
        "Pembayaran telah kedaluwarsa (melebihi batas waktu 2 jam setelah pelayanan selesai).",
      );
    }

    if (txRecord.status_transaksi === "cancelled") {
      throw new Error("Transaksi tidak dapat dikonfirmasi karena telah dibatalkan.");
    }

    // 1. Update Transaksi -> COMPLETED
    const [updatedTx] = await db
      .update(transaksi)
      .set({
        status_transaksi: "completed",
        updated_at: now,
      })
      .where(eq(transaksi.id_transaksi, data.transactionId))
      .returning();

    if (!updatedTx) {
      throw new Error("Gagal memperbarui transaksi.");
    }

    // 2. Update Pembayaran -> SUCCESS
    let confirmedByUserId: string | null = null;
    if (data.capsterId) {
      const [cUser] = await db
        .select({ id_user: capster.id_user })
        .from(capster)
        .where(eq(capster.id_capster, data.capsterId))
        .limit(1);
      if (cUser) confirmedByUserId = cUser.id_user;
    }

    await db
      .update(pembayaran)
      .set({
        status_pembayaran: "success",
        waktu_bayar: now,
        dikonfirmasi_oleh: confirmedByUserId,
        referensi: data.referensi ?? (data.cashReceived ? `Tunai: ${data.cashReceived}` : null),
        updated_at: now,
      })
      .where(eq(pembayaran.id_transaksi, data.transactionId));

    // 3. Update Booking -> COMPLETED
    if (updatedTx.id_booking) {
      await db
        .update(booking)
        .set({
          status: "completed",
          updated_at: now,
        })
        .where(eq(booking.id_booking, updatedTx.id_booking));
    }

    // 4. Create Struk Digital (Hanya dibuat setelah COMPLETED)
    let [strukRow] = await db
      .select()
      .from(struk)
      .where(eq(struk.id_transaksi, data.transactionId))
      .limit(1);

    if (!strukRow) {
      const no_struk = generateStrukNumber();
      [strukRow] = await db
        .insert(struk)
        .values({
          id_barbershop: updatedTx.id_barbershop,
          id_transaksi: data.transactionId,
          no_struk,
          tanggal_cetak: now,
        })
        .returning();
    }

    if (!strukRow) {
      throw new Error("Gagal membuat struk transaksi.");
    }

    // 5. Catat Audit Log
    if (updatedTx.id_barbershop) {
      await logAudit({
        barbershopId: updatedTx.id_barbershop,
        userId: confirmedByUserId,
        aksi: "payment confirmation",
        entityType: "pembayaran",
        entityId: data.transactionId,
      });

      await logAudit({
        barbershopId: updatedTx.id_barbershop,
        userId: confirmedByUserId,
        aksi: "transaction completion",
        entityType: "transaksi",
        entityId: data.transactionId,
      });
    }

    return {
      success: true,
      transactionId: updatedTx.id_transaksi,
      noStruk: strukRow.no_struk,
      status: "completed",
    };
  });

/**
 * 6. PEMBATALAN PERMINTAAN / LAYANAN (BPMN)
 * Wajib menyimpan: cancelled_at dan cancel_reason.
 * Layanan cancelled langsung dikeluarkan dari mesin estimasi.
 */
export const cancelBookingOrTransaction = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      transactionId?: string;
      bookingId?: string;
      reason: string;
      cancelledBy?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!data.reason || !data.reason.trim()) {
      throw new Error("Alasan pembatalan wajib diisi.");
    }

    const now = new Date();
    let targetBookingId = data.bookingId;
    let targetTxId = data.transactionId;
    let barbershopId: string | null = null;

    if (!targetBookingId && targetTxId) {
      const [tx] = await db
        .select({ id_booking: transaksi.id_booking, id_barbershop: transaksi.id_barbershop })
        .from(transaksi)
        .where(eq(transaksi.id_transaksi, targetTxId))
        .limit(1);
      if (tx) {
        targetBookingId = tx.id_booking ?? undefined;
        barbershopId = tx.id_barbershop;
      }
    } else if (targetBookingId && !targetTxId) {
      const [b] = await db
        .select({ id_booking: booking.id_booking, id_barbershop: booking.id_barbershop })
        .from(booking)
        .where(eq(booking.id_booking, targetBookingId))
        .limit(1);
      if (b) {
        barbershopId = b.id_barbershop;
        const [tx] = await db
          .select({ id_transaksi: transaksi.id_transaksi })
          .from(transaksi)
          .where(eq(transaksi.id_booking, targetBookingId))
          .limit(1);
        if (tx) targetTxId = tx.id_transaksi;
      }
    }

    // 1. Update Booking -> CANCELLED
    if (targetBookingId) {
      await db
        .update(booking)
        .set({
          status: "cancelled",
          cancelled_at: now,
          cancel_reason: data.reason.trim(),
          updated_at: now,
        })
        .where(eq(booking.id_booking, targetBookingId));
    }

    // 2. Update Transaksi -> CANCELLED
    if (targetTxId) {
      await db
        .update(transaksi)
        .set({
          status_transaksi: "cancelled",
          updated_at: now,
        })
        .where(eq(transaksi.id_transaksi, targetTxId));

      await db
        .update(pembayaran)
        .set({
          status_pembayaran: "failed",
          updated_at: now,
        })
        .where(eq(pembayaran.id_transaksi, targetTxId));
    }

    // 3. Catat Audit Log
    if (barbershopId) {
      await logAudit({
        barbershopId,
        aksi: "cancel request",
        entityType: "permintaan_layanan",
        entityId: targetBookingId ?? targetTxId ?? null,
        alasan: data.reason.trim(),
      });
    }

    return { success: true, status: "cancelled" };
  });

export const cancelCustomerTransaction = createServerFn({
  method: "POST",
})
  .validator((data: { transactionId: string; reason?: string }) => data)
  .handler(async ({ data }) => {
    return cancelBookingOrTransaction({
      data: {
        transactionId: data.transactionId,
        reason: data.reason || "Dibatalkan oleh pelanggan",
        cancelledBy: "pelanggan",
      },
    });
  });

/**
 * 7. DETAIL TRANSAKSI & ESTIMASI REALTIME UNTUK FRONTEND
 */
export const getTransactionDetail = createServerFn({
  method: "GET",
})
  .validator(
    (data: {
      transactionId: string;
      barbershopSlug?: string | undefined;
      barbershopId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    // 0. Jalankan pembersihan background expiration
    let targetShopId = data.barbershopId;
    if (data.barbershopSlug) {
      const [shop] = await db
        .select({ id_barbershop: barbershop.id_barbershop })
        .from(barbershop)
        .where(eq(barbershop.slug, data.barbershopSlug))
        .limit(1);

      if (!shop) return null;
      targetShopId = shop.id_barbershop;
    }

    await sweepExpiredRequestsAndPayments(targetShopId);

    const txRows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_barbershop: transaksi.id_barbershop,
        id_booking: transaksi.id_booking,
        id_shift: transaksi.id_shift,
        id_capster: transaksi.id_capster,
        id_pelanggan: transaksi.id_pelanggan,
        subtotal: transaksi.subtotal,
        diskon: transaksi.diskon,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
        waktu_selesai_layanan: transaksi.waktu_selesai_layanan,
        batas_pembayaran: transaksi.batas_pembayaran,
        created_at: transaksi.created_at,
        customer_name: users.nama_lengkap,
        customer_phone: users.no_hp,
      })
      .from(transaksi)
      .innerJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
      .innerJoin(users, eq(pelanggan.id_user, users.id_user))
      .where(eq(transaksi.id_transaksi, data.transactionId))
      .limit(1);

    if (!txRows[0]) {
      return null;
    }

    const tx = txRows[0];

    // Validasi isolasi tenant: transaksi wajib milik barbershop yang sedang dibuka
    if (targetShopId && tx.id_barbershop !== targetShopId) {
      return null;
    }

    // Get Booking & Capster
    let bookingInfo = null;
    let capsterName = "Capster";
    let capsterRole = "Barber";
    let capsterId = tx.id_capster;

    if (tx.id_booking) {
      const bRows = await db
        .select({
          id_booking: booking.id_booking,
          id_capster: booking.id_capster,
          status: booking.status,
          waktu_booking: booking.waktu_booking,
          waktu_permintaan: booking.waktu_permintaan,
          batas_konfirmasi: booking.batas_konfirmasi,
          waktu_konfirmasi: booking.waktu_konfirmasi,
          waktu_mulai_layanan: booking.waktu_mulai_layanan,
          estimasi_tunggu_menit: booking.estimasi_tunggu_menit,
          estimasi_mulai: booking.estimasi_mulai,
          source: booking.source,
          cancelled_at: booking.cancelled_at,
          cancel_reason: booking.cancel_reason,
          catatan: booking.catatan,
        })
        .from(booking)
        .where(eq(booking.id_booking, tx.id_booking))
        .limit(1);

      if (bRows[0]) {
        bookingInfo = bRows[0];
        capsterId = bRows[0].id_capster ?? capsterId;
      }
    }

    if (capsterId) {
      const capRows = await db
        .select({
          nama_lengkap: users.nama_lengkap,
          no_pegawai: capster.no_pegawai,
        })
        .from(capster)
        .innerJoin(users, eq(capster.id_user, users.id_user))
        .where(eq(capster.id_capster, capsterId))
        .limit(1);

      if (capRows[0]) {
        capsterName = capRows[0].nama_lengkap;
        capsterRole = capRows[0].no_pegawai === "CAP-001" ? "Senior Barber" : "Barber";
      }
    }

    // Get Items (Detail Booking Snapshot)
    const items: {
      serviceId: string;
      name: string;
      price: number;
      quantity: number;
      durationMinutes: number;
      subtotal: number;
    }[] = [];

    if (tx.id_booking) {
      const details = await db
        .select({
          id_layanan: detailBooking.id_layanan,
          harga_satuan: detailBooking.harga_satuan,
          qty: detailBooking.qty,
          subtotal: detailBooking.subtotal,
          nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
          durasi_menit_snapshot: detailBooking.durasi_menit_snapshot,
          nama_layanan: layanan.nama_layanan,
        })
        .from(detailBooking)
        .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
        .where(eq(detailBooking.id_booking, tx.id_booking));

      details.forEach((d) => {
        items.push({
          serviceId: d.id_layanan,
          name: d.nama_layanan_snapshot || d.nama_layanan || "Layanan",
          price: Number(d.harga_satuan),
          quantity: d.qty,
          durationMinutes: d.durasi_menit_snapshot || 30,
          subtotal: Number(d.subtotal),
        });
      });
    }

    // Get Pembayaran
    const payRows = await db
      .select()
      .from(pembayaran)
      .where(eq(pembayaran.id_transaksi, tx.id_transaksi))
      .limit(1);

    const payment = payRows[0] ?? null;

    // Get Struk
    const strukRows = await db
      .select()
      .from(struk)
      .where(eq(struk.id_transaksi, tx.id_transaksi))
      .limit(1);

    const strukData = strukRows[0] ?? null;

    // Hitung Estimasi Terkini Dinamis dari Backend Engine
    let liveEstimation = null;
    if (tx.id_booking) {
      liveEstimation = await getBookingEstimation(tx.id_booking);
    }

    const itemsTotalDuration = items.reduce((sum, it) => sum + (it.durationMinutes * it.quantity), 0);

    return {
      transactionId: tx.id_transaksi,
      bookingId: tx.id_booking,
      bookingStatus: bookingInfo?.status ?? "waiting",
      customerId: tx.id_pelanggan,
      customerName: tx.customer_name,
      customerPhone: tx.customer_phone,
      capsterId: capsterId ?? "",
      capsterName,
      capsterRole,
      createdAt: tx.created_at.toISOString(),
      waktuPermintaan: bookingInfo?.waktu_permintaan?.toISOString() ?? tx.created_at.toISOString(),
      batasKonfirmasi: bookingInfo?.batas_konfirmasi?.toISOString() ?? null,
      waktuKonfirmasi: bookingInfo?.waktu_konfirmasi?.toISOString() ?? null,
      waktuMulaiLayanan: bookingInfo?.waktu_mulai_layanan?.toISOString() ?? null,
      waktuSelesaiLayanan: tx.waktu_selesai_layanan?.toISOString() ?? null,
      batasPembayaran: tx.batas_pembayaran?.toISOString() ?? null,
      subtotal: Number(tx.subtotal),
      discount: Number(tx.diskon),
      total: Number(tx.total),
      status: tx.status_transaksi,
      paymentMethod: payment?.metode_pembayaran ?? "tunai",
      paymentStatus: payment?.status_pembayaran ?? "pending",
      items,
      struk: strukData,
      notes: bookingInfo?.catatan ?? null,
      cancelReason: bookingInfo?.cancel_reason ?? null,
      cancelledAt: bookingInfo?.cancelled_at?.toISOString() ?? null,
      totalDurationMinutes: liveEstimation?.totalDurationMinutes ?? itemsTotalDuration,
      estimation: liveEstimation,
    };
  });

/**
 * 8. GET WAITING ESTIMATION FOR CUSTOMER (AUTO REFRESH / POLLING)
 */
export const getCustomerWaitEstimation = createServerFn({
  method: "GET",
})
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data }) => {
    return await getBookingEstimation(data.bookingId);
  });

/**
 * 9. GET CUSTOMER TRANSACTIONS HISTORY
 */
export const getCustomerTransactions = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            customerId?: string;
            customerName?: string;
            barbershopSlug?: string;
            barbershopId?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => {
    let customerId = data?.customerId;

    if (!customerId && data?.customerName) {
      const cust = await db
        .select({ id_pelanggan: pelanggan.id_pelanggan })
        .from(pelanggan)
        .innerJoin(users, eq(pelanggan.id_user, users.id_user))
        .where(eq(users.nama_lengkap, data.customerName))
        .limit(1);

      if (cust[0]) customerId = cust[0].id_pelanggan;
    }

    if (!customerId) {
      return [];
    }

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

    const conditions = [eq(transaksi.id_pelanggan, customerId)];
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
        customerName: users.nama_lengkap,
      })
      .from(transaksi)
      .innerJoin(pelanggan, eq(transaksi.id_pelanggan, pelanggan.id_pelanggan))
      .innerJoin(users, eq(pelanggan.id_user, users.id_user))
      .where(and(...conditions))
      .orderBy(desc(transaksi.created_at));

    const results = [];

    for (const t of txs) {
      let serviceNames = "Layanan Barbershop";
      if (t.id_booking) {
        const details = await db
          .select({
            nama_snapshot: detailBooking.nama_layanan_snapshot,
            nama: layanan.nama_layanan,
          })
          .from(detailBooking)
          .leftJoin(layanan, eq(detailBooking.id_layanan, layanan.id_layanan))
          .where(eq(detailBooking.id_booking, t.id_booking));

        if (details.length > 0) {
          serviceNames = details.map((d) => d.nama_snapshot || d.nama || "Layanan").join(" + ");
        }
      }

      const [pay] = await db
        .select({ method: pembayaran.metode_pembayaran })
        .from(pembayaran)
        .where(eq(pembayaran.id_transaksi, t.id_transaksi))
        .limit(1);

      results.push({
        id: t.id_transaksi,
        date: t.created_at.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }),
        time: t.created_at.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }),
        serviceNames,
        total: Number(t.total),
        status:
          t.status_transaksi === "completed" || t.status_transaksi === "paid"
            ? "Selesai"
            : t.status_transaksi === "cancelled" || t.status_transaksi === "expired"
              ? "Batal"
              : "Menunggu",
        paymentMethod: pay?.method ?? "tunai",
      });
    }

    return results;
  });

/**
 * 10. GET OR CREATE CUSTOMER
 */
export const getOrCreateCustomer = createServerFn({
  method: "POST",
})
  .validator((data: { name: string; phone?: string; barbershopId?: string }) => data)
  .handler(async ({ data }) => {
    const name = data.name.trim() || "Pelanggan Umum";
    const phone = data.phone?.trim() || null;
    let userRow;

    if (phone) {
      const existing = await db
        .select()
        .from(users)
        .where(and(eq(users.no_hp, phone), eq(users.role, "pelanggan")))
        .limit(1);
      userRow = existing[0];
    }

    if (!userRow) {
      const email = `pelanggan.${Date.now()}.${Math.floor(Math.random() * 1000)}@barberin.local`;
      const [u] = await db
        .insert(users)
        .values({
          email,
          nama_lengkap: name,
          no_hp: phone,
          role: "pelanggan",
          status: "active",
          id_barbershop: data.barbershopId ?? null,
        })
        .returning();
      userRow = u;
    }

    if (!userRow) {
      throw new Error("Gagal membuat user.");
    }

    let [p] = await db
      .select()
      .from(pelanggan)
      .where(eq(pelanggan.id_user, userRow.id_user))
      .limit(1);

    if (!p) {
      [p] = await db
        .insert(pelanggan)
        .values({
          id_user: userRow.id_user,
          id_barbershop: data.barbershopId ?? null,
          nama_pelanggan: name,
          no_hp: phone,
        })
        .returning();
    }

    if (!p) {
      throw new Error("Gagal membuat data pelanggan.");
    }

    return {
      customerId: p.id_pelanggan,
      userId: userRow.id_user,
      name: userRow.nama_lengkap,
    };
  });
