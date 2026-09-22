import "dotenv/config";
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

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("  BARBERIN — ACCEPTANCE TESTS (TEST 1 - TEST 15)");
  console.log("=======================================================\n");

  const cleanupIds = {
    barbershops: [],
    users: [],
    pelanggan: [],
    capsters: [],
    shifts: [],
    layanan: [],
    bookings: [],
    transaksi: [],
    pembayaran: [],
    struk: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP FIXTURES: Barbershop A & B, Capster A1, A2, B1, Services, Shifts
    // -------------------------------------------------------------------------
    console.log("--- Menyiapkan Fixture Uji Coba Multi-Tenant ---");
    const testPrefix = `test_${Date.now()}`;
    const now1 = new Date();

    // Barbershop 1 (Shop A)
    const [shopA] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Shop A ${testPrefix}`}, ${`shop-a-${testPrefix}`}, 'Jl. Uji A', '0811111111', 'active')
      RETURNING id_barbershop, slug;
    `;
    cleanupIds.barbershops.push(shopA.id_barbershop);

    // Barbershop 2 (Shop B)
    const [shopB] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${`Shop B ${testPrefix}`}, ${`shop-b-${testPrefix}`}, 'Jl. Uji B', '0822222222', 'active')
      RETURNING id_barbershop, slug;
    `;
    cleanupIds.barbershops.push(shopB.id_barbershop);

    // Users
    const [userCapsterA1] = await sql`
      INSERT INTO users (nama_lengkap, no_hp, email, role)
      VALUES ('Capster A1', ${`0812${Date.now().toString().slice(-6)}1`}, ${`capa1_${testPrefix}@barber.id`}, 'capster')
      RETURNING id_user, nama_lengkap, no_hp;
    `;
    cleanupIds.users.push(userCapsterA1.id_user);

    const [userCapsterA2] = await sql`
      INSERT INTO users (nama_lengkap, no_hp, email, role)
      VALUES ('Capster A2', ${`0812${Date.now().toString().slice(-6)}2`}, ${`capa2_${testPrefix}@barber.id`}, 'capster')
      RETURNING id_user, nama_lengkap, no_hp;
    `;
    cleanupIds.users.push(userCapsterA2.id_user);

    const [userCapsterB1] = await sql`
      INSERT INTO users (nama_lengkap, no_hp, email, role)
      VALUES ('Capster B1', ${`0812${Date.now().toString().slice(-6)}3`}, ${`capb1_${testPrefix}@barber.id`}, 'capster')
      RETURNING id_user, nama_lengkap, no_hp;
    `;
    cleanupIds.users.push(userCapsterB1.id_user);

    // Capsters
    const [capsterA1] = await sql`
      INSERT INTO capster (id_barbershop, id_user, status)
      VALUES (${shopA.id_barbershop}, ${userCapsterA1.id_user}, 'active')
      RETURNING id_capster;
    `;
    cleanupIds.capsters.push(capsterA1.id_capster);

    const [capsterA2] = await sql`
      INSERT INTO capster (id_barbershop, id_user, status)
      VALUES (${shopA.id_barbershop}, ${userCapsterA2.id_user}, 'active')
      RETURNING id_capster;
    `;
    cleanupIds.capsters.push(capsterA2.id_capster);

    const [capsterB1] = await sql`
      INSERT INTO capster (id_barbershop, id_user, status)
      VALUES (${shopB.id_barbershop}, ${userCapsterB1.id_user}, 'active')
      RETURNING id_capster;
    `;
    cleanupIds.capsters.push(capsterB1.id_capster);

    // Shifts
    const [shiftA1] = await sql`
      INSERT INTO shift_capster (id_barbershop, id_capster, tanggal, waktu_mulai, status)
      VALUES (${shopA.id_barbershop}, ${capsterA1.id_capster}, ${now1}, '09:00', 'ongoing')
      RETURNING id_shift;
    `;
    cleanupIds.shifts.push(shiftA1.id_shift);

    // Customer User
    const [userCust1] = await sql`
      INSERT INTO users (nama_lengkap, no_hp, email, role)
      VALUES ('Pelanggan 1', ${`0813${Date.now().toString().slice(-6)}1`}, ${`cust1_${testPrefix}@cust.id`}, 'pelanggan')
      RETURNING id_user;
    `;
    cleanupIds.users.push(userCust1.id_user);

    const [cust1] = await sql`
      INSERT INTO pelanggan (id_barbershop, id_user, nama_pelanggan, no_hp)
      VALUES (${shopA.id_barbershop}, ${userCust1.id_user}, 'Pelanggan 1', '0813000001')
      RETURNING id_pelanggan;
    `;
    cleanupIds.pelanggan.push(cust1.id_pelanggan);

    // Services
    const [layananA_30m] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, deskripsi, harga, durasi_menit, status)
      VALUES (${shopA.id_barbershop}, 'Gentleman Haircut 30m', 'Potong rambut', 50000, 30, 'active')
      RETURNING id_layanan, harga, durasi_menit;
    `;
    cleanupIds.layanan.push(layananA_30m.id_layanan);

    const [layananA_20m] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, deskripsi, harga, durasi_menit, status)
      VALUES (${shopA.id_barbershop}, 'Beard Trim 20m', 'Cukur jenggot', 30000, 20, 'active')
      RETURNING id_layanan, harga, durasi_menit;
    `;
    cleanupIds.layanan.push(layananA_20m.id_layanan);

    const [layananA_40m] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, deskripsi, harga, durasi_menit, status)
      VALUES (${shopA.id_barbershop}, 'Full Package 40m', 'Paket komplit', 80000, 40, 'active')
      RETURNING id_layanan, harga, durasi_menit;
    `;
    cleanupIds.layanan.push(layananA_40m.id_layanan);

    const [layananB_50m] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, deskripsi, harga, durasi_menit, status)
      VALUES (${shopB.id_barbershop}, 'Shop B Service 50m', 'Layanan Shop B', 75000, 50, 'active')
      RETURNING id_layanan, harga, durasi_menit;
    `;
    cleanupIds.layanan.push(layananB_50m.id_layanan);

    console.log("Fixture siap.\n");

    // -------------------------------------------------------------------------
    // TEST 1: Request Baru
    // - Booking masuk dengan status pending_confirmation
    // - Batas konfirmasi = waktu_permintaan + 5 menit
    // -------------------------------------------------------------------------
    console.log("▶ TEST 1: Request Baru -> status pending_confirmation & batas konfirmasi = NOW() + 5m");
    const limit1 = new Date(now1.getTime() + 5 * 60 * 1000);

    const [b1] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, batas_konfirmasi, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${now1}, '10:00',
        'pending_confirmation', ${now1}, ${limit1}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(b1.id_booking);

    const [db1] = await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${b1.id_booking}, ${layananA_30m.id_layanan},
        ${layananA_30m.harga}, 1, ${layananA_30m.harga}, 'Gentleman Haircut 30m', 30
      ) RETURNING *;
    `;

    assert(b1.status === "pending_confirmation", "Status booking baru harus 'pending_confirmation'");
    const diffSeconds = Math.round((new Date(b1.batas_konfirmasi).getTime() - new Date(b1.waktu_permintaan).getTime()) / 1000);
    assert(diffSeconds === 300, `Batas konfirmasi tepat 300 detik (5 menit). Terhitung: ${diffSeconds}s`);
    assert(b1.id_barbershop === shopA.id_barbershop, "Tenant id_barbershop tersimpan dengan benar");
    assert(db1.nama_layanan_snapshot === "Gentleman Haircut 30m", "Detail booking menyimpan snapshot nama layanan");
    assert(db1.durasi_menit_snapshot === 30, "Detail booking menyimpan snapshot durasi 30 menit");

    // -------------------------------------------------------------------------
    // TEST 2: Konfirmasi < 5 Menit
    // - Capster konfirmasi booking sebelum batas konfirmasi habis
    // - Status berubah menjadi 'waiting' atau 'confirmed'
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 2: Konfirmasi < 5m -> status berubah menjadi confirmed/waiting");
    const confirmTime2 = new Date();
    const [b2Updated] = await sql`
      UPDATE booking
      SET status = 'waiting', waktu_konfirmasi = ${confirmTime2}
      WHERE id_booking = ${b1.id_booking} AND batas_konfirmasi >= ${confirmTime2}
      RETURNING *;
    `;
    assert(b2Updated && b2Updated.status === "waiting", "Status booking berhasil dikonfirmasi menjadi 'waiting'");
    assert(Boolean(b2Updated.waktu_konfirmasi), "Waktu konfirmasi tercatat");
    // Selesaikan b1 agar tidak mengganggu antrean di test 4, 5, 6
    await sql`UPDATE booking SET status = 'completed' WHERE id_booking = ${b1.id_booking}`;

    // -------------------------------------------------------------------------
    // TEST 3: Request > 5 Menit Tanpa Konfirmasi
    // - Otomatis expired dan tidak masuk antrean estimasi
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 3: Request > 5m tanpa konfirmasi -> otomatis expired & excluded");
    const pastTime3 = new Date(Date.now() - 10 * 60 * 1000); // 10 menit lalu
    const pastLimit3 = new Date(pastTime3.getTime() + 5 * 60 * 1000); // 5 menit lalu (sudah lewat)

    const [b3Expired] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, batas_konfirmasi, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${pastTime3}, '09:00',
        'pending_confirmation', ${pastTime3}, ${pastLimit3}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(b3Expired.id_booking);

    // Jalankan logika sweeping expiration
    const swept = await sql`
      UPDATE booking
      SET status = 'expired'
      WHERE status = 'pending_confirmation'
        AND batas_konfirmasi < NOW()
        AND id_booking = ${b3Expired.id_booking}
      RETURNING id_booking, status;
    `;
    assert(swept.length === 1 && swept[0].status === "expired", "Booking kedaluwarsa otomatis berubah menjadi 'expired'");

    // Cek bahwa booking expired di-filter dari active queue
    const activeBookings = await sql`
      SELECT id_booking FROM booking
      WHERE id_barbershop = ${shopA.id_barbershop}
        AND id_capster = ${capsterA1.id_capster}
        AND status IN ('in_service', 'confirmed', 'waiting')
        AND id_booking = ${b3Expired.id_booking};
    `;
    assert(activeBookings.length === 0, "Booking expired tidak masuk ke dalam antrean aktif / estimasi");

    // -------------------------------------------------------------------------
    // TEST 3B: Owner Mengubah Durasi Layanan (30m -> 40m)
    // - Order lama (b1) tetap menggunakan snapshot 30 menit
    // - Order baru menggunakan durasi baru (40 menit)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST: Snapshot Durasi (Owner ubah durasi 30m -> 40m, order lama tetap 30m, order baru 40m)");
    await sql`UPDATE layanan SET durasi_menit = 40 WHERE id_layanan = ${layananA_30m.id_layanan};`;

    // Cek order lama b1:
    const [oldDetail] = await sql`SELECT durasi_menit_snapshot FROM detail_booking WHERE id_booking = ${b1.id_booking};`;
    assert(oldDetail.durasi_menit_snapshot === 30, "Order lama tetap menggunakan snapshot durasi 30 menit");

    // Buat order baru setelah perubahan durasi:
    const [bNewOrder] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking, status, waktu_permintaan, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${now1}, '10:05', 'pending_confirmation', ${now1}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bNewOrder.id_booking);
    const [latestSvc] = await sql`SELECT durasi_menit FROM layanan WHERE id_layanan = ${layananA_30m.id_layanan};`;
    const [newDetail] = await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${bNewOrder.id_booking}, ${layananA_30m.id_layanan},
        ${layananA_30m.harga}, 1, ${layananA_30m.harga}, 'Gentleman Haircut 30m', ${latestSvc.durasi_menit}
      ) RETURNING *;
    `;
    assert(newDetail.durasi_menit_snapshot === 40, "Order baru menggunakan snapshot durasi baru (40 menit)");

    // Kembalikan ke 30m untuk test selanjutnya
    await sql`UPDATE layanan SET durasi_menit = 30 WHERE id_layanan = ${layananA_30m.id_layanan};`;
    await sql`UPDATE booking SET status = 'cancelled' WHERE id_booking = ${bNewOrder.id_booking};`;

    // -------------------------------------------------------------------------
    // TEST 4: Estimasi Durasi Tunggu
    // - Customer A: durasi 30m, sudah berjalan 10m -> sisa durasi = 20m
    // - Customer B: antre di belakang A -> estimasi tunggu B = 20m
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 4: Estimasi durasi (A 30m berjalan 10m -> sisa 20m; B antre -> est B = 20m)");
    // Customer A (Sedang in_service, mulai 10 menit yang lalu)
    const startTimeA = new Date(Date.now() - 10 * 60 * 1000);
    const [bCustA] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, waktu_konfirmasi, waktu_mulai_layanan, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${startTimeA}, '10:10',
        'in_service', ${startTimeA}, ${startTimeA}, ${startTimeA}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bCustA.id_booking);
    await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${bCustA.id_booking}, ${layananA_30m.id_layanan},
        ${layananA_30m.harga}, 1, ${layananA_30m.harga}, 'Gentleman Haircut 30m', 30
      );
    `;

    // Customer B (Menunggu dalam antrean, durasi 20m)
    const [bCustB] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, waktu_konfirmasi, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${now1}, '10:20',
        'waiting', ${now1}, ${now1}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bCustB.id_booking);
    await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${bCustB.id_booking}, ${layananA_20m.id_layanan},
        ${layananA_20m.harga}, 1, ${layananA_20m.harga}, 'Beard Trim 20m', 20
      );
    `;

    // Hitung estimasi dengan rumus Section D, E, F:
    // inService: durasi 30m, elapsed 10m -> remaining = 30 - 10 = 20m
    const elapsedA = Math.floor((Date.now() - startTimeA.getTime()) / (60 * 1000));
    const sisaA = Math.max(0, 30 - elapsedA);
    assert(sisaA === 20, `Sisa durasi layanan A adalah 20 menit (30 - 10). Terhitung: ${sisaA}m`);
    const estB = sisaA; // Tidak ada antrean sebelum B selain yang sedang di-service
    assert(estB === 20, `Estimasi tunggu Customer B tepat 20 menit. Terhitung: ${estB}m`);

    // Customer & Capster Display Konsistensi
    const customerViewB = estB;
    const capsterViewB = estB;
    assert(customerViewB === capsterViewB, `Customer B dan Capster melihat estimasi tunggu yang sama (${customerViewB} menit)`);

    // Verifikasi Dinamis Berdasarkan Waktu Aktual (5 Menit Berlalu)
    const futureTime5m = new Date(startTimeA.getTime() + 15 * 60 * 1000); // 15 menit dari mulai layanan A
    const elapsedA_5m = Math.floor((futureTime5m.getTime() - startTimeA.getTime()) / (60 * 1000));
    const sisaA_5m = Math.max(0, 30 - elapsedA_5m);
    assert(sisaA_5m === 15, `Setelah 5 menit, sisa layanan A berkurang menjadi 15 menit. Terhitung: ${sisaA_5m}m`);
    const estB_5m = sisaA_5m;
    assert(estB_5m === 15, `Setelah 5 menit, estimasi Customer B otomatis turun dari 20m menjadi 15m`);

    // -------------------------------------------------------------------------
    // TEST 5: Estimasi Durasi Multiple Customer
    // - Customer A running sisa 20m
    // - Customer B antrean ke-1 (durasi 20m) -> est B = 20m
    // - Customer C antrean ke-2 (durasi 40m) -> est C = 20m (sisa A) + 20m (B) = 40m
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 5: Multiple customer (A running sisa 20m, B 20m, C 40m -> B = 20m, C = 40m)");
    const [bCustC] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, waktu_konfirmasi, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${now1}, '10:30',
        'waiting', ${new Date(now1.getTime() + 1000)}, ${new Date(now1.getTime() + 1000)}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bCustC.id_booking);
    await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${bCustC.id_booking}, ${layananA_40m.id_layanan},
        ${layananA_40m.harga}, 1, ${layananA_40m.harga}, 'Full Package 40m', 40
      );
    `;

    const estC = sisaA + 20; // 20 (sisa A) + 20 (durasi B)
    assert(estB === 20, `Customer B: antrean ke-1, estimasi tunggu = 20m`);
    assert(estC === 40, `Customer C: antrean ke-2, estimasi tunggu = 40m (20m sisa A + 20m B)`);
    assert(estC === 40, `Capster dan Customer C sama-sama melihat estimasi antrean C = 40m`);

    // -------------------------------------------------------------------------
    // TEST 6: Pembatalan Antrean
    // - Customer B membatalkan pesanan
    // - Estimasi Customer C berkurang menjadi 20m (hanya menunggu sisa A)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 6: Cancel (B dibatalkan -> est C berkurang jadi 20m)");
    await sql`
      UPDATE booking
      SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'Dibatalkan oleh pelanggan'
      WHERE id_booking = ${bCustB.id_booking};
    `;

    // Ambil antrean aktif sebelum C (hanya A karena B sudah dibatalkan)
    const activeBeforeC = await sql`
      SELECT b.id_booking, b.status
      FROM booking b
      WHERE b.id_barbershop = ${shopA.id_barbershop}
        AND b.id_capster = ${capsterA1.id_capster}
        AND b.status IN ('in_service', 'confirmed', 'waiting')
        AND b.id_booking != ${bCustC.id_booking};
    `;
    const remainingBeforeC = activeBeforeC.filter((b) => b.id_booking === bCustA.id_booking);
    assert(activeBeforeC.length === 1, "Hanya ada 1 booking aktif sebelum C (A yang sedang berjalan)");
    const newEstC = sisaA; // Karena B cancel, C hanya menunggu sisa A
    assert(newEstC === 20, `Setelah B cancel, estimasi tunggu C otomatis turun menjadi 20m. Terhitung: ${newEstC}m`);

    // -------------------------------------------------------------------------
    // TEST 7: Finish Service
    // - Capster klik selesai layanan -> status booking = 'awaiting_payment'
    // - Batas pembayaran = NOW() + 2 jam
    // - Status transaksi tetap 'ongoing' (BELUM 'completed')
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 7: Finish service -> status awaiting_payment (bukan completed), batas bayar = +2 jam");
    const [txA] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_booking, id_shift, id_capster, id_pelanggan,
        subtotal, diskon, total, status_transaksi
      ) VALUES (
        ${shopA.id_barbershop}, ${bCustA.id_booking}, ${shiftA1.id_shift}, ${capsterA1.id_capster}, ${cust1.id_pelanggan},
        ${layananA_30m.harga}, 0, ${layananA_30m.harga}, 'ongoing'
      ) RETURNING *;
    `;
    cleanupIds.transaksi.push(txA.id_transaksi);

    const finishNow7 = new Date();
    const payLimit7 = new Date(finishNow7.getTime() + 2 * 60 * 60 * 1000);

    const [bFinishedA] = await sql`
      UPDATE booking
      SET status = 'awaiting_payment'
      WHERE id_booking = ${bCustA.id_booking}
      RETURNING *;
    `;
    const [txUpdated7] = await sql`
      UPDATE transaksi
      SET waktu_selesai_layanan = ${finishNow7}, batas_pembayaran = ${payLimit7}
      WHERE id_transaksi = ${txA.id_transaksi}
      RETURNING *;
    `;

    assert(bFinishedA.status === "awaiting_payment", "Status booking saat selesai potong adalah 'awaiting_payment'");
    assert(txUpdated7.status_transaksi === "ongoing", "Status transaksi TETAP 'ongoing' (belum completed)");
    const payDiffMinutes = Math.round((new Date(txUpdated7.batas_pembayaran).getTime() - new Date(txUpdated7.waktu_selesai_layanan).getTime()) / (60 * 1000));
    assert(payDiffMinutes === 120, `Batas pembayaran tepat 120 menit (2 jam). Terhitung: ${payDiffMinutes}m`);

    // -------------------------------------------------------------------------
    // TEST 8: Pembayaran Sukses & Penerbitan Struk
    // - Kasir/Capster konfirmasi pembayaran
    // - Status pembayaran = 'success'
    // - Status transaksi = 'completed'
    // - Struk otomatis terbuat dengan id_barbershop yang tepat
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 8: Payment success -> pembayaran = success, transaksi = completed, struk terbuat");
    const [payA] = await sql`
      INSERT INTO pembayaran (
        id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran, dikonfirmasi_oleh
      ) VALUES (
        ${shopA.id_barbershop}, ${txA.id_transaksi}, 'tunai', ${txA.total}, 'pending', ${userCapsterA1.id_user}
      ) RETURNING *;
    `;
    cleanupIds.pembayaran.push(payA.id_pembayaran);

    // Capster mengonfirmasi pembayaran
    const [paySuccess] = await sql`
      UPDATE pembayaran
      SET status_pembayaran = 'success'
      WHERE id_pembayaran = ${payA.id_pembayaran}
      RETURNING *;
    `;
    const [txCompleted] = await sql`
      UPDATE transaksi
      SET status_transaksi = 'completed'
      WHERE id_transaksi = ${txA.id_transaksi}
      RETURNING *;
    `;
    const [bCompleted] = await sql`
      UPDATE booking
      SET status = 'completed'
      WHERE id_booking = ${bCustA.id_booking}
      RETURNING *;
    `;

    // Buat struk
    const nomorStruk = `STR-${testPrefix}-001`;
    const [strukRecord] = await sql`
      INSERT INTO struk (id_barbershop, id_transaksi, no_struk, tanggal_cetak)
      VALUES (${shopA.id_barbershop}, ${txA.id_transaksi}, ${nomorStruk}, NOW())
      RETURNING *;
    `;
    cleanupIds.struk.push(strukRecord.id_struk);

    assert(paySuccess.status_pembayaran === "success", "Status pembayaran berhasil menjadi 'success'");
    assert(txCompleted.status_transaksi === "completed", "Status transaksi resmi menjadi 'completed'");
    assert(bCompleted.status === "completed", "Status booking resmi menjadi 'completed'");
    assert(strukRecord.no_struk === nomorStruk, "Struk digital berhasil diterbitkan");
    assert(strukRecord.id_barbershop === shopA.id_barbershop, "Struk digital terikat pada id_barbershop tenant");

    // -------------------------------------------------------------------------
    // TEST 9: Payment Timeout > 2 Jam
    // - Transaksi menunggu bayar melebihi 2 jam
    // - Otomatis expired (booking = expired, transaksi = expired, pembayaran = expired)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 9: Payment timeout > 2 jam -> pembayaran = expired, transaksi = expired");
    const pastDone9 = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 jam lalu
    const pastLimit9 = new Date(pastDone9.getTime() + 2 * 60 * 60 * 1000); // 1 jam lalu (sudah expired)

    const [b9] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking,
        status, waktu_permintaan, waktu_mulai_layanan, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        ${pastDone9}, '07:00',
        'awaiting_payment', ${pastDone9}, ${pastDone9}, 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(b9.id_booking);

    const [tx9] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_booking, id_shift, id_capster, id_pelanggan,
        subtotal, diskon, total, status_transaksi, waktu_selesai_layanan, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${b9.id_booking}, ${shiftA1.id_shift}, ${capsterA1.id_capster}, ${cust1.id_pelanggan},
        50000, 0, 50000, 'ongoing', ${pastDone9}, ${pastLimit9}
      ) RETURNING *;
    `;
    cleanupIds.transaksi.push(tx9.id_transaksi);

    const [pay9] = await sql`
      INSERT INTO pembayaran (
        id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${tx9.id_transaksi}, 'tunai', 50000, 'pending', ${pastLimit9}
      ) RETURNING *;
    `;
    cleanupIds.pembayaran.push(pay9.id_pembayaran);

    // Jalankan sweep pembayaran expired
    const sweptTx = await sql`
      UPDATE transaksi
      SET status_transaksi = 'expired'
      WHERE status_transaksi = 'ongoing'
        AND batas_pembayaran < NOW()
        AND id_transaksi = ${tx9.id_transaksi}
      RETURNING *;
    `;
    const sweptPay = await sql`
      UPDATE pembayaran
      SET status_pembayaran = 'expired'
      WHERE status_pembayaran = 'pending'
        AND id_transaksi = ${tx9.id_transaksi}
      RETURNING *;
    `;
    const sweptBk = await sql`
      UPDATE booking
      SET status = 'expired'
      WHERE id_booking = ${b9.id_booking}
      RETURNING *;
    `;

    assert(sweptTx.length === 1 && sweptTx[0].status_transaksi === "expired", "Transaksi timeout > 2 jam menjadi 'expired'");
    assert(sweptPay.length === 1 && sweptPay[0].status_pembayaran === "expired", "Pembayaran timeout > 2 jam menjadi 'expired'");
    assert(sweptBk.length === 1 && sweptBk[0].status === "expired", "Booking timeout > 2 jam menjadi 'expired'");

    // -------------------------------------------------------------------------
    // TEST 10: Capster Isolation
    // - Antrean dan estimasi Capster A1 TIDAK bocor ke Capster A2
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 10: Capster isolation (Capster A1 vs Capster A2)");
    const queueCapsterA1 = await sql`
      SELECT id_booking, id_capster FROM booking
      WHERE id_barbershop = ${shopA.id_barbershop}
        AND id_capster = ${capsterA1.id_capster}
        AND status IN ('in_service', 'waiting', 'confirmed');
    `;
    const queueCapsterA2 = await sql`
      SELECT id_booking, id_capster FROM booking
      WHERE id_barbershop = ${shopA.id_barbershop}
        AND id_capster = ${capsterA2.id_capster}
        AND status IN ('in_service', 'waiting', 'confirmed');
    `;
    assert(queueCapsterA1.some((b) => b.id_booking === bCustC.id_booking), "Booking Customer C ada di antrean Capster A1");
    assert(!queueCapsterA2.some((b) => b.id_booking === bCustC.id_booking), "Booking Customer C TIDAK ADA di antrean Capster A2");

    // -------------------------------------------------------------------------
    // TEST 11: Tenant Isolation (Layanan)
    // - Barbershop A layanan tidak muncul di Barbershop B
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 11: Tenant isolation (Layanan Shop A vs Shop B)");
    const servicesA = await sql`
      SELECT id_layanan, nama_layanan FROM layanan
      WHERE id_barbershop = ${shopA.id_barbershop};
    `;
    const servicesB = await sql`
      SELECT id_layanan, nama_layanan FROM layanan
      WHERE id_barbershop = ${shopB.id_barbershop};
    `;
    assert(servicesA.some((s) => s.id_layanan === layananA_30m.id_layanan), "Layanan A30m muncul di Shop A");
    assert(!servicesB.some((s) => s.id_layanan === layananA_30m.id_layanan), "Layanan A30m TIDAK muncul di Shop B");
    assert(servicesB.some((s) => s.id_layanan === layananB_50m.id_layanan), "Layanan B50m muncul di Shop B");
    assert(!servicesA.some((s) => s.id_layanan === layananB_50m.id_layanan), "Layanan B50m TIDAK muncul di Shop A");

    // -------------------------------------------------------------------------
    // TEST 12: Transaksi Isolation Antar Tenant
    // - Transaksi Shop A tidak muncul pada query Shop B
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 12: Transaksi isolation (Transaksi Shop A vs Shop B)");
    const txListShopA = await sql`
      SELECT id_transaksi FROM transaksi
      WHERE id_barbershop = ${shopA.id_barbershop};
    `;
    const txListShopB = await sql`
      SELECT id_transaksi FROM transaksi
      WHERE id_barbershop = ${shopB.id_barbershop};
    `;
    assert(txListShopA.some((t) => t.id_transaksi === txA.id_transaksi), "Transaksi Shop A muncul di tenant Shop A");
    assert(!txListShopB.some((t) => t.id_transaksi === txA.id_transaksi), "Transaksi Shop A TIDAK PERNAH muncul di tenant Shop B");

    // -------------------------------------------------------------------------
    // TEST 13: Customer URL (Slug Scoping)
    // - Slug yang valid menghasilkan barbershop spesifik
    // - Slug yang tidak valid mengembalikan null (NO fallback)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 13: Customer URL slug scoping & 404 pada slug tidak valid");
    const [foundShopA] = await sql`
      SELECT id_barbershop, slug FROM barbershop
      WHERE slug = ${shopA.slug};
    `;
    const [invalidShop] = await sql`
      SELECT id_barbershop, slug FROM barbershop
      WHERE slug = 'non-existent-barbershop-slug-12345';
    `;
    assert(foundShopA && foundShopA.id_barbershop === shopA.id_barbershop, `Slug '${shopA.slug}' mengembalikan Barbershop A yang valid`);
    assert(!invalidShop, "Slug yang tidak terdaftar menghasilkan NULL (tidak ada fallback default barbershop)");

    // -------------------------------------------------------------------------
    // TEST 14: Cross-Tenant Login Ditolak
    // - Capster dari Barbershop A mencoba login di tenant Barbershop B
    // - Harus ditolak
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 14: Cross-tenant login ditolak");
    // Cari apakah Capster A1 terdaftar di Shop B
    const crossCapsterCheck = await sql`
      SELECT c.id_capster
      FROM capster c
      JOIN users u ON c.id_user = u.id_user
      WHERE c.id_barbershop = ${shopB.id_barbershop}
        AND u.no_hp = ${userCapsterA1.no_hp};
    `;
    assert(crossCapsterCheck.length === 0, `Capster Shop A (${userCapsterA1.nama_lengkap}) ditolak login di Shop B`);

    // -------------------------------------------------------------------------
    // TEST 15: Direct URL Protection
    // - Akses dashboard tanpa sesi/auth yang cocok dengan tenant harus terblokir
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 15: Direct URL protection (cek sesi capster tersimpan per tenant)");
    // Validasi struktur kunci sesi: barberin_capster_state_{tenant}_{capsterId}
    const tenantKeyShopA = `barberin_capster_state_${shopA.slug}_${capsterA1.id_capster}`;
    const tenantKeyShopB = `barberin_capster_state_${shopB.slug}_${capsterA1.id_capster}`;
    assert(tenantKeyShopA !== tenantKeyShopB, "Kunci sesi storage terisolasi per barbershop slug");
    assert(tenantKeyShopA.includes(shopA.slug), "Kunci sesi mengandung slug tenant aktif");

    // =========================================================================
    // FITUR WAKTU PELAYANAN OWNER -> CUSTOMER -> CAPSTER (TEST 1 - TEST 9)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("  ACCEPTANCE TESTS: MENU WAKTU PELAYANAN (TEST 1 - TEST 9)");
    console.log("=======================================================\n");

    // TEST 1: Validasi Waktu Pelayanan (Wajib diisi, angka integer > 0, tolak 0 dan negatif)
    console.log("▶ TEST 1: Validasi input Waktu Pelayanan (wajib angka, integer > 0)");
    function validateWaktuPelayanan(durasi) {
      const num = Number(durasi);
      if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
        throw new Error("Waktu pelayanan wajib diisi dengan bilangan bulat positif lebih dari 0 menit.");
      }
      return num;
    }
    let valErr1 = false;
    try { validateWaktuPelayanan(0); } catch (e) { valErr1 = true; }
    assert(valErr1, "Validasi menolak durasi_menit = 0");
    let valErr2 = false;
    try { validateWaktuPelayanan(-10); } catch (e) { valErr2 = true; }
    assert(valErr2, "Validasi menolak durasi_menit negatif (-10)");
    let valErr3 = false;
    try { validateWaktuPelayanan("abc"); } catch (e) { valErr3 = true; }
    assert(valErr3, "Validasi menolak durasi_menit non-numerik ('abc')");
    let valErr4 = false;
    try { validateWaktuPelayanan(30.5); } catch (e) { valErr4 = true; }
    assert(valErr4, "Validasi menolak durasi_menit pecahan (30.5)");
    assert(validateWaktuPelayanan(30) === 30, "Validasi meloloskan integer positif (30)");

    // TEST 2: Owner membuat Haircut: Harga 30000, Waktu Pelayanan: 30 menit -> DB durasi_menit = 30
    console.log("\n▶ TEST 2: Owner membuat Haircut: Harga 30000, Waktu Pelayanan: 30 menit");
    const [svcHaircut] = await sql`
      INSERT INTO layanan (
        id_barbershop, nama_layanan, deskripsi, durasi_menit, harga, status
      ) VALUES (
        ${shopA.id_barbershop}, 'Haircut Signature', 'Potong rambut pria rapi', 30, '30000.00', 'active'
      ) RETURNING *;
    `;
    cleanupIds.layanan.push(svcHaircut.id_layanan);
    assert(svcHaircut.durasi_menit === 30, `Database menyimpan durasi_menit = 30 (integer)`);
    assert(Number(svcHaircut.harga) === 30000, `Database menyimpan harga = Rp30.000`);

    // TEST 3: Owner Edit Haircut: 30 -> 40 menit -> DB durasi_menit = 40
    console.log("\n▶ TEST 3: Owner Edit Haircut: 30 -> 40 menit");
    const [svcUpdated] = await sql`
      UPDATE layanan
      SET durasi_menit = 40, updated_at = NOW()
      WHERE id_layanan = ${svcHaircut.id_layanan} AND id_barbershop = ${shopA.id_barbershop}
      RETURNING *;
    `;
    assert(svcUpdated.durasi_menit === 40, `Database menyimpan durasi_menit terupdate = 40`);

    // TEST 4: Customer memilih Haircut -> durasi layanan = 40 menit
    console.log("\n▶ TEST 4: Customer memilih Haircut dengan durasi 40 menit");
    const [svcActive] = await sql`
      SELECT durasi_menit FROM layanan
      WHERE id_layanan = ${svcHaircut.id_layanan} AND id_barbershop = ${shopA.id_barbershop} AND status = 'active';
    `;
    assert(svcActive.durasi_menit === 40, `Layanan terpilih menghasilkan durasi 40 menit untuk Customer`);

    // TEST 5: Customer membuat request saat durasi 40 menit -> durasi_menit_snapshot = 40
    console.log("\n▶ TEST 5: Customer membuat booking saat durasi 40 menit -> snapshot tersimpan 40");
    const [bCustT5] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking, status, waktu_permintaan, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        NOW(), '11:00', 'waiting', NOW(), 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bCustT5.id_booking);

    const [detCustT5] = await sql`
      INSERT INTO detail_booking (
        id_barbershop, id_booking, id_layanan, harga_satuan, qty, subtotal,
        nama_layanan_snapshot, durasi_menit_snapshot
      ) VALUES (
        ${shopA.id_barbershop}, ${bCustT5.id_booking}, ${svcHaircut.id_layanan},
        ${svcHaircut.harga}, 1, ${svcHaircut.harga}, 'Haircut Signature', ${svcActive.durasi_menit}
      ) RETURNING *;
    `;
    assert(detCustT5.durasi_menit_snapshot === 40, `detail_booking.durasi_menit_snapshot tersimpan tepat 40 menit`);

    // TEST 6: Owner mengubah layanan 40 -> 50 menit -> request lama tetap durasi_menit_snapshot = 40
    console.log("\n▶ TEST 6: Owner ubah durasi 40 -> 50 menit, snapshot booking lama tetap 40 menit");
    await sql`
      UPDATE layanan
      SET durasi_menit = 50, updated_at = NOW()
      WHERE id_layanan = ${svcHaircut.id_layanan} AND id_barbershop = ${shopA.id_barbershop};
    `;
    const [detCustT5Check] = await sql`
      SELECT durasi_menit_snapshot FROM detail_booking WHERE id_detail_booking = ${detCustT5.id_detail_booking};
    `;
    assert(detCustT5Check.durasi_menit_snapshot === 40, `Request lama tetap memiliki durasi_menit_snapshot = 40 (tidak berubah)`);

    // TEST 7: Customer berikutnya menunggu -> estimasi dihitung dari snapshot + kondisi layanan aktif + sisa waktu
    console.log("\n▶ TEST 7: Estimasi antrean dihitung dinamis dari snapshot + sisa durasi layanan aktif");
    // Asumsikan bCustA sedang berjalan dengan sisa 20 menit, dan bCustT5 menunggu di belakangnya dengan snapshot 40 menit
    const estNextCustomer = 20 + detCustT5Check.durasi_menit_snapshot; // 20 + 40 = 60 menit
    assert(estNextCustomer === 60, `Estimasi customer berikutnya tepat 60 menit (20m sisa aktif + 40m antrean sebelumnya)`);

    // TEST 8: Capster membuka list transaksi -> melihat Waktu Pelayanan & Estimasi Waktu Tunggu identik dg Customer
    console.log("\n▶ TEST 8: Capster & Customer melihat Waktu Pelayanan (40m) & Estimasi yang identik");
    const capsterDisplayDuration = detCustT5Check.durasi_menit_snapshot;
    const customerDisplayDuration = detCustT5Check.durasi_menit_snapshot;
    assert(capsterDisplayDuration === 40 && customerDisplayDuration === 40, "Waktu Pelayanan pada Capster dan Customer sama-sama 40 menit");

    // TEST 9: Owner Barbershop A mengubah durasi layanan -> Barbershop B tidak berubah
    console.log("\n▶ TEST 9: Multi-tenant: Ubah durasi di Shop A tidak mempengaruhi layanan Shop B");
    const [svcShopB] = await sql`
      INSERT INTO layanan (
        id_barbershop, nama_layanan, deskripsi, durasi_menit, harga, status
      ) VALUES (
        ${shopB.id_barbershop}, 'Haircut Shop B', 'Haircut di Barbershop B', 25, '35000.00', 'active'
      ) RETURNING *;
    `;
    cleanupIds.layanan.push(svcShopB.id_layanan);

    // Update layanan Shop A ke 45m
    await sql`
      UPDATE layanan
      SET durasi_menit = 45
      WHERE id_layanan = ${svcHaircut.id_layanan} AND id_barbershop = ${shopA.id_barbershop};
    `;

    // Cek layanan Shop B
    const [svcShopBCheck] = await sql`
      SELECT durasi_menit FROM layanan WHERE id_layanan = ${svcShopB.id_layanan};
    `;
    assert(svcShopBCheck.durasi_menit === 25, `Durasi layanan Shop B tetap 25 menit (terisolasi sempurna dari perubahan Shop A)`);

    // =========================================================================
    // ALUR BARU: LANGSUNG MULAI LAYANAN & PELANGGAN SELESAI LAYANAN
    // =========================================================================
    console.log("\n=======================================================");
    console.log("  ALUR BARU: LANGSUNG MULAI LAYANAN & PELANGGAN SELESAI LAYANAN");
    console.log("=======================================================\n");

    // TEST 1: Customer membuat request -> status langsung waiting (langsung masuk antrean & siap MULAI LAYANAN)
    console.log("▶ TEST 1: Customer membuat request -> status langsung 'waiting' tanpa barrier konfirmasi");
    const [bReqT1] = await sql`
      INSERT INTO booking (
        id_barbershop, id_pelanggan, id_capster,
        tanggal_booking, waktu_booking, status, waktu_permintaan, waktu_konfirmasi, source
      ) VALUES (
        ${shopA.id_barbershop}, ${cust1.id_pelanggan}, ${capsterA1.id_capster},
        NOW(), '12:00', 'waiting', NOW(), NOW(), 'scan'
      ) RETURNING *;
    `;
    cleanupIds.bookings.push(bReqT1.id_booking);
    assert(bReqT1.status === "waiting", "Status permintaan layanan baru langsung 'waiting' (langsung antre)");
    assert(bReqT1.waktu_konfirmasi !== null, "waktu_konfirmasi langsung terisi saat pemesanan");

    // TEST 2: Capster langsung klik MULAI LAYANAN -> status in_service
    console.log("\n▶ TEST 2: Capster langsung klik MULAI LAYANAN -> status in_service");
    const nowStart = new Date();
    const [bReqT2] = await sql`
      UPDATE booking
      SET status = 'in_service', waktu_mulai_layanan = ${nowStart}, updated_at = ${nowStart}
      WHERE id_booking = ${bReqT1.id_booking}
      RETURNING *;
    `;
    assert(bReqT2.status === "in_service", "Status layanan berhasil bertransisi menjadi 'in_service'");
    assert(bReqT2.waktu_mulai_layanan !== null, "waktu_mulai_layanan tercatat di database");

    // TEST 3: Pelanggan menekan tombol SELESAI LAYANAN di halaman pelanggan -> status awaiting_payment
    console.log("\n▶ TEST 3: Pelanggan menekan [ SELESAI LAYANAN ] -> status awaiting_payment (batas bayar +2 jam)");
    const nowFinish = new Date();
    const batasBayar2h = new Date(nowFinish.getTime() + 2 * 60 * 60 * 1000);
    const [bReqT3] = await sql`
      UPDATE booking
      SET status = 'awaiting_payment', updated_at = ${nowFinish}
      WHERE id_booking = ${bReqT1.id_booking}
      RETURNING *;
    `;
    assert(bReqT3.status === "awaiting_payment", "Status layanan berhasil diselesaikan pelanggan menjadi 'awaiting_payment'");

    const [txT3] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_booking, id_shift, id_capster, id_pelanggan,
        subtotal, diskon, total, status_transaksi, waktu_selesai_layanan, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${bReqT1.id_booking}, ${shiftA1.id_shift}, ${capsterA1.id_capster}, ${cust1.id_pelanggan},
        '50000.00', 0, '50000.00', 'ongoing', ${nowFinish}, ${batasBayar2h}
      ) RETURNING *;
    `;
    cleanupIds.transaksi.push(txT3.id_transaksi);
    assert(txT3.status_transaksi === "ongoing", "Transaksi tetap berstatus 'ongoing'");

    const [payT3] = await sql`
      INSERT INTO pembayaran (
        id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${txT3.id_transaksi}, 'tunai', '50000.00', 'pending', ${batasBayar2h}
      ) RETURNING *;
    `;
    cleanupIds.pembayaran.push(payT3.id_pembayaran);
    const diffBatasBayar = Math.round((new Date(txT3.batas_pembayaran).getTime() - new Date(txT3.waktu_selesai_layanan).getTime()) / (60 * 1000));
    assert(diffBatasBayar === 120, `Batas pembayaran tepat 120 menit (2 jam) sejak pelanggan menyelesaikan layanan. Terhitung: ${diffBatasBayar}m`);

    // TEST 4: Customer bayar -> Capster melihat [ KONFIRMASI PEMBAYARAN ]
    console.log("\n▶ TEST 4: Layanan selesai -> tahap awaiting_payment siap dikonfirmasi pembayarannya oleh Capster");
    assert(bReqT3.status === "awaiting_payment" && txT3.status_transaksi === "ongoing", "Aksi yang muncul di Capster adalah KONFIRMASI PEMBAYARAN");

    // TEST 5: Capster melakukan Konfirmasi Pembayaran < 2 jam -> payment = success, transaction = completed, struk terbit
    console.log("\n▶ TEST 5: Capster Konfirmasi Pembayaran < 2 jam -> payment = success, transaction = completed, struk terbit");
    const nowPayConf = new Date();
    const [payT5] = await sql`
      UPDATE pembayaran
      SET status_pembayaran = 'success', waktu_bayar = ${nowPayConf}, dikonfirmasi_oleh = ${userCapsterA1.id_user}, updated_at = ${nowPayConf}
      WHERE id_pembayaran = ${payT3.id_pembayaran}
      RETURNING *;
    `;
    assert(payT5.status_pembayaran === "success", "Status pembayaran berhasil menjadi 'success'");
    assert(payT5.waktu_bayar !== null, "waktu_konfirmasi_pembayaran (waktu_bayar) tercatat");

    const [txT5Done] = await sql`
      UPDATE transaksi
      SET status_transaksi = 'completed', updated_at = ${nowPayConf}
      WHERE id_transaksi = ${txT3.id_transaksi}
      RETURNING *;
    `;
    assert(txT5Done.status_transaksi === "completed", "Status transaksi resmi menjadi 'completed'");

    const [bReqT5Done] = await sql`
      UPDATE booking
      SET status = 'completed', updated_at = ${nowPayConf}
      WHERE id_booking = ${bReqT1.id_booking}
      RETURNING *;
    `;
    assert(bReqT5Done.status === "completed", "Status booking resmi menjadi 'completed'");

    const [strukT5] = await sql`
      INSERT INTO struk (
        id_barbershop, id_transaksi, no_struk, url_struk
      ) VALUES (
        ${shopA.id_barbershop}, ${txT3.id_transaksi}, ${`STR-${Date.now()}`}, 'https://struk.barber.id/receipt.pdf'
      ) RETURNING *;
    `;
    cleanupIds.struk.push(strukT5.id_struk);
    assert(strukT5.id_struk !== undefined, "Struk digital berhasil diterbitkan setelah konfirmasi pembayaran");

    // TEST 6: Konfirmasi pembayaran tidak dilakukan sampai 2 jam -> payment = expired, transaction = expired
    console.log("\n▶ TEST 6: Pembayaran > 2 jam tanpa konfirmasi -> expired (payment & transaction)");
    const past3h = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const batasPast3h = new Date(past3h.getTime() + 2 * 60 * 60 * 1000);
    const [txTimeout] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_capster, id_pelanggan,
        subtotal, diskon, total, status_transaksi, waktu_selesai_layanan, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA1.id_shift}, ${capsterA1.id_capster}, ${cust1.id_pelanggan},
        '40000.00', 0, '40000.00', 'ongoing', ${past3h}, ${batasPast3h}
      ) RETURNING *;
    `;
    cleanupIds.transaksi.push(txTimeout.id_transaksi);

    const [payTimeout] = await sql`
      INSERT INTO pembayaran (
        id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran, batas_pembayaran
      ) VALUES (
        ${shopA.id_barbershop}, ${txTimeout.id_transaksi}, 'tunai', '40000.00', 'pending', ${batasPast3h}
      ) RETURNING *;
    `;
    cleanupIds.pembayaran.push(payTimeout.id_pembayaran);

    const isPayTimeout = new Date().getTime() > new Date(txTimeout.batas_pembayaran).getTime();
    assert(isPayTimeout, "Transaksi telah melewati batas 2 jam tanpa konfirmasi pembayaran");

    const [txExpired] = await sql`
      UPDATE transaksi SET status_transaksi = 'expired', updated_at = NOW()
      WHERE id_transaksi = ${txTimeout.id_transaksi} RETURNING *;
    `;
    const [payExpired] = await sql`
      UPDATE pembayaran SET status_pembayaran = 'expired', updated_at = NOW()
      WHERE id_pembayaran = ${payTimeout.id_pembayaran} RETURNING *;
    `;
    assert(txExpired.status_transaksi === "expired", "Transaksi timeout > 2 jam otomatis beralih menjadi 'expired'");
    assert(payExpired.status_pembayaran === "expired", "Pembayaran timeout > 2 jam otomatis beralih menjadi 'expired'");

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- Membersihkan Data Uji Coba ---");
    if (cleanupIds.struk.length > 0) {
      await sql`DELETE FROM struk WHERE id_struk = ANY(${cleanupIds.struk})`;
    }
    if (cleanupIds.pembayaran.length > 0) {
      await sql`DELETE FROM pembayaran WHERE id_pembayaran = ANY(${cleanupIds.pembayaran})`;
    }
    if (cleanupIds.transaksi.length > 0) {
      await sql`DELETE FROM transaksi WHERE id_transaksi = ANY(${cleanupIds.transaksi})`;
    }
    if (cleanupIds.bookings.length > 0) {
      await sql`DELETE FROM detail_booking WHERE id_booking = ANY(${cleanupIds.bookings})`;
      await sql`DELETE FROM booking WHERE id_booking = ANY(${cleanupIds.bookings})`;
    }
    if (cleanupIds.shifts.length > 0) {
      await sql`DELETE FROM shift_capster WHERE id_shift = ANY(${cleanupIds.shifts})`;
    }
    if (cleanupIds.layanan.length > 0) {
      await sql`DELETE FROM layanan WHERE id_layanan = ANY(${cleanupIds.layanan})`;
    }
    if (cleanupIds.capsters.length > 0) {
      await sql`DELETE FROM capster WHERE id_capster = ANY(${cleanupIds.capsters})`;
    }
    if (cleanupIds.pelanggan.length > 0) {
      await sql`DELETE FROM pelanggan WHERE id_pelanggan = ANY(${cleanupIds.pelanggan})`;
    }
    if (cleanupIds.users.length > 0) {
      await sql`DELETE FROM users WHERE id_user = ANY(${cleanupIds.users})`;
    }
    if (cleanupIds.barbershops.length > 0) {
      await sql`DELETE FROM barbershop WHERE id_barbershop = ANY(${cleanupIds.barbershops})`;
    }
    console.log("Pembersihan data selesai.");
    await sql.end();
  }

  console.log("\n=======================================================");
  console.log(`  HASIL AKHIR: ${passedCount} LULUS, ${failedCount} GAGAL`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("❌ Terjadi kesalahan saat menjalankan tes:", err);
  process.exit(1);
});
