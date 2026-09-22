import { and, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { booking, pembayaran, transaksi } from "@/db/schema";
import { logAudit } from "./audit";

/**
 * Background Expiration Sweeper:
 * 1. Mengubah permintaan layanan (booking) yang melewati batas konfirmasi (5 menit) menjadi 'expired'
 * 2. Mengubah transaksi & pembayaran yang melewati batas pembayaran (2 jam setelah pelayanan fisik selesai) menjadi 'expired'
 * 3. Terisolasi per barbershop jika targetShopId ditentukan
 */
export async function sweepExpiredRequestsAndPayments(targetShopId?: string): Promise<{
  expiredRequestsCount: number;
  expiredTransactionsCount: number;
}> {
  const now = new Date();
  let expiredRequestsCount = 0;
  let expiredTransactionsCount = 0;

  try {
    // 1. Cek Permintaan Layanan yang melebih batas_konfirmasi (5 menit)
    const bookingConditions = [
      eq(booking.status, "pending_confirmation"),
      lte(booking.batas_konfirmasi, now),
    ];
    if (targetShopId) {
      bookingConditions.push(eq(booking.id_barbershop, targetShopId));
    }

    const expiredBookings = await db
      .select({
        id_booking: booking.id_booking,
        id_barbershop: booking.id_barbershop,
      })
      .from(booking)
      .where(and(...bookingConditions));

    if (expiredBookings.length > 0) {
      const expiredBookingIds = expiredBookings.map((b) => b.id_booking);

      await db
        .update(booking)
        .set({
          status: "expired",
          updated_at: now,
        })
        .where(inArray(booking.id_booking, expiredBookingIds));

      // Update transaksi & pembayaran terkait menjadi expired juga jika masih pending
      const relatedTxs = await db
        .select({ id_transaksi: transaksi.id_transaksi, id_barbershop: transaksi.id_barbershop })
        .from(transaksi)
        .where(inArray(transaksi.id_booking, expiredBookingIds));

      if (relatedTxs.length > 0) {
        const txIds = relatedTxs.map((t) => t.id_transaksi);
        await db
          .update(transaksi)
          .set({ status_transaksi: "expired", updated_at: now })
          .where(and(inArray(transaksi.id_transaksi, txIds), eq(transaksi.status_transaksi, "pending")));

        await db
          .update(pembayaran)
          .set({ status_pembayaran: "expired", updated_at: now })
          .where(and(inArray(pembayaran.id_transaksi, txIds), eq(pembayaran.status_pembayaran, "pending")));
      }

      for (const b of expiredBookings) {
        await logAudit({
          barbershopId: b.id_barbershop,
          aksi: "expire request",
          entityType: "permintaan_layanan",
          entityId: b.id_booking,
          alasan: "Melebihi batas konfirmasi 5 menit oleh capster",
        });
      }

      expiredRequestsCount = expiredBookings.length;
    }

    // 2. Cek Transaksi & Pembayaran yang melewati batas_pembayaran (2 jam setelah pelayanan selesai)
    const txConditions = [
      or(eq(transaksi.status_transaksi, "pending"), eq(transaksi.status_transaksi, "ongoing")),
      isNotNull(transaksi.batas_pembayaran),
      lte(transaksi.batas_pembayaran, now),
    ];
    if (targetShopId) {
      txConditions.push(eq(transaksi.id_barbershop, targetShopId));
    }

    const expiredTxs = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_barbershop: transaksi.id_barbershop,
        id_booking: transaksi.id_booking,
      })
      .from(transaksi)
      .where(and(...txConditions));

    if (expiredTxs.length > 0) {
      const expiredTxIds = expiredTxs.map((t) => t.id_transaksi);

      await db
        .update(transaksi)
        .set({
          status_transaksi: "expired",
          updated_at: now,
        })
        .where(inArray(transaksi.id_transaksi, expiredTxIds));

      await db
        .update(pembayaran)
        .set({
          status_pembayaran: "expired",
          updated_at: now,
        })
        .where(inArray(pembayaran.id_transaksi, expiredTxIds));

      // Booking yang terkait juga diset expired jika masih awaiting_payment
      const relatedBookingIds = expiredTxs
        .map((t) => t.id_booking)
        .filter((id): id is string => Boolean(id));

      if (relatedBookingIds.length > 0) {
        await db
          .update(booking)
          .set({
            status: "expired",
            updated_at: now,
          })
          .where(
            and(
              inArray(booking.id_booking, relatedBookingIds),
              or(eq(booking.status, "awaiting_payment"), eq(booking.status, "in_service")),
            ),
          );
      }

      for (const t of expiredTxs) {
        if (t.id_barbershop) {
          await logAudit({
            barbershopId: t.id_barbershop,
            aksi: "transaction expiration",
            entityType: "transaksi",
            entityId: t.id_transaksi,
            alasan: "Melebihi batas waktu pembayaran 2 jam setelah pelayanan",
          });
        }
      }

      expiredTransactionsCount = expiredTxs.length;
    }
  } catch (err) {
    console.error("[EXPIRATION SWEEPER ERROR]", err);
  }

  return {
    expiredRequestsCount,
    expiredTransactionsCount,
  };
}
