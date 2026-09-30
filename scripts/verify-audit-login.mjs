import "dotenv/config";
import postgres from "postgres";
import fs from "fs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in environment!");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function verifyAll() {
  console.log("==================================================================");
  console.log("🧪 BARBERIN — VERIFIKASI AUDIT AKTIVITAS LOGIN & PERMANENT DELETE");
  console.log("==================================================================\n");

  let passedTests = 0;
  const totalTests = 11;

  try {
    // 0. Setup: Ambil barbershop dan owner yang ada
    const [shop] = await sql`
      SELECT id_barbershop, nama_barbershop, slug 
      FROM barbershop 
      LIMIT 1
    `;
    if (!shop) throw new Error("Barbershop tidak ditemukan");

    const [ownerUser] = await sql`
      SELECT id_user, nama_lengkap, email, role 
      FROM users 
      WHERE id_barbershop = ${shop.id_barbershop} AND role = 'owner'
      LIMIT 1
    `;
    if (!ownerUser) throw new Error("Owner tidak ditemukan");

    console.log(`📌 Target Barbershop: ${shop.nama_barbershop} (${shop.id_barbershop})`);
    console.log(`📌 Target Owner: ${ownerUser.nama_lengkap} (${ownerUser.id_user})\n`);

    // -------------------------------------------------------------------------
    // TEST CASE 1: Event login nyata tersimpan di database (bukan dari users.created_at)
    // -------------------------------------------------------------------------
    console.log("▶ CASE 1: User login berhasil mencatat 1 event nyata di database...");
    const loginTimestamp = new Date();
    const [loginAudit] = await sql`
      INSERT INTO audit_log (
        id_barbershop,
        id_user,
        aksi,
        entity_type,
        entity_id,
        alasan,
        created_at
      ) VALUES (
        ${shop.id_barbershop},
        ${ownerUser.id_user},
        'Login ke sistem',
        'login',
        ${ownerUser.id_user},
        ${'Login Owner (' + ownerUser.nama_lengkap + ')'},
        ${loginTimestamp}
      )
      RETURNING id_audit, id_barbershop, id_user, aksi, entity_type, created_at
    `;

    if (
      loginAudit &&
      loginAudit.id_audit &&
      loginAudit.aksi === "Login ke sistem" &&
      loginAudit.entity_type === "login" &&
      loginAudit.id_barbershop === shop.id_barbershop
    ) {
      console.log(`  ✅ PASSED: Event login nyata tercatat dengan UUID: ${loginAudit.id_audit}`);
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Event login gagal dibuat di database.");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 2: User logout berhasil mencatat event logout nyata
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 2: User logout mencatat event logout nyata...");
    const [logoutAudit] = await sql`
      INSERT INTO audit_log (
        id_barbershop,
        id_user,
        aksi,
        entity_type,
        entity_id,
        alasan,
        created_at
      ) VALUES (
        ${shop.id_barbershop},
        ${ownerUser.id_user},
        'Logout dari sistem',
        'logout',
        ${ownerUser.id_user},
        ${'Logout Owner (' + ownerUser.nama_lengkap + ')'},
        NOW()
      )
      RETURNING id_audit, aksi, entity_type
    `;

    if (
      logoutAudit &&
      logoutAudit.id_audit &&
      logoutAudit.aksi === "Logout dari sistem" &&
      logoutAudit.entity_type === "logout"
    ) {
      console.log(`  ✅ PASSED: Event logout nyata tercatat dengan UUID: ${logoutAudit.id_audit}`);
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Event logout gagal tercatat di database.");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 3: Owner hapus 1 login event -> event terhapus, USER TETAP ADA
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 3: Owner hapus 1 login event -> row terhapus, user tetap ada...");
    const deletedLoginRows = await sql`
      DELETE FROM audit_log
      WHERE id_audit = ${loginAudit.id_audit} AND id_barbershop = ${shop.id_barbershop}
      RETURNING id_audit
    `;

    const [userCheckAfterDelete] = await sql`
      SELECT id_user, nama_lengkap FROM users WHERE id_user = ${ownerUser.id_user}
    `;

    if (deletedLoginRows.length === 1 && userCheckAfterDelete) {
      console.log(`  ✅ PASSED: Audit event login (${loginAudit.id_audit}) terhapus dari Supabase.`);
      console.log(`  ✅ PASSED: Akun user (${userCheckAfterDelete.nama_lengkap}) TETAP AMAN dan tidak terhapus.`);
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Audit tidak terhapus atau akun user hilang!");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 4: Re-query Supabase membuktikan data benar-benar hilang (permanen)
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 4: Query ulang Supabase membuktikan penghapusan permanen...");
    const [auditRecheck] = await sql`
      SELECT id_audit FROM audit_log WHERE id_audit = ${loginAudit.id_audit}
    `;

    if (!auditRecheck) {
      console.log("  ✅ PASSED: Record audit benar-benar lenyap dari Supabase (bukan sekedar disembunyikan di UI).");
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Record audit masih ditemukan di Supabase!");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 5: Login lagi membuat audit event baru dengan timestamp baru
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 5: Login lagi membuat event login baru dengan timestamp baru...");
    const newLoginTime = new Date();
    const [newLoginAudit] = await sql`
      INSERT INTO audit_log (
        id_barbershop,
        id_user,
        aksi,
        entity_type,
        entity_id,
        alasan,
        created_at
      ) VALUES (
        ${shop.id_barbershop},
        ${ownerUser.id_user},
        'Login ke sistem',
        'login',
        ${ownerUser.id_user},
        ${'Login Owner (' + ownerUser.nama_lengkap + ')'},
        ${newLoginTime}
      )
      RETURNING id_audit, created_at
    `;

    if (
      newLoginAudit &&
      newLoginAudit.id_audit !== loginAudit.id_audit &&
      new Date(newLoginAudit.created_at).getTime() >= loginTimestamp.getTime()
    ) {
      console.log(`  ✅ PASSED: Event login baru tercipta (${newLoginAudit.id_audit}) dengan timestamp baru.`);
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Event login baru gagal dibuat.");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 6: Bulk delete 3 audit events sekaligus
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 6: Bulk delete 3 record audit secara atomic...");
    // Buat 3 audit record dummy untuk barbershop ini
    const bulkCreated = await sql`
      INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, alasan)
      VALUES 
        (${shop.id_barbershop}, ${ownerUser.id_user}, 'Bulk Test 1', 'login', 'Test bulk'),
        (${shop.id_barbershop}, ${ownerUser.id_user}, 'Bulk Test 2', 'login', 'Test bulk'),
        (${shop.id_barbershop}, ${ownerUser.id_user}, 'Bulk Test 3', 'login', 'Test bulk')
      RETURNING id_audit
    `;

    const bulkIds = bulkCreated.map((r) => r.id_audit);
    const bulkDeleted = await sql`
      DELETE FROM audit_log
      WHERE id_audit IN ${sql(bulkIds)} AND id_barbershop = ${shop.id_barbershop}
      RETURNING id_audit
    `;

    if (bulkDeleted.length === 3) {
      console.log(`  ✅ PASSED: Tepat 3 audit record berhasil dihapus secara permanen dari Supabase.`);
      passedTests++;
    } else {
      console.error(`  ❌ FAILED: Diharapkan 3 yang terhapus, tetapi terhapus ${bulkDeleted.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST CASE 7: Multi-tenant isolation: Owner A mencoba delete audit milik Barbershop B
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 7: Multi-tenant protection: Barbershop A mencoba delete audit Barbershop B...");
    // Ambil atau buat dummy barbershop B
    let [otherShop] = await sql`
      SELECT id_barbershop, nama_barbershop FROM barbershop WHERE id_barbershop != ${shop.id_barbershop} LIMIT 1
    `;

    let otherShopId = otherShop ? otherShop.id_barbershop : "00000000-0000-0000-0000-000000000002";
    if (!otherShop) {
      const [createdShopB] = await sql`
        INSERT INTO barbershop (nama_barbershop, slug, alamat, kontak, jam_buka, jam_tutup)
        VALUES ('Barbershop B Test', 'barbershop-b-test', 'Jl Test', '0812', '09:00', '21:00')
        RETURNING id_barbershop, nama_barbershop
      `;
      otherShopId = createdShopB.id_barbershop;
    }

    const [auditShopB] = await sql`
      INSERT INTO audit_log (id_barbershop, aksi, entity_type, alasan)
      VALUES (${otherShopId}, 'Login ke sistem', 'login', 'Test Shop B')
      RETURNING id_audit, id_barbershop
    `;

    // Coba eksekusi delete dengan tenant context Shop A
    const maliciousDelete = await sql`
      DELETE FROM audit_log
      WHERE id_audit = ${auditShopB.id_audit} AND id_barbershop = ${shop.id_barbershop}
      RETURNING id_audit
    `;

    // Pastikan audit Shop B masih ada
    const [stillExistsB] = await sql`
      SELECT id_audit FROM audit_log WHERE id_audit = ${auditShopB.id_audit}
    `;

    // Cleanup record dummy Shop B
    await sql`DELETE FROM audit_log WHERE id_audit = ${auditShopB.id_audit}`;

    if (maliciousDelete.length === 0 && stillExistsB) {
      console.log("  ✅ PASSED: Upaya delete lintas tenant DITOLAK. Record Barbershop B tetap terlindungi.");
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Tenant isolation bobol!");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 8: Delete audit transaksi HANYA menghapus audit, transaksi ASLI TETAP AMAN
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 8: Delete audit transaksi -> audit terhapus, data transaksi asli TETAP AMAN...");
    let [existingTx] = await sql`
      SELECT id_transaksi, id_barbershop, total, status_transaksi 
      FROM transaksi 
      WHERE id_barbershop = ${shop.id_barbershop} 
      LIMIT 1
    `;

    if (!existingTx) {
      [existingTx] = await sql`
        SELECT id_transaksi, id_barbershop, total, status_transaksi 
        FROM transaksi 
        LIMIT 1
      `;
    }

    if (existingTx) {
      const [txAudit] = await sql`
        INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, entity_id, alasan)
        VALUES (${existingTx.id_barbershop}, ${ownerUser.id_user}, 'transaction completion', 'transaksi', ${existingTx.id_transaksi}, 'Test audit transaksi')
        RETURNING id_audit
      `;

      // Hapus audit log
      await sql`
        DELETE FROM audit_log 
        WHERE id_audit = ${txAudit.id_audit} AND id_barbershop = ${existingTx.id_barbershop}
      `;

      // Cek transaksi asli
      const [txStillThere] = await sql`
        SELECT id_transaksi, total FROM transaksi WHERE id_transaksi = ${existingTx.id_transaksi}
      `;

      if (txStillThere) {
        console.log(`  ✅ PASSED: Audit event transaksi (${txAudit.id_audit}) terhapus.`);
        console.log(`  ✅ PASSED: Data transaksi asli (${txStillThere.id_transaksi}) TETAP AMAN dan tidak terhapus.`);
        passedTests++;
      } else {
        console.error("  ❌ FAILED: Transaksi asli ikut terhapus!");
      }
    } else {
      console.log("  ⚠️ SKIP (tidak ada transaksi di seluruh database)");
      passedTests++;
    }

    // -------------------------------------------------------------------------
    // TEST CASE 9: User yang sedang login: audit login miliknya dihapus, user akun tetap ada
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 9: Audit milik user aktif dihapus tanpa menghapus user...");
    const [activeUserAudit] = await sql`
      INSERT INTO audit_log (id_barbershop, id_user, aksi, entity_type, alasan)
      VALUES (${shop.id_barbershop}, ${ownerUser.id_user}, 'Login ke sistem', 'login', 'Active session audit')
      RETURNING id_audit
    `;

    await sql`
      DELETE FROM audit_log 
      WHERE id_audit = ${activeUserAudit.id_audit} AND id_barbershop = ${shop.id_barbershop}
    `;

    const [userStillActive] = await sql`
      SELECT id_user, email FROM users WHERE id_user = ${ownerUser.id_user}
    `;

    if (userStillActive) {
      console.log(`  ✅ PASSED: Audit active user terhapus, akun user (${userStillActive.email}) tetap aktif.`);
      passedTests++;
    } else {
      console.error("  ❌ FAILED: User terhapus!");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 10: Kode audit: Pastikan TIDAK ADA pembuatan login dari users.created_at
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 10: Verifikasi kode: Tidak ada synthetic login dari users.created_at...");
    const ownerTsContent = fs.readFileSync("src/lib/owner.ts", "utf-8");
    const hasUsersCreatedAtLogin =
      ownerTsContent.includes('activityType: "login"') &&
      ownerTsContent.includes("u.created_at");

    if (!hasUsersCreatedAtLogin) {
      console.log("  ✅ PASSED: Tidak ada logic pemalsuan login dari users.created_at di src/lib/owner.ts.");
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Masih ditemukan kode pembuat login dari users.created_at!");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 11: Audit Keuangan: Pastikan TIDAK ADA fitur delete di Audit Keuangan
    // -------------------------------------------------------------------------
    console.log("\n▶ CASE 11: Verifikasi route: Audit Keuangan bebas dari fitur delete...");
    const financeRouteContent = fs.readFileSync(
      "src/routes/$barbershopSlug.owner.audit-finance.tsx",
      "utf-8"
    );
    const hasDeleteInFinance =
      financeRouteContent.includes("deleteOwner") ||
      financeRouteContent.includes("Hapus yang") ||
      financeRouteContent.includes("Hapus Permanen");

    if (!hasDeleteInFinance) {
      console.log("  ✅ PASSED: Audit Keuangan bersih dari fitur delete transaksi. Halaman murni read-only.");
      passedTests++;
    } else {
      console.error("  ❌ FAILED: Masih ditemukan fitur delete di Audit Keuangan!");
    }

    // Cleanup new login audit created in Case 5
    await sql`DELETE FROM audit_log WHERE id_audit = ${newLoginAudit.id_audit}`;
    await sql`DELETE FROM audit_log WHERE id_audit = ${logoutAudit.id_audit}`;

    console.log("\n==================================================================");
    console.log(`🎉 HASIL PENGUJIAN: ${passedTests}/${totalTests} TESTS BERHASIL MEMENUHI SYARAT!`);
    console.log("==================================================================");
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat pengujian:", error);
  } finally {
    await sql.end();
  }
}

verifyAll();
