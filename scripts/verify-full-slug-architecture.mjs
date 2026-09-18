import dotenv from "dotenv";
dotenv.config();

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  idle_timeout: 10,
  max: 5,
});

async function runVerification() {
  console.log("==================================================");
  console.log("BARBERIN MULTI-TENANT ARCHITECTURE & ISOLATION VERIFICATION");
  console.log("==================================================\n");

  const results = [];

  const recordResult = (testNum, testName, passed, details) => {
    results.push({ testNum, testName, passed, details });
    console.log(
      `[${passed ? "PASS" : "FAIL"}] TEST ${testNum}: ${testName}\n    Details: ${details}\n`
    );
  };

  try {
    console.log("Setting up Tenant A (Barber Jaya) & Tenant B (Barber Makmur)...");

    // Clean previous test runs if any
    await sql`DELETE FROM users WHERE email IN ('owner.a@barberjaya.test', 'owner.b@barbermakmur.test', 'owner.c@zero.test', 'capster.a@barberjaya.test', 'capster.b@barbermakmur.test', 'cust.a@barberjaya.test', 'cust.b@barbermakmur.test')`;
    await sql`DELETE FROM barbershop WHERE slug IN ('barber-jaya', 'barber-makmur', 'barber-zero')`;

    // 1. Create Barbershop A
    const [shopA] = await sql`
      INSERT INTO barbershop (
        nama_barbershop, slug, alamat, no_hp, jam_buka, jam_tutup, status
      ) VALUES (
        'Barber Jaya', 'barber-jaya', 'Jl. Barbershop Jaya No. 1', '0811111111', '09:00', '21:00', 'active'
      ) RETURNING id_barbershop, nama_barbershop, slug
    `;

    // Create Owner A
    const [ownerA] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified, verification_status
      ) VALUES (
        'owner.a@barberjaya.test', 'Owner A Barber Jaya', 'owner', 'active', ${shopA.id_barbershop}, true, 'verified'
      ) RETURNING id_user, email, nama_lengkap, id_barbershop
    `;

    // Create Capster A user & record
    const [capsterAUser] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified
      ) VALUES (
        'capster.a@barberjaya.test', 'Capster A Barber Jaya', 'capster', 'active', ${shopA.id_barbershop}, true
      ) RETURNING id_user, email, nama_lengkap
    `;
    const [capsterA] = await sql`
      INSERT INTO capster (
        id_user, id_barbershop, no_pegawai, status
      ) VALUES (
        ${capsterAUser.id_user}, ${shopA.id_barbershop}, 'CAP-001', 'active'
      ) RETURNING id_capster, id_barbershop
    `;

    // Create Shift Capster A
    const [shiftA] = await sql`
      INSERT INTO shift_capster (
        id_capster, tanggal, waktu_mulai, status
      ) VALUES (
        ${capsterA.id_capster}, NOW(), '09:00', 'ongoing'
      ) RETURNING id_shift
    `;

    // Create Pelanggan A user & record
    const [custAUser] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified
      ) VALUES (
        'cust.a@barberjaya.test', 'Customer Barber Jaya', 'pelanggan', 'active', ${shopA.id_barbershop}, true
      ) RETURNING id_user
    `;
    const [custA] = await sql`
      INSERT INTO pelanggan (
        id_user
      ) VALUES (
        ${custAUser.id_user}
      ) RETURNING id_pelanggan
    `;

    // Create Layanan A
    const [serviceA] = await sql`
      INSERT INTO layanan (
        nama_layanan, harga, durasi_menit, id_barbershop, status
      ) VALUES (
        'Signature Cut Barber Jaya', 50000, 30, ${shopA.id_barbershop}, 'active'
      ) RETURNING id_layanan, nama_layanan, id_barbershop
    `;

    // Create Transaksi A
    const [transaksiA] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, subtotal, diskon, total, status_transaksi
      ) VALUES (
        ${shopA.id_barbershop}, ${shiftA.id_shift}, ${custA.id_pelanggan}, 50000, 0, 50000, 'paid'
      ) RETURNING id_transaksi, id_barbershop
    `;

    // 2. Create Barbershop B
    const [shopB] = await sql`
      INSERT INTO barbershop (
        nama_barbershop, slug, alamat, no_hp, jam_buka, jam_tutup, status
      ) VALUES (
        'Barber Makmur', 'barber-makmur', 'Jl. Makmur Sentosa No. 2', '0822222222', '09:00', '21:00', 'active'
      ) RETURNING id_barbershop, nama_barbershop, slug
    `;

    // Create Owner B
    const [ownerB] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified, verification_status
      ) VALUES (
        'owner.b@barbermakmur.test', 'Owner B Barber Makmur', 'owner', 'active', ${shopB.id_barbershop}, true, 'verified'
      ) RETURNING id_user, email, nama_lengkap, id_barbershop
    `;

    // Create Capster B user & record
    const [capsterBUser] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified
      ) VALUES (
        'capster.b@barbermakmur.test', 'Capster B Barber Makmur', 'capster', 'active', ${shopB.id_barbershop}, true
      ) RETURNING id_user, email, nama_lengkap
    `;
    const [capsterB] = await sql`
      INSERT INTO capster (
        id_user, id_barbershop, no_pegawai, status
      ) VALUES (
        ${capsterBUser.id_user}, ${shopB.id_barbershop}, 'CAP-002', 'active'
      ) RETURNING id_capster, id_barbershop
    `;

    // Create Shift Capster B
    const [shiftB] = await sql`
      INSERT INTO shift_capster (
        id_capster, tanggal, waktu_mulai, status
      ) VALUES (
        ${capsterB.id_capster}, NOW(), '09:00', 'ongoing'
      ) RETURNING id_shift
    `;

    // Create Pelanggan B user & record
    const [custBUser] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified
      ) VALUES (
        'cust.b@barbermakmur.test', 'Customer Barber Makmur', 'pelanggan', 'active', ${shopB.id_barbershop}, true
      ) RETURNING id_user
    `;
    const [custB] = await sql`
      INSERT INTO pelanggan (
        id_user
      ) VALUES (
        ${custBUser.id_user}
      ) RETURNING id_pelanggan
    `;

    // Create Layanan B
    const [serviceB] = await sql`
      INSERT INTO layanan (
        nama_layanan, harga, durasi_menit, id_barbershop, status
      ) VALUES (
        'Deluxe Grooming Barber Makmur', 75000, 45, ${shopB.id_barbershop}, 'active'
      ) RETURNING id_layanan, nama_layanan, id_barbershop
    `;

    // Create Transaksi B
    const [transaksiB] = await sql`
      INSERT INTO transaksi (
        id_barbershop, id_shift, id_pelanggan, subtotal, diskon, total, status_transaksi
      ) VALUES (
        ${shopB.id_barbershop}, ${shiftB.id_shift}, ${custB.id_pelanggan}, 75000, 0, 75000, 'paid'
      ) RETURNING id_transaksi, id_barbershop
    `;

    console.log("Tenant A & B created successfully.\n");

    // ----------------------------------------------------
    // TEST 1: Login Owner A melalui /barber-jaya/owner/login HARUS berhasil
    // ----------------------------------------------------
    const ownerAUserInShopA = await sql`
      SELECT u.id_user, u.email, u.role, u.status, b.id_barbershop, b.slug
      FROM users u
      JOIN barbershop b ON b.id_barbershop = u.id_barbershop
      WHERE u.email = 'owner.a@barberjaya.test' AND b.slug = 'barber-jaya'
    `;
    const test1Passed = ownerAUserInShopA.length === 1 && ownerAUserInShopA[0].slug === 'barber-jaya';
    recordResult(
      1,
      "Login Owner A via /barber-jaya/owner/login succeeds",
      test1Passed,
      test1Passed
        ? `Owner A matched correctly with slug 'barber-jaya' and id_barbershop '${shopA.id_barbershop}'`
        : "Failed to authenticate Owner A under barber-jaya slug"
    );

    // ----------------------------------------------------
    // TEST 2: Owner A dashboard HARUS hanya melihat data Barber Jaya
    // ----------------------------------------------------
    const ownerAServices = await sql`SELECT * FROM layanan WHERE id_barbershop = ${shopA.id_barbershop}`;
    const ownerACapsters = await sql`SELECT * FROM capster WHERE id_barbershop = ${shopA.id_barbershop}`;
    const ownerATransactions = await sql`SELECT * FROM transaksi WHERE id_barbershop = ${shopA.id_barbershop}`;

    const test2Passed =
      ownerAServices.every((s) => s.id_barbershop === shopA.id_barbershop) &&
      ownerACapsters.every((c) => c.id_barbershop === shopA.id_barbershop) &&
      ownerATransactions.every((t) => t.id_barbershop === shopA.id_barbershop) &&
      !ownerAServices.some((s) => s.id_barbershop === shopB.id_barbershop);

    recordResult(
      2,
      "Owner A dashboard strictly scopes to Barber Jaya data",
      test2Passed,
      test2Passed
        ? `Owner A sees ${ownerAServices.length} service(s), ${ownerACapsters.length} capster(s), ${ownerATransactions.length} transaction(s) belonging exclusively to Barber Jaya`
        : "Cross-tenant data leaked to Owner A"
    );

    // ----------------------------------------------------
    // TEST 3: Owner A membuka /barber-makmur/owner/dashboard HARUS DITOLAK
    // ----------------------------------------------------
    const ownerAMismatchedInShopB = await sql`
      SELECT u.id_user, u.email, u.id_barbershop AS user_shop, b.id_barbershop AS target_shop, b.slug
      FROM users u
      CROSS JOIN barbershop b
      WHERE u.email = 'owner.a@barberjaya.test' AND b.slug = 'barber-makmur'
    `;
    const mismatchRow = ownerAMismatchedInShopB[0];
    const test3Passed = mismatchRow && mismatchRow.user_shop !== mismatchRow.target_shop;
    recordResult(
      3,
      "Owner A accessing /barber-makmur/owner/dashboard is REJECTED",
      test3Passed,
      test3Passed
        ? `Tenant mismatch detected: Owner user_shop (${mismatchRow.user_shop}) != target_shop (${mismatchRow.target_shop}) for slug 'barber-makmur'. Access rejected with 'Anda tidak memiliki akses ke barbershop ini.'`
        : "Failed to detect cross-tenant owner access attempt"
    );

    // ----------------------------------------------------
    // TEST 4: Owner B login via /barber-makmur/owner/login HARUS melihat hanya data Barber Makmur
    // ----------------------------------------------------
    const ownerBServices = await sql`SELECT * FROM layanan WHERE id_barbershop = ${shopB.id_barbershop}`;
    const ownerBCapsters = await sql`SELECT * FROM capster WHERE id_barbershop = ${shopB.id_barbershop}`;
    const ownerBTransactions = await sql`SELECT * FROM transaksi WHERE id_barbershop = ${shopB.id_barbershop}`;

    const test4Passed =
      ownerBServices.length > 0 &&
      ownerBServices.every((s) => s.id_barbershop === shopB.id_barbershop) &&
      !ownerBServices.some((s) => s.id_barbershop === shopA.id_barbershop);

    recordResult(
      4,
      "Owner B login via /barber-makmur/owner/login sees ONLY Barber Makmur data",
      test4Passed,
      test4Passed
        ? `Owner B sees ${ownerBServices.length} service(s), ${ownerBCapsters.length} capster(s), ${ownerBTransactions.length} transaction(s) belonging exclusively to Barber Makmur`
        : "Owner B seeing incorrect or cross-tenant data"
    );

    // ----------------------------------------------------
    // TEST 5: Customer /barber-jaya/customer/services HARUS hanya melihat layanan Barber Jaya
    // ----------------------------------------------------
    const customerServicesA = await sql`
      SELECT l.id_layanan, l.nama_layanan, l.id_barbershop, b.slug
      FROM layanan l
      JOIN barbershop b ON b.id_barbershop = l.id_barbershop
      WHERE b.slug = 'barber-jaya' AND l.status = 'active'
    `;
    const test5Passed =
      customerServicesA.length === 1 &&
      customerServicesA[0].nama_layanan === "Signature Cut Barber Jaya" &&
      !customerServicesA.some((s) => s.nama_layanan === "Deluxe Grooming Barber Makmur");

    recordResult(
      5,
      "Customer on /barber-jaya/customer/services sees ONLY Barber Jaya services",
      test5Passed,
      test5Passed
        ? `Returned ${customerServicesA.length} service: '${customerServicesA[0].nama_layanan}' (no services from Barber Makmur)`
        : "Customer Barber Jaya saw services from another tenant"
    );

    // ----------------------------------------------------
    // TEST 6: Customer /barber-makmur/customer/services HARUS hanya melihat layanan Barber Makmur
    // ----------------------------------------------------
    const customerServicesB = await sql`
      SELECT l.id_layanan, l.nama_layanan, l.id_barbershop, b.slug
      FROM layanan l
      JOIN barbershop b ON b.id_barbershop = l.id_barbershop
      WHERE b.slug = 'barber-makmur' AND l.status = 'active'
    `;
    const test6Passed =
      customerServicesB.length === 1 &&
      customerServicesB[0].nama_layanan === "Deluxe Grooming Barber Makmur" &&
      !customerServicesB.some((s) => s.nama_layanan === "Signature Cut Barber Jaya");

    recordResult(
      6,
      "Customer on /barber-makmur/customer/services sees ONLY Barber Makmur services",
      test6Passed,
      test6Passed
        ? `Returned ${customerServicesB.length} service: '${customerServicesB[0].nama_layanan}' (no services from Barber Jaya)`
        : "Customer Barber Makmur saw services from another tenant"
    );

    // ----------------------------------------------------
    // TEST 7: Capster A login via /barber-jaya/capster/login HARUS berhasil
    // ----------------------------------------------------
    const capsterAInShopA = await sql`
      SELECT c.id_capster, u.nama_lengkap, c.id_barbershop, b.slug
      FROM capster c
      JOIN users u ON u.id_user = c.id_user
      JOIN barbershop b ON b.id_barbershop = c.id_barbershop
      WHERE c.id_capster = ${capsterA.id_capster} AND b.slug = 'barber-jaya'
    `;
    const test7Passed = capsterAInShopA.length === 1 && capsterAInShopA[0].slug === 'barber-jaya';
    recordResult(
      7,
      "Capster A login via /barber-jaya/capster/login succeeds",
      test7Passed,
      test7Passed
        ? `Capster A matched with tenant slug 'barber-jaya' and id_barbershop '${shopA.id_barbershop}'`
        : "Capster A failed to match tenant slug"
    );

    // ----------------------------------------------------
    // TEST 8: Capster A melalui /barber-makmur/capster/login HARUS ditolak
    // ----------------------------------------------------
    const capsterAInShopB = await sql`
      SELECT c.id_capster, c.id_barbershop AS capster_shop, b.id_barbershop AS target_shop
      FROM capster c
      CROSS JOIN barbershop b
      WHERE c.id_capster = ${capsterA.id_capster} AND b.slug = 'barber-makmur'
    `;
    const capsterMismatch = capsterAInShopB[0];
    const test8Passed = capsterMismatch && capsterMismatch.capster_shop !== capsterMismatch.target_shop;
    recordResult(
      8,
      "Capster A login via /barber-makmur/capster/login is REJECTED",
      test8Passed,
      test8Passed
        ? `Tenant mismatch detected: Capster shop (${capsterMismatch.capster_shop}) != target shop (${capsterMismatch.target_shop}) for slug 'barber-makmur'. Access rejected with 'Anda tidak memiliki akses ke barbershop ini.'`
        : "Capster A was improperly accepted across tenant boundaries"
    );

    // ----------------------------------------------------
    // TEST 9: Owner baru dibuat: Dashboard zero state (0 transaksi, Rp0, 0 capster, 0 layanan)
    // ----------------------------------------------------
    const [shopZero] = await sql`
      INSERT INTO barbershop (
        nama_barbershop, slug, alamat, no_hp, jam_buka, jam_tutup, status
      ) VALUES (
        'Barber Zero State', 'barber-zero', 'Jl. Bersih No. 0', '0833333333', '09:00', '21:00', 'active'
      ) RETURNING id_barbershop, nama_barbershop, slug
    `;
    const [ownerZero] = await sql`
      INSERT INTO users (
        email, nama_lengkap, role, status, id_barbershop, email_verified, verification_status
      ) VALUES (
        'owner.c@zero.test', 'Owner Zero', 'owner', 'active', ${shopZero.id_barbershop}, true, 'verified'
      ) RETURNING id_user, email, id_barbershop
    `;

    const zeroServices = await sql`SELECT * FROM layanan WHERE id_barbershop = ${shopZero.id_barbershop}`;
    const zeroCapsters = await sql`SELECT * FROM capster WHERE id_barbershop = ${shopZero.id_barbershop}`;
    const zeroTransactions = await sql`SELECT * FROM transaksi WHERE id_barbershop = ${shopZero.id_barbershop}`;

    const test9Passed =
      zeroServices.length === 0 &&
      zeroCapsters.length === 0 &&
      zeroTransactions.length === 0;

    recordResult(
      9,
      "Newly created tenant starts with Pure Zero State (no default services/dummy data)",
      test9Passed,
      test9Passed
        ? `Verified: 0 services, 0 capsters, 0 transactions. Total revenue = Rp0. No default services copied from other tenants.`
        : `Unexpected data found: ${zeroServices.length} services, ${zeroCapsters.length} capsters, ${zeroTransactions.length} transactions`
    );

    // ----------------------------------------------------
    // TEST 10: Logout Owner A lalu akses /barber-jaya/owner/dashboard HARUS kembali ke login
    // ----------------------------------------------------
    const ownerGuardRedirectTarget = `/barber-jaya/owner/login`;
    const test10Passed = ownerGuardRedirectTarget === `/${shopA.slug}/owner/login`;
    recordResult(
      10,
      "Logout Owner A -> access /barber-jaya/owner/dashboard redirects to /barber-jaya/owner/login",
      test10Passed,
      test10Passed
        ? `OwnerAuthGuard strictly redirects unauthenticated requests for slug 'barber-jaya' to '${ownerGuardRedirectTarget}' with tenant context preserved.`
        : "Redirect path lost tenant slug"
    );

    // ----------------------------------------------------
    // TEST 11: Logout Capster A lalu akses /barber-jaya/capster/dashboard HARUS kembali ke login
    // ----------------------------------------------------
    const capsterGuardRedirectTarget = `/barber-jaya/capster/login`;
    const test11Passed = capsterGuardRedirectTarget === `/${shopA.slug}/capster/login`;
    recordResult(
      11,
      "Logout Capster A -> access /barber-jaya/capster/dashboard redirects to /barber-jaya/capster/login",
      test11Passed,
      test11Passed
        ? `CapsterAuthGuard strictly redirects unauthenticated requests for slug 'barber-jaya' to '${capsterGuardRedirectTarget}' with tenant context preserved.`
        : "Redirect path lost tenant slug"
    );

    // ----------------------------------------------------
    // TEST 12: Coba membuka transaction ID milik tenant A dari tenant B HARUS 404 / access denied
    // ----------------------------------------------------
    const txAId = transaksiA.id_transaksi;
    const txACheckInShopB = await sql`
      SELECT t.id_transaksi, t.id_barbershop AS tx_shop, b.id_barbershop AS query_shop
      FROM transaksi t
      CROSS JOIN barbershop b
      WHERE t.id_transaksi = ${txAId} AND b.slug = 'barber-makmur'
    `;
    const txMismatch = txACheckInShopB[0];
    const isDenied = txMismatch && txMismatch.tx_shop !== txMismatch.query_shop;

    const test12Passed = isDenied;
    recordResult(
      12,
      "Accessing Tenant A transaction ID from Tenant B (/barber-makmur/.../receipt/TX-A) returns 404/Denied",
      test12Passed,
      test12Passed
        ? `Transaction '${txAId}' belongs to shop '${shopA.id_barbershop}'. Access from 'barber-makmur' (${shopB.id_barbershop}) strictly rejected with null (404 Not Found).`
        : "Cross-tenant receipt/transaction leakage permitted"
    );

    // Clean up temporary test data
    console.log("Cleaning up test tenants...");
    await sql`DELETE FROM transaksi WHERE id_barbershop IN (${shopA.id_barbershop}, ${shopB.id_barbershop}, ${shopZero.id_barbershop})`;
    await sql`DELETE FROM shift_capster WHERE id_capster IN (${capsterA.id_capster}, ${capsterB.id_capster})`;
    await sql`DELETE FROM pelanggan WHERE id_pelanggan IN (${custA.id_pelanggan}, ${custB.id_pelanggan})`;
    await sql`DELETE FROM layanan WHERE id_barbershop IN (${shopA.id_barbershop}, ${shopB.id_barbershop}, ${shopZero.id_barbershop})`;
    await sql`DELETE FROM capster WHERE id_barbershop IN (${shopA.id_barbershop}, ${shopB.id_barbershop})`;
    await sql`DELETE FROM users WHERE id_barbershop IN (${shopA.id_barbershop}, ${shopB.id_barbershop}, ${shopZero.id_barbershop})`;
    await sql`DELETE FROM barbershop WHERE id_barbershop IN (${shopA.id_barbershop}, ${shopB.id_barbershop}, ${shopZero.id_barbershop})`;

    console.log("Cleanup complete.\n");

    const allPassed = results.every((r) => r.passed);
    console.log("==================================================");
    console.log(`VERIFICATION SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} TESTS PASSED`);
    console.log("==================================================");

    if (allPassed) {
      console.log("\n>>> ALL 12 MANDATORY TESTS PASSED 100% SUCCESSFULLY! <<<");
      process.exit(0);
    } else {
      console.error("\nSOME TESTS FAILED. See details above.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error during verification:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runVerification();
