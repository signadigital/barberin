import "dotenv/config";
import dns from "node:dns";
import { Resolver } from "node:dns/promises";

// Setup DNS fallback
try {
  const origLookup = dns.lookup;
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    origLookup(hostname, options, (err, address, family) => {
      if (!err) return callback(null, address, family);
      resolver
        .resolve4(hostname)
        .then((addresses) => {
          if (options && options.all) {
            callback(
              null,
              addresses.map((a) => ({ address: a, family: 4 })),
            );
          } else {
            callback(null, addresses[0], 4);
          }
        })
        .catch(() => callback(err, address, family));
    });
  };
} catch {
  // ignore
}

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  }
}

async function run() {
  console.log("\n=======================================================");
  console.log("  BARBERIN — VERIFIKASI FITUR PENARIKAN KOMISI CAPSTER");
  console.log("=======================================================\n");

  const cleanup = {
    barbershops: [],
    users: [],
    capsters: [],
    layanan: [],
    shifts: [],
    bookings: [],
    transaksi: [],
    komisi: [],
    pengajuan: [],
    pembayaran: [],
    saldo: [],
    notifikasi: [],
  };

  const testId = `test_comm_${Date.now()}`;
  const now = new Date();

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP FIXTURES (MULTI-TENANT): Shop A & Shop B
    // -------------------------------------------------------------------------
    console.log("--- 1. Menyiapkan Fixture Multi-Tenant (Shop A & Shop B) ---");

    const [shopA] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Barbershop A ${testId}`}, ${`shop-a-${testId}`}, 'Jl. A', '081111', 'active')
      RETURNING id_barbershop, slug;
    `;
    cleanup.barbershops.push(shopA.id_barbershop);

    const [shopB] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Barbershop B ${testId}`}, ${`shop-b-${testId}`}, 'Jl. B', '082222', 'active')
      RETURNING id_barbershop, slug;
    `;
    cleanup.barbershops.push(shopB.id_barbershop);

    // Initial Saldo Bisnis Shop A: Rp 2.000.000
    const [saldoA] = await sql`
      INSERT INTO saldo_bisnis (
        id_barbershop, jenis_transaksi, referensi_id, debit, kredit, saldo, keterangan
      ) VALUES (
        ${shopA.id_barbershop}, 'pendapatan', 'INIT', 2000000, 0, 2000000, 'Saldo awal Shop A'
      ) RETURNING id_saldo, saldo;
    `;
    cleanup.saldo.push(saldoA.id_saldo);

    // Owner Shop A & Owner Shop B
    const [ownerA] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`ownerA_${testId}@barberin.test`}, 'Owner A', 'owner', 'active', ${shopA.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(ownerA.id_user);

    const [ownerB] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`ownerB_${testId}@barberin.test`}, 'Owner B', 'owner', 'active', ${shopB.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(ownerB.id_user);

    // Capster A1 (20% komisi) & Capster A2 (10% komisi) in Shop A
    const [userCapA1] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`capA1_${testId}@barberin.test`}, 'Singgih Pratama', 'capster', 'active', ${shopA.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(userCapA1.id_user);

    const [capA1] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapA1.id_user}, ${shopA.id_barbershop}, 'Singgih Pratama', 'CAP-A1', 20.00, 'active')
      RETURNING id_capster, persentase_komisi;
    `;
    cleanup.capsters.push(capA1.id_capster);

    const [userCapA2] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`capA2_${testId}@barberin.test`}, 'Capster A2', 'capster', 'active', ${shopA.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(userCapA2.id_user);

    const [capA2] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapA2.id_user}, ${shopA.id_barbershop}, 'Capster A2', 'CAP-A2', 10.00, 'active')
      RETURNING id_capster, persentase_komisi;
    `;
    cleanup.capsters.push(capA2.id_capster);

    // Capster B1 in Shop B (15% komisi)
    const [userCapB1] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`capB1_${testId}@barberin.test`}, 'Capster B1', 'capster', 'active', ${shopB.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(userCapB1.id_user);

    const [capB1] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapB1.id_user}, ${shopB.id_barbershop}, 'Capster B1', 'CAP-B1', 15.00, 'active')
      RETURNING id_capster, persentase_komisi;
    `;
    cleanup.capsters.push(capB1.id_capster);

    // Shift & Customer
    const [shiftA1] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, status)
      VALUES (${capA1.id_capster}, ${shopA.id_barbershop}, ${now}, '08:00', 'ongoing')
      RETURNING id_shift;
    `;
    cleanup.shifts.push(shiftA1.id_shift);

    const [custUser] = await sql`
      INSERT INTO users (email, nama_lengkap, role, status, id_barbershop)
      VALUES (${`cust_${testId}@barberin.test`}, 'Pelanggan Uji', 'pelanggan', 'active', ${shopA.id_barbershop})
      RETURNING id_user;
    `;
    cleanup.users.push(custUser.id_user);

    const [cust] = await sql`
      INSERT INTO pelanggan (id_user, id_barbershop, nama_pelanggan, no_hp)
      VALUES (${custUser.id_user}, ${shopA.id_barbershop}, 'Pelanggan Uji', '089999')
      RETURNING id_pelanggan;
    `;

    assert(Number(capA1.persentase_komisi) === 20.00, "Persentase komisi Capster A1 tersimpan sebesar 20%");
    assert(Number(capA2.persentase_komisi) === 10.00, "Persentase komisi Capster A2 tersimpan sebesar 10%");

    // -------------------------------------------------------------------------
    // 2. PEMBENTUKAN KOMISI TRANSAKSI DARI TRANSAKSI COMPLETED
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Pengujian Pembentukan Komisi Transaksi (Snapshot Persentase) ---");

    // Transaksi 1: Rp 50.000 completed -> Komisi 20% = Rp 10.000
    const [tx1] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi, created_at
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA1.id_shift}, ${cust.id_pelanggan}, ${capA1.id_capster},
        50000, 0, 50000, 'completed', ${now}
      ) RETURNING id_transaksi, total;
    `;
    cleanup.transaksi.push(tx1.id_transaksi);

    // Call recordCommissionForTransaction
    const { recordCommissionForTransaction } = await import("../src/lib/commissions.ts");
    const rec1 = await recordCommissionForTransaction(tx1.id_transaksi);
    assert(rec1 === true, "recordCommissionForTransaction sukses untuk transaksi completed");

    // Verifikasi snapshot di tabel komisi_transaksi
    const [commRow1] = await sql`
      SELECT * FROM komisi_transaksi WHERE id_transaksi = ${tx1.id_transaksi}
    `;
    assert(commRow1 !== undefined, "Record komisi_transaksi terbentuk di database");
    assert(Number(commRow1.persentase_komisi) === 20, "Snapshot persentase_komisi benar 20%");
    assert(Number(commRow1.nominal_komisi) === 10000, "Nominal komisi dihitung tepat: Rp 10.000 (20% dari Rp 50.000)");
    assert(commRow1.status === "belum_dibayar", "Status awal komisi transaksi adalah 'belum_dibayar'");
    cleanup.komisi.push(commRow1.id_komisi_trx);

    // Ubah persentase komisi capster menjadi 25% (Uji snapshot kekal)
    await sql`UPDATE capster SET persentase_komisi = 25.00 WHERE id_capster = ${capA1.id_capster}`;
    const [commRow1After] = await sql`
      SELECT persentase_komisi, nominal_komisi FROM komisi_transaksi WHERE id_transaksi = ${tx1.id_transaksi}
    `;
    assert(
      Number(commRow1After.persentase_komisi) === 20 && Number(commRow1After.nominal_komisi) === 10000,
      "Snapshot komisi lama tetap 20% dan Rp 10.000 meskipun persentase capster telah diubah owner",
    );

    // Transaksi 2: Rp 100.000 completed -> Komisi snapshot baru (25%) = Rp 25.000
    const [tx2] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi, created_at
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA1.id_shift}, ${cust.id_pelanggan}, ${capA1.id_capster},
        100000, 0, 100000, 'completed', ${now}
      ) RETURNING id_transaksi, total;
    `;
    cleanup.transaksi.push(tx2.id_transaksi);
    await recordCommissionForTransaction(tx2.id_transaksi);
    const [commRow2] = await sql`SELECT * FROM komisi_transaksi WHERE id_transaksi = ${tx2.id_transaksi}`;
    cleanup.komisi.push(commRow2.id_komisi_trx);
    assert(Number(commRow2.nominal_komisi) === 25000, "Transaksi 2 menggunakan snapshot baru 25% = Rp 25.000");

    // Transaksi 3: status 'pending' & 'cancelled' TIDAK boleh membuat komisi
    const [txPending] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi, created_at
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA1.id_shift}, ${cust.id_pelanggan}, ${capA1.id_capster},
        40000, 0, 40000, 'pending', ${now}
      ) RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(txPending.id_transaksi);
    const recPending = await recordCommissionForTransaction(txPending.id_transaksi);
    assert(recPending === false, "Transaksi berstatus 'pending' ditolak dan tidak menghasilkan komisi");

    // -------------------------------------------------------------------------
    // 3. PENGUJIAN QUERY DASHBOARD CAPSTER
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Pengujian Dashboard Capster (Komisi Hari Ini vs Penarikan Komisi) ---");

    const { getCapsterCommissionDashboardLogic } = await import("../src/lib/commissions.ts");
    const dash1 = await getCapsterCommissionDashboardLogic({
      capsterId: capA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    assert(dash1 !== null, "Dashboard data berhasil diambil");
    assert(dash1.komisiHariIni === 35000, `Komisi Hari Ini dihitung Rp 35.000 (10.000 + 25.000). Hasil: Rp ${dash1.komisiHariIni}`);
    assert(dash1.totalBelumTerbayar === 35000, `Total Belum Terbayar = Rp 35.000. Hasil: Rp ${dash1.totalBelumTerbayar}`);
    assert(dash1.cardState === "can_withdraw", "Card state awal adalah 'can_withdraw'");

    // -------------------------------------------------------------------------
    // 4. PENGAJUAN PENARIKAN KOMISI (CAPSTER) & PENCEGAHAN DOUBLE WITHDRAWAL
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Pengujian Pengajuan Penarikan Komisi & Pencegahan Double Withdrawal ---");

    const { requestCommissionWithdrawalLogic } = await import("../src/lib/commissions.ts");
    const reqResult = await requestCommissionWithdrawalLogic({
      capsterId: capA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    assert(reqResult.success === true, "Pengajuan penarikan komisi berhasil dilakukan");
    cleanup.pengajuan.push(reqResult.pengajuanId);

    // Verifikasi record pengajuan_komisi
    const [pengajuanRow] = await sql`
      SELECT * FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}
    `;
    assert(pengajuanRow.status === "pending", "Status pengajuan_komisi adalah 'pending'");
    assert(Number(pengajuanRow.jumlah_pengajuan) === 35000, "Jumlah pengajuan sebesar Rp 35.000");

    // Verifikasi komisi_transaksi berubah status menjadi 'diajukan'
    const commRowsAfterReq = await sql`
      SELECT status, id_pengajuan FROM komisi_transaksi WHERE id_capster = ${capA1.id_capster}
    `;
    assert(
      commRowsAfterReq.every((r) => r.status === "diajukan" && r.id_pengajuan === reqResult.pengajuanId),
      "Semua komisi transaksi terkait berubah status menjadi 'diajukan' dan tertaut ke id_pengajuan",
    );

    // Verifikasi notifikasi untuk Owner A
    const ownerNotifs = await sql`
      SELECT * FROM notifikasi WHERE id_user = ${ownerA.id_user} AND tipe = 'pengajuan_komisi'
    `;
    assert(ownerNotifs.length > 0, "Owner menerima NOTIFIKASI pengajuan penarikan komisi");
    assert(ownerNotifs[0].pesan.includes("Singgih Pratama"), "Notifikasi mencantumkan nama capster");

    // Pengujian DOUBLE WITHDRAWAL PREVENTION: pengajuan kedua harus ditolak
    let doubleWithdrawalBlocked = false;
    try {
      await requestCommissionWithdrawalLogic({
        capsterId: capA1.id_capster,
        barbershopSlug: shopA.slug,
      });
    } catch (e) {
      doubleWithdrawalBlocked = true;
    }
    assert(doubleWithdrawalBlocked, "Double withdrawal dicegah server-side saat masih ada pengajuan pending");

    // Dashboard Capster otomatis berubah state menjadi 'pending'
    const dashAfterReq = await getCapsterCommissionDashboardLogic({
      capsterId: capA1.id_capster,
      barbershopSlug: shopA.slug,
    });
    assert(dashAfterReq.cardState === "pending", "Dashboard Capster otomatis berubah menjadi state 'pending'");

    // -------------------------------------------------------------------------
    // 5. OWNER MENYETUJUI PENGAJUAN (APPROVE)
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Pengujian Persetujuan Pengajuan oleh Owner (Approve) ---");

    const { approveCommissionRequestLogic } = await import("../src/lib/commissions.ts");
    const appResult = await approveCommissionRequestLogic({
      pengajuanId: reqResult.pengajuanId,
      ownerUserId: ownerA.id_user,
      barbershopSlug: shopA.slug,
    });
    assert(appResult.success === true, "Owner berhasil menyetujui pengajuan komisi");

    const [pengajuanApproved] = await sql`
      SELECT status, disetujui_at FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}
    `;
    assert(pengajuanApproved.status === "approved", "Status pengajuan_komisi menjadi 'approved'");
    assert(pengajuanApproved.disetujui_at !== null, "disetujui_at tersimpan timestamp server");

    // Verifikasi Capster menerima NOTIFIKASI persetujuan
    const capNotifsApproved = await sql`
      SELECT * FROM notifikasi WHERE id_user = ${userCapA1.id_user} AND tipe = 'persetujuan_komisi'
    `;
    assert(capNotifsApproved.length > 0, "Capster menerima NOTIFIKASI bahwa pengajuan telah disetujui");

    // Dashboard Capster otomatis berubah state menjadi 'approved' (Menunggu Pembayaran)
    const dashAfterApp = await getCapsterCommissionDashboardLogic({
      capsterId: capA1.id_capster,
      barbershopSlug: shopA.slug,
    });
    assert(dashAfterApp.cardState === "approved", "Dashboard Capster otomatis menampilkan 'Menunggu Pembayaran'");

    // -------------------------------------------------------------------------
    // 6. OWNER MEMBAYAR KOMISI (PEMBAYARAN_KOMISI & PENGURANGAN SALDO_BISNIS ATOMIK)
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Pengujian Pembayaran Komisi & Pengurangan Saldo Bisnis Atomik ---");

    const { payCommissionRequestLogic } = await import("../src/lib/commissions.ts");
    const payResult = await payCommissionRequestLogic({
      pengajuanId: reqResult.pengajuanId,
      ownerUserId: ownerA.id_user,
      metodePembayaran: "transfer",
      referensi: "TRF-BCA-98712",
      catatan: "Gaji & komisi periode uji",
      barbershopSlug: shopA.slug,
    });
    assert(payResult.success === true, "Pembayaran komisi berhasil diproses");
    cleanup.pembayaran.push(payResult.paymentId);

    // Verifikasi record PEMBAYARAN_KOMISI
    const [payRow] = await sql`
      SELECT * FROM pembayaran_komisi WHERE id_pembayaran_komisi = ${payResult.paymentId}
    `;
    assert(payRow.status === "success", "Record PEMBAYARAN_KOMISI tersimpan dengan status 'success'");
    assert(Number(payRow.jumlah_bayar) === 35000, "Nominal pembayaran tercatat tepat Rp 35.000");

    // Verifikasi SALDO_BISNIS berkurang tepat satu kali (2.000.000 - 35.000 = 1.965.000)
    const [latestSaldoA] = await sql`
      SELECT * FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1
    `;
    assert(Number(latestSaldoA.saldo) === 1965000, `Saldo bisnis berkurang tepat Rp 35.000 menjadi Rp 1.965.000. Aktual: Rp ${latestSaldoA.saldo}`);
    assert(latestSaldoA.jenis_transaksi === "pembayaran_komisi", "Mutasi saldo jenis_transaksi adalah 'pembayaran_komisi'");
    cleanup.saldo.push(latestSaldoA.id_saldo);

    // Verifikasi status PENGAJUAN_KOMISI dan KOMISI_TRANSAKSI menjadi paid / dibayar
    const [pengajuanPaid] = await sql`SELECT status FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(pengajuanPaid.status === "paid", "PENGAJUAN_KOMISI berstatus 'paid'");

    const commRowsPaid = await sql`SELECT status FROM komisi_transaksi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(commRowsPaid.every((r) => r.status === "dibayar"), "Semua KOMISI_TRANSAKSI berstatus 'dibayar'");

    // Verifikasi DOUBLE PAYMENT PREVENTION: pembayaran kedua harus ditolak
    let doublePaymentBlocked = false;
    try {
      await payCommissionRequestLogic({
        pengajuanId: reqResult.pengajuanId,
        ownerUserId: ownerA.id_user,
        barbershopSlug: shopA.slug,
      });
    } catch {
      doublePaymentBlocked = true;
    }
    assert(doublePaymentBlocked, "Double payment dicegah saat pengajuan sudah berstatus 'paid'");

    // Dashboard Capster otomatis menampilkan 'paid' (Sudah Terbayar) dengan timestamp riil
    const dashAfterPay = await getCapsterCommissionDashboardLogic({
      capsterId: capA1.id_capster,
      barbershopSlug: shopA.slug,
    });
    assert(dashAfterPay.cardState === "paid", "Dashboard Capster otomatis menampilkan 'Sudah Terbayar'");
    assert(dashAfterPay.activePengajuan?.dibayarAtFormatted !== null, "Timestamp riil pembayaran ditampilkan pada card");

    // -------------------------------------------------------------------------
    // 7. PENGUJIAN ALUR PENOLAKAN (REJECT) OLEH OWNER
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Pengujian Alur Penolakan (Reject) oleh Owner ---");

    // Capster A2 memiliki transaksi Rp 50.000 (komisi 10% = Rp 5.000)
    const [txA2] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi, created_at
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA1.id_shift}, ${cust.id_pelanggan}, ${capA2.id_capster},
        50000, 0, 50000, 'completed', ${now}
      ) RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(txA2.id_transaksi);
    await recordCommissionForTransaction(txA2.id_transaksi);

    // Capster A2 mengajukan penarikan
    const reqA2 = await requestCommissionWithdrawalLogic({
      capsterId: capA2.id_capster,
      barbershopSlug: shopA.slug,
    });
    cleanup.pengajuan.push(reqA2.pengajuanId);

    // Saldo bisnis sebelum penolakan
    const [saldoBeforeReject] = await sql`
      SELECT saldo FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1
    `;

    // Owner menolak dengan alasan
    const { rejectCommissionRequestLogic } = await import("../src/lib/commissions.ts");
    const rejResult = await rejectCommissionRequestLogic({
      pengajuanId: reqA2.pengajuanId,
      alasan: "Data shift belum diverifikasi oleh supervisor",
      ownerUserId: ownerA.id_user,
      barbershopSlug: shopA.slug,
    });
    assert(rejResult.success === true, "Owner berhasil menolak pengajuan");

    const [pengajuanRejected] = await sql`
      SELECT status, alasan_penolakan, ditolak_at FROM pengajuan_komisi WHERE id_pengajuan = ${reqA2.pengajuanId}
    `;
    assert(pengajuanRejected.status === "rejected", "PENGAJUAN_KOMISI berstatus 'rejected'");
    assert(pengajuanRejected.alasan_penolakan === "Data shift belum diverifikasi oleh supervisor", "Alasan penolakan tersimpan di database");

    // Komisi transaksi kembali berstatus 'belum_dibayar'
    const [commRowA2] = await sql`
      SELECT status, id_pengajuan FROM komisi_transaksi WHERE id_capster = ${capA2.id_capster}
    `;
    assert(commRowA2.status === "belum_dibayar" && commRowA2.id_pengajuan === null, "Komisi yang ditolak dikembalikan ke status 'belum_dibayar' dan tidak dianggap lunas");

    // Saldo bisnis TIDAK boleh berkurang
    const [saldoAfterReject] = await sql`
      SELECT saldo FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1
    `;
    assert(Number(saldoAfterReject.saldo) === Number(saldoBeforeReject.saldo), "Saldo bisnis TIDAK berkurang saat pengajuan ditolak");

    // Capster A2 menerima notifikasi penolakan
    const capNotifsRejected = await sql`
      SELECT * FROM notifikasi WHERE id_user = ${userCapA2.id_user} AND tipe = 'penolakan_komisi'
    `;
    assert(capNotifsRejected.length > 0, "Capster A2 menerima NOTIFIKASI penolakan dengan alasan yang jelas");

    // -------------------------------------------------------------------------
    // 8. PENGUJIAN ISOLASI MULTI-TENANT
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Pengujian Isolasi Multi-Tenant ---");

    const { getOwnerCommissionRequestsLogic } = await import("../src/lib/commissions.ts");
    const ownerBRequests = await getOwnerCommissionRequestsLogic({
      barbershopSlug: shopB.slug,
    });
    assert(
      ownerBRequests.every((r) => r.capsterId !== capA1.id_capster && r.capsterId !== capA2.id_capster),
      "Owner Shop B TIDAK dapat melihat pengajuan komisi dari Capster Shop A",
    );

    const dashB1 = await getCapsterCommissionDashboardLogic({
      capsterId: capB1.id_capster,
      barbershopSlug: shopB.slug,
    });
    assert(dashB1.totalBelumTerbayar === 0, "Capster Shop B tidak melihat data komisi Capster Shop A (Total: Rp 0)");

    console.log("\n=======================================================");
    console.log(`  🎉 SEMUA PENGUJIAN BERHASIL (${passedCount} passed, ${failedCount} failed)`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n❌ TERJADI KESALAHAN PADA SAAT VERIFIKASI:", err);
    failedCount++;
  } finally {
    // Cleanup fixtures
    console.log("--- Membersihkan Data Uji Coba Multi-Tenant ---");
    try {
      if (cleanup.pembayaran.length > 0) {
        await sql`DELETE FROM pembayaran_komisi WHERE id_pembayaran_komisi IN ${sql(cleanup.pembayaran)}`;
      }
      if (cleanup.komisi.length > 0) {
        await sql`DELETE FROM komisi_transaksi WHERE id_komisi_trx IN ${sql(cleanup.komisi)}`;
      }
      if (cleanup.pengajuan.length > 0) {
        await sql`DELETE FROM pengajuan_komisi WHERE id_pengajuan IN ${sql(cleanup.pengajuan)}`;
      }
      if (cleanup.saldo.length > 0) {
        await sql`DELETE FROM saldo_bisnis WHERE id_saldo IN ${sql(cleanup.saldo)}`;
      }
      if (cleanup.transaksi.length > 0) {
        await sql`DELETE FROM transaksi WHERE id_transaksi IN ${sql(cleanup.transaksi)}`;
      }
      if (cleanup.shifts.length > 0) {
        await sql`DELETE FROM shift_capster WHERE id_shift IN ${sql(cleanup.shifts)}`;
      }
      if (cleanup.capsters.length > 0) {
        await sql`DELETE FROM capster WHERE id_capster IN ${sql(cleanup.capsters)}`;
      }
      if (cleanup.users.length > 0) {
        await sql`DELETE FROM notifikasi WHERE id_user IN ${sql(cleanup.users)}`;
        await sql`DELETE FROM audit_log WHERE id_user IN ${sql(cleanup.users)}`;
        await sql`DELETE FROM pelanggan WHERE id_user IN ${sql(cleanup.users)}`;
        await sql`DELETE FROM users WHERE id_user IN ${sql(cleanup.users)}`;
      }
      if (cleanup.barbershops.length > 0) {
        await sql`DELETE FROM saldo_bisnis WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
        await sql`DELETE FROM barbershop WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
      }
      console.log("✅ Data uji coba berhasil dibersihkan.");
    } catch (cleanupErr) {
      console.warn("Peringatan saat membersihkan fixture uji coba:", cleanupErr);
    }

    await sql.end();
    if (failedCount > 0) process.exit(1);
  }
}

run();
