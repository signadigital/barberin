import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { booking, detailBooking, layanan } from "@/db/schema";
import { sweepExpiredRequestsAndPayments } from "./expiration";

export type QueueItemEstimation = {
  bookingId: string;
  barbershopId: string;
  capsterId: string;
  status: string;
  source: string;
  waktuPermintaan: Date;
  waktuKonfirmasi: Date | null;
  waktuMulaiLayanan: Date | null;
  totalDurationMinutes: number;
  remainingMinutes: number; // Sisa durasi pengerjaan jika sedang in_service
  waitTimeMinutes: number; // Berapa lama harus menunggu sebelum mulai
  estimatedStartTime: Date; // Perkiraan waktu mulai dilayani
  estimatedEndTime: Date; // Perkiraan waktu selesai
  positionInQueue: number; // 0 jika sedang in_service, 1 untuk antrean pertama, dst.
  serviceNames: string;
};

/**
 * Mesin Perhitungan Estimasi Waktu Tunggu BARBERIN
 * Sesuai NEW_BPMN & NEW_ERD:
 * - Scoped strictly to (id_barbershop, id_capster)
 * - Formula: Sisa durasi layanan in_service + Total durasi snapshot layanan aktif sebelum pelanggan
 * - Layanan Aktif: in_service, confirmed, waiting
 * - TIDAK Dihitung: pending_confirmation, expired, cancelled, completed, awaiting_payment
 */
export async function calculateQueueEstimations(
  barbershopId: string,
  capsterId: string,
  referenceTime: Date = new Date(),
): Promise<QueueItemEstimation[]> {
  // 1. Bersihkan request yang kadaluwarsa terlebih dahulu
  await sweepExpiredRequestsAndPayments(barbershopId);

  // 2. Ambil seluruh permintaan layanan aktif untuk capster di barbershop ini
  const activeStatuses: ("in_service" | "confirmed" | "waiting")[] = [
    "in_service",
    "confirmed",
    "waiting",
  ];

  const activeBookings = await db
    .select({
      id_booking: booking.id_booking,
      id_barbershop: booking.id_barbershop,
      id_capster: booking.id_capster,
      status: booking.status,
      source: booking.source,
      waktu_permintaan: booking.waktu_permintaan,
      waktu_konfirmasi: booking.waktu_konfirmasi,
      waktu_mulai_layanan: booking.waktu_mulai_layanan,
      created_at: booking.created_at,
    })
    .from(booking)
    .where(
      and(
        eq(booking.id_barbershop, barbershopId),
        eq(booking.id_capster, capsterId),
        inArray(booking.status, activeStatuses),
      ),
    )
    .orderBy(asc(booking.waktu_permintaan), asc(booking.created_at));

  if (activeBookings.length === 0) {
    return [];
  }

  // 3. Ambil detail layanan (durasi snapshot) untuk semua booking aktif
  const bookingIds = activeBookings.map((b) => b.id_booking);
  const details = await db
    .select({
      id_booking: detailBooking.id_booking,
      nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
      durasi_menit_snapshot: detailBooking.durasi_menit_snapshot,
      qty: detailBooking.qty,
      id_layanan: detailBooking.id_layanan,
    })
    .from(detailBooking)
    .where(inArray(detailBooking.id_booking, bookingIds));

  // Map total duration per booking
  const durationMap = new Map<string, { totalDuration: number; names: string[] }>();
  for (const d of details) {
    const existing = durationMap.get(d.id_booking) ?? { totalDuration: 0, names: [] };
    const dur = (d.durasi_menit_snapshot && d.durasi_menit_snapshot > 0) ? d.durasi_menit_snapshot : 30;
    const qty = d.qty || 1;
    existing.totalDuration += dur * qty;
    if (d.nama_layanan_snapshot) {
      existing.names.push(d.nama_layanan_snapshot);
    }
    durationMap.set(d.id_booking, existing);
  }

  // 4. Pisahkan yang sedang in_service (maksimal 1 yang aktif dikerjakan di kursi)
  const inServiceBooking = activeBookings.find((b) => b.status === "in_service");
  const waitingBookings = activeBookings.filter((b) => b.status !== "in_service");

  // Urutkan antrean waiting secara konsisten (prioritaskan waktu_konfirmasi atau waktu_permintaan)
  waitingBookings.sort((a, b) => {
    const timeA = (a.waktu_konfirmasi ?? a.waktu_permintaan ?? a.created_at).getTime();
    const timeB = (b.waktu_konfirmasi ?? b.waktu_permintaan ?? b.created_at).getTime();
    return timeA - timeB;
  });

  const orderedQueue = inServiceBooking ? [inServiceBooking, ...waitingBookings] : waitingBookings;

  const results: QueueItemEstimation[] = [];

  // Hitung sisa durasi in_service berdasarkan waktu aktual server (referenceTime)
  let currentWaitAccumulator = 0;
  let inServiceRemaining = 0;

  if (inServiceBooking) {
    const info = durationMap.get(inServiceBooking.id_booking) ?? { totalDuration: 30, names: ["Layanan"] };
    const startTime = inServiceBooking.waktu_mulai_layanan ?? inServiceBooking.waktu_konfirmasi ?? inServiceBooking.waktu_permintaan;
    const elapsedMinutes = Math.max(0, Math.floor((referenceTime.getTime() - startTime.getTime()) / 60000));
    inServiceRemaining = Math.max(0, info.totalDuration - elapsedMinutes);

    const estStart = referenceTime; // Sedang berlangsung
    const estEnd = new Date(referenceTime.getTime() + inServiceRemaining * 60000);

    results.push({
      bookingId: inServiceBooking.id_booking,
      barbershopId: inServiceBooking.id_barbershop,
      capsterId: inServiceBooking.id_capster ?? capsterId,
      status: inServiceBooking.status,
      source: inServiceBooking.source,
      waktuPermintaan: inServiceBooking.waktu_permintaan,
      waktuKonfirmasi: inServiceBooking.waktu_konfirmasi,
      waktuMulaiLayanan: inServiceBooking.waktu_mulai_layanan,
      totalDurationMinutes: info.totalDuration,
      remainingMinutes: inServiceRemaining,
      waitTimeMinutes: 0, // Sedang dilayani, tidak ada waktu tunggu
      estimatedStartTime: estStart,
      estimatedEndTime: estEnd,
      positionInQueue: 0,
      serviceNames: info.names.join(" + ") || "Layanan Barbershop",
    });

    currentWaitAccumulator = inServiceRemaining;
  }

  // Hitung estimasi untuk setiap pelanggan yang sedang menunggu (waiting / confirmed)
  let queueIndex = 1;
  for (const b of waitingBookings) {
    const info = durationMap.get(b.id_booking) ?? { totalDuration: 30, names: ["Layanan"] };
    const waitTime = currentWaitAccumulator;
    const estStart = new Date(referenceTime.getTime() + waitTime * 60000);
    const estEnd = new Date(estStart.getTime() + info.totalDuration * 60000);

    results.push({
      bookingId: b.id_booking,
      barbershopId: b.id_barbershop,
      capsterId: b.id_capster ?? capsterId,
      status: b.status,
      source: b.source,
      waktuPermintaan: b.waktu_permintaan,
      waktuKonfirmasi: b.waktu_konfirmasi,
      waktuMulaiLayanan: b.waktu_mulai_layanan,
      totalDurationMinutes: info.totalDuration,
      remainingMinutes: info.totalDuration,
      waitTimeMinutes: waitTime,
      estimatedStartTime: estStart,
      estimatedEndTime: estEnd,
      positionInQueue: queueIndex++,
      serviceNames: info.names.join(" + ") || "Layanan Barbershop",
    });

    // Tambahkan durasi booking ini untuk pelanggan berikutnya di antrean
    currentWaitAccumulator += info.totalDuration;
  }

  return results;
}

/**
 * Ambil estimasi dinamis untuk satu permintaan layanan (booking) tertentu.
 * Mengembalikan null jika booking tidak ditemukan atau statusnya tidak aktif.
 */
export async function getBookingEstimation(
  bookingId: string,
  referenceTime: Date = new Date(),
): Promise<QueueItemEstimation | null> {
  const [b] = await db
    .select({
      id_booking: booking.id_booking,
      id_barbershop: booking.id_barbershop,
      id_capster: booking.id_capster,
      status: booking.status,
    })
    .from(booking)
    .where(eq(booking.id_booking, bookingId))
    .limit(1);

  if (!b || !b.id_capster) {
    return null;
  }

  const queue = await calculateQueueEstimations(b.id_barbershop, b.id_capster, referenceTime);
  const found = queue.find((q) => q.bookingId === bookingId);
  return found ?? null;
}
