import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  alasanPembatalan,
  booking,
  pembayaran,
  pembatalan,
  transaksi,
} from "@/db/schema";

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 jam dalam milidetik

export const CANCEL_REASON_CATEGORY = "Alasan lainnya";
export const CANCEL_REASON_DETAIL =
  "Otomatis dibatalkan sistem: Melebihi batas waktu 2 jam menunggu persetujuan capster (Alasan lainnya)";

/**
 * Memeriksa apakah suatu transaksi pending sudah melebihi 2 jam dari waktu pembuatannya.
 */
export function isTransactionExpired(
  createdAt: Date | string | number,
  status?: string | null,
): boolean {
  if (status && status !== "pending" && status !== "Menunggu") {
    return false;
  }
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  return Date.now() - createdTime > TWO_HOURS_MS;
}

/**
 * Membatalkan secara otomatis seluruh transaksi & booking yang masih berstatus pending
 * setelah melebihi batas waktu 2 jam dari waktu pemesanan/pembuatan transaksi.
 * Kategori alasan pembatalan dicatat sebagai "Alasan lainnya".
 */
export async function autoCancelExpiredPendingTransactions(): Promise<number> {
  try {
    const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS);

    // Cari seluruh transaksi pending yang dibuat > 2 jam yang lalu
    const expiredTxs = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_booking: transaksi.id_booking,
        created_at: transaksi.created_at,
      })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.status_transaksi, "pending"),
          lte(transaksi.created_at, twoHoursAgo),
        ),
      );

    if (!expiredTxs || expiredTxs.length === 0) {
      return 0;
    }

    // 1. Pastikan kategori "Alasan lainnya" tersedia di master alasan_pembatalan
    let [alasanRow] = await db
      .select({ id_alasan: alasanPembatalan.id_alasan })
      .from(alasanPembatalan)
      .where(eq(alasanPembatalan.alasan, CANCEL_REASON_CATEGORY))
      .limit(1);

    if (!alasanRow) {
      try {
        const [inserted] = await db
          .insert(alasanPembatalan)
          .values({
            tipe_aktor: "admin/capster",
            alasan: CANCEL_REASON_CATEGORY,
          })
          .returning({ id_alasan: alasanPembatalan.id_alasan });
        alasanRow = inserted;
      } catch {
        const [existing] = await db
          .select({ id_alasan: alasanPembatalan.id_alasan })
          .from(alasanPembatalan)
          .where(eq(alasanPembatalan.alasan, CANCEL_REASON_CATEGORY))
          .limit(1);
        alasanRow = existing;
      }
    }

    // 2. Batalkan setiap transaksi yang kedaluwarsa secara atomik/tercatat
    for (const tx of expiredTxs) {
      // Update transaksi -> cancelled
      await db
        .update(transaksi)
        .set({
          status_transaksi: "cancelled",
          updated_at: new Date(),
        })
        .where(eq(transaksi.id_transaksi, tx.id_transaksi));

      // Update booking terkait -> cancelled
      if (tx.id_booking) {
        await db
          .update(booking)
          .set({
            status: "cancelled",
            catatan: CANCEL_REASON_DETAIL,
            updated_at: new Date(),
          })
          .where(eq(booking.id_booking, tx.id_booking));
      }

      // Update pembayaran -> failed
      await db
        .update(pembayaran)
        .set({
          status_pembayaran: "failed",
        })
        .where(eq(pembayaran.id_transaksi, tx.id_transaksi));

      // Catat log pembatalan ke tabel pembatalan jika belum ada
      const [existingPembatalan] = await db
        .select({ id_pembatalan: pembatalan.id_pembatalan })
        .from(pembatalan)
        .where(eq(pembatalan.id_transaksi, tx.id_transaksi))
        .limit(1);

      if (!existingPembatalan) {
        await db.insert(pembatalan).values({
          id_transaksi: tx.id_transaksi,
          id_alasan: alasanRow?.id_alasan ?? null,
          dibatalkan_oleh: "sistem",
          waktu_pembatalan: new Date(),
          catatan: CANCEL_REASON_DETAIL,
        });
      }
    }

    return expiredTxs.length;
  } catch (error) {
    console.error("Gagal menjalankan autoCancelExpiredPendingTransactions:", error);
    return 0;
  }
}
