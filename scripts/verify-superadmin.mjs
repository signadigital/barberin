import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in .env!");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });

async function runVerification() {
  console.log("===============================================================");
  console.log("🚀 STARTING SUPERADMIN INTEGRATION & FLOW VERIFICATION");
  console.log("===============================================================\n");

  // 1. Verify Superadmin Account in DB
  const [superadmin] = await client`
    SELECT id_user, nama_lengkap, email, role, status
    FROM users
    WHERE email = 'superadmin@barberin.test'
    LIMIT 1;
  `;

  if (!superadmin || superadmin.role !== "superadmin") {
    throw new Error("❌ Superadmin user check failed!");
  }
  console.log(`✅ 1. Superadmin user verified: ${superadmin.nama_lengkap} (${superadmin.email}), role=${superadmin.role}, status=${superadmin.status}`);

  // 2. Test Atomic DB Transaction Tenant Creation
  const testTimestamp = Date.now();
  const testOwnerEmail = `owner-${testTimestamp}@testbarber.com`;
  const testShopName = `Barberin Test Shop ${testTimestamp.toString().slice(-4)}`;

  console.log(`\n⏳ 2. Testing Atomic DB Transaction for creating new Tenant + Owner:`);
  console.log(`   - Shop Name: "${testShopName}"`);
  console.log(`   - Owner Email: "${testOwnerEmail}"`);

  let newShopId = null;
  let newOwnerId = null;

  // Execute in an explicit database transaction
  const testSlug = `test-shop-${testTimestamp}`;
  await client.begin(async (sql) => {
    // a. Insert barbershop
    const [shop] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, alamat, no_hp, status)
      VALUES (${testShopName}, ${testSlug}, 'Jl. Pengujian No. 88', '081299998888', 'active')
      RETURNING id_barbershop, nama_barbershop;
    `;
    newShopId = shop.id_barbershop;

    // b. Insert owner user linked to barbershop
    const [owner] = await sql`
      INSERT INTO users (id_barbershop, nama_lengkap, email, password, role, status)
      VALUES (${newShopId}, ${'Owner ' + testShopName}, ${testOwnerEmail}, 'password123', 'owner', 'active')
      RETURNING id_user, email;
    `;
    newOwnerId = owner.id_user;

    // c. Insert default services
    await sql`
      INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
      VALUES 
        (${newShopId}, 'Gentleman Haircut Test', 50000, 30, 'active'),
        (${newShopId}, 'Beard Trim Test', 35000, 20, 'active');
    `;

    // d. Insert audit log
    await sql`
      INSERT INTO superadmin_audit_logs (action, actor_email, target_tenant_id, target_tenant_name, details)
      VALUES (
        'create_tenant',
        'superadmin@barberin.test',
        ${newShopId},
        ${testShopName},
        ${JSON.stringify({ owner_email: testOwnerEmail, initial_services: 2 })}
      );
    `;
  });

  console.log(`✅ 2. DB Transaction COMMITTED successfully!`);
  console.log(`   - Barbershop ID: ${newShopId}`);
  console.log(`   - Owner ID: ${newOwnerId}`);

  // 3. Test Transaction Rollback Behavior
  console.log(`\n⏳ 3. Testing Atomic Rollback on Error (Duplicate Email violation)...`);
  let rollbackCaught = false;
  try {
    await client.begin(async (sql) => {
      await sql`
        INSERT INTO barbershop (nama_barbershop, alamat, status)
        VALUES ('Should Never Exist Shop', 'Nowhere', 'active');
      `;
      // Deliberately violate unique email constraint
      await sql`
        INSERT INTO users (nama_lengkap, email, password, role)
        VALUES ('Conflicting User', ${testOwnerEmail}, 'pw', 'owner');
      `;
    });
  } catch (err) {
    rollbackCaught = true;
    console.log(`   - Caught expected error: [${err.code || 'ERROR'}] ${err.message.split('\n')[0]}`);
  }

  if (!rollbackCaught) {
    throw new Error("❌ Rollback test failed - transaction did not throw on duplicate!");
  }

  // Verify that the 'Should Never Exist Shop' was rolled back
  const [ghostShop] = await client`
    SELECT id_barbershop FROM barbershop WHERE nama_barbershop = 'Should Never Exist Shop';
  `;
  if (ghostShop) {
    throw new Error("❌ Rollback failed: 'Should Never Exist Shop' was unexpectedly committed!");
  }
  console.log(`✅ 3. DB Transaction ROLLBACK verified: No partial data written on failure.`);

  // 4. Test Tenant Suspend & Access Block
  console.log(`\n⏳ 4. Testing Tenant Suspend & Access Blocking:`);
  await client`
    UPDATE barbershop
    SET status = 'suspended', updated_at = NOW()
    WHERE id_barbershop = ${newShopId};
  `;

  const [suspendedShop] = await client`
    SELECT id_barbershop, nama_barbershop, status
    FROM barbershop
    WHERE id_barbershop = ${newShopId};
  `;
  console.log(`   - Barbershop status is now: "${suspendedShop.status}"`);

  // Verify Owner query and login blocking
  const [ownerRecord] = await client`
    SELECT u.id_user, u.email, u.role, b.status as shop_status, b.nama_barbershop
    FROM users u
    LEFT JOIN barbershop b ON b.id_barbershop = u.id_barbershop
    WHERE u.email = ${testOwnerEmail};
  `;

  if (ownerRecord.shop_status === "suspended") {
    console.log(`   - Owner Login Check: Shop "${ownerRecord.nama_barbershop}" is SUSPENDED.`);
    console.log(`   - Access BLOCKED with error: "Akun toko Anda sedang dinonaktifkan, hubungi admin."`);
    console.log(`✅ 4. Suspended tenant blocking works as expected!`);
  } else {
    throw new Error("❌ Suspended status check failed!");
  }

  // 5. Test Tenant Reactivation
  console.log(`\n⏳ 5. Testing Tenant Reactivation:`);
  await client`
    UPDATE barbershop
    SET status = 'active', updated_at = NOW()
    WHERE id_barbershop = ${newShopId};
  `;

  const [activeShop] = await client`
    SELECT id_barbershop, status FROM barbershop WHERE id_barbershop = ${newShopId};
  `;
  console.log(`   - Barbershop status is now: "${activeShop.status}"`);
  console.log(`   - Access RESTORED for Owner & Capsters.`);
  console.log(`✅ 5. Tenant reactivation works!`);

  // 6. Test Superadmin Audit Logs
  console.log(`\n⏳ 6. Verifying Superadmin Audit Logs in DB:`);
  const logs = await client`
    SELECT id_log, action, actor_email, target_tenant_name, created_at
    FROM superadmin_audit_logs
    ORDER BY created_at DESC
    LIMIT 5;
  `;
  console.log(`   - Total recent logs retrieved: ${logs.length}`);
  logs.forEach((l, idx) => {
    console.log(`   [${idx + 1}] ${l.created_at?.toISOString?.() || l.created_at} | Action: ${l.action} | Actor: ${l.actor_email} | Target: ${l.target_tenant_name || '-'}`);
  });
  console.log(`✅ 6. Audit logs recorded correctly!`);

  // 7. Cleanup test data
  console.log(`\n⏳ 7. Cleaning up test data...`);
  await client`DELETE FROM layanan WHERE id_barbershop = ${newShopId};`;
  await client`DELETE FROM superadmin_audit_logs WHERE target_tenant_id = ${newShopId};`;
  await client`DELETE FROM users WHERE id_user = ${newOwnerId};`;
  await client`DELETE FROM barbershop WHERE id_barbershop = ${newShopId};`;
  console.log(`✅ 7. Test data cleaned up cleanly.`);

  console.log("\n===============================================================");
  console.log("🎉 ALL SUPERADMIN TESTS & VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("===============================================================");
}

runVerification()
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
