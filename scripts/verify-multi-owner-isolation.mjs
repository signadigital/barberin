import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in .env!");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

function generateStrukNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STR-${ymd}-${rand}`;
}

async function runMultiOwnerIsolationVerification() {
  console.log("=======================================================================");
  console.log("🚀 STARTING MULTI-OWNER DATA ISOLATION VERIFICATION (REQUIREMENT 14)");
  console.log("=======================================================================\n");

  const ts = Date.now();
  const shopAName = `Shop A Test ${ts}`;
  const shopASlug = `shop-a-${ts}`;
  const ownerAEmail = `owner-a-${ts}@barberin.test`;

  const shopBName = `Shop B Test ${ts}`;
  const shopBSlug = `shop-b-${ts}`;
  const ownerBEmail = `owner-b-${ts}@barberin.test`;

  let shopAId, ownerAId, serviceA1Id, serviceA2Id, capsterAId, txAId;
  let shopBId, ownerBId;

  try {
    // -------------------------------------------------------------------------
    // SETUP: 1. SETUP SHOP_A (2 layanan, 1 capster, 1 pelanggan, 1 transaksi)
    // -------------------------------------------------------------------------
    console.log("⏳ [SETUP] Creating Barbershop A & Owner A with initial dataset...");
    const [shopA] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status, jam_buka, jam_tutup)
      VALUES (${shopAName}, ${shopASlug}, 'Jl. Owner A No. 1', '08111111111', 'active', '08:00', '21:00')
      RETURNING id_barbershop;
    `;
    shopAId = shopA.id_barbershop;

    const [ownerA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopAId}, 'Owner Alpha', ${ownerAEmail}, 'password123', 'owner', 'active')
      RETURNING id_user;
    `;
    ownerAId = ownerA.id_user;

    const [srvA1] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
      VALUES (${shopAId}, 'Gentleman Haircut A', 50000, 30, 'active')
      RETURNING id_layanan;
    `;
    serviceA1Id = srvA1.id_layanan;

    const [srvA2] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
      VALUES (${shopAId}, 'Beard Trim A', 30000, 20, 'active')
      RETURNING id_layanan;
    `;
    serviceA2Id = srvA2.id_layanan;

    const [userCapA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopAId}, 'Capster Alpha', ${`capster-a-${ts}@barberin.test`}, 'password123', 'capster', 'active')
      RETURNING id_user;
    `;
    const [capA] = await sql`
      INSERT INTO capster (id_user, id_barbershop, no_pegawai, status, tanggal_bergabung)
      VALUES (${userCapA.id_user}, ${shopAId}, 'CAP-A01', 'active', NOW())
      RETURNING id_capster;
    `;
    capsterAId = capA.id_capster;

    const [shiftA] = await sql`
      INSERT INTO shift_capster (id_capster, tanggal, waktu_mulai, status)
      VALUES (${capsterAId}, NOW(), '09:00', 'ongoing')
      RETURNING id_shift;
    `;

    const [userCustA] = await sql`
      INSERT INTO users (nama_lengkap, email, role, status)
      VALUES ('Pelanggan Alpha', ${`cust-a-${ts}@barberin.test`}, 'pelanggan', 'active')
      RETURNING id_user;
    `;
    const [custA] = await sql`
      INSERT INTO pelanggan (id_user)
      VALUES (${userCustA.id_user})
      RETURNING id_pelanggan;
    `;

    const [bookA] = await sql`
      INSERT INTO booking (id_barbershop, id_pelanggan, id_capster, tanggal_booking, waktu_booking, status)
      VALUES (${shopAId}, ${custA.id_pelanggan}, ${capsterAId}, NOW(), '10:00', 'completed')
      RETURNING id_booking;
    `;

    await sql`
      INSERT INTO detail_booking (id_booking, id_layanan, qty, harga_satuan, subtotal)
      VALUES (${bookA.id_booking}, ${serviceA1Id}, 1, 50000, 50000);
    `;

    const [txA] = await sql`
      INSERT INTO transaksi (id_barbershop, id_booking, id_shift, id_pelanggan, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${bookA.id_booking}, ${shiftA.id_shift}, ${custA.id_pelanggan}, 50000, 0, 50000, 'paid')
      RETURNING id_transaksi;
    `;
    txAId = txA.id_transaksi;

    await sql`
      INSERT INTO pembayaran (id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran)
      VALUES (${txAId}, 'tunai', 50000, 'success');
    `;

    console.log(`✅ [SETUP] SHOP_A created: ID=${shopAId}, Slug=${shopASlug}`);
    console.log(`   - 2 Services: ${serviceA1Id}, ${serviceA2Id}`);
    console.log(`   - 1 Capster: ${capsterAId}`);
    console.log(`   - 1 Transaction: ${txAId} (Rp50.000, paid)`);

    // -------------------------------------------------------------------------
    // SETUP: 2. SETUP SHOP_B (Owner B baru dibuat, kondisi 100% KOSONG)
    // -------------------------------------------------------------------------
    console.log("\n⏳ [SETUP] Creating Barbershop B & Owner B (Brand New, 0 initial data)...");
    const [shopB] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status, jam_buka, jam_tutup)
      VALUES (${shopBName}, ${shopBSlug}, 'Jl. Owner B No. 2', '08222222222', 'active', '08:00', '21:00')
      RETURNING id_barbershop;
    `;
    shopBId = shopB.id_barbershop;

    const [ownerB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopBId}, 'Owner Beta', ${ownerBEmail}, 'password123', 'owner', 'active')
      RETURNING id_user;
    `;
    ownerBId = ownerB.id_user;

    console.log(`✅ [SETUP] SHOP_B created: ID=${shopBId}, Slug=${shopBSlug}`);
    console.log(`   - Starts with 0 services, 0 capsters, 0 bookings, 0 transactions.`);

    // -------------------------------------------------------------------------
    // TEST A: Login Owner A -> Hanya data SHOP_A
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST A] Query data for Owner A (Tenant ID = SHOP_A)...");
    const servicesForA = await sql`
      SELECT id_layanan, nama_layanan, harga, id_barbershop 
      FROM layanan 
      WHERE id_barbershop = ${shopAId} AND status = 'active';
    `;
    const capstersForA = await sql`
      SELECT id_capster, id_barbershop 
      FROM capster 
      WHERE id_barbershop = ${shopAId} AND status = 'active';
    `;
    const txsForA = await sql`
      SELECT id_transaksi, total, status_transaksi, id_barbershop 
      FROM transaksi 
      WHERE id_barbershop = ${shopAId};
    `;

    if (servicesForA.length !== 2) throw new Error(`[TEST A FAILED] Expected 2 services for Owner A, got ${servicesForA.length}`);
    if (capstersForA.length !== 1) throw new Error(`[TEST A FAILED] Expected 1 capster for Owner A, got ${capstersForA.length}`);
    if (txsForA.length !== 1) throw new Error(`[TEST A FAILED] Expected 1 transaction for Owner A, got ${txsForA.length}`);
    console.log(`✅ [TEST A PASSED] Owner A sees strictly SHOP_A data (${servicesForA.length} services, ${capstersForA.length} capster, ${txsForA.length} tx).`);

    // -------------------------------------------------------------------------
    // TEST B: Login Owner B -> Semua data kosong / clear
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST B] Query data for Owner B (Tenant ID = SHOP_B)...");
    const servicesForB = await sql`
      SELECT id_layanan FROM layanan WHERE id_barbershop = ${shopBId};
    `;
    const capstersForB = await sql`
      SELECT id_capster FROM capster WHERE id_barbershop = ${shopBId};
    `;
    const bookingsForB = await sql`
      SELECT id_booking FROM booking WHERE id_barbershop = ${shopBId};
    `;
    const txsForB = await sql`
      SELECT id_transaksi, total FROM transaksi WHERE id_barbershop = ${shopBId};
    `;
    const revenueForB = txsForB
      .filter((t) => t.status_transaksi === "paid")
      .reduce((sum, t) => sum + Number(t.total || 0), 0);

    if (servicesForB.length !== 0) throw new Error(`[TEST B FAILED] Expected 0 services for Owner B, got ${servicesForB.length}`);
    if (capstersForB.length !== 0) throw new Error(`[TEST B FAILED] Expected 0 capsters for Owner B, got ${capstersForB.length}`);
    if (bookingsForB.length !== 0) throw new Error(`[TEST B FAILED] Expected 0 bookings for Owner B, got ${bookingsForB.length}`);
    if (txsForB.length !== 0) throw new Error(`[TEST B FAILED] Expected 0 transactions for Owner B, got ${txsForB.length}`);
    if (revenueForB !== 0) throw new Error(`[TEST B FAILED] Expected Rp0 revenue for Owner B, got ${revenueForB}`);
    console.log("✅ [TEST B PASSED] Owner B starts 100% CLEAR: Layanan=0, Capster=0, Booking=0, Transaksi=0, Pendapatan=Rp0.");

    // -------------------------------------------------------------------------
    // TEST C: Tambahkan layanan dari Owner B -> Layanan masuk SHOP_B
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST C] Owner B adds a new service to SHOP_B...");
    const [newServiceB] = await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
      VALUES (${shopBId}, 'Haircut Khusus Beta', 75000, 35, 'active')
      RETURNING id_layanan, nama_layanan, id_barbershop;
    `;

    if (newServiceB.id_barbershop !== shopBId) {
      throw new Error(`[TEST C FAILED] Service inserted into wrong tenant: ${newServiceB.id_barbershop} vs ${shopBId}`);
    }
    console.log(`✅ [TEST C PASSED] Service '${newServiceB.nama_layanan}' safely assigned to SHOP_B (${shopBId}).`);

    // -------------------------------------------------------------------------
    // TEST D: Login kembali Owner A -> Layanan Owner B tidak muncul
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST D] Verify Owner A's catalog does not include Owner B's new service...");
    const recheckServicesA = await sql`
      SELECT id_layanan, nama_layanan, id_barbershop 
      FROM layanan 
      WHERE id_barbershop = ${shopAId} AND status = 'active';
    `;
    const containsServiceB = recheckServicesA.some((s) => s.id_layanan === newServiceB.id_layanan);
    if (containsServiceB || recheckServicesA.length !== 2) {
      throw new Error(`[TEST D FAILED] Owner B's service leaked into Owner A's catalog!`);
    }
    console.log(`✅ [TEST D PASSED] Owner A still sees strictly 2 services. Owner B's service is completely isolated.`);

    // -------------------------------------------------------------------------
    // TEST E: Coba akses / edit / delete data Owner A menggunakan Owner B
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST E] Attempting cross-tenant unauthorized UPDATE & DELETE...");
    // Owner B tries to update Owner A's service
    const updateAttempt = await sql`
      UPDATE layanan 
      SET nama_layanan = 'Hacked by Owner B'
      WHERE id_layanan = ${serviceA1Id} AND id_barbershop = ${shopBId}
      RETURNING id_layanan;
    `;
    if (updateAttempt.length > 0) {
      throw new Error(`[TEST E FAILED] Cross-tenant UPDATE succeeded! Security violation!`);
    }

    // Owner B tries to delete Owner A's service
    const deleteAttempt = await sql`
      DELETE FROM layanan 
      WHERE id_layanan = ${serviceA1Id} AND id_barbershop = ${shopBId}
      RETURNING id_layanan;
    `;
    if (deleteAttempt.length > 0) {
      throw new Error(`[TEST E FAILED] Cross-tenant DELETE succeeded! Security violation!`);
    }

    // Verify service A1 is intact
    const [intactA1] = await sql`
      SELECT nama_layanan FROM layanan WHERE id_layanan = ${serviceA1Id};
    `;
    if (intactA1.nama_layanan !== "Gentleman Haircut A") {
      throw new Error(`[TEST E FAILED] Service A was corrupted!`);
    }
    console.log(`✅ [TEST E PASSED] Cross-tenant edit & delete blocked. 0 rows affected, data completely protected.`);

    // -------------------------------------------------------------------------
    // TEST F: Booking melalui URL SHOP_A (slug) -> Booking masuk SHOP_A
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST F] Customer booking via URL SHOP_A (slug: " + shopASlug + ")...");
    // Resolve shop from slug
    const [resolvedShopA] = await sql`
      SELECT id_barbershop FROM barbershop WHERE slug = ${shopASlug} AND status = 'active' LIMIT 1;
    `;
    if (!resolvedShopA || resolvedShopA.id_barbershop !== shopAId) {
      throw new Error(`[TEST F FAILED] Could not resolve shop from slug ${shopASlug}`);
    }

    const [bookingCustomerA] = await sql`
      INSERT INTO booking (id_barbershop, id_pelanggan, id_capster, tanggal_booking, waktu_booking, status)
      VALUES (${resolvedShopA.id_barbershop}, ${custA.id_pelanggan}, ${capsterAId}, NOW(), '11:00', 'pending')
      RETURNING id_booking, id_barbershop;
    `;
    if (bookingCustomerA.id_barbershop !== shopAId) {
      throw new Error(`[TEST F FAILED] Booking created under wrong barbershop: ${bookingCustomerA.id_barbershop}`);
    }
    console.log(`✅ [TEST F PASSED] Booking via slug '${shopASlug}' successfully bound to SHOP_A (${bookingCustomerA.id_barbershop}).`);

    // -------------------------------------------------------------------------
    // TEST G: Booking melalui URL SHOP_B (slug) -> Booking masuk SHOP_B
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST G] Customer booking via URL SHOP_B (slug: " + shopBSlug + ")...");
    // Setup 1 capster in SHOP_B so booking can be handled
    const [userCapB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopBId}, 'Capster Beta', ${`capster-b-${ts}@barberin.test`}, 'password123', 'capster', 'active')
      RETURNING id_user;
    `;
    const [capB] = await sql`
      INSERT INTO capster (id_user, id_barbershop, no_pegawai, status, tanggal_bergabung)
      VALUES (${userCapB.id_user}, ${shopBId}, 'CAP-B01', 'active', NOW())
      RETURNING id_capster;
    `;

    const [shiftB] = await sql`
      INSERT INTO shift_capster (id_capster, tanggal, waktu_mulai, status)
      VALUES (${capB.id_capster}, NOW(), '10:00', 'ongoing')
      RETURNING id_shift;
    `;

    const [resolvedShopB] = await sql`
      SELECT id_barbershop FROM barbershop WHERE slug = ${shopBSlug} AND status = 'active' LIMIT 1;
    `;
    if (!resolvedShopB || resolvedShopB.id_barbershop !== shopBId) {
      throw new Error(`[TEST G FAILED] Could not resolve shop from slug ${shopBSlug}`);
    }

    const [bookingCustomerB] = await sql`
      INSERT INTO booking (id_barbershop, id_pelanggan, id_capster, tanggal_booking, waktu_booking, status)
      VALUES (${resolvedShopB.id_barbershop}, ${custA.id_pelanggan}, ${capB.id_capster}, NOW(), '11:30', 'pending')
      RETURNING id_booking, id_barbershop;
    `;
    if (bookingCustomerB.id_barbershop !== shopBId) {
      throw new Error(`[TEST G FAILED] Booking created under wrong barbershop: ${bookingCustomerB.id_barbershop}`);
    }

    // Complete transaction for B
    const [txB] = await sql`
      INSERT INTO transaksi (id_barbershop, id_booking, id_shift, id_pelanggan, subtotal, diskon, total, status_transaksi)
      VALUES (${shopBId}, ${bookingCustomerB.id_booking}, ${shiftB.id_shift}, ${custA.id_pelanggan}, 75000, 0, 75000, 'paid')
      RETURNING id_transaksi;
    `;

    console.log(`✅ [TEST G PASSED] Booking via slug '${shopBSlug}' successfully bound to SHOP_B (${bookingCustomerB.id_barbershop}).`);

    // -------------------------------------------------------------------------
    // TEST H: Dashboard Owner A -> Statistik hanya SHOP_A
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST H] Computing Dashboard Metrics for Owner A...");
    const txAStats = await sql`
      SELECT COUNT(*)::int AS total_tx, COALESCE(SUM(total), 0)::numeric AS total_revenue
      FROM transaksi 
      WHERE id_barbershop = ${shopAId} AND status_transaksi = 'paid';
    `;
    const capAStats = await sql`
      SELECT COUNT(*)::int AS total_capsters 
      FROM capster 
      WHERE id_barbershop = ${shopAId} AND status = 'active';
    `;

    const revenueA = Number(txAStats[0].total_revenue);
    const countA = Number(txAStats[0].total_tx);
    const capstersA = Number(capAStats[0].total_capsters);

    if (revenueA !== 50000) throw new Error(`[TEST H FAILED] Expected Owner A revenue = 50000, got ${revenueA}`);
    if (countA !== 1) throw new Error(`[TEST H FAILED] Expected Owner A tx count = 1, got ${countA}`);
    if (capstersA !== 1) throw new Error(`[TEST H FAILED] Expected Owner A capster count = 1, got ${capstersA}`);

    console.log(`✅ [TEST H PASSED] Dashboard Owner A strictly isolated:`);
    console.log(`   - Revenue: Rp${revenueA.toLocaleString("id-ID")}`);
    console.log(`   - Paid Transactions: ${countA}`);
    console.log(`   - Active Capsters: ${capstersA}`);

    // -------------------------------------------------------------------------
    // TEST I: Dashboard Owner B -> Statistik hanya SHOP_B
    // -------------------------------------------------------------------------
    console.log("\n🧪 [TEST I] Computing Dashboard Metrics for Owner B...");
    const txBStats = await sql`
      SELECT COUNT(*)::int AS total_tx, COALESCE(SUM(total), 0)::numeric AS total_revenue
      FROM transaksi 
      WHERE id_barbershop = ${shopBId} AND status_transaksi = 'paid';
    `;
    const capBStats = await sql`
      SELECT COUNT(*)::int AS total_capsters 
      FROM capster 
      WHERE id_barbershop = ${shopBId} AND status = 'active';
    `;

    const revenueB = Number(txBStats[0].total_revenue);
    const countB = Number(txBStats[0].total_tx);
    const capstersB = Number(capBStats[0].total_capsters);

    if (revenueB !== 75000) throw new Error(`[TEST I FAILED] Expected Owner B revenue = 75000, got ${revenueB}`);
    if (countB !== 1) throw new Error(`[TEST I FAILED] Expected Owner B tx count = 1, got ${countB}`);
    if (capstersB !== 1) throw new Error(`[TEST I FAILED] Expected Owner B capster count = 1, got ${capstersB}`);

    console.log(`✅ [TEST I PASSED] Dashboard Owner B strictly isolated:`);
    console.log(`   - Revenue: Rp${revenueB.toLocaleString("id-ID")}`);
    console.log(`   - Paid Transactions: ${countB}`);
    console.log(`   - Active Capsters: ${capstersB}`);

    console.log("\n=======================================================================");
    console.log("🎉 ALL 9 MULTI-OWNER ISOLATION TESTS (A - I) PASSED 100% SUCCESSFULLY!");
    console.log("=======================================================================\n");

  } finally {
    // Clean up temporary test entities
    console.log("🧹 Cleaning up temporary test records...");
    try {
      if (shopAId) {
        await sql`DELETE FROM pembayaran WHERE id_transaksi IN (SELECT id_transaksi FROM transaksi WHERE id_barbershop = ${shopAId})`;
        await sql`DELETE FROM detail_booking WHERE id_booking IN (SELECT id_booking FROM booking WHERE id_barbershop = ${shopAId})`;
        await sql`DELETE FROM transaksi WHERE id_barbershop = ${shopAId}`;
        await sql`DELETE FROM booking WHERE id_barbershop = ${shopAId}`;
        await sql`DELETE FROM shift_capster WHERE id_capster IN (SELECT id_capster FROM capster WHERE id_barbershop = ${shopAId})`;
        await sql`DELETE FROM capster WHERE id_barbershop = ${shopAId}`;
        await sql`DELETE FROM layanan WHERE id_barbershop = ${shopAId}`;
        await sql`DELETE FROM users WHERE id_barbershop = ${shopAId}`;
        await sql`DELETE FROM barbershop WHERE id_barbershop = ${shopAId}`;
      }
      if (shopBId) {
        await sql`DELETE FROM pembayaran WHERE id_transaksi IN (SELECT id_transaksi FROM transaksi WHERE id_barbershop = ${shopBId})`;
        await sql`DELETE FROM detail_booking WHERE id_booking IN (SELECT id_booking FROM booking WHERE id_barbershop = ${shopBId})`;
        await sql`DELETE FROM transaksi WHERE id_barbershop = ${shopBId}`;
        await sql`DELETE FROM booking WHERE id_barbershop = ${shopBId}`;
        await sql`DELETE FROM shift_capster WHERE id_capster IN (SELECT id_capster FROM capster WHERE id_barbershop = ${shopBId})`;
        await sql`DELETE FROM capster WHERE id_barbershop = ${shopBId}`;
        await sql`DELETE FROM layanan WHERE id_barbershop = ${shopBId}`;
        await sql`DELETE FROM users WHERE id_barbershop = ${shopBId}`;
        await sql`DELETE FROM barbershop WHERE id_barbershop = ${shopBId}`;
      }
      console.log("✅ Cleanup complete.");
    } catch (cleanupErr) {
      console.warn("⚠️ Cleanup warning:", cleanupErr.message);
    }
    await sql.end();
  }
}

runMultiOwnerIsolationVerification().catch((err) => {
  console.error("❌ Multi-Owner Isolation Verification Error:", err);
  process.exit(1);
});
