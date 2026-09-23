import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  barbershop,
  booking,
  capster,
  detailBooking,
  komisiTransaksi,
  layanan,
  notifikasi,
  pembayaranKomisi,
  pengajuanKomisi,
  saldoBisnis,
  transaksi,
  users,
} from "../db/schema.ts";
import { logAudit } from "./audit.ts";
import { formatRupiah } from "./format.ts";

export type CommissionCardState =
  | "can_withdraw" // Belum Terbayar (RpX) -> [ Ajukan Penarikan ]
  | "pending" // Menunggu Persetujuan Owner
  | "approved" // Menunggu Pembayaran (Disetujui oleh owner) -> [ Menunggu Pembayaran ]
  | "paid" // Sudah Terbayar (RpX) -> [tanggal] • [waktu] WIB
  | "rejected"; // Ditolak oleh owner

export type CapsterCommissionDashboardData = {
  capsterId: string;
  capsterName: string;
  barbershopId: string;
  persentaseKomisi: number;
  komisiHariIni: number;
  totalBelumTerbayar: number;
  cardState: CommissionCardState;
  activePengajuan: {
    idPengajuan: string;
    jumlah: number;
    status: string;
    diajukanAt: string | null;
    disetujuiAt: string | null;
    ditolakAt: string | null;
    alasanPenolakan?: string | null;
    dibayarAt?: string | null;
    dibayarAtFormatted?: string | null;
    metodePembayaran?: string | null;
  } | null;
  notifikasiTerbaru: Array<{
    id: string;
    judul: string;
    pesan: string;
    tipe: string;
    createdAt: string;
  }>;
};

export function formatWibTimestamp(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return `${datePart} • ${timePart} WIB`;
}

export function formatShortWib(date: Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return `${datePart}, ${timePart}`;
}

export function formatFullWib(date: Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return `${datePart}, ${timePart} WIB`;
}

export function parseCommissionDateRange(
  period?: string,
  customStart?: string,
  customEnd?: string,
): { startDate: Date | null; endDate: Date | null; label: string } {
  const now = new Date();
  const jakartaTodayStr = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  if (period === "today") {
    return {
      startDate: new Date(`${jakartaTodayStr}T00:00:00+07:00`),
      endDate: new Date(`${jakartaTodayStr}T23:59:59.999+07:00`),
      label: "Hari Ini",
    };
  }
  if (period === "7d") {
    const end = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
    return { startDate: start, endDate: end, label: "7 Hari Terakhir" };
  }
  if (period === "30d") {
    const end = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    return { startDate: start, endDate: end, label: "30 Hari Terakhir" };
  }
  if (period === "month") {
    const [y, m] = jakartaTodayStr.split("-").map(Number);
    const yVal = y ?? now.getFullYear();
    const mVal = m ?? (now.getMonth() + 1);
    const daysInMonth = new Date(yVal, mVal, 0).getDate();
    const mStr = String(mVal).padStart(2, "0");
    const lastDayStr = String(daysInMonth).padStart(2, "0");
    const start = new Date(`${yVal}-${mStr}-01T00:00:00+07:00`);
    const end = new Date(`${yVal}-${mStr}-${lastDayStr}T23:59:59.999+07:00`);
    const monthName = start.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    return {
      startDate: start,
      endDate: end,
      label: `1 - ${daysInMonth} ${monthName}`,
    };
  }
  if (period === "custom" && customStart && customEnd) {
    return {
      startDate: new Date(`${customStart}T00:00:00+07:00`),
      endDate: new Date(`${customEnd}T23:59:59.999+07:00`),
      label: `${customStart} s/d ${customEnd}`,
    };
  }
  return { startDate: null, endDate: null, label: "Semua Waktu" };
}

/**
 * 1. CATAT KOMISI DARI TRANSAKSI SELESAI (SNAPSHOT PERSENTASE)
 * Hanya dipanggil saat transaksi dan pembayaran benar-benar COMPLETED.
 */
export async function recordCommissionForTransaction(transactionId: string): Promise<boolean> {
  try {
    const [tx] = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        id_barbershop: transaksi.id_barbershop,
        id_capster: transaksi.id_capster,
        total: transaksi.total,
        status_transaksi: transaksi.status_transaksi,
      })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, transactionId))
      .limit(1);

    if (!tx || !tx.id_capster || !tx.id_barbershop) return false;

    // Komisi HANYA untuk transaksi yang completed/paid
    if (tx.status_transaksi !== "completed" && tx.status_transaksi !== "paid") {
      return false;
    }

    // Cek apakah komisi sudah pernah dibuat sebelumnya
    const [existing] = await db
      .select({ id_komisi_trx: komisiTransaksi.id_komisi_trx })
      .from(komisiTransaksi)
      .where(eq(komisiTransaksi.id_transaksi, transactionId))
      .limit(1);

    if (existing) return true;

    // Dapatkan data capster & persentase komisi
    const [c] = await db
      .select({
        id_capster: capster.id_capster,
        persentase_komisi: capster.persentase_komisi,
      })
      .from(capster)
      .where(eq(capster.id_capster, tx.id_capster))
      .limit(1);

    if (!c) return false;

    const persentase = Number(c.persentase_komisi || 15);
    const dasarKomisi = Number(tx.total || 0);
    const nominalKomisi = Math.round(dasarKomisi * (persentase / 100));

    await db.insert(komisiTransaksi).values({
      id_transaksi: tx.id_transaksi,
      id_capster: tx.id_capster,
      id_barbershop: tx.id_barbershop,
      persentase_komisi: String(persentase),
      dasar_komisi: String(dasarKomisi),
      nominal_komisi: String(nominalKomisi),
      status: "belum_dibayar",
    });

    return true;
  } catch (err) {
    console.error("Gagal mencatat komisi transaksi:", err);
    return false;
  }
}

/**
 * 2. GET CAPSTER COMMISSION DASHBOARD DATA
 */
export async function getCapsterCommissionDashboardLogic(data?: {
  capsterId?: string;
  userId?: string;
  barbershopSlug?: string;
}): Promise<CapsterCommissionDashboardData | null> {
  let targetCapsterId = data?.capsterId?.trim();
  let targetUserId = data?.userId?.trim();

  if (!targetCapsterId && targetUserId) {
    const [c] = await db
      .select({ id_capster: capster.id_capster })
      .from(capster)
      .where(eq(capster.id_user, targetUserId))
      .limit(1);
    if (c) targetCapsterId = c.id_capster;
  }

  if (!targetCapsterId) return null;

  // Ambil profil capster & barbershop
  const [capsterRecord] = await db
    .select({
      id_capster: capster.id_capster,
      id_barbershop: capster.id_barbershop,
      nama_lengkap: users.nama_lengkap,
      id_user: users.id_user,
      persentase_komisi: capster.persentase_komisi,
    })
    .from(capster)
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(eq(capster.id_capster, targetCapsterId))
    .limit(1);

  if (!capsterRecord) return null;

  const barbershopId = capsterRecord.id_barbershop;
  targetUserId = capsterRecord.id_user;

  // 1. Hitung Komisi Hari Ini (WIB)
  const jakartaTodayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
  const startOfToday = new Date(`${jakartaTodayStr}T00:00:00+07:00`);
  const endOfToday = new Date(`${jakartaTodayStr}T23:59:59.999+07:00`);

  const todayCommissions = await db
    .select({ nominal: komisiTransaksi.nominal_komisi })
    .from(komisiTransaksi)
    .where(
      and(
        eq(komisiTransaksi.id_capster, targetCapsterId),
        eq(komisiTransaksi.id_barbershop, barbershopId),
        gte(komisiTransaksi.created_at, startOfToday),
        lte(komisiTransaksi.created_at, endOfToday),
      ),
    );

  const komisiHariIni = todayCommissions.reduce((sum, c) => sum + Number(c.nominal), 0);

  // 2. Hitung Total Komisi Belum Terbayar (status = 'belum_dibayar')
  const unpaidCommissions = await db
    .select({ nominal: komisiTransaksi.nominal_komisi })
    .from(komisiTransaksi)
    .where(
      and(
        eq(komisiTransaksi.id_capster, targetCapsterId),
        eq(komisiTransaksi.id_barbershop, barbershopId),
        eq(komisiTransaksi.status, "belum_dibayar"),
      ),
    );

  const totalBelumTerbayar = unpaidCommissions.reduce((sum, c) => sum + Number(c.nominal), 0);

  // 3. Ambil pengajuan terakhir capster
  const [latestPengajuan] = await db
    .select({
      id_pengajuan: pengajuanKomisi.id_pengajuan,
      jumlah_pengajuan: pengajuanKomisi.jumlah_pengajuan,
      status: pengajuanKomisi.status,
      keterangan: pengajuanKomisi.keterangan,
      diajukan_at: pengajuanKomisi.diajukan_at,
      disetujui_at: pengajuanKomisi.disetujui_at,
      ditolak_at: pengajuanKomisi.ditolak_at,
      alasan_penolakan: pengajuanKomisi.alasan_penolakan,
    })
    .from(pengajuanKomisi)
    .where(
      and(
        eq(pengajuanKomisi.id_capster, targetCapsterId),
        eq(pengajuanKomisi.id_barbershop, barbershopId),
      ),
    )
    .orderBy(desc(pengajuanKomisi.created_at))
    .limit(1);

  // 4. Ambil data pembayaran jika ada (status = 'success')
  let isPaid = false;
  let paymentDetail: {
    dibayarAt: string | null;
    dibayarAtFormatted: string | null;
    metodePembayaran: string | null;
  } | null = null;

  if (latestPengajuan) {
    const [pay] = await db
      .select({
        dibayar_at: pembayaranKomisi.dibayar_at,
        metode_pembayaran: pembayaranKomisi.metode_pembayaran,
        status: pembayaranKomisi.status,
      })
      .from(pembayaranKomisi)
      .where(
        and(
          eq(pembayaranKomisi.id_pengajuan, latestPengajuan.id_pengajuan),
          eq(pembayaranKomisi.status, "success"),
        ),
      )
      .orderBy(desc(pembayaranKomisi.created_at))
      .limit(1);

    if (pay || latestPengajuan.status === "paid") {
      isPaid = true;
      paymentDetail = {
        dibayarAt: pay?.dibayar_at ? pay.dibayar_at.toISOString() : null,
        dibayarAtFormatted: formatWibTimestamp(pay?.dibayar_at),
        metodePembayaran: pay?.metode_pembayaran || "transfer",
      };
    }
  }

  // 5. Tentukan visual state card
  let cardState: CommissionCardState = "can_withdraw";
  let activePengajuanData: CapsterCommissionDashboardData["activePengajuan"] = null;

  if (latestPengajuan) {
    activePengajuanData = {
      idPengajuan: latestPengajuan.id_pengajuan,
      jumlah: Number(latestPengajuan.jumlah_pengajuan),
      status: latestPengajuan.status,
      diajukanAt: latestPengajuan.diajukan_at?.toISOString() || null,
      disetujuiAt: latestPengajuan.disetujui_at?.toISOString() || null,
      ditolakAt: latestPengajuan.ditolak_at?.toISOString() || null,
      alasanPenolakan: latestPengajuan.alasan_penolakan,
      dibayarAt: paymentDetail?.dibayarAt || null,
      dibayarAtFormatted: paymentDetail?.dibayarAtFormatted || null,
      metodePembayaran: paymentDetail?.metodePembayaran || null,
    };

    if (latestPengajuan.status === "pending") {
      cardState = "pending";
    } else if (isPaid) {
      if (totalBelumTerbayar > 0) {
        cardState = "can_withdraw";
      } else {
        cardState = "paid";
      }
    } else if (latestPengajuan.status === "approved") {
      cardState = "approved";
    } else if (latestPengajuan.status === "rejected") {
      cardState = totalBelumTerbayar > 0 ? "can_withdraw" : "rejected";
    }
  } else {
    cardState = "can_withdraw";
  }

  // 6. Ambil notifikasi terbaru untuk capster
  const notifRows = await db
    .select({
      id_notifikasi: notifikasi.id_notifikasi,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      tipe: notifikasi.tipe,
      created_at: notifikasi.created_at,
    })
    .from(notifikasi)
    .where(
      and(
        eq(notifikasi.id_user, targetUserId),
        eq(notifikasi.id_barbershop, barbershopId),
      ),
    )
    .orderBy(desc(notifikasi.created_at))
    .limit(5);

  return {
    capsterId: targetCapsterId,
    capsterName: capsterRecord.nama_lengkap,
    barbershopId,
    persentaseKomisi: Number(capsterRecord.persentase_komisi || 15),
    komisiHariIni,
    totalBelumTerbayar,
    cardState,
    activePengajuan: activePengajuanData,
    notifikasiTerbaru: notifRows.map((n) => ({
      id: n.id_notifikasi,
      judul: n.judul,
      pesan: n.pesan,
      tipe: n.tipe,
      createdAt: n.created_at.toISOString(),
    })),
  };
}

export const getCapsterCommissionDashboard = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            capsterId?: string;
            userId?: string;
            barbershopSlug?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => getCapsterCommissionDashboardLogic(data));

/**
 * 3. CAPSTER AJUKAN PENARIKAN KOMISI
 */
export async function requestCommissionWithdrawalLogic(data?: {
  capsterId?: string;
  userId?: string;
  barbershopSlug?: string;
  keterangan?: string;
}) {
  let targetCapsterId = data?.capsterId?.trim();
  let targetUserId = data?.userId?.trim();

  if (!targetCapsterId && targetUserId) {
    const [c] = await db
      .select({ id_capster: capster.id_capster })
      .from(capster)
      .where(eq(capster.id_user, targetUserId))
      .limit(1);
    if (c) targetCapsterId = c.id_capster;
  }

  if (!targetCapsterId) {
    throw new Error("ID Capster wajib diisi untuk mengajukan penarikan komisi.");
  }

  const [c] = await db
    .select({
      id_capster: capster.id_capster,
      id_barbershop: capster.id_barbershop,
      id_user: capster.id_user,
      nama_lengkap: users.nama_lengkap,
    })
    .from(capster)
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(eq(capster.id_capster, targetCapsterId))
    .limit(1);

  if (!c) {
    throw new Error("Data capster tidak ditemukan.");
  }

  const barbershopId = c.id_barbershop;

  // Backend validation: Cek apakah masih ada pengajuan aktif (pending / approved yang belum dibayar)
  const candidateActive = await db
    .select({
      id_pengajuan: pengajuanKomisi.id_pengajuan,
      status: pengajuanKomisi.status,
    })
    .from(pengajuanKomisi)
    .where(
      and(
        eq(pengajuanKomisi.id_capster, targetCapsterId),
        eq(pengajuanKomisi.id_barbershop, barbershopId),
        inArray(pengajuanKomisi.status, ["pending", "approved"]),
      ),
    );

  for (const act of candidateActive) {
    if (act.status === "pending") {
      throw new Error(
        "Pengajuan penarikan masih dalam status Menunggu Persetujuan. Harap selesaikan pengajuan sebelumnya terlebih dahulu.",
      );
    }
    if (act.status === "approved") {
      const [pay] = await db
        .select({ id: pembayaranKomisi.id_pembayaran_komisi })
        .from(pembayaranKomisi)
        .where(
          and(
            eq(pembayaranKomisi.id_pengajuan, act.id_pengajuan),
            eq(pembayaranKomisi.status, "success"),
          ),
        )
        .limit(1);

      if (!pay) {
        throw new Error(
          "Pengajuan penarikan masih dalam status Menunggu Pembayaran. Harap selesaikan pengajuan sebelumnya terlebih dahulu.",
        );
      }
    }
  }

  // Ambil semua komisi transaksi belum dibayar milik capster
  const unpaidTxs = await db
    .select({
      id_komisi_trx: komisiTransaksi.id_komisi_trx,
      nominal_komisi: komisiTransaksi.nominal_komisi,
    })
    .from(komisiTransaksi)
    .where(
      and(
        eq(komisiTransaksi.id_capster, targetCapsterId),
        eq(komisiTransaksi.id_barbershop, barbershopId),
        eq(komisiTransaksi.status, "belum_dibayar"),
      ),
    );

  const totalNominal = unpaidTxs.reduce((sum, t) => sum + Number(t.nominal_komisi), 0);

  if (totalNominal <= 0) {
    throw new Error("Tidak ada komisi yang belum dibayar untuk diajukan.");
  }

  const now = new Date();

  // 1. Buat record PENGAJUAN_KOMISI
  const [newPengajuan] = await db
    .insert(pengajuanKomisi)
    .values({
      id_capster: targetCapsterId,
      id_barbershop: barbershopId,
      jumlah_pengajuan: String(totalNominal),
      status: "pending",
      keterangan: data?.keterangan || "Pengajuan penarikan komisi capster",
      diajukan_at: now,
    })
    .returning();

  if (!newPengajuan) {
    throw new Error("Gagal membuat data pengajuan komisi.");
  }

  // 2. Update status KOMISI_TRANSAKSI menjadi diajukan
  const txIds = unpaidTxs.map((t) => t.id_komisi_trx);
  await db
    .update(komisiTransaksi)
    .set({
      status: "diajukan",
      id_pengajuan: newPengajuan.id_pengajuan,
      updated_at: now,
    })
    .where(inArray(komisiTransaksi.id_komisi_trx, txIds));

  // 3. Kirim NOTIFIKASI ke Owner Barbershop
  const ownerUsers = await db
    .select({ id_user: users.id_user })
    .from(users)
    .where(
      and(
        eq(users.id_barbershop, barbershopId),
        eq(users.role, "owner"),
      ),
    );

  for (const owner of ownerUsers) {
    await db.insert(notifikasi).values({
      id_user: owner.id_user,
      id_barbershop: barbershopId,
      tipe: "pengajuan_komisi",
      judul: "Pengajuan Penarikan Komisi",
      pesan: `Capster ${c.nama_lengkap} mengajukan penarikan komisi sebesar ${formatRupiah(totalNominal)}.`,
    });
  }

  // 4. Catat AUDIT_LOG
  await logAudit({
    barbershopId,
    userId: c.id_user,
    aksi: "pengajuan penarikan komisi",
    entityType: "pengajuan_komisi",
    entityId: newPengajuan.id_pengajuan,
    alasan: `Nominal diajukan: ${formatRupiah(totalNominal)}`,
  });

  return {
    success: true,
    pengajuanId: newPengajuan.id_pengajuan,
    jumlah: totalNominal,
  };
}

export const requestCommissionWithdrawal = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      capsterId?: string;
      userId?: string;
      barbershopSlug?: string;
      keterangan?: string;
    }) => data,
  )
  .handler(async ({ data }) => requestCommissionWithdrawalLogic(data));

/**
 * 4. GET DAFTAR PENGAJUAN KOMISI UNTUK OWNER (TAB PENGAJUAN PENARIKAN)
 */
export async function getOwnerCommissionRequestsLogic(data?: {
  barbershopSlug?: string;
  statusFilter?: string; // 'all' | 'pending' | 'approved' | 'rejected' | 'paid'
  period?: string; // 'month' | 'today' | '7d' | '30d' | 'all' | 'custom'
  customStart?: string;
  customEnd?: string;
  searchQuery?: string;
}) {
  let targetShopId: string | null = null;
  if (data?.barbershopSlug) {
    const [shop] = await db
      .select({ id_barbershop: barbershop.id_barbershop })
      .from(barbershop)
      .where(eq(barbershop.slug, data.barbershopSlug))
      .limit(1);
    if (shop) targetShopId = shop.id_barbershop;
  }

  if (!targetShopId) {
    return {
      dateRangeText: "",
      counts: { all: 0, pending: 0, approved: 0, rejected: 0, paid: 0 },
      requests: [],
    };
  }

  const { startDate, endDate, label: dateRangeText } = parseCommissionDateRange(
    data?.period || "month",
    data?.customStart,
    data?.customEnd,
  );

  const conditions = [eq(pengajuanKomisi.id_barbershop, targetShopId)];

  if (startDate && endDate) {
    conditions.push(gte(pengajuanKomisi.diajukan_at, startDate));
    conditions.push(lte(pengajuanKomisi.diajukan_at, endDate));
  }

  if (data?.searchQuery && data.searchQuery.trim()) {
    const q = `%${data.searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(users.nama_lengkap, q),
        ilike(capster.no_pegawai, q),
      )!,
    );
  }

  const rows = await db
    .select({
      id_pengajuan: pengajuanKomisi.id_pengajuan,
      id_capster: pengajuanKomisi.id_capster,
      id_barbershop: pengajuanKomisi.id_barbershop,
      jumlah_pengajuan: pengajuanKomisi.jumlah_pengajuan,
      status: pengajuanKomisi.status,
      keterangan: pengajuanKomisi.keterangan,
      diajukan_at: pengajuanKomisi.diajukan_at,
      disetujui_at: pengajuanKomisi.disetujui_at,
      ditolak_at: pengajuanKomisi.ditolak_at,
      alasan_penolakan: pengajuanKomisi.alasan_penolakan,
      nama_capster: users.nama_lengkap,
      no_hp: users.no_hp,
      no_pegawai: capster.no_pegawai,
      persentase_komisi: capster.persentase_komisi,
      pembayaran_id: pembayaranKomisi.id_pembayaran_komisi,
      pembayaran_status: pembayaranKomisi.status,
      dibayar_at: pembayaranKomisi.dibayar_at,
      metode_pembayaran: pembayaranKomisi.metode_pembayaran,
      referensi: pembayaranKomisi.referensi,
    })
    .from(pengajuanKomisi)
    .innerJoin(capster, eq(pengajuanKomisi.id_capster, capster.id_capster))
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .leftJoin(
      pembayaranKomisi,
      and(
        eq(pengajuanKomisi.id_pengajuan, pembayaranKomisi.id_pengajuan),
        eq(pembayaranKomisi.status, "success"),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(pengajuanKomisi.diajukan_at));

  const mapped = rows.map((r) => {
    let uiStatus: "pending" | "approved" | "rejected" | "paid" = "pending";
    let statusLabel = "Menunggu Persetujuan";

    const isPaid =
      (r.status === "approved" || r.status === "paid") &&
      !!r.pembayaran_id &&
      r.pembayaran_status === "success";

    if (isPaid) {
      uiStatus = "paid";
      statusLabel = "Sudah Terbayarkan";
    } else if (r.status === "approved") {
      uiStatus = "approved";
      statusLabel = "Disetujui / Menunggu Pembayaran";
    } else if (r.status === "rejected") {
      uiStatus = "rejected";
      statusLabel = "Ditolak";
    } else {
      uiStatus = "pending";
      statusLabel = "Menunggu Persetujuan";
    }

    return {
      idPengajuan: r.id_pengajuan,
      capsterId: r.id_capster,
      capsterName: r.nama_capster,
      capsterPhone: r.no_hp,
      avatarLetter: r.nama_capster ? r.nama_capster.charAt(0).toUpperCase() : "C",
      noPegawai: r.no_pegawai,
      persentaseKomisi: Number(r.persentase_komisi || 15),
      jumlah: Number(r.jumlah_pengajuan),
      status: r.status,
      uiStatus,
      statusLabel,
      keterangan: r.keterangan,
      diajukanAt: r.diajukan_at ? formatWibTimestamp(r.diajukan_at) : "-",
      diajukanAtShort: r.diajukan_at ? formatShortWib(r.diajukan_at) : "-",
      disetujuiAt: r.disetujui_at ? formatWibTimestamp(r.disetujui_at) : null,
      ditolakAt: r.ditolak_at ? formatWibTimestamp(r.ditolak_at) : null,
      alasanPenolakan: r.alasan_penolakan,
      dibayarAt: r.dibayar_at ? formatShortWib(r.dibayar_at) : "-",
      metodePembayaran: r.metode_pembayaran || null,
      referensi: r.referensi || null,
    };
  });

  const counts = {
    all: mapped.length,
    pending: mapped.filter((m) => m.uiStatus === "pending").length,
    approved: mapped.filter((m) => m.uiStatus === "approved").length,
    rejected: mapped.filter((m) => m.uiStatus === "rejected").length,
    paid: mapped.filter((m) => m.uiStatus === "paid").length,
  };

  const filter = data?.statusFilter || "all";
  const filtered = filter === "all" ? mapped : mapped.filter((m) => m.uiStatus === filter);

  return {
    dateRangeText,
    counts,
    requests: filtered,
  };
}

export const getOwnerCommissionRequests = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            barbershopSlug?: string;
            statusFilter?: string;
            period?: string;
            customStart?: string;
            customEnd?: string;
            searchQuery?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => getOwnerCommissionRequestsLogic(data));

/**
 * 5. GET DETAIL PENGAJUAN PENARIKAN KOMISI (SCREEN 2)
 */
export async function getOwnerCommissionRequestDetailLogic(data: {
  pengajuanId: string;
  barbershopSlug?: string;
}) {
  const [p] = await db
    .select({
      id_pengajuan: pengajuanKomisi.id_pengajuan,
      id_capster: pengajuanKomisi.id_capster,
      id_barbershop: pengajuanKomisi.id_barbershop,
      jumlah_pengajuan: pengajuanKomisi.jumlah_pengajuan,
      status: pengajuanKomisi.status,
      keterangan: pengajuanKomisi.keterangan,
      diajukan_at: pengajuanKomisi.diajukan_at,
      disetujui_at: pengajuanKomisi.disetujui_at,
      ditolak_at: pengajuanKomisi.ditolak_at,
      alasan_penolakan: pengajuanKomisi.alasan_penolakan,
      nama_capster: users.nama_lengkap,
      no_hp: users.no_hp,
      capster_status: capster.status,
      no_pegawai: capster.no_pegawai,
      persentase_komisi: capster.persentase_komisi,
    })
    .from(pengajuanKomisi)
    .innerJoin(capster, eq(pengajuanKomisi.id_capster, capster.id_capster))
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId))
    .limit(1);

  if (!p) throw new Error("Pengajuan komisi tidak ditemukan.");

  // Ambil data pembayaran jika sudah berhasil
  const [pay] = await db
    .select()
    .from(pembayaranKomisi)
    .where(
      and(
        eq(pembayaranKomisi.id_pengajuan, p.id_pengajuan),
        eq(pembayaranKomisi.status, "success"),
      ),
    )
    .orderBy(desc(pembayaranKomisi.created_at))
    .limit(1);

  let uiStatus: "pending" | "approved" | "rejected" | "paid" = "pending";
  let statusLabel = "Menunggu Persetujuan";

  if ((p.status === "approved" || p.status === "paid") && pay) {
    uiStatus = "paid";
    statusLabel = "Sudah Terbayarkan";
  } else if (p.status === "approved") {
    uiStatus = "approved";
    statusLabel = "Disetujui / Menunggu Pembayaran";
  } else if (p.status === "rejected") {
    uiStatus = "rejected";
    statusLabel = "Ditolak";
  }

  // Ambil transaksi pembentuk komisi dari KOMISI_TRANSAKSI
  const komisiRows = await db
    .select({
      id_komisi_trx: komisiTransaksi.id_komisi_trx,
      id_transaksi: komisiTransaksi.id_transaksi,
      persentase_komisi: komisiTransaksi.persentase_komisi,
      dasar_komisi: komisiTransaksi.dasar_komisi,
      nominal_komisi: komisiTransaksi.nominal_komisi,
      status: komisiTransaksi.status,
      created_at: komisiTransaksi.created_at,
      id_booking: transaksi.id_booking,
      transaksi_created_at: transaksi.created_at,
      transaksi_total: transaksi.total,
    })
    .from(komisiTransaksi)
    .innerJoin(transaksi, eq(komisiTransaksi.id_transaksi, transaksi.id_transaksi))
    .where(
      or(
        eq(komisiTransaksi.id_pengajuan, p.id_pengajuan),
        and(
          eq(komisiTransaksi.id_capster, p.id_capster),
          eq(komisiTransaksi.id_barbershop, p.id_barbershop),
          lte(komisiTransaksi.created_at, p.diajukan_at),
        ),
      ),
    )
    .orderBy(desc(transaksi.created_at));

  // Ambil nama layanan snapshot dari detailBooking jika tersedia
  const bookingIds = komisiRows
    .map((k) => k.id_booking)
    .filter((b): b is string => Boolean(b));

  const detailMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const details = await db
      .select({
        id_booking: detailBooking.id_booking,
        nama_layanan_snapshot: detailBooking.nama_layanan_snapshot,
      })
      .from(detailBooking)
      .where(inArray(detailBooking.id_booking, bookingIds));

    for (const d of details) {
      if (d.id_booking && !detailMap.has(d.id_booking)) {
        detailMap.set(d.id_booking, d.nama_layanan_snapshot || "Layanan Barbershop");
      }
    }
  }

  const transactions = komisiRows.map((k) => {
    const serviceName =
      (k.id_booking && detailMap.get(k.id_booking)) || "Haircut Classic";
    return {
      id: k.id_komisi_trx,
      tanggalFormatted: formatShortWib(k.transaksi_created_at || k.created_at),
      layananName: serviceName,
      nominal: Number(k.dasar_komisi || k.transaksi_total),
      persentase: Number(k.persentase_komisi || p.persentase_komisi || 15),
      komisi: Number(k.nominal_komisi),
    };
  });

  return {
    capster: {
      id: p.id_capster,
      name: p.nama_capster,
      phone: p.no_hp || "+62 812 3456 7890",
      role: "Capster",
      status: p.capster_status === "active" ? "Aktif" : "Nonaktif",
      avatarLetter: p.nama_capster ? p.nama_capster.charAt(0).toUpperCase() : "C",
      persentaseKomisi: Number(p.persentase_komisi || 15),
    },
    pengajuan: {
      id: p.id_pengajuan,
      jumlah: Number(p.jumlah_pengajuan),
      status: p.status,
      uiStatus,
      statusLabel,
      keterangan: p.keterangan,
      diajukanAtFormatted: formatFullWib(p.diajukan_at),
      disetujuiAtFormatted: p.disetujui_at ? formatFullWib(p.disetujui_at) : null,
      ditolakAtFormatted: p.ditolak_at ? formatFullWib(p.ditolak_at) : null,
      alasanPenolakan: p.alasan_penolakan || null,
      dibayarAtFormatted: pay?.dibayar_at ? formatFullWib(pay.dibayar_at) : null,
      metodePembayaran: pay?.metode_pembayaran || null,
      referensi: pay?.referensi || null,
      catatan: pay?.catatan || null,
    },
    dasarKomisi: {
      transactions,
      totalNominal: transactions.reduce((sum, t) => sum + t.nominal, 0),
      totalKomisi: transactions.reduce((sum, t) => sum + t.komisi, 0),
    },
  };
}

export const getOwnerCommissionRequestDetail = createServerFn({
  method: "GET",
})
  .validator((data: { pengajuanId: string; barbershopSlug?: string }) => data)
  .handler(async ({ data }) => getOwnerCommissionRequestDetailLogic(data));

/**
 * 6. GET REKAP KOMISI (TAB REKAP KOMISI)
 */
export async function getOwnerCommissionRecapLogic(data?: {
  barbershopSlug?: string;
  period?: string;
  customStart?: string;
  customEnd?: string;
  searchQuery?: string;
}) {
  let targetShopId: string | null = null;
  if (data?.barbershopSlug) {
    const [shop] = await db
      .select({ id_barbershop: barbershop.id_barbershop })
      .from(barbershop)
      .where(eq(barbershop.slug, data.barbershopSlug))
      .limit(1);
    if (shop) targetShopId = shop.id_barbershop;
  }

  if (!targetShopId) {
    return {
      dateRangeText: "",
      summary: {
        totalKomisiTerbayar: 0,
        totalKomisiBelumDibayar: 0,
        totalTransaksiSelesai: 0,
        totalOmset: 0,
      },
      items: [],
    };
  }

  const { startDate, endDate, label: dateRangeText } = parseCommissionDateRange(
    data?.period || "month",
    data?.customStart,
    data?.customEnd,
  );

  const capsterConditions = [
    eq(capster.id_barbershop, targetShopId),
    eq(capster.status, "active"),
  ];

  if (data?.searchQuery && data.searchQuery.trim()) {
    const q = `%${data.searchQuery.trim()}%`;
    capsterConditions.push(
      or(
        ilike(users.nama_lengkap, q),
        ilike(capster.no_pegawai, q),
      )!,
    );
  }

  const capsterRows = await db
    .select({
      id_capster: capster.id_capster,
      nama_capster: users.nama_lengkap,
      no_pegawai: capster.no_pegawai,
      persentase_komisi: capster.persentase_komisi,
    })
    .from(capster)
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(and(...capsterConditions));

  const items = [];
  let totalKomisiTerbayar = 0;
  let totalKomisiBelumDibayar = 0;
  let totalTransaksiSelesai = 0;
  let totalOmset = 0;

  for (const c of capsterRows) {
    const trxConditions = [
      eq(komisiTransaksi.id_capster, c.id_capster),
      eq(komisiTransaksi.id_barbershop, targetShopId),
    ];
    if (startDate && endDate) {
      trxConditions.push(gte(komisiTransaksi.created_at, startDate));
      trxConditions.push(lte(komisiTransaksi.created_at, endDate));
    }

    const commRows = await db
      .select({
        dasar_komisi: komisiTransaksi.dasar_komisi,
        nominal_komisi: komisiTransaksi.nominal_komisi,
        status: komisiTransaksi.status,
        created_at: komisiTransaksi.created_at,
      })
      .from(komisiTransaksi)
      .where(and(...trxConditions))
      .orderBy(desc(komisiTransaksi.created_at));

    const countTx = commRows.length;
    const dasarTotal = commRows.reduce((sum, r) => sum + Number(r.dasar_komisi), 0);
    const nominalTotal = commRows.reduce((sum, r) => sum + Number(r.nominal_komisi), 0);
    const belumDibayar = commRows
      .filter((r) => r.status === "belum_dibayar" || r.status === "diajukan")
      .reduce((sum, r) => sum + Number(r.nominal_komisi), 0);
    const sudahDibayar = commRows
      .filter((r) => r.status === "dibayar")
      .reduce((sum, r) => sum + Number(r.nominal_komisi), 0);

    totalTransaksiSelesai += countTx;
    totalOmset += dasarTotal;
    totalKomisiBelumDibayar += belumDibayar;
    totalKomisiTerbayar += sudahDibayar;

    let statusKomisi: "Belum Dibayar" | "Sudah Terbayarkan" | "Sebagian Terbayar" | "Tidak Ada" = "Tidak Ada";
    if (countTx > 0) {
      if (belumDibayar > 0 && sudahDibayar > 0) statusKomisi = "Sebagian Terbayar";
      else if (belumDibayar > 0) statusKomisi = "Belum Dibayar";
      else if (sudahDibayar > 0) statusKomisi = "Sudah Terbayarkan";
    }

    const latestDate = commRows[0]?.created_at;

    items.push({
      capsterId: c.id_capster,
      capsterName: c.nama_capster,
      avatarLetter: c.nama_capster ? c.nama_capster.charAt(0).toUpperCase() : "C",
      noPegawai: c.no_pegawai,
      persentaseKomisi: Number(c.persentase_komisi || 15),
      jumlahTransaksi: countTx,
      dasarKomisi: dasarTotal,
      nominalKomisi: nominalTotal,
      komisiBelumDibayar: belumDibayar,
      komisiTerbayar: sudahDibayar,
      statusKomisi,
      tanggalTerakhirFormatted: latestDate ? formatShortWib(latestDate) : "-",
    });
  }

  return {
    dateRangeText,
    summary: {
      totalKomisiTerbayar,
      totalKomisiBelumDibayar,
      totalTransaksiSelesai,
      totalOmset,
    },
    items,
  };
}

export const getOwnerCommissionRecap = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            barbershopSlug?: string;
            period?: string;
            customStart?: string;
            customEnd?: string;
            searchQuery?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => getOwnerCommissionRecapLogic(data));

/**
 * 7. GET RIWAYAT PEMBAYARAN KOMISI (TAB RIWAYAT PEMBAYARAN)
 */
export async function getOwnerCommissionPaymentHistoryLogic(data?: {
  barbershopSlug?: string;
  period?: string;
  customStart?: string;
  customEnd?: string;
  searchQuery?: string;
}) {
  let targetShopId: string | null = null;
  if (data?.barbershopSlug) {
    const [shop] = await db
      .select({ id_barbershop: barbershop.id_barbershop })
      .from(barbershop)
      .where(eq(barbershop.slug, data.barbershopSlug))
      .limit(1);
    if (shop) targetShopId = shop.id_barbershop;
  }

  if (!targetShopId) {
    return {
      dateRangeText: "",
      payments: [],
    };
  }

  const { startDate, endDate, label: dateRangeText } = parseCommissionDateRange(
    data?.period || "month",
    data?.customStart,
    data?.customEnd,
  );

  const conditions = [
    eq(pembayaranKomisi.id_barbershop, targetShopId),
    eq(pembayaranKomisi.status, "success"),
  ];

  if (startDate && endDate) {
    conditions.push(gte(pembayaranKomisi.dibayar_at, startDate));
    conditions.push(lte(pembayaranKomisi.dibayar_at, endDate));
  }

  if (data?.searchQuery && data.searchQuery.trim()) {
    const q = `%${data.searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(users.nama_lengkap, q),
        ilike(capster.no_pegawai, q),
        ilike(pembayaranKomisi.referensi, q),
      )!,
    );
  }

  const rows = await db
    .select({
      id_pembayaran: pembayaranKomisi.id_pembayaran_komisi,
      id_pengajuan: pembayaranKomisi.id_pengajuan,
      jumlah_bayar: pembayaranKomisi.jumlah_bayar,
      metode_pembayaran: pembayaranKomisi.metode_pembayaran,
      referensi: pembayaranKomisi.referensi,
      status: pembayaranKomisi.status,
      dibayar_at: pembayaranKomisi.dibayar_at,
      catatan: pembayaranKomisi.catatan,
      nama_capster: users.nama_lengkap,
      no_hp: users.no_hp,
      no_pegawai: capster.no_pegawai,
      id_capster: capster.id_capster,
    })
    .from(pembayaranKomisi)
    .innerJoin(pengajuanKomisi, eq(pembayaranKomisi.id_pengajuan, pengajuanKomisi.id_pengajuan))
    .innerJoin(capster, eq(pengajuanKomisi.id_capster, capster.id_capster))
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(and(...conditions))
    .orderBy(desc(pembayaranKomisi.dibayar_at));

  const payments = rows.map((r) => ({
    idPembayaran: r.id_pembayaran,
    idPengajuan: r.id_pengajuan,
    capsterId: r.id_capster,
    capsterName: r.nama_capster,
    capsterPhone: r.no_hp,
    avatarLetter: r.nama_capster ? r.nama_capster.charAt(0).toUpperCase() : "C",
    noPegawai: r.no_pegawai,
    jumlahBayar: Number(r.jumlah_bayar),
    metodePembayaran: r.metode_pembayaran,
    referensi: r.referensi || "-",
    status: r.status,
    statusLabel: "Berhasil",
    dibayarAtFormatted: r.dibayar_at ? formatShortWib(r.dibayar_at) : "-",
    catatan: r.catatan,
  }));

  return {
    dateRangeText,
    payments,
  };
}

export const getOwnerCommissionPaymentHistory = createServerFn({
  method: "GET",
})
  .validator(
    (
      data:
        | {
            barbershopSlug?: string;
            period?: string;
            customStart?: string;
            customEnd?: string;
            searchQuery?: string;
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => getOwnerCommissionPaymentHistoryLogic(data));

/**
 * 8. OWNER SETUJUI PENGAJUAN KOMISI (APPROVE)
 */
export async function approveCommissionRequestLogic(data: {
  pengajuanId: string;
  ownerUserId?: string;
  barbershopSlug?: string;
}) {
  const [p] = await db
    .select()
    .from(pengajuanKomisi)
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId))
    .limit(1);

  if (!p) throw new Error("Pengajuan komisi tidak ditemukan.");
  if (p.status !== "pending") {
    throw new Error(`Pengajuan sudah berstatus ${p.status} dan tidak dapat disetujui.`);
  }

  const now = new Date();

  await db
    .update(pengajuanKomisi)
    .set({
      status: "approved",
      disetujui_at: now,
      updated_at: now,
    })
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId));

  // Dapatkan data user capster untuk notifikasi
  const [c] = await db
    .select({ id_user: capster.id_user })
    .from(capster)
    .where(eq(capster.id_capster, p.id_capster))
    .limit(1);

  if (c) {
    await db.insert(notifikasi).values({
      id_user: c.id_user,
      id_barbershop: p.id_barbershop,
      tipe: "persetujuan_komisi",
      judul: "Pengajuan Komisi Disetujui",
      pesan: `Pengajuan komisi sebesar ${formatRupiah(Number(p.jumlah_pengajuan))} telah disetujui oleh Owner. Menunggu proses pembayaran.`,
    });
  }

  await logAudit({
    barbershopId: p.id_barbershop,
    userId: data.ownerUserId || null,
    aksi: "persetujuan pengajuan komisi",
    entityType: "pengajuan_komisi",
    entityId: p.id_pengajuan,
    alasan: `Disetujui untuk pembayaran: ${formatRupiah(Number(p.jumlah_pengajuan))}`,
  });

  return { success: true };
}

export const approveCommissionRequest = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      pengajuanId: string;
      ownerUserId?: string;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }) => approveCommissionRequestLogic(data));

/**
 * 9. OWNER TOLAK PENGAJUAN KOMISI (REJECT)
 */
export async function rejectCommissionRequestLogic(data: {
  pengajuanId: string;
  alasan: string;
  ownerUserId?: string;
  barbershopSlug?: string;
}) {
  if (!data.alasan || !data.alasan.trim()) {
    throw new Error("Alasan penolakan pengajuan komisi wajib diisi.");
  }

  const [p] = await db
    .select()
    .from(pengajuanKomisi)
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId))
    .limit(1);

  if (!p) throw new Error("Pengajuan komisi tidak ditemukan.");
  if (p.status !== "pending") {
    throw new Error(`Pengajuan berstatus ${p.status} dan tidak dapat ditolak.`);
  }

  const now = new Date();

  // 1. Update PENGAJUAN_KOMISI -> rejected
  await db
    .update(pengajuanKomisi)
    .set({
      status: "rejected",
      ditolak_at: now,
      ditolak_oleh: data.ownerUserId,
      alasan_penolakan: data.alasan.trim(),
      updated_at: now,
    })
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId));

  // 2. Kembalikan status KOMISI_TRANSAKSI ke belum_dibayar
  await db
    .update(komisiTransaksi)
    .set({
      status: "belum_dibayar",
      id_pengajuan: null,
      updated_at: now,
    })
    .where(eq(komisiTransaksi.id_pengajuan, data.pengajuanId));

  // 3. Kirim notifikasi ke Capster
  const [c] = await db
    .select({ id_user: capster.id_user })
    .from(capster)
    .where(eq(capster.id_capster, p.id_capster))
    .limit(1);

  if (c) {
    await db.insert(notifikasi).values({
      id_user: c.id_user,
      id_barbershop: p.id_barbershop,
      tipe: "penolakan_komisi",
      judul: "Pengajuan Komisi Ditolak",
      pesan: `Pengajuan komisi sebesar ${formatRupiah(Number(p.jumlah_pengajuan))} ditolak oleh Owner: ${data.alasan.trim()}`,
    });
  }

  await logAudit({
    barbershopId: p.id_barbershop,
    userId: data.ownerUserId || null,
    aksi: "penolakan pengajuan komisi",
    entityType: "pengajuan_komisi",
    entityId: p.id_pengajuan,
    alasan: data.alasan.trim(),
  });

  return { success: true };
}

export const rejectCommissionRequest = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      pengajuanId: string;
      alasan: string;
      ownerUserId?: string;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }) => rejectCommissionRequestLogic(data));

/**
 * 10. OWNER LAKUKAN PEMBAYARAN KOMISI (ATOMIC TRANSACTION)
 * PENGAJUAN_KOMISI.status tetap 'approved', PEMBAYARAN_KOMISI.status = 'success'
 */
export async function payCommissionRequestLogic(data: {
  pengajuanId: string;
  ownerUserId?: string;
  metodePembayaran?: "tunai" | "transfer" | "qris";
  referensi?: string;
  catatan?: string;
  barbershopSlug?: string;
}) {
  const [p] = await db
    .select()
    .from(pengajuanKomisi)
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId))
    .limit(1);

  if (!p) throw new Error("Pengajuan komisi tidak ditemukan.");

  if (p.status !== "approved") {
    throw new Error(`Pengajuan harus disetujui terlebih dahulu sebelum dibayar (status saat ini: ${p.status}).`);
  }

  // Cek double payment di tabel PEMBAYARAN_KOMISI
  const [existingPayment] = await db
    .select({ id: pembayaranKomisi.id_pembayaran_komisi })
    .from(pembayaranKomisi)
    .where(
      and(
        eq(pembayaranKomisi.id_pengajuan, data.pengajuanId),
        eq(pembayaranKomisi.status, "success"),
      ),
    )
    .limit(1);

  if (existingPayment) {
    throw new Error("Pembayaran untuk pengajuan ini sudah tercatat berhasil.");
  }

  const amount = Number(p.jumlah_pengajuan);
  const barbershopId = p.id_barbershop;
  const now = new Date();

  // 1. Catat record PEMBAYARAN_KOMISI
  const [newPayment] = await db
    .insert(pembayaranKomisi)
    .values({
      id_pengajuan: p.id_pengajuan,
      id_barbershop: barbershopId,
      jumlah_bayar: String(amount),
      metode_pembayaran: data.metodePembayaran || "transfer",
      referensi: data.referensi || `TRF-KOMISI-${Date.now()}`,
      status: "success",
      dibayar_at: now,
      dibayar_oleh: data.ownerUserId,
      catatan: data.catatan || "Pembayaran komisi capster",
    })
    .returning();

  if (!newPayment) {
    throw new Error("Gagal membuat record pembayaran komisi.");
  }

  // 2. Ambil saldo bisnis terakhir dan kurangi secara atomik
  const [lastSaldoRow] = await db
    .select({ saldo: saldoBisnis.saldo })
    .from(saldoBisnis)
    .where(eq(saldoBisnis.id_barbershop, barbershopId))
    .orderBy(desc(saldoBisnis.created_at))
    .limit(1);

  const prevSaldo = Number(lastSaldoRow?.saldo || 0);
  const updatedSaldo = Math.max(0, prevSaldo - amount);

  await db.insert(saldoBisnis).values({
    id_barbershop: barbershopId,
    jenis_transaksi: "pembayaran_komisi",
    referensi_id: newPayment.id_pembayaran_komisi,
    debit: "0",
    kredit: String(amount),
    saldo: String(updatedSaldo),
    keterangan: `Pembayaran komisi capster senilai ${formatRupiah(amount)}`,
  });

  // 3. Update PENGAJUAN_KOMISI: status TETAP 'approved', hanya update updated_at
  await db
    .update(pengajuanKomisi)
    .set({
      updated_at: now,
    })
    .where(eq(pengajuanKomisi.id_pengajuan, data.pengajuanId));

  // 4. Update status KOMISI_TRANSAKSI -> dibayar
  await db
    .update(komisiTransaksi)
    .set({
      status: "dibayar",
      updated_at: now,
    })
    .where(eq(komisiTransaksi.id_pengajuan, data.pengajuanId));

  // 5. Kirim NOTIFIKASI ke Capster
  const [c] = await db
    .select({
      id_user: capster.id_user,
      nama_lengkap: users.nama_lengkap,
    })
    .from(capster)
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(eq(capster.id_capster, p.id_capster))
    .limit(1);

  if (c) {
    await db.insert(notifikasi).values({
      id_user: c.id_user,
      id_barbershop: barbershopId,
      tipe: "pembayaran_komisi",
      judul: "Komisi Sudah Dibayarkan",
      pesan: `Komisi sebesar ${formatRupiah(amount)} telah dibayarkan oleh Owner.`,
    });
  }

  // 6. Kirim NOTIFIKASI konfirmasi ke Owner jika ada ownerUserId
  if (data.ownerUserId) {
    await db.insert(notifikasi).values({
      id_user: data.ownerUserId,
      id_barbershop: barbershopId,
      tipe: "pembayaran_komisi",
      judul: "Komisi Berhasil Dibayarkan",
      pesan: `Pembayaran komisi untuk capster ${c?.nama_lengkap || "Capster"} sebesar ${formatRupiah(amount)} telah berhasil diproses.`,
    });
  }

  // 7. Catat AUDIT_LOG
  await logAudit({
    barbershopId,
    userId: data.ownerUserId || null,
    aksi: "pembayaran komisi sukses",
    entityType: "pembayaran_komisi",
    entityId: newPayment.id_pembayaran_komisi,
    alasan: `Pembayaran komisi sebesar ${formatRupiah(amount)} berhasil`,
  });

  return {
    success: true,
    paymentId: newPayment.id_pembayaran_komisi,
    amount,
    updatedSaldo,
    dibayarAt: now.toISOString(),
    dibayarAtFormatted: formatShortWib(now),
  };
}

export const payCommissionRequest = createServerFn({
  method: "POST",
})
  .validator(
    (data: {
      pengajuanId: string;
      ownerUserId?: string;
      metodePembayaran?: "tunai" | "transfer" | "qris";
      referensi?: string;
      catatan?: string;
      barbershopSlug?: string;
    }) => data,
  )
  .handler(async ({ data }) => payCommissionRequestLogic(data));
