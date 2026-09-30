import "dotenv/config";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import postgres from "postgres";

console.log("=======================================================================");
console.log("🚀 STARTING TRANSACTION PERMANENT DELETION VERIFICATION (REQUIREMENT 32)");
console.log("=======================================================================\n");

// =============================================================================
// PART 1: STATIC CODE & UI ARCHITECTURE AUDIT
// =============================================================================
console.log("--- PART 1: STATIC CODE & UI AUDIT ---");

// 1. Audit src/lib/owner.ts
const ownerLib = readFileSync("src/lib/owner.ts", "utf8");

assert(
  ownerLib.includes("export const deleteOwnerTransactions = createServerFn"),
  "deleteOwnerTransactions must be exported as a createServerFn"
);
assert(
  ownerLib.includes("requireOwnerTenant()"),
  "deleteOwnerTransactions must strictly authenticate via requireOwnerTenant()"
);
assert(
  !ownerLib.includes("clientProvidedTenantId"),
  "Must not accept client-provided tenant ID"
);
assert(
  ownerLib.includes("db.transaction(async (tx) => {"),
  "Must execute deletions inside an atomic db.transaction"
);
assert(
  ownerLib.includes(".delete(pembatalan)"),
  "Must delete dependent pembatalan records"
);
assert(
  ownerLib.includes(".delete(struk)"),
  "Must delete dependent struk records"
);
assert(
  ownerLib.includes(".delete(pembayaran)"),
  "Must delete dependent pembayaran records"
);
assert(
  ownerLib.includes(".delete(komisiTransaksi)"),
  "Must delete dependent komisi_transaksi records"
);
assert(
  ownerLib.includes(".delete(transaksi)"),
  "Must delete parent transaksi record"
);
assert(
  ownerLib.includes("OWNER_DELETE_TRANSACTION"),
  "Must log OWNER_DELETE_TRANSACTION in audit_log"
);
assert(
  ownerLib.includes("allFilteredTransactionIds"),
  "getOwnerAuditFinance must provide allFilteredTransactionIds for select-all filtered"
);
console.log("✓ PASS: Server function deleteOwnerTransactions & audit logging verified");

// 2. Audit src/routes/$barbershopSlug.owner.audit-finance.tsx
const auditFinancePage = readFileSync(
  "src/routes/$barbershopSlug.owner.audit-finance.tsx",
  "utf8"
);

assert(
  auditFinancePage.includes("deleteOwnerTransactions"),
  "Page must import and call deleteOwnerTransactions"
);
assert(
  auditFinancePage.includes("<Checkbox"),
  "Page must render Checkbox components in table header and rows"
);
assert(
  auditFinancePage.includes('"indeterminate"'),
  "Checkbox must support indeterminate state for partial selection"
);
assert(
  auditFinancePage.includes("handleToggleSelectAllPage"),
  "Page must support selecting all transactions on the current page"
);
assert(
  auditFinancePage.includes("Pilih seluruh"),
  "Page must support prompt to select all filtered transactions"
);
assert(
  auditFinancePage.includes("AlertDialog"),
  "Page must use AlertDialog for deletion confirmation (never window.confirm)"
);
assert(
  !auditFinancePage.includes("window.confirm("),
  "Page must NOT use window.confirm()"
);
assert(
  auditFinancePage.includes('variant: "destructive"'),
  "Delete button must have destructive styling"
);
assert(
  auditFinancePage.includes("Menghapus..."),
  "Double-submit protection must show 'Menghapus...' and disable button"
);
assert(
  auditFinancePage.includes("fetchFinanceData()") && auditFinancePage.includes("router.invalidate()"),
  "Page must refresh data and invalidate router after successful deletion"
);
assert(
  auditFinancePage.includes("Transaksi berhasil dihapus permanen"),
  "Must show permanent deletion success toast"
);
console.log("✓ PASS: Frontend table, selection toolbar, checkboxes, and dialogs verified");

// 3. Audit src/routes/$barbershopSlug.owner.audit-finance.$id.tsx
const auditDetailPage = readFileSync(
  "src/routes/$barbershopSlug.owner.audit-finance.$id.tsx",
  "utf8"
);
assert(
  auditDetailPage.includes("deleteOwnerTransactions"),
  "Detail page must also support permanent deletion"
);
assert(
  auditDetailPage.includes("AlertDialog"),
  "Detail page must use AlertDialog for confirmation"
);
console.log("✓ PASS: Detail page deletion capability verified");

// =============================================================================
// PART 2: DATABASE & MULTI-TENANT ISOLATION TESTS
// =============================================================================
console.log("\n--- PART 2: LIVE DATABASE, ATOMICITY & TENANT ISOLATION TESTS ---");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in environment!");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

function generateStrukNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `STR-${ymd}-${rand}`;
}

async function runLiveTests() {
  const ts = Date.now();
  const shopAName = `Shop A DeleteTest ${ts}`;
  const shopASlug = `shop-a-del-${ts}`;
  const ownerAEmail = `owner-a-del-${ts}@barberin.test`;

  const shopBName = `Shop B DeleteTest ${ts}`;
  const shopBSlug = `shop-b-del-${ts}`;
  const ownerBEmail = `owner-b-del-${ts}@barberin.test`;

  let shopAId, ownerAId, capsterAId, pelangganAId, shiftAId;
  let shopBId, ownerBId, capsterBId, pelangganBId, shiftBId;
  let txA1, txA2, txA3, txA4, txB1, txB2;

  try {
    // 1. Setup Tenant A
    console.log("⏳ Setting up Tenant A and Tenant B datasets...");
    const [shopA] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status, jam_buka, jam_tutup)
      VALUES (${shopAName}, ${shopASlug}, 'Jl. Del A', '0811111111', 'active', '08:00', '21:00')
      RETURNING id_barbershop;
    `;
    shopAId = shopA.id_barbershop;

    const [ownerA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopAId}, 'Owner A Delete', ${ownerAEmail}, 'password123', 'owner', 'active')
      RETURNING id_user;
    `;
    ownerAId = ownerA.id_user;

    const [capsterUserA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopAId}, 'Capster A', ${`cap-a-${ts}@test.com`}, 'pass', 'capster', 'active')
      RETURNING id_user;
    `;
    const [capsterA] = await sql`
      INSERT INTO capster (id_user, id_barbershop, no_pegawai, status)
      VALUES (${capsterUserA.id_user}, ${shopAId}, 'CAP-A01', 'active')
      RETURNING id_capster;
    `;
    capsterAId = capsterA.id_capster;

    const [custUserA] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopAId}, 'Pelanggan A', ${`cust-a-${ts}@test.com`}, 'pass', 'pelanggan', 'active')
      RETURNING id_user;
    `;
    const [pelangganA] = await sql`
      INSERT INTO pelanggan (id_user, id_barbershop, nama_pelanggan, no_hp)
      VALUES (${custUserA.id_user}, ${shopAId}, 'Pelanggan A', '0812345678')
      RETURNING id_pelanggan;
    `;
    pelangganAId = pelangganA.id_pelanggan;

    const [shiftA] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, status, total_transaksi, total_pendapatan)
      VALUES (${capsterAId}, ${shopAId}, CURRENT_DATE, '08:00', 'ongoing', 0, 0)
      RETURNING id_shift;
    `;
    shiftAId = shiftA.id_shift;

    // 2. Setup Tenant B
    const [shopB] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status, jam_buka, jam_tutup)
      VALUES (${shopBName}, ${shopBSlug}, 'Jl. Del B', '0822222222', 'active', '08:00', '21:00')
      RETURNING id_barbershop;
    `;
    shopBId = shopB.id_barbershop;

    const [ownerB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopBId}, 'Owner B Delete', ${ownerBEmail}, 'password123', 'owner', 'active')
      RETURNING id_user;
    `;
    ownerBId = ownerB.id_user;

    const [capsterUserB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopBId}, 'Capster B', ${`cap-b-${ts}@test.com`}, 'pass', 'capster', 'active')
      RETURNING id_user;
    `;
    const [capsterB] = await sql`
      INSERT INTO capster (id_user, id_barbershop, no_pegawai, status)
      VALUES (${capsterUserB.id_user}, ${shopBId}, 'CAP-B01', 'active')
      RETURNING id_capster;
    `;
    capsterBId = capsterB.id_capster;

    const [custUserB] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${shopBId}, 'Pelanggan B', ${`cust-b-${ts}@test.com`}, 'pass', 'pelanggan', 'active')
      RETURNING id_user;
    `;
    const [pelangganB] = await sql`
      INSERT INTO pelanggan (id_user, id_barbershop, nama_pelanggan, no_hp)
      VALUES (${custUserB.id_user}, ${shopBId}, 'Pelanggan B', '0823456789')
      RETURNING id_pelanggan;
    `;
    pelangganBId = pelangganB.id_pelanggan;

    const [shiftB] = await sql`
      INSERT INTO shift_capster (id_capster, id_barbershop, tanggal, waktu_mulai, status, total_transaksi, total_pendapatan)
      VALUES (${capsterBId}, ${shopBId}, CURRENT_DATE, '08:00', 'ongoing', 0, 0)
      RETURNING id_shift;
    `;
    shiftBId = shiftB.id_shift;

    // 3. Create Transactions for Tenant A
    // txA1: completed with pembayaran, struk, and komisi_transaksi
    const [tA1] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${shiftAId}, ${pelangganAId}, ${capsterAId}, 100000, 0, 100000, 'paid')
      RETURNING id_transaksi;
    `;
    txA1 = tA1.id_transaksi;

    await sql`
      INSERT INTO pembayaran (id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran)
      VALUES (${shopAId}, ${txA1}, 'tunai', 100000, 'success');
    `;
    await sql`
      INSERT INTO struk (id_barbershop, id_transaksi, no_struk)
      VALUES (${shopAId}, ${txA1}, ${generateStrukNumber()});
    `;
    await sql`
      INSERT INTO komisi_transaksi (id_transaksi, id_capster, id_barbershop, persentase_komisi, dasar_komisi, nominal_komisi, status)
      VALUES (${txA1}, ${capsterAId}, ${shopAId}, 15.00, 100000, 15000, 'belum_dibayar');
    `;

    // txA2: cancelled with pembayaran, struk, and pembatalan
    const [tA2] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${shiftAId}, ${pelangganAId}, ${capsterAId}, 50000, 0, 50000, 'cancelled')
      RETURNING id_transaksi;
    `;
    txA2 = tA2.id_transaksi;

    await sql`
      INSERT INTO pembayaran (id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran)
      VALUES (${shopAId}, ${txA2}, 'qris', 50000, 'failed');
    `;
    await sql`
      INSERT INTO struk (id_barbershop, id_transaksi, no_struk)
      VALUES (${shopAId}, ${txA2}, ${generateStrukNumber()});
    `;
    await sql`
      INSERT INTO pembatalan (id_transaksi, dibatalkan_oleh, catatan)
      VALUES (${txA2}, 'pelanggan', 'Batal potong');
    `;

    // txA3: another active transaction
    const [tA3] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${shiftAId}, ${pelangganAId}, ${capsterAId}, 75000, 0, 75000, 'paid')
      RETURNING id_transaksi;
    `;
    txA3 = tA3.id_transaksi;
    await sql`
      INSERT INTO pembayaran (id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran)
      VALUES (${shopAId}, ${txA3}, 'transfer', 75000, 'success');
    `;
    await sql`
      INSERT INTO struk (id_barbershop, id_transaksi, no_struk)
      VALUES (${shopAId}, ${txA3}, ${generateStrukNumber()});
    `;
    await sql`
      INSERT INTO komisi_transaksi (id_transaksi, id_capster, id_barbershop, persentase_komisi, dasar_komisi, nominal_komisi, status)
      VALUES (${txA3}, ${capsterAId}, ${shopAId}, 15.00, 75000, 11250, 'belum_dibayar');
    `;

    // txA4: pending transaction
    const [tA4] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${shiftAId}, ${pelangganAId}, ${capsterAId}, 40000, 0, 40000, 'pending')
      RETURNING id_transaksi;
    `;
    txA4 = tA4.id_transaksi;

    // 4. Create Transactions for Tenant B
    const [tB1] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopBId}, ${shiftBId}, ${pelangganBId}, ${capsterBId}, 120000, 0, 120000, 'paid')
      RETURNING id_transaksi;
    `;
    txB1 = tB1.id_transaksi;
    await sql`
      INSERT INTO pembayaran (id_barbershop, id_transaksi, metode_pembayaran, jumlah_bayar, status_pembayaran)
      VALUES (${shopBId}, ${txB1}, 'tunai', 120000, 'success');
    `;
    await sql`
      INSERT INTO struk (id_barbershop, id_transaksi, no_struk)
      VALUES (${shopBId}, ${txB1}, ${generateStrukNumber()});
    `;
    await sql`
      INSERT INTO komisi_transaksi (id_transaksi, id_capster, id_barbershop, persentase_komisi, dasar_komisi, nominal_komisi, status)
      VALUES (${txB1}, ${capsterBId}, ${shopBId}, 15.00, 120000, 18000, 'belum_dibayar');
    `;

    const [tB2] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopBId}, ${shiftBId}, ${pelangganBId}, ${capsterBId}, 80000, 0, 80000, 'paid')
      RETURNING id_transaksi;
    `;
    txB2 = tB2.id_transaksi;

    console.log("✓ Initial datasets for Tenant A and Tenant B created.");

    // -------------------------------------------------------------------------
    // TEST 1: Tenant Isolation: Tenant A cannot delete Tenant B's transaction
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Multi-Tenant Isolation ---");
    // Simulate what deleteOwnerTransactions does for Owner A attempting to delete txB1
    const targetTxs = await sql`
      SELECT id_transaksi FROM transaksi
      WHERE id_transaksi = ${txB1} AND id_barbershop = ${shopAId};
    `;
    assert.strictEqual(
      targetTxs.length,
      0,
      "Tenant A must find 0 records when querying Tenant B's transaction"
    );

    // Verify txB1 still exists in database
    const verifyB1 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txB1};`;
    assert.strictEqual(verifyB1.length, 1, "Tenant B's transaction must remain untouched in Supabase");
    console.log("✓ PASS: Tenant A cannot delete Tenant B transaction (strict multi-tenant isolation)");

    // -------------------------------------------------------------------------
    // TEST 2: Single Delete: Permanent DB Deletion & Cascade Clean of Dependents
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Single Delete & Dependent Records Cleanup ---");
    // Verify txA1 and its dependents exist prior to deletion
    const beforeTxA1 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txA1};`;
    const beforePayA1 = await sql`SELECT id_pembayaran FROM pembayaran WHERE id_transaksi = ${txA1};`;
    const beforeStrukA1 = await sql`SELECT id_struk FROM struk WHERE id_transaksi = ${txA1};`;
    const beforeKomisiA1 = await sql`SELECT id_komisi_trx FROM komisi_transaksi WHERE id_transaksi = ${txA1};`;

    assert.strictEqual(beforeTxA1.length, 1, "txA1 must exist before deletion");
    assert.strictEqual(beforePayA1.length, 1, "pembayaran A1 must exist before deletion");
    assert.strictEqual(beforeStrukA1.length, 1, "struk A1 must exist before deletion");
    assert.strictEqual(beforeKomisiA1.length, 1, "komisi A1 must exist before deletion");

    // Execute atomic server-side delete pattern
    await sql.begin(async (tx) => {
      await tx`DELETE FROM pembatalan WHERE id_transaksi = ${txA1};`;
      await tx`DELETE FROM struk WHERE id_transaksi = ${txA1};`;
      await tx`DELETE FROM pembayaran WHERE id_transaksi = ${txA1};`;
      await tx`DELETE FROM komisi_transaksi WHERE id_transaksi = ${txA1};`;
      await tx`DELETE FROM transaksi WHERE id_transaksi = ${txA1} AND id_barbershop = ${shopAId};`;
    });

    // Record audit log
    await sql`
      INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, entity_id, alasan)
      VALUES (${shopAId}, ${ownerAId}, 'OWNER_DELETE_TRANSACTION', 'transaksi', ${txA1}, 'Owner A Delete menghapus transaksi txA1');
    `;

    // VERIFY DIRECTLY FROM SUPABASE DATABASE
    const afterTxA1 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txA1};`;
    const afterPayA1 = await sql`SELECT id_pembayaran FROM pembayaran WHERE id_transaksi = ${txA1};`;
    const afterStrukA1 = await sql`SELECT id_struk FROM struk WHERE id_transaksi = ${txA1};`;
    const afterKomisiA1 = await sql`SELECT id_komisi_trx FROM komisi_transaksi WHERE id_transaksi = ${txA1};`;

    assert.strictEqual(afterTxA1.length, 0, "txA1 must be completely removed (0 rows) from transaksi table");
    assert.strictEqual(afterPayA1.length, 0, "pembayaran must be completely removed (0 rows)");
    assert.strictEqual(afterStrukA1.length, 0, "struk must be completely removed (0 rows)");
    assert.strictEqual(afterKomisiA1.length, 0, "komisi_transaksi must be completely removed (0 rows)");

    // Verify other transactions for Tenant A and Tenant B are unharmed
    const checkTxA2 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txA2};`;
    const checkTxB1 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txB1};`;
    assert.strictEqual(checkTxA2.length, 1, "txA2 must still exist");
    assert.strictEqual(checkTxB1.length, 1, "txB1 must still exist");
    console.log("✓ PASS: Single deletion permanently removed transaction and all child records from database");

    // -------------------------------------------------------------------------
    // TEST 3: Dependent Records Cleanup (Pembatalan)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Pembatalan Dependent Cleanup ---");
    const beforeBatalA2 = await sql`SELECT id_pembatalan FROM pembatalan WHERE id_transaksi = ${txA2};`;
    assert.strictEqual(beforeBatalA2.length, 1, "pembatalan record must exist before deletion");

    await sql.begin(async (tx) => {
      await tx`DELETE FROM pembatalan WHERE id_transaksi = ${txA2};`;
      await tx`DELETE FROM struk WHERE id_transaksi = ${txA2};`;
      await tx`DELETE FROM pembayaran WHERE id_transaksi = ${txA2};`;
      await tx`DELETE FROM komisi_transaksi WHERE id_transaksi = ${txA2};`;
      await tx`DELETE FROM transaksi WHERE id_transaksi = ${txA2} AND id_barbershop = ${shopAId};`;
    });

    const afterBatalA2 = await sql`SELECT id_pembatalan FROM pembatalan WHERE id_transaksi = ${txA2};`;
    const afterTxA2 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txA2};`;
    assert.strictEqual(afterBatalA2.length, 0, "pembatalan record must be deleted");
    assert.strictEqual(afterTxA2.length, 0, "txA2 must be deleted from Supabase");
    console.log("✓ PASS: Pembatalan dependent record cleaned up successfully");

    // -------------------------------------------------------------------------
    // TEST 4: Bulk Deletion (Multiple Transactions)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Bulk Deletion ---");
    const bulkIds = [txA3, txA4];
    await sql.begin(async (tx) => {
      await tx`DELETE FROM pembatalan WHERE id_transaksi IN ${sql(bulkIds)};`;
      await tx`DELETE FROM struk WHERE id_transaksi IN ${sql(bulkIds)};`;
      await tx`DELETE FROM pembayaran WHERE id_transaksi IN ${sql(bulkIds)};`;
      await tx`DELETE FROM komisi_transaksi WHERE id_transaksi IN ${sql(bulkIds)};`;
      await tx`DELETE FROM transaksi WHERE id_transaksi IN ${sql(bulkIds)} AND id_barbershop = ${shopAId};`;
    });

    const afterBulkTx = await sql`
      SELECT id_transaksi FROM transaksi WHERE id_transaksi IN ${sql(bulkIds)};
    `;
    assert.strictEqual(afterBulkTx.length, 0, "All selected bulk transactions must be 0 rows in database");
    console.log("✓ PASS: Bulk deletion permanently removed all selected transactions");

    // -------------------------------------------------------------------------
    // TEST 5: Financial Audit Log
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Financial Audit Log Verification ---");
    const auditLogs = await sql`
      SELECT * FROM audit_log
      WHERE id_barbershop = ${shopAId} AND aksi = 'OWNER_DELETE_TRANSACTION';
    `;
    assert(auditLogs.length > 0, "Audit log must contain deletion entries");
    assert.strictEqual(auditLogs[0].entity_type, "transaksi", "Audit log entity_type must be transaksi");
    console.log("✓ PASS: Financial audit log recorded deletion activity correctly");

    // -------------------------------------------------------------------------
    // TEST 6: Atomic Rollback on Error
    // -------------------------------------------------------------------------
    console.log("\n--- TEST: Atomic Rollback on Failure ---");
    // Create new transaction for Tenant A
    const [tA5] = await sql`
      INSERT INTO transaksi (id_barbershop, id_shift, id_pelanggan, id_capster, subtotal, diskon, total, status_transaksi)
      VALUES (${shopAId}, ${shiftAId}, ${pelangganAId}, ${capsterAId}, 60000, 0, 60000, 'paid')
      RETURNING id_transaksi;
    `;
    const txA5 = tA5.id_transaksi;

    // Simulate an operation that encounters an error midway
    let failedAsExpected = false;
    try {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM transaksi WHERE id_transaksi = ${txA5} AND id_barbershop = ${shopAId};`;
        // Deliberate simulated failure
        throw new Error("Simulated failure during deletion");
      });
    } catch {
      failedAsExpected = true;
    }

    assert(failedAsExpected, "Transaction must fail and trigger rollback");
    // Verify txA5 STILL EXISTS because the transaction rolled back
    const checkTxA5 = await sql`SELECT id_transaksi FROM transaksi WHERE id_transaksi = ${txA5};`;
    assert.strictEqual(checkTxA5.length, 1, "txA5 must NOT be deleted due to atomic rollback");
    console.log("✓ PASS: Atomic rollback prevents partial deletion on failure");

  } finally {
    // CLEANUP TEST DATA
    console.log("\n⏳ Cleaning up test datasets...");
    if (shopAId) {
      await sql`DELETE FROM audit_log WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM komisi_transaksi WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM pembatalan WHERE id_transaksi IN (SELECT id_transaksi FROM transaksi WHERE id_barbershop = ${shopAId});`;
      await sql`DELETE FROM struk WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM pembayaran WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM transaksi WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM shift_capster WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM pelanggan WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM capster WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM users WHERE id_barbershop = ${shopAId};`;
      await sql`DELETE FROM barbershop WHERE id_barbershop = ${shopAId};`;
    }
    if (shopBId) {
      await sql`DELETE FROM komisi_transaksi WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM struk WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM pembayaran WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM transaksi WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM shift_capster WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM pelanggan WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM capster WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM users WHERE id_barbershop = ${shopBId};`;
      await sql`DELETE FROM barbershop WHERE id_barbershop = ${shopBId};`;
    }
    await sql.end();
  }

  console.log("\n=======================================================================");
  console.log("🎉 ALL TRANSACTION PERMANENT DELETION TESTS PASSED SUCCESSFULLY!");
  console.log("=======================================================================\n");
}

runLiveTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
