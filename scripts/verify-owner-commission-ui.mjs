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
import {
  recordCommissionForTransaction,
  getCapsterCommissionDashboardLogic,
  requestCommissionWithdrawalLogic,
  getOwnerCommissionRequestsLogic,
  getOwnerCommissionRequestDetailLogic,
  getOwnerCommissionRecapLogic,
  getOwnerCommissionPaymentHistoryLogic,
  approveCommissionRequestLogic,
  rejectCommissionRequestLogic,
  payCommissionRequestLogic,
} from "../src/lib/commissions.js";

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
  console.log("  BARBERIN — VERIFIKASI GAJI & KOMISI OWNER (6 TESTS)");
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
    audit: [],
  };

  const testId = `owner_test_${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP FIXTURES (MULTI-TENANT): Shop A & Shop B
    // -------------------------------------------------------------------------
    console.log("--- Menyiapkan Fixture Multi-Tenant (Shop A & Shop B) ---");

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

    // Users
    const [userOwnerA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, ${`Owner A ${testId}`}, ${`owner-a-${testId}@barberin.id`}, '081100', 'owner', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userOwnerA.id_user);

    const [userOwnerB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopB.id_barbershop}, ${`Owner B ${testId}`}, ${`owner-b-${testId}@barberin.id`}, '082200', 'owner', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userOwnerB.id_user);

    const [userCapA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, 'Singgih', ${`singgih-${testId}@barberin.id`}, '081234567890', 'capster', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userCapA.id_user);

    const [capA] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapA.id_user}, ${shopA.id_barbershop}, 'Singgih', 'CAP-001', 15.00, 'active')
      RETURNING id_capster;
    `;
    cleanup.capsters.push(capA.id_capster);

    const [custA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, 'Pelanggan Uji', ${`cust-${testId}@barberin.id`}, '089999', 'pelanggan', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(custA.id_user);

    const [pelangganA] = await sql`
      INSERT INTO pelanggan (id_user, id_barbershop, nama_pelanggan)
      VALUES (${custA.id_user}, ${shopA.id_barbershop}, 'Pelanggan Uji')
      RETURNING id_pelanggan;
    `;

    const [shiftA] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, status)
      VALUES (${capA.id_capster}, ${shopA.id_barbershop}, CURRENT_DATE, '09:00', 'ongoing')
      RETURNING id_shift;
    `;
    cleanup.shifts.push(shiftA.id_shift);

    // Initial Saldo Bisnis Shop A = Rp 1.000.000
    const [initialSaldo] = await sql`
      INSERT INTO saldo_bisnis (id_barbershop, jenis_transaksi, debit, kredit, saldo, keterangan)
      VALUES (${shopA.id_barbershop}, 'pendapatan', 1000000.00, 0.00, 1000000.00, 'Saldo Awal Uji Coba')
      RETURNING id_saldo;
    `;
    cleanup.saldo.push(initialSaldo.id_saldo);

    // 2 Completed Transactions (Total omset: Rp 50.000 + Rp 75.000 = Rp 125.000)
    // Komisi 15%: Rp 7.500 + Rp 11.250 = Rp 18.750
    const [tx1] = await sql`
      INSERT INTO transaksi (id_barbershop, id_capster, id_pelanggan, id_shift, subtotal, diskon, total, status_transaksi)
      VALUES (${shopA.id_barbershop}, ${capA.id_capster}, ${pelangganA.id_pelanggan}, ${shiftA.id_shift}, 50000.00, 0.00, 50000.00, 'completed')
      RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(tx1.id_transaksi);
    await recordCommissionForTransaction(tx1.id_transaksi);

    const [tx2] = await sql`
      INSERT INTO transaksi (id_barbershop, id_capster, id_pelanggan, id_shift, subtotal, diskon, total, status_transaksi)
      VALUES (${shopA.id_barbershop}, ${capA.id_capster}, ${pelangganA.id_pelanggan}, ${shiftA.id_shift}, 75000.00, 0.00, 75000.00, 'completed')
      RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(tx2.id_transaksi);
    await recordCommissionForTransaction(tx2.id_transaksi);

    // Track generated komisi
    const genKomisi = await sql`SELECT id_komisi_trx FROM komisi_transaksi WHERE id_barbershop = ${shopA.id_barbershop}`;
    genKomisi.forEach((k) => cleanup.komisi.push(k.id_komisi_trx));

    console.log("✅ Fixtures siap.\n");

    // -------------------------------------------------------------------------
    // TEST 1 — PENDING
    // -------------------------------------------------------------------------
    console.log("--- TEST 1 — PENDING: Capster Mengajukan Komisi ---");
    const reqResult = await requestCommissionWithdrawalLogic({
      capsterId: capA.id_capster,
      barbershopSlug: shopA.slug,
      keterangan: "Pengajuan komisi pertama Singgih",
    });
    assert(!!reqResult.pengajuanId, "Pengajuan penarikan komisi berhasil dibuat");
    cleanup.pengajuan.push(reqResult.pengajuanId);

    // Verify DB status
    const [dbPengajuan1] = await sql`SELECT status, jumlah_pengajuan FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(dbPengajuan1.status === "pending", "PENGAJUAN_KOMISI.status di database bernilai 'pending'");
    assert(Number(dbPengajuan1.jumlah_pengajuan) === 18750, "Jumlah pengajuan sesuai akumulasi komisi (Rp 18.750)");

    // Verify Owner query and UI status
    const ownerRequests1 = await getOwnerCommissionRequestsLogic({ barbershopSlug: shopA.slug });
    const targetItem1 = ownerRequests1.requests.find((r) => r.idPengajuan === reqResult.pengajuanId);
    assert(!!targetItem1, "Owner melihat pengajuan di daftar permintaan");
    assert(targetItem1.uiStatus === "pending", "UI status pengajuan bernilai 'pending'");
    assert(targetItem1.statusLabel === "Menunggu Persetujuan", "Label UI bernilai 'Menunggu Persetujuan'");
    assert(ownerRequests1.counts.pending === 1, "Counter pill 'Menunggu' bernilai 1");

    // Verify Detail View (Screen 2) with Dasar Komisi
    const detail1 = await getOwnerCommissionRequestDetailLogic({
      pengajuanId: reqResult.pengajuanId,
      barbershopSlug: shopA.slug,
    });
    assert(detail1.capster.name === "Singgih", "Detail menampilkan Nama Capster: Singgih");
    assert(detail1.dasarKomisi.transactions.length === 2, "Detail Dasar Komisi menampilkan 2 transaksi pembentuk");
    assert(detail1.dasarKomisi.totalKomisi === 18750, "Total dasar komisi bernilai Rp 18.750");

    console.log("✅ TEST 1 BERHASIL.\n");

    // -------------------------------------------------------------------------
    // TEST 2 — APPROVE
    // -------------------------------------------------------------------------
    console.log("--- TEST 2 — APPROVE: Owner Menyetujui Pengajuan ---");
    const approveResult = await approveCommissionRequestLogic({
      pengajuanId: reqResult.pengajuanId,
      ownerUserId: userOwnerA.id_user,
      barbershopSlug: shopA.slug,
    });
    assert(approveResult.success === true, "Owner berhasil menyetujui pengajuan");

    const [dbPengajuan2] = await sql`SELECT status, disetujui_at FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(dbPengajuan2.status === "approved", "PENGAJUAN_KOMISI.status di database bernilai 'approved'");
    assert(!!dbPengajuan2.disetujui_at, "disetujui_at tersimpan");

    // Verify Saldo Bisnis BELUM berkurang
    const [saldoCheck2] = await sql`SELECT saldo FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1`;
    assert(Number(saldoCheck2.saldo) === 1000000, "Saldo bisnis BELUM berkurang saat approved (tetap Rp 1.000.000)");

    // Verify UI Status
    const ownerRequests2 = await getOwnerCommissionRequestsLogic({ barbershopSlug: shopA.slug });
    const targetItem2 = ownerRequests2.requests.find((r) => r.idPengajuan === reqResult.pengajuanId);
    assert(targetItem2.uiStatus === "approved", "UI status bernilai 'approved'");
    assert(targetItem2.statusLabel === "Disetujui / Menunggu Pembayaran", "Label UI bernilai 'Disetujui / Menunggu Pembayaran'");
    assert(ownerRequests2.counts.approved === 1, "Counter pill 'Disetujui' bernilai 1");

    // Verify Capster received notification
    const capNotifs = await sql`SELECT * FROM notifikasi WHERE id_user = ${userCapA.id_user} AND tipe = 'persetujuan_komisi'`;
    assert(capNotifs.length > 0, "Capster menerima NOTIFIKASI persetujuan komisi");

    console.log("✅ TEST 2 BERHASIL.\n");

    // -------------------------------------------------------------------------
    // TEST 3 — PAYMENT
    // -------------------------------------------------------------------------
    console.log("--- TEST 3 — PAYMENT: Owner Konfirmasi Pembayaran ---");
    const payResult = await payCommissionRequestLogic({
      pengajuanId: reqResult.pengajuanId,
      ownerUserId: userOwnerA.id_user,
      metodePembayaran: "transfer",
      barbershopSlug: shopA.slug,
    });
    assert(payResult.success === true, "Pembayaran komisi berhasil dieksekusi");
    cleanup.pembayaran.push(payResult.paymentId);

    // Verify Database state per ERD
    const [dbPengajuan3] = await sql`SELECT status FROM pengajuan_komisi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(dbPengajuan3.status === "approved", "PENGAJUAN_KOMISI.status TETAP 'approved' (TIDAK menjadi 'paid' baru)");

    const [dbPay3] = await sql`SELECT status, jumlah_bayar FROM pembayaran_komisi WHERE id_pembayaran_komisi = ${payResult.paymentId}`;
    assert(dbPay3.status === "success", "PEMBAYARAN_KOMISI.status bernilai 'success'");
    assert(Number(dbPay3.jumlah_bayar) === 18750, "Jumlah bayar sesuai nominal pengajuan");

    // Verify Saldo Bisnis berkurang tepat satu kali
    const [saldoCheck3] = await sql`SELECT saldo, kredit, jenis_transaksi FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1`;
    assert(Number(saldoCheck3.saldo) === 1000000 - 18750, "Saldo bisnis berkurang tepat satu kali (Rp 1.000.000 - Rp 18.750 = Rp 981.250)");
    assert(saldoCheck3.jenis_transaksi === "pembayaran_komisi", "Mutasi saldo berjenis 'pembayaran_komisi'");

    // Verify Komisi Transaksi status = 'dibayar'
    const komisiCheck3 = await sql`SELECT status FROM komisi_transaksi WHERE id_pengajuan = ${reqResult.pengajuanId}`;
    assert(komisiCheck3.every((k) => k.status === "dibayar"), "Semua KOMISI_TRANSAKSI terkait berstatus 'dibayar'");

    // Verify UI Status
    const ownerRequests3 = await getOwnerCommissionRequestsLogic({ barbershopSlug: shopA.slug });
    const targetItem3 = ownerRequests3.requests.find((r) => r.idPengajuan === reqResult.pengajuanId);
    assert(targetItem3.uiStatus === "paid", "Status UI pengajuan bernilai 'paid'");
    assert(targetItem3.statusLabel === "Sudah Terbayarkan", "Label UI bernilai 'Sudah Terbayarkan'");
    assert(targetItem3.dibayarAt !== "-", "Kolom DIBAYARKAN menampilkan timestamp aktual");
    assert(ownerRequests3.counts.paid === 1, "Counter pill 'Terbayarkan' bernilai 1");

    // Verify Capster Dashboard reflects paid state
    const capDashboard3 = await getCapsterCommissionDashboardLogic({
      capsterId: capA.id_capster,
      barbershopSlug: shopA.slug,
    });
    assert(capDashboard3.cardState === "paid", "Dashboard Capster menampilkan cardState 'paid'");

    console.log("✅ TEST 3 BERHASIL.\n");

    // -------------------------------------------------------------------------
    // TEST 4 — DOUBLE PAYMENT PREVENTION
    // -------------------------------------------------------------------------
    console.log("--- TEST 4 — DOUBLE PAYMENT: Mencegah Pembayaran Ganda ---");
    let doublePaymentBlocked = false;
    try {
      await payCommissionRequestLogic({
        pengajuanId: reqResult.pengajuanId,
        ownerUserId: userOwnerA.id_user,
        metodePembayaran: "transfer",
        barbershopSlug: shopA.slug,
      });
    } catch (err) {
      doublePaymentBlocked = true;
      console.log(`  (Double payment ditolak oleh backend: "${err.message}")`);
    }
    assert(doublePaymentBlocked, "Backend BERHASIL menolak percobaan pembayaran kedua");

    // Ensure saldo was NOT debited again
    const saldoCount = await sql`SELECT count(*) as cnt FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} AND jenis_transaksi = 'pembayaran_komisi'`;
    assert(Number(saldoCount[0].cnt) === 1, "Mutasi saldo pembayaran komisi tepat 1 kali, tidak ada mutasi kedua");

    console.log("✅ TEST 4 BERHASIL.\n");

    // -------------------------------------------------------------------------
    // TEST 5 — REJECT FLOW
    // -------------------------------------------------------------------------
    console.log("--- TEST 5 — REJECT: Penolakan Pengajuan Komisi ---");
    // Create new transaction and request for testing reject
    const [tx3] = await sql`
      INSERT INTO transaksi (id_barbershop, id_capster, id_pelanggan, id_shift, subtotal, diskon, total, status_transaksi)
      VALUES (${shopA.id_barbershop}, ${capA.id_capster}, ${pelangganA.id_pelanggan}, ${shiftA.id_shift}, 50000.00, 0.00, 50000.00, 'completed')
      RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(tx3.id_transaksi);
    await recordCommissionForTransaction(tx3.id_transaksi);
    const [newKom] = await sql`SELECT id_komisi_trx FROM komisi_transaksi WHERE id_transaksi = ${tx3.id_transaksi}`;
    cleanup.komisi.push(newKom.id_komisi_trx);

    const reqReject = await requestCommissionWithdrawalLogic({
      capsterId: capA.id_capster,
      barbershopSlug: shopA.slug,
      keterangan: "Pengajuan kedua untuk uji tolak",
    });
    cleanup.pengajuan.push(reqReject.pengajuanId);

    // Rejection without reason must fail
    let emptyReasonBlocked = false;
    try {
      await rejectCommissionRequestLogic({
        pengajuanId: reqReject.pengajuanId,
        alasan: "   ",
        ownerUserId: userOwnerA.id_user,
        barbershopSlug: shopA.slug,
      });
    } catch {
      emptyReasonBlocked = true;
    }
    assert(emptyReasonBlocked, "Penolakan tanpa alasan wajib ditolak");

    // Reject with valid reason
    const rejectResult = await rejectCommissionRequestLogic({
      pengajuanId: reqReject.pengajuanId,
      alasan: "Nominal pengajuan tidak sesuai catatan layanan",
      ownerUserId: userOwnerA.id_user,
      barbershopSlug: shopA.slug,
    });
    assert(rejectResult.success === true, "Penolakan dengan alasan berhasil");

    const [dbPengajuanReject] = await sql`SELECT status, alasan_penolakan FROM pengajuan_komisi WHERE id_pengajuan = ${reqReject.pengajuanId}`;
    assert(dbPengajuanReject.status === "rejected", "PENGAJUAN_KOMISI.status bernilai 'rejected'");
    assert(dbPengajuanReject.alasan_penolakan === "Nominal pengajuan tidak sesuai catatan layanan", "Alasan penolakan tersimpan di database");

    // Komisi transaksi dikembalikan ke 'belum_dibayar'
    const [komisiReverted] = await sql`SELECT status, id_pengajuan FROM komisi_transaksi WHERE id_komisi_trx = ${newKom.id_komisi_trx}`;
    assert(komisiReverted.status === "belum_dibayar", "KOMISI_TRANSAKSI kembali berstatus 'belum_dibayar'");
    assert(komisiReverted.id_pengajuan === null, "id_pengajuan pada komisi transaksi di-reset ke null");

    // Saldo bisnis tidak berubah
    const [saldoCheck5] = await sql`SELECT saldo FROM saldo_bisnis WHERE id_barbershop = ${shopA.id_barbershop} ORDER BY created_at DESC LIMIT 1`;
    assert(Number(saldoCheck5.saldo) === 1000000 - 18750, "Saldo bisnis TIDAK berkurang saat ditolak");

    console.log("✅ TEST 5 BERHASIL.\n");

    // -------------------------------------------------------------------------
    // TEST 6 — MULTI TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log("--- TEST 6 — MULTI TENANT: Isolasi Data Antar-Tenant ---");
    // Owner Shop B attempts to view Shop A's requests
    const ownerBRequests = await getOwnerCommissionRequestsLogic({ barbershopSlug: shopB.slug });
    assert(
      ownerBRequests.requests.length === 0,
      "Owner Shop B TIDAK dapat melihat pengajuan komisi dari Shop A (0 pengajuan)",
    );

    // Tab Rekap & Riwayat for Shop B
    const rekapB = await getOwnerCommissionRecapLogic({ barbershopSlug: shopB.slug });
    assert(rekapB.summary.totalKomisiBelumDibayar === 0, "Rekap Komisi Shop B terisolasi (Total Belum Dibayar: Rp 0)");

    const histB = await getOwnerCommissionPaymentHistoryLogic({ barbershopSlug: shopB.slug });
    assert(histB.payments.length === 0, "Riwayat Pembayaran Shop B terisolasi (0 pembayaran)");

    console.log("✅ TEST 6 BERHASIL.\n");

    console.log("=======================================================");
    console.log(`  🎉 SEMUA 6 TEST UTAMA BERHASIL LULUS (${passedCount} passed, ${failedCount} failed)`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n❌ TERJADI KESALAHAN PADA SAAT VERIFIKASI:", err);
    failedCount++;
  } finally {
    console.log("--- Membersihkan Data Uji Coba ---");
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
