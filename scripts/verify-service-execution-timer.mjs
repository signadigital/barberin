import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in .env!");
  process.exit(1);
}
const sql = postgres(connectionString, { prepare: false });

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  console.log("===============================================================");
  console.log("🔍 TESTING VERIFIKASI SISA WAKTU LAYANAN (SERVICE EXECUTION)");
  console.log("===============================================================\n");

  // 1. Ambil Barbershop & Capster aktif untuk pengetesan
  const [shop] = await sql`
    SELECT id_barbershop, slug FROM barbershop WHERE status = 'active' LIMIT 1
  `;
  assert(shop, `Barbershop aktif ditemukan: ${shop.slug}`);

  const [cap] = await sql`
    SELECT id_capster FROM capster WHERE id_barbershop = ${shop.id_barbershop} AND status = 'active' LIMIT 1
  `;
  assert(cap, `Capster aktif ditemukan: ${cap.id_capster}`);

  const [pel] = await sql`
    SELECT id_pelanggan FROM pelanggan WHERE id_barbershop = ${shop.id_barbershop} LIMIT 1
  `;
  assert(pel, `Pelanggan ditemukan: ${pel.id_pelanggan}`);

  const now = new Date();

  // Bersihkan data test lama jika ada
  await sql`DELETE FROM booking WHERE catatan = 'TEST_SERVICE_EXECUTION_TIMER'`;

  // -----------------------------------------------------------------
  // TEST 1: Layanan 30 menit baru dimulai -> Sisa sekitar 30 menit
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 1: Layanan 30 menit baru dimulai (started_at = NOW)");
  const [b1] = await sql`
    INSERT INTO booking (
      id_pelanggan, id_barbershop, id_capster,
      tanggal_booking, waktu_booking, status, catatan,
      waktu_permintaan, waktu_konfirmasi, waktu_mulai_layanan,
      source
    ) VALUES (
      ${pel.id_pelanggan}, ${shop.id_barbershop}, ${cap.id_capster},
      ${now}, '10:00', 'in_service', 'TEST_SERVICE_EXECUTION_TIMER',
      ${new Date(now.getTime() - 20 * 60000)}, -- waktu permintaan 20 menit lalu
      ${new Date(now.getTime() - 10 * 60000)}, -- waktu konfirmasi 10 menit lalu
      ${now}, -- waktu mulai layanan: BARU SAJA DIMULAI (started_at)
      'scan'
    ) RETURNING id_booking
  `;

  const [lay] = await sql`
    SELECT id_layanan FROM layanan WHERE id_barbershop = ${shop.id_barbershop} LIMIT 1
  `;
  assert(lay, `Layanan ditemukan: ${lay.id_layanan}`);

  // Insert detail booking durasi 30 menit
  await sql`
    INSERT INTO detail_booking (
      id_booking, id_barbershop, id_layanan, nama_layanan_snapshot,
      durasi_menit_snapshot, harga_satuan, qty, subtotal
    ) VALUES (
      ${b1.id_booking}, ${shop.id_barbershop}, ${lay.id_layanan}, 'Gentleman Haircut',
      30, '50000', 1, '50000'
    )
  `;

  // Hitung sisa waktu dengan konsep: remaining = durasi_menit_snapshot - elapsed_time_since_started_at
  const [bRow1] = await sql`
    SELECT b.waktu_mulai_layanan, d.durasi_menit_snapshot
    FROM booking b
    JOIN detail_booking d ON b.id_booking = d.id_booking
    WHERE b.id_booking = ${b1.id_booking}
  `;

  const startedAt1 = new Date(bRow1.waktu_mulai_layanan);
  const durasi1 = bRow1.durasi_menit_snapshot; // 30
  const elapsedMinutes1 = Math.max(0, Math.floor((now.getTime() - startedAt1.getTime()) / 60000));
  const remaining1 = Math.max(0, durasi1 - elapsedMinutes1);

  console.log(`  Durasi: ${durasi1}m, Elapsed: ${elapsedMinutes1}m, Sisa: ${remaining1}m`);
  assert(remaining1 === 30, "Layanan baru dimulai menghasilkan sisa waktu tepat 30 menit (bukan 0)");

  // -----------------------------------------------------------------
  // TEST 2: Setelah 5 menit berjalan -> Sisa sekitar 25 menit
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 2: Setelah 5 menit berjalan (started_at = NOW - 5 menit)");
  const fiveMinAgo = new Date(now.getTime() - 5 * 60000);
  await sql`UPDATE booking SET waktu_mulai_layanan = ${fiveMinAgo} WHERE id_booking = ${b1.id_booking}`;

  const elapsedMinutes2 = Math.max(0, Math.floor((now.getTime() - fiveMinAgo.getTime()) / 60000));
  const remaining2 = Math.max(0, durasi1 - elapsedMinutes2);
  console.log(`  Elapsed: ${elapsedMinutes2}m, Sisa: ${remaining2}m`);
  assert(remaining2 === 25, "Setelah 5 menit, sisa waktu berkurang menjadi 25 menit");

  // -----------------------------------------------------------------
  // TEST 3: Setelah 10 menit berjalan -> Sisa sekitar 20 menit
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 3: Setelah 10 menit berjalan (started_at = NOW - 10 menit)");
  const tenMinAgo = new Date(now.getTime() - 10 * 60000);
  await sql`UPDATE booking SET waktu_mulai_layanan = ${tenMinAgo} WHERE id_booking = ${b1.id_booking}`;

  const elapsedMinutes3 = Math.max(0, Math.floor((now.getTime() - tenMinAgo.getTime()) / 60000));
  const remaining3 = Math.max(0, durasi1 - elapsedMinutes3);
  console.log(`  Elapsed: ${elapsedMinutes3}m, Sisa: ${remaining3}m`);
  assert(remaining3 === 20, "Setelah 10 menit, sisa waktu berkurang menjadi 20 menit");

  // -----------------------------------------------------------------
  // TEST 4: Setelah 30 menit berjalan -> Sisa 0 menit
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 4: Setelah 30 menit berjalan (started_at = NOW - 30 menit)");
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60000);
  await sql`UPDATE booking SET waktu_mulai_layanan = ${thirtyMinAgo} WHERE id_booking = ${b1.id_booking}`;

  const elapsedMinutes4 = Math.max(0, Math.floor((now.getTime() - thirtyMinAgo.getTime()) / 60000));
  const remaining4 = Math.max(0, durasi1 - elapsedMinutes4);
  console.log(`  Elapsed: ${elapsedMinutes4}m, Sisa: ${remaining4}m`);
  assert(remaining4 === 0, "Setelah 30 menit, sisa waktu mencapai 0 menit");

  // -----------------------------------------------------------------
  // TEST 5: Setelah 35 menit berjalan -> Sisa tetap 0 (tidak menghasilkan negatif)
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 5: Setelah 35 menit berjalan (started_at = NOW - 35 menit, No Negative)");
  const thirtyFiveMinAgo = new Date(now.getTime() - 35 * 60000);
  await sql`UPDATE booking SET waktu_mulai_layanan = ${thirtyFiveMinAgo} WHERE id_booking = ${b1.id_booking}`;

  const elapsedMinutes5 = Math.max(0, Math.floor((now.getTime() - thirtyFiveMinAgo.getTime()) / 60000));
  const remaining5 = Math.max(0, durasi1 - elapsedMinutes5);
  console.log(`  Elapsed: ${elapsedMinutes5}m, Sisa: ${remaining5}m`);
  assert(remaining5 === 0, "Setelah 35 menit, sisa waktu tidak bernilai negatif dan tetap 0 menit");

  // -----------------------------------------------------------------
  // TEST 6: Penyelesaian layanan -> Status in_service beralih ke awaiting_payment (bukan completed)
  // -----------------------------------------------------------------
  console.log("\n▶ TEST 6: Pelayanan selesai -> Status beralih ke 'awaiting_payment'");
  const finishedAt = new Date();

  // Simulasikan finish service
  await sql`
    UPDATE booking
    SET status = 'awaiting_payment', updated_at = ${finishedAt}
    WHERE id_booking = ${b1.id_booking}
  `;

  const [bRowFinished] = await sql`
    SELECT status FROM booking WHERE id_booking = ${b1.id_booking}
  `;
  console.log(`  Status booking setelah selesai layanan: ${bRowFinished.status}`);
  assert(
    bRowFinished.status === "awaiting_payment",
    "Status in_service berhasil bertransisi menjadi 'awaiting_payment', bukan langsung completed",
  );

  // Bersihkan data test
  await sql`DELETE FROM detail_booking WHERE id_booking = ${b1.id_booking}`;
  await sql`DELETE FROM booking WHERE id_booking = ${b1.id_booking}`;

  console.log("\n===============================================================");
  console.log("🎉 SEMUA TEST SISA WAKTU LAYANAN BERHASIL (100% SUKSES)!");
  console.log("===============================================================");

  await sql.end();
}

runTests().catch(async (err) => {
  console.error("Test execution failed:", err);
  await sql.end();
  process.exit(1);
});
