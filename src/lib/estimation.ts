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
  // UI Compatibility aliases
  antreanKe?: number;
  estimasiTungguMenit?: number;
  durasiLayanan?: number;
  sisaDurasi?: number;
  estimasiMulai?: string;
  estimasiSelesai?: string;
  totalAntreanSebelumnya?: number;
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

  // 2. Ambil seluruh permintaan layanan aktif untuk capster di barbershop ini (termasuk yang baru masuk / pending_confirmation)
  const activeStatuses: ("in_service" | "confirmed" | "waiting" | "pending_confirmation")[] = [
    "in_service",
    "confirmed",
    "waiting",
    "pending_confirmation",
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

  // 4. Pisahkan yang sedang in_service (ambil booking in_service yang paling mutakhir/aktif)
  const inServiceBookings = activeBookings.filter((b) => b.status === "in_service");
  inServiceBookings.sort((a, b) => {
    const tA = (a.waktu_mulai_layanan ?? a.created_at).getTime();
    const tB = (b.waktu_mulai_layanan ?? b.created_at).getTime();
    return tB - tA; // descending (terbaru lebih dahulu)
  });
  const inServiceBooking = inServiceBookings[0];
  const waitingBookings = activeBookings.filter((b) => b.status !== "in_service");

  // Urutkan antrean waiting secara konsisten (prioritaskan waktu_konfirmasi atau waktu_permintaan)
  waitingBookings.sort((a, b) => {
    const timeA = (a.waktu_konfirmasi ?? a.waktu_permintaan ?? a.created_at).getTime();
    const timeB = (b.waktu_konfirmasi ?? b.waktu_permintaan ?? b.created_at).getTime();
    return timeA - timeB;
  });

  const results: QueueItemEstimation[] = [];

  // Hitung sisa durasi in_service berdasarkan waktu aktual server (referenceTime)
  let currentWaitAccumulator = 0;
  let inServiceRemaining = 0;

  if (inServiceBooking) {
    const info = durationMap.get(inServiceBooking.id_booking) ?? { totalDuration: 30, names: ["Layanan"] };
    // started_at HARUS waktu pelayanan benar-benar dimulai (waktu_mulai_layanan)
    // Jangan gunakan waktu_permintaan atau waktu_konfirmasi yang menyebabkan elapsed time menjadi durasi penuh
    const startTime = inServiceBooking.waktu_mulai_layanan ?? inServiceBooking.created_at ?? referenceTime;
    const elapsedMinutes = Math.max(0, Math.floor((referenceTime.getTime() - startTime.getTime()) / 60000));
    inServiceRemaining = Math.max(0, info.totalDuration - elapsedMinutes);

    const estStart = startTime; // Waktu aktual pelayanan dimulai
    const estEnd = new Date(startTime.getTime() + info.totalDuration * 60000);

    results.push({
      bookingId: inServiceBooking.id_booking,
      barbershopId: inServiceBooking.id_barbershop,
      capsterId: inServiceBooking.id_capster ?? capsterId,
      status: inServiceBooking.status,
      source: inServiceBooking.source,
      waktuPermintaan: inServiceBooking.waktu_permintaan,
      waktuKonfirmasi: inServiceBooking.waktu_konfirmasi,
      waktuMulaiLayanan: startTime,
      totalDurationMinutes: info.totalDuration,
      remainingMinutes: inServiceRemaining,
      waitTimeMinutes: 0, // Sedang dilayani, tidak ada waktu tunggu
      estimatedStartTime: estStart,
      estimatedEndTime: estEnd,
      positionInQueue: 0,
      serviceNames: info.names.join(" + ") || "Layanan Barbershop",
      antreanKe: 0,
      estimasiTungguMenit: 0,
      durasiLayanan: info.totalDuration,
      sisaDurasi: inServiceRemaining,
      estimasiMulai: estStart.toISOString(),
      estimasiSelesai: estEnd.toISOString(),
      totalAntreanSebelumnya: 0,
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
      positionInQueue: queueIndex,
      serviceNames: info.names.join(" + ") || "Layanan Barbershop",
      antreanKe: queueIndex,
      estimasiTungguMenit: waitTime,
      durasiLayanan: info.totalDuration,
      sisaDurasi: info.totalDuration,
      estimasiMulai: estStart.toISOString(),
      estimasiSelesai: estEnd.toISOString(),
      totalAntreanSebelumnya: queueIndex - 1,
    });

    // Tambahkan durasi booking ini untuk pelanggan berikutnya di antrean
    currentWaitAccumulator += info.totalDuration;
    queueIndex++;
  }

  return results;
}

/**
 * Helper untuk mendapatkan estimasi dalam bentuk Map<bookingId, QueueItemEstimation>
 * Memudahkan look-up O(1) saat me-render transaksi list di Capster
 */
export async function calculateCapsterEstimationsMap(
  barbershopId: string,
  capsterId: string,
  referenceTime: Date = new Date(),
): Promise<Map<string, QueueItemEstimation>> {
  const queue = await calculateQueueEstimations(barbershopId, capsterId, referenceTime);
  const map = new Map<string, QueueItemEstimation>();
  for (const item of queue) {
    map.set(item.bookingId, item);
  }
  return map;
}

/**
 * Ambil estimasi dinamis untuk satu permintaan layanan (booking) tertentu.
 * Jika statusnya in_service/waiting/confirmed, mengambil nilai real-time queue.
 * Jika statusnya pending_confirmation, menghitung preview estimasi tunggu
 * (posisi di belakang antrean aktif saat ini).
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
      waktu_permintaan: booking.waktu_permintaan,
      waktu_konfirmasi: booking.waktu_konfirmasi,
      waktu_mulai_layanan: booking.waktu_mulai_layanan,
      source: booking.source,
    })
    .from(booking)
    .where(eq(booking.id_booking, bookingId))
    .limit(1);

  if (!b || !b.id_capster) {
    return null;
  }

  // Jika booking sudah aktif dalam antrean (in_service, waiting, confirmed, pending_confirmation)
  if (
    b.status === "in_service" ||
    b.status === "waiting" ||
    b.status === "confirmed" ||
    b.status === "pending_confirmation"
  ) {
    const queue = await calculateQueueEstimations(b.id_barbershop, b.id_capster, referenceTime);
    const found = queue.find((q) => q.bookingId === bookingId);
    if (found) return found;

    // Fallback presisi jika booking in_service tidak terambil di queue utama
    if (b.status === "in_service") {
      const details = await db
        .select({
          durasi_menit_snapshot: detailBooking.durasi_menit_snapshot,
          nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
          qty: detailBooking.qty,
        })
        .from(detailBooking)
        .where(eq(detailBooking.id_booking, bookingId));

      let totalDuration = 0;
      const names: string[] = [];
      for (const d of details) {
        const dur = (d.durasi_menit_snapshot && d.durasi_menit_snapshot > 0) ? d.durasi_menit_snapshot : 30;
        totalDuration += dur * (d.qty || 1);
        if (d.nama_layanan_snapshot) names.push(d.nama_layanan_snapshot);
      }
      if (totalDuration === 0) totalDuration = 30;

      const startTime = b.waktu_mulai_layanan ?? referenceTime;
      const elapsedMinutes = Math.max(0, Math.floor((referenceTime.getTime() - startTime.getTime()) / 60000));
      const remaining = Math.max(0, totalDuration - elapsedMinutes);
      const estEnd = new Date(startTime.getTime() + totalDuration * 60000);

      return {
        bookingId: b.id_booking,
        barbershopId: b.id_barbershop,
        capsterId: b.id_capster,
        status: b.status,
        source: b.source || "scan",
        waktuPermintaan: b.waktu_permintaan,
        waktuKonfirmasi: b.waktu_konfirmasi,
        waktuMulaiLayanan: startTime,
        totalDurationMinutes: totalDuration,
        remainingMinutes: remaining,
        waitTimeMinutes: 0,
        estimatedStartTime: startTime,
        estimatedEndTime: estEnd,
        positionInQueue: 0,
        serviceNames: names.join(" + ") || "Layanan Barbershop",
        antreanKe: 0,
        estimasiTungguMenit: 0,
        durasiLayanan: totalDuration,
        sisaDurasi: remaining,
        estimasiMulai: startTime.toISOString(),
        estimasiSelesai: estEnd.toISOString(),
        totalAntreanSebelumnya: 0,
      };
    }

    return null;
  }

  // Jika status pending_confirmation: hitung preview estimasi tunggu untuk halaman Menunggu Konfirmasi
  if (b.status === "pending_confirmation") {
    const details = await db
      .select({
        durasi_menit_snapshot: detailBooking.durasi_menit_snapshot,
        nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
        qty: detailBooking.qty,
      })
      .from(detailBooking)
      .where(eq(detailBooking.id_booking, bookingId));

    let totalDuration = 0;
    const names: string[] = [];
    for (const d of details) {
      const dur = (d.durasi_menit_snapshot && d.durasi_menit_snapshot > 0) ? d.durasi_menit_snapshot : 30;
      totalDuration += dur * (d.qty || 1);
      if (d.nama_layanan_snapshot) names.push(d.nama_layanan_snapshot);
    }
    if (totalDuration === 0) totalDuration = 30;

    const queue = await calculateQueueEstimations(b.id_barbershop, b.id_capster, referenceTime);
    const lastQueueItem = queue[queue.length - 1];
    let waitTime = 0;
    let position = 1;
    if (lastQueueItem) {
      const remainingForLast = Math.max(
        0,
        Math.floor((lastQueueItem.estimatedEndTime.getTime() - referenceTime.getTime()) / 60000),
      );
      waitTime = remainingForLast;
      position = queue.filter((q) => q.positionInQueue > 0).length + 1;
    }

    const estStart = new Date(referenceTime.getTime() + waitTime * 60000);
    const estEnd = new Date(estStart.getTime() + totalDuration * 60000);

    return {
      bookingId: b.id_booking,
      barbershopId: b.id_barbershop,
      capsterId: b.id_capster,
      status: b.status,
      source: b.source || "scan",
      waktuPermintaan: b.waktu_permintaan,
      waktuKonfirmasi: null,
      waktuMulaiLayanan: null,
      totalDurationMinutes: totalDuration,
      remainingMinutes: totalDuration,
      waitTimeMinutes: waitTime,
      estimatedStartTime: estStart,
      estimatedEndTime: estEnd,
      positionInQueue: position,
      serviceNames: names.join(" + ") || "Layanan Barbershop",
      antreanKe: position,
      estimasiTungguMenit: waitTime,
      durasiLayanan: totalDuration,
      sisaDurasi: totalDuration,
      estimasiMulai: estStart.toISOString(),
      estimasiSelesai: estEnd.toISOString(),
      totalAntreanSebelumnya: position - 1,
    };
  }

  return null;
}
