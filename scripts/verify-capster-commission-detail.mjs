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
  getCapsterCommissionDetailDataLogic,
  getCapsterWithdrawalDetailLogic,
  requestCommissionWithdrawalLogic,
  approveCommissionRequestLogic,
  rejectCommissionRequestLogic,
  payCommissionRequestLogic,
  formatWithdrawalCode,
  formatWithdrawalDateTime,
} from "../src/lib/commissions.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function run() {
  console.log("==================================================================");
  console.log("🚀 START VERIFICATION: CAPSTER DETAIL KOMISI & RIWAYAT PENARIKAN");
  console.log("==================================================================");

  const cleanup = {
    barbershops: [],
    users: [],
    capsters: [],
    layanan: [],
    shifts: [],
    pelanggan: [],
    transaksi: [],
    komisi: [],
    pengajuan: [],
    pembayaran: [],
    saldo: [],
    notifikasi: [],
    audit: [],
  };

  const testId = `cap_wd_${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP FIXTURES (MULTI-TENANT): Shop A & Shop B
    // -------------------------------------------------------------------------
    console.log("\n--- SETUP FIXTURES (MULTI-TENANT & CAPSTERS) ---");

    const [shopA] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Barbershop A ${testId}`}, ${`shop-a-${testId}`}, 'Jl. Sudirman No. 1', '08123456789', 'active')
      RETURNING id_barbershop, slug, nama_barbershop;
    `;
    cleanup.barbershops.push(shopA.id_barbershop);

    const [shopB] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Barbershop B ${testId}`}, ${`shop-b-${testId}`}, 'Jl. Thamrin No. 2', '08987654321', 'active')
      RETURNING id_barbershop, slug, nama_barbershop;
    `;
    cleanup.barbershops.push(shopB.id_barbershop);

    console.log(`  Shop A created: ${shopA.nama_barbershop} (${shopA.slug})`);
    console.log(`  Shop B created: ${shopB.nama_barbershop} (${shopB.slug})`);

    // Owner Shop A
    const [userOwnerA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, ${`Owner A ${testId}`}, ${`owner-a-${testId}@barberin.id`}, '081100', 'owner', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userOwnerA.id_user);

    // Capster A1
    const [userCapsterA1] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, ${`Capster A1 ${testId}`}, ${`capster-a1-${testId}@barberin.id`}, '081101', 'capster', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userCapsterA1.id_user);

    const [capsterA1] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapsterA1.id_user}, ${shopA.id_barbershop}, ${`Capster A1 ${testId}`}, ${`CAP-A1-${testId}`}, 15.00, 'active')
      RETURNING id_capster;
    `;
    cleanup.capsters.push(capsterA1.id_capster);

    // Capster A2 (for Capster Isolation test)
    const [userCapsterA2] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, ${`Capster A2 ${testId}`}, ${`capster-a2-${testId}@barberin.id`}, '081102', 'capster', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userCapsterA2.id_user);

    const [capsterA2] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, no_pegawai, persentase_komisi, status)
      VALUES (${userCapsterA2.id_user}, ${shopA.id_barbershop}, ${`Capster A2 ${testId}`}, ${`CAP-A2-${testId}`}, 15.00, 'active')
      RETURNING id_capster;
    `;
    cleanup.capsters.push(capsterA2.id_capster);

    // Layanan
    const [layanan1] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
      VALUES (${shopA.id_barbershop}, 'Haircut Premium', 100000, 45, 'active')
      RETURNING id_layanan;
    `;
    cleanup.layanan.push(layanan1.id_layanan);

    // Shift
    const [shiftA] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, waktu_selesai, status)
      VALUES (${capsterA1.id_capster}, ${shopA.id_barbershop}, CURRENT_DATE, '09:00', '17:00', 'ongoing')
      RETURNING id_shift;
    `;
    cleanup.shifts.push(shiftA.id_shift);

    // Pelanggan
    const [userPelanggan] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, no_hp, role, status)
      VALUES (${shopA.id_barbershop}, ${`Pelanggan ${testId}`}, ${`pelanggan-${testId}@test.id`}, '081199', 'pelanggan', 'active')
      RETURNING id_user;
    `;
    cleanup.users.push(userPelanggan.id_user);

    const [pelangganA] = await sql`
      INSERT INTO pelanggan (id_user, id_barbershop, nama_pelanggan, no_hp)
      VALUES (${userPelanggan.id_user}, ${shopA.id_barbershop}, 'Pelanggan Test', '081199')
      RETURNING id_pelanggan;
    `;
    cleanup.pelanggan.push(pelangganA.id_pelanggan);

    // Transaksi A1: Total 100.000
    const [trx1] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopA.id_barbershop}, ${shiftA.id_shift}, ${pelangganA.id_pelanggan}, ${capsterA1.id_capster}, 100000, 0, 100000, 'completed')
      RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(trx1.id_transaksi);

    // Transaksi A2: Total 200.000
    const [trx2] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopA.id_barbershop}, ${shiftA.id_shift}, ${pelangganA.id_pelanggan}, ${capsterA1.id_capster}, 200000, 0, 200000, 'completed')
      RETURNING id_transaksi;
    `;
    cleanup.transaksi.push(trx2.id_transaksi);

    // -------------------------------------------------------------------------
    // TEST 1: Helper Formatter
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: FORMAT HELPER FUNCTIONS ---");
    const testDate = new Date("2026-09-23T14:30:00+07:00");
    const testCode = formatWithdrawalCode("abc-123-xyz-001", testDate);
    assert(testCode.startsWith("#WD-20260923-"), `Kode penarikan berformat #WD-YYYYMMDD-XXX: ${testCode}`);
    const testDateFormatted = formatWithdrawalDateTime(testDate);
    assert(testDateFormatted.includes("2026") && testDateFormatted.includes("14:30"), `Format tanggal WIB dengan titik dua: ${testDateFormatted}`);

    // -------------------------------------------------------------------------
    // TEST A & B: KOMISI TERSEDIA AWAL (Rp45.000) & TOTAL KOMISI DITERIMA (Rp0)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST A & B: KOMISI TERSEDIA AWAL & TOTAL KOMISI DITERIMA ---");

    // Insert 2 komisi:
    // Trx 1: 15% dari 100.000 = 15.000
    // Trx 2: 15% dari 200.000 = 30.000
    // Total komisi = 45.000
    const [kom1] = await sql`
      INSERT INTO komisi_transaksi (
        id_transaksi, id_capster, id_barbershop, persentase_komisi, dasar_komisi, nominal_komisi, status
      ) VALUES (
        ${trx1.id_transaksi}, ${capsterA1.id_capster}, ${shopA.id_barbershop}, 15.00, 100000, 15000, 'belum_dibayar'
      ) RETURNING id_komisi_trx;
    `;
    cleanup.komisi.push(kom1.id_komisi_trx);

    const [kom2] = await sql`
      INSERT INTO komisi_transaksi (
        id_transaksi, id_capster, id_barbershop, persentase_komisi, dasar_komisi, nominal_komisi, status
      ) VALUES (
        ${trx2.id_transaksi}, ${capsterA1.id_capster}, ${shopA.id_barbershop}, 15.00, 200000, 30000, 'belum_dibayar'
      ) RETURNING id_komisi_trx;
    `;
    cleanup.komisi.push(kom2.id_komisi_trx);

    const initialData = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    assert(initialData !== null, "Berhasil memuat detail komisi capster");
    assert(initialData.totalKomisiDiterima === 0, `TEST A: Total Komisi Diterima awal adalah Rp0 (aktual: ${initialData.totalKomisiDiterima})`);
    assert(initialData.jumlahPembayaranDiterima === 0, `TEST A: Jumlah pembayaran awal adalah 0 (aktual: ${initialData.jumlahPembayaranDiterima})`);
    assert(initialData.komisiTersedia === 45000, `TEST B: Komisi Tersedia awal adalah Rp45.000 (aktual: ${initialData.komisiTersedia})`);
    assert(initialData.canWithdraw === true, "TEST B: Tombol Ajukan Penarikan aktif (canWithdraw = true)");

    // -------------------------------------------------------------------------
    // TEST C: CAPSTER AJUKAN PENARIKAN (STATUS PENDING)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST C: CAPSTER AJUKAN PENARIKAN (STATUS PENDING) ---");
    const withdrawRes1 = await requestCommissionWithdrawalLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
      keterangan: "Pengajuan komisi pertama",
    });

    assert(withdrawRes1.success === true, "Pengajuan penarikan berhasil dibuat di backend");
    const pengajuanId1 = withdrawRes1.pengajuanId;
    cleanup.pengajuan.push(pengajuanId1);

    const dataAfterSubmit = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    assert(dataAfterSubmit.komisiTersedia === 0, `TEST B: Komisi Tersedia berkurang menjadi Rp0 setelah diajukan (aktual: ${dataAfterSubmit.komisiTersedia})`);
    assert(dataAfterSubmit.canWithdraw === false, "TEST B: Tombol Ajukan Penarikan menjadi disabled saat pengajuan aktif");
    assert(dataAfterSubmit.counts.pending === 1, `TEST C: Tab Menunggu menampilkan 1 pengajuan (aktual: ${dataAfterSubmit.counts.pending})`);

    const req1 = dataAfterSubmit.requests.find((r) => r.idPengajuan === pengajuanId1);
    assert(req1 !== undefined, "Pengajuan ada dalam list requests");
    assert(req1.uiStatus === "pending", `TEST C: uiStatus adalah pending (aktual: ${req1.uiStatus})`);
    assert(req1.uiStatusLabel === "Menunggu Persetujuan", `TEST C: uiStatusLabel adalah Menunggu Persetujuan (aktual: ${req1.uiStatusLabel})`);
    assert(req1.jumlah === 45000, `Nominal pengajuan sesuai komisi eligible: ${req1.jumlahFormatted}`);

    // Cek notifikasi terkirim ke Owner & Capster
    const notifs = await sql`
      SELECT id_notifikasi, id_user, tipe, judul, pesan 
      FROM notifikasi 
      WHERE id_barbershop = ${shopA.id_barbershop}
    `;
    const notifOwner = notifs.find((n) => n.id_user === userOwnerA.id_user);
    const notifCapster = notifs.find((n) => n.id_user === userCapsterA1.id_user);
    assert(notifOwner !== undefined, "Notifikasi pengajuan penarikan masuk ke Owner");
    assert(notifCapster !== undefined, "Notifikasi pengajuan penarikan masuk ke Capster");

    // -------------------------------------------------------------------------
    // TEST G: DOUBLE WITHDRAWAL PREVENTION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST G: DOUBLE WITHDRAWAL PREVENTION ---");
    let doubleWithdrawBlocked = false;
    try {
      await requestCommissionWithdrawalLogic({
        capsterId: capsterA1.id_capster,
        barbershopSlug: shopA.slug,
      });
    } catch (err) {
      doubleWithdrawBlocked = true;
    }
    assert(doubleWithdrawBlocked === true, "TEST G: Pengajuan kedua berhasil dicegah (Double withdrawal prevented)");

    // -------------------------------------------------------------------------
    // TEST D: OWNER REJECT DENGAN ALASAN
    // -------------------------------------------------------------------------
    console.log("\n--- TEST D: OWNER REJECT DENGAN ALASAN ---");
    await rejectCommissionRequestLogic({
      pengajuanId: pengajuanId1,
      alasan: "Jam kerja belum sesuai shift",
      ownerUserId: userOwnerA.id_user,
      barbershopSlug: shopA.slug,
    });

    const dataAfterReject = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    const req1Rejected = dataAfterReject.requests.find((r) => r.idPengajuan === pengajuanId1);
    assert(req1Rejected.uiStatus === "rejected", `TEST D: uiStatus menjadi rejected (aktual: ${req1Rejected.uiStatus})`);
    assert(req1Rejected.uiStatusLabel === "Ditolak", `TEST D: uiStatusLabel menjadi Ditolak (aktual: ${req1Rejected.uiStatusLabel})`);
    assert(req1Rejected.alasanPenolakan === "Jam kerja belum sesuai shift", `TEST D: Alasan penolakan tampil: "${req1Rejected.alasanPenolakan}"`);
    assert(dataAfterReject.komisiTersedia === 45000, `TEST D: Komisi Tersedia kembali menjadi Rp45.000 setelah ditolak (aktual: ${dataAfterReject.komisiTersedia})`);
    assert(dataAfterReject.canWithdraw === true, "TEST D: canWithdraw kembali bernilai true");
    assert(dataAfterReject.totalKomisiDiterima === 0, "TEST D: Komisi yang ditolak TIDAK dihitung sebagai diterima");

    // -------------------------------------------------------------------------
    // TEST E: AJUKAN KEMBALI & OWNER APPROVE
    // -------------------------------------------------------------------------
    console.log("\n--- TEST E: OWNER APPROVE PENGAJUAN ---");
    const withdrawRes2 = await requestCommissionWithdrawalLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
      keterangan: "Pengajuan ulang setelah perbaikan",
    });
    const pengajuanId2 = withdrawRes2.pengajuanId;
    cleanup.pengajuan.push(pengajuanId2);

    await approveCommissionRequestLogic({
      pengajuanId: pengajuanId2,
      ownerUserId: userOwnerA.id_user,
      barbershopSlug: shopA.slug,
    });

    const dataAfterApprove = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    const req2Approved = dataAfterApprove.requests.find((r) => r.idPengajuan === pengajuanId2);
    assert(req2Approved.uiStatus === "approved", `TEST E: uiStatus menjadi approved (aktual: ${req2Approved.uiStatus})`);
    assert(req2Approved.uiStatusLabel === "Disetujui", `TEST E: uiStatusLabel menjadi Disetujui (aktual: ${req2Approved.uiStatusLabel})`);
    assert(dataAfterApprove.totalKomisiDiterima === 0, "TEST E: Komisi approved BELUM masuk ke Total Komisi Diterima");

    // -------------------------------------------------------------------------
    // TEST F: OWNER SELESAIKAN PEMBAYARAN (SUDAH DITARIK)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST F: OWNER SELESAIKAN PEMBAYARAN (SUDAH DITARIK) ---");
    // Tambah saldo bisnis awal agar bisa didebit
    await sql`
      INSERT INTO saldo_bisnis (id_barbershop, jenis_transaksi, debit, kredit, saldo, keterangan)
      VALUES (${shopA.id_barbershop}, 'penyesuaian', 1000000, 0, 1000000, 'Saldo awal test')
    `;

    const payRes = await payCommissionRequestLogic({
      pengajuanId: pengajuanId2,
      ownerUserId: userOwnerA.id_user,
      metodePembayaran: "transfer",
      referensi: `TRF-TEST-${Date.now()}`,
      catatan: "Pembayaran komisi sukses",
      barbershopSlug: shopA.slug,
    });

    assert(payRes.success === true, "Pembayaran komisi berhasil dicatat success");
    cleanup.pembayaran.push(payRes.paymentId);

    const dataAfterPay = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    const req2Paid = dataAfterPay.requests.find((r) => r.idPengajuan === pengajuanId2);
    assert(req2Paid.uiStatus === "paid", `TEST F: uiStatus menjadi paid (aktual: ${req2Paid.uiStatus})`);
    assert(req2Paid.uiStatusLabel === "Sudah Ditarik", `TEST F: uiStatusLabel menjadi Sudah Ditarik (aktual: ${req2Paid.uiStatusLabel})`);
    assert(req2Paid.dibayarAtFormatted !== null, `TEST F: Tanggal pembayaran terisi: ${req2Paid.dibayarAtFormatted}`);
    assert(dataAfterPay.totalKomisiDiterima === 45000, `TEST F: Total Komisi Diterima bertambah menjadi Rp45.000 (aktual: ${dataAfterPay.totalKomisiDiterima})`);
    assert(dataAfterPay.jumlahPembayaranDiterima === 1, `TEST F: Jumlah pembayaran bertambah menjadi 1 kali pembayaran (aktual: ${dataAfterPay.jumlahPembayaranDiterima})`);
    assert(dataAfterPay.counts.paid >= 1, `TEST F: Tab Sudah Ditarik memiliki minimal 1 item (aktual: ${dataAfterPay.counts.paid})`);

    // -------------------------------------------------------------------------
    // TEST DETAIL MODAL ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- TEST DETAIL MODAL (#WD-...) ---");
    const detailData = await getCapsterWithdrawalDetailLogic({
      pengajuanId: pengajuanId2,
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopA.slug,
    });

    assert(detailData !== null, "getCapsterWithdrawalDetailLogic mengembalikan rincian pengajuan");
    assert(detailData.pengajuan.uiStatus === "paid", "Status detail pengajuan adalah paid");
    assert(detailData.pengajuan.metodePembayaran === "transfer", "Metode pembayaran adalah transfer");
    assert(detailData.dasarKomisi.transactions.length === 2, `Jumlah transaksi pembentuk komisi adalah 2 (aktual: ${detailData.dasarKomisi.transactions.length})`);
    assert(detailData.dasarKomisi.totalKomisi === 45000, `Total komisi pembentuk adalah Rp45.000 (aktual: ${detailData.dasarKomisi.totalKomisi})`);

    // -------------------------------------------------------------------------
    // TEST H: CAPSTER ISOLATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST H: CAPSTER ISOLATION ---");
    const dataCapster2 = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA2.id_capster,
      barbershopSlug: shopA.slug,
    });

    const capster2SeesCapster1 = dataCapster2.requests.some((r) => r.idPengajuan === pengajuanId2);
    assert(capster2SeesCapster1 === false, "TEST H: Capster A2 TIDAK DAPAT melihat pengajuan milik Capster A1");
    assert(dataCapster2.totalKomisiDiterima === 0, "TEST H: Total Komisi Capster A2 terisolasi (Rp0)");

    let capster2AccessDetailBlocked = false;
    try {
      await getCapsterWithdrawalDetailLogic({
        pengajuanId: pengajuanId2,
        capsterId: capsterA2.id_capster,
        barbershopSlug: shopA.slug,
      });
    } catch (err) {
      capster2AccessDetailBlocked = true;
    }
    assert(capster2AccessDetailBlocked === true, "TEST H: Capster A2 dilarang mengakses detail pengajuan Capster A1");

    // -------------------------------------------------------------------------
    // TEST I: TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST I: TENANT ISOLATION ---");
    const dataCrossTenant = await getCapsterCommissionDetailDataLogic({
      capsterId: capsterA1.id_capster,
      barbershopSlug: shopB.slug, // Slug of different shop
    });

    assert(dataCrossTenant === null, "TEST I: Capster Shop A tidak dapat mengakses data menggunakan slug Shop B (returns null)");

    let crossTenantWithdrawBlocked = false;
    try {
      await requestCommissionWithdrawalLogic({
        capsterId: capsterA1.id_capster,
        barbershopSlug: shopB.slug,
      });
    } catch (err) {
      crossTenantWithdrawBlocked = true;
    }
    assert(crossTenantWithdrawBlocked === true, "TEST I: Pengajuan ditolak jika barbershopSlug bukan milik tenant Capster");

    console.log("\n==================================================================");
    console.log(`📊 HASIL VERIFIKASI: ${passedCount} PASSED / ${failedCount} FAILED`);
    console.log("==================================================================");

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Terjadi kesalahan pada test suite:", error);
    process.exit(1);
  } finally {
    console.log("\n🧹 Membersihkan fixture test dari database...");
    try {
      if (cleanup.pembayaran.length > 0) {
        await sql`DELETE FROM pembayaran_komisi WHERE id_pembayaran_komisi IN ${sql(cleanup.pembayaran)}`;
      }
      if (cleanup.pengajuan.length > 0) {
        await sql`DELETE FROM pengajuan_komisi WHERE id_pengajuan IN ${sql(cleanup.pengajuan)}`;
      }
      if (cleanup.komisi.length > 0) {
        await sql`DELETE FROM komisi_transaksi WHERE id_komisi_trx IN ${sql(cleanup.komisi)}`;
      }
      if (cleanup.transaksi.length > 0) {
        await sql`DELETE FROM transaksi WHERE id_transaksi IN ${sql(cleanup.transaksi)}`;
      }
      if (cleanup.pelanggan.length > 0) {
        await sql`DELETE FROM pelanggan WHERE id_pelanggan IN ${sql(cleanup.pelanggan)}`;
      }
      if (cleanup.shifts.length > 0) {
        await sql`DELETE FROM shift_capster WHERE id_shift IN ${sql(cleanup.shifts)}`;
      }
      if (cleanup.layanan.length > 0) {
        await sql`DELETE FROM layanan WHERE id_layanan IN ${sql(cleanup.layanan)}`;
      }
      if (cleanup.capsters.length > 0) {
        await sql`DELETE FROM capster WHERE id_capster IN ${sql(cleanup.capsters)}`;
      }
      if (cleanup.barbershops.length > 0) {
        await sql`DELETE FROM saldo_bisnis WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
        await sql`DELETE FROM notifikasi WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
        await sql`DELETE FROM audit_log WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
      }
      if (cleanup.users.length > 0) {
        await sql`DELETE FROM users WHERE id_user IN ${sql(cleanup.users)}`;
      }
      if (cleanup.barbershops.length > 0) {
        await sql`DELETE FROM barbershop WHERE id_barbershop IN ${sql(cleanup.barbershops)}`;
      }
      console.log("  ✅ Fixtures berhasil dibersihkan.");
    } catch (e) {
      console.error("  ⚠️ Gagal membersihkan beberapa fixtures:", e);
    }
    await sql.end();
  }
}

run();
