import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  barbershop,
  capster,
  komisiTransaksi,
  notifikasi,
  pembayaranKomisi,
  pengajuanKomisi,
  saldoBisnis,
  transaksi,
  users,
} from "../db/schema";
import { logAudit } from "./audit";
import { formatRupiah } from "./format";

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

  const [capsterRecord] = await db
    .select({
      id_capster: capster.id_capster,
      id_barbershop: capster.id_barbershop,
      id_user: capster.id_user,
      persentase_komisi: capster.persentase_komisi,
      nama_lengkap: users.nama_lengkap,
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

  const todayRows = await db
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

  const komisiHariIni = todayRows.reduce((sum, r) => sum + Number(r.nominal), 0);

  // 2. Hitung Total Komisi Belum Terbayar (dapat diajukan)
  const unpaidRows = await db
    .select({ nominal: komisiTransaksi.nominal_komisi })
    .from(komisiTransaksi)
    .where(
      and(
        eq(komisiTransaksi.id_capster, targetCapsterId),
        eq(komisiTransaksi.id_barbershop, barbershopId),
        eq(komisiTransaksi.status, "belum_dibayar"),
      ),
    );

  const totalBelumTerbayar = unpaidRows.reduce((sum, r) => sum + Number(r.nominal), 0);

  // 3. Ambil pengajuan terakhir / aktif
  const [latestPengajuan] = await db
    .select({
      id_pengajuan: pengajuanKomisi.id_pengajuan,
      jumlah_pengajuan: pengajuanKomisi.jumlah_pengajuan,
      status: pengajuanKomisi.status,
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

  // 4. Ambil data pembayaran jika ada
  let paymentDetail: {
    dibayarAt: string | null;
    dibayarAtFormatted: string | null;
    metodePembayaran: string | null;
  } | null = null;

  if (latestPengajuan && latestPengajuan.status === "paid") {
    const [pay] = await db
      .select({
        dibayar_at: pembayaranKomisi.dibayar_at,
        metode_pembayaran: pembayaranKomisi.metode_pembayaran,
      })
      .from(pembayaranKomisi)
      .where(eq(pembayaranKomisi.id_pengajuan, latestPengajuan.id_pengajuan))
      .orderBy(desc(pembayaranKomisi.created_at))
      .limit(1);

    if (pay) {
      paymentDetail = {
        dibayarAt: pay.dibayar_at ? pay.dibayar_at.toISOString() : null,
        dibayarAtFormatted: formatWibTimestamp(pay.dibayar_at),
        metodePembayaran: pay.metode_pembayaran,
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
    } else if (latestPengajuan.status === "approved") {
      cardState = "approved";
    } else if (latestPengajuan.status === "paid") {
      if (totalBelumTerbayar > 0) {
        cardState = "can_withdraw";
      } else {
        cardState = "paid";
      }
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
 * 3. AJUKAN PENARIKAN KOMISI (CAPSTER)
 */
export async function requestCommissionWithdrawalLogic(data: {
  capsterId?: string;
  userId?: string;
  barbershopSlug?: string;
  keterangan?: string;
}) {
  let targetCapsterId = data.capsterId?.trim();
  if (!targetCapsterId && data.userId) {
    const [c] = await db
      .select({ id_capster: capster.id_capster })
      .from(capster)
      .where(eq(capster.id_user, data.userId))
      .limit(1);
    if (c) targetCapsterId = c.id_capster;
  }

  if (!targetCapsterId) {
    throw new Error("Akun capster tidak valid.");
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

  // Backend validation: Cek apakah masih ada pengajuan aktif (pending / approved)
  const [active] = await db
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
    )
    .limit(1);

  if (active) {
    throw new Error(
      `Pengajuan penarikan masih dalam status ${active.status === "pending" ? "Menunggu Persetujuan" : "Menunggu Pembayaran"}. Harap selesaikan pengajuan sebelumnya terlebih dahulu.`,
    );
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
      keterangan: data.keterangan || "Pengajuan penarikan komisi capster",
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
 * 4. GET DAFTAR PENGAJUAN KOMISI UNTUK OWNER
 */
export async function getOwnerCommissionRequestsLogic(data?: {
  barbershopSlug?: string;
  statusFilter?: string;
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

  if (!targetShopId) return [];

  const conditions = [eq(pengajuanKomisi.id_barbershop, targetShopId)];
  if (data?.statusFilter && data.statusFilter !== "all") {
    conditions.push(eq(pengajuanKomisi.status, data.statusFilter as any));
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
      no_pegawai: capster.no_pegawai,
      persentase_komisi: capster.persentase_komisi,
    })
    .from(pengajuanKomisi)
    .innerJoin(capster, eq(pengajuanKomisi.id_capster, capster.id_capster))
    .innerJoin(users, eq(capster.id_user, users.id_user))
    .where(and(...conditions))
    .orderBy(desc(pengajuanKomisi.diajukan_at));

  return rows.map((r) => ({
    idPengajuan: r.id_pengajuan,
    capsterId: r.id_capster,
    capsterName: r.nama_capster,
    noPegawai: r.no_pegawai,
    persentaseKomisi: Number(r.persentase_komisi || 15),
    jumlah: Number(r.jumlah_pengajuan),
    status: r.status,
    keterangan: r.keterangan,
    diajukanAt: r.diajukan_at ? formatWibTimestamp(r.diajukan_at) : "-",
    disetujuiAt: r.disetujui_at ? formatWibTimestamp(r.disetujui_at) : null,
    ditolakAt: r.ditolak_at ? formatWibTimestamp(r.ditolak_at) : null,
    alasanPenolakan: r.alasan_penolakan,
  }));
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
          }
        | undefined,
    ) => data,
  )
  .handler(async ({ data }) => getOwnerCommissionRequestsLogic(data));

/**
 * 5. OWNER SETUJUI PENGAJUAN KOMISI (APPROVE)
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
    userId: data.ownerUserId,
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
 * 6. OWNER TOLAK PENGAJUAN KOMISI (REJECT)
 */
export async function rejectCommissionRequestLogic(data: {
  pengajuanId: string;
  alasan: string;
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
    userId: data.ownerUserId,
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
 * 7. OWNER LAKUKAN PEMBAYARAN KOMISI (ATOMIC TRANSACTION)
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
    if (p.status === "paid") {
      throw new Error("Pengajuan ini sudah pernah dibayarkan sebelumnya.");
    }
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

  // 3. Update status PENGAJUAN_KOMISI -> paid
  await db
    .update(pengajuanKomisi)
    .set({
      status: "paid",
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
    userId: data.ownerUserId,
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
    dibayarAtFormatted: formatWibTimestamp(now),
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
