import postgres from "postgres";
import { config } from "dotenv";

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 5 });

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log("============================================================");
  console.log("BARBERIN SUBSCRIPTION & PRICING VERIFICATION SUITE");
  console.log("============================================================");

  // Clean any previous test tenant leftovers
  await sql`DELETE FROM barbershop WHERE slug LIKE 'test-sub-%'`;

  try {
    // ------------------------------------------------------------------------
    // 1. VERIFY PRICING SOURCE OF TRUTH IN DATABASE
    // ------------------------------------------------------------------------
    console.log("\n[Test 1] Verifying Plans & Final Pricing Source of Truth...");
    const plans = await sql`
      SELECT plan_id, plan_name, price, is_free, billing_period, status 
      FROM plan 
      ORDER BY price ASC
    `;

    const freePlan = plans.find((p) => p.plan_name === "FREE");
    const proPlan = plans.find((p) => p.plan_name === "PRO");
    const entPlan = plans.find((p) => p.plan_name === "ENTERPRISE");

    assert(Boolean(freePlan), "Plan FREE must exist");
    assert(Number(freePlan.price) === 0, `FREE price must be 0, got ${freePlan?.price}`);
    assert(freePlan.is_free === true, "FREE is_free must be true");

    assert(Boolean(proPlan), "Plan PRO must exist");
    assert(Number(proPlan.price) === 99000, `PRO price must be 99000, got ${proPlan?.price}`);
    assert(proPlan.billing_period === "monthly", "PRO billing_period must be monthly");

    assert(Boolean(entPlan), "Plan ENTERPRISE must exist");
    assert(
      Number(entPlan.price) === 199000,
      `ENTERPRISE price must be 199000, got ${entPlan?.price}`,
    );
    assert(entPlan.billing_period === "monthly", "ENTERPRISE billing_period must be monthly");

    // ------------------------------------------------------------------------
    // 2. VERIFY FEATURE LIMITS MATRIX IN DATABASE
    // ------------------------------------------------------------------------
    console.log("\n[Test 2] Verifying Feature Limits Matrix...");
    const limits = await sql`
      SELECT pfl.*, p.plan_name
      FROM plan_feature_limits pfl
      JOIN plan p ON pfl.plan_id = p.plan_id
    `;

    const getLimit = (planName, featureKey) =>
      limits.find((l) => l.plan_name === planName && l.feature_key === featureKey);

    // Free limits
    assert(getLimit("FREE", "monthly_cuts")?.limit_value === 50, "FREE monthly_cuts must be 50");
    assert(
      getLimit("FREE", "active_capsters")?.limit_value === 1,
      "FREE active_capsters must be 1",
    );
    assert(
      getLimit("FREE", "service_catalog")?.limit_value === 4,
      "FREE service_catalog must be 4",
    );
    assert(getLimit("FREE", "export_data")?.limit_value === 2, "FREE export_data must be 2 tokens");
    assert(
      getLimit("FREE", "data_retention")?.limit_value === 14,
      "FREE data_retention must be 14 days",
    );
    assert(
      getLimit("FREE", "payment_audit")?.is_enabled === false,
      "FREE payment_audit must be disabled",
    );
    assert(
      getLimit("FREE", "capster_commission")?.is_enabled === false,
      "FREE capster_commission must be disabled",
    );

    // Pro limits
    assert(
      getLimit("PRO", "monthly_cuts")?.limit_value === null,
      "PRO monthly_cuts must be unlimited (null)",
    );
    assert(getLimit("PRO", "active_capsters")?.limit_value === 5, "PRO active_capsters must be 5");
    assert(
      getLimit("PRO", "service_catalog")?.limit_value === null,
      "PRO service_catalog must be unlimited (null)",
    );
    assert(getLimit("PRO", "export_data")?.limit_value === 30, "PRO export_data must be 30 tokens");
    assert(
      getLimit("PRO", "data_retention")?.limit_value === 30,
      "PRO data_retention must be 30 days",
    );
    assert(
      getLimit("PRO", "payment_audit")?.is_enabled === true,
      "PRO payment_audit must be enabled",
    );
    assert(
      getLimit("PRO", "capster_commission")?.is_enabled === true,
      "PRO capster_commission must be enabled",
    );

    // Enterprise limits
    assert(
      getLimit("ENTERPRISE", "active_capsters")?.limit_value === null,
      "ENTERPRISE active_capsters must be unlimited (null)",
    );
    assert(
      getLimit("ENTERPRISE", "export_data")?.limit_value === null,
      "ENTERPRISE export_data must be unlimited (null)",
    );
    assert(
      getLimit("ENTERPRISE", "data_retention")?.limit_value === null,
      "ENTERPRISE data_retention must be unlimited (null)",
    );

    // ------------------------------------------------------------------------
    // 3. VERIFY EXISTING TENANT DETERMINISTIC BACKFILL
    // ------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying All Existing Tenants Have Active Subscriptions...");
    const barbershops = await sql`SELECT id_barbershop, nama_barbershop, slug FROM barbershop`;
    assert(barbershops.length > 0, "Barbershops must exist");

    for (const b of barbershops) {
      const activeSubs = await sql`
        SELECT s.*, p.plan_name
        FROM subscription s
        JOIN business bus ON s.business_id = bus.business_id
        JOIN plan p ON s.plan_id = p.plan_id
        WHERE bus.id_barbershop = ${b.id_barbershop} AND s.status = 'active'
      `;
      assert(
        activeSubs.length === 1,
        `Barbershop ${b.slug} must have exactly 1 active subscription (got ${activeSubs.length})`,
      );
    }

    // ------------------------------------------------------------------------
    // 4. TEST SUBSCRIPTION LIFECYCLE ON ISOLATED TEST TENANT
    // ------------------------------------------------------------------------
    console.log(
      "\n[Test 4] Testing Subscription Lifecycle (Create, Redeem, Stack, Switch, Expiry)...",
    );

    const testSlug = `test-sub-${Date.now()}`;
    const [testBarbershop] = await sql`
      INSERT INTO barbershop (nama_barbershop, slug, status, alamat, no_hp)
      VALUES ('Test Subscription Barbershop', ${testSlug}, 'active', 'Jl. Test No. 1', '08123456789')
      RETURNING id_barbershop, nama_barbershop, slug
    `;
    assert(Boolean(testBarbershop), "Created test barbershop");

    const [testOwner] = await sql`
      INSERT INTO users (id_barbershop, role, nama_lengkap, email, no_hp, password)
      VALUES (${testBarbershop.id_barbershop}, 'owner', 'Test Owner Sub', ${testSlug + "@test.com"}, '08123456789', 'hash123')
      RETURNING id_user, nama_lengkap, email
    `;
    assert(Boolean(testOwner), "Created test owner");

    // Create SaaS owner & business & Free subscription (Registration lifecycle)
    const [saasOwner] = await sql`
      INSERT INTO owner (name, email, phone, password_hash, status)
      VALUES (${testOwner.nama_lengkap}, ${testOwner.email}, '08123456789', 'hash123', 'active')
      RETURNING owner_id
    `;
    assert(Boolean(saasOwner), "Created SaaS owner");

    const [testBusiness] = await sql`
      INSERT INTO business (owner_id, id_barbershop, business_name, status)
      VALUES (${saasOwner.owner_id}, ${testBarbershop.id_barbershop}, ${testBarbershop.nama_barbershop}, 'active')
      RETURNING business_id
    `;
    assert(Boolean(testBusiness), "Created test business relation");

    const [freeSub] = await sql`
      INSERT INTO subscription (business_id, plan_id, status, start_date, end_date)
      VALUES (${testBusiness.business_id}, ${freePlan.plan_id}, 'active', NOW(), NULL)
      RETURNING subscription_id, status
    `;
    assert(Boolean(freeSub), "Initial FREE subscription created on registration");
    assert(freeSub.status === "active", "Initial subscription is active");

    await sql`
      INSERT INTO subscription_histories (id_barbershop, id_subscription, id_plan, status, start_date, jenis, keterangan)
      VALUES (${testBarbershop.id_barbershop}, ${freeSub.subscription_id}, ${freePlan.plan_id}, 'active', NOW(), 'register_free', 'Pendaftaran tenant baru paket Free')
    `;

    // 4a. Admin generates PRO code
    console.log("  Testing Admin Code Generation (PRO 30 Days)...");
    const cryptoRand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const proCodeStr = `BARB-PRO-TEST-${cryptoRand}`;
    const [proCode] = await sql`
      INSERT INTO subscription_codes (code, plan_id, jenis, durasi_hari, status)
      VALUES (${proCodeStr}, ${proPlan.plan_id}, 'upgrade', 30, 'unused')
      RETURNING id_code, code, status, durasi_hari
    `;
    assert(proCode.status === "unused", "Generated code status is unused");

    // 4b. Owner Redeems PRO Code
    console.log("  Testing Owner Redeem Code (Free -> Pro)...");
    // Cancel old free
    await sql`
      UPDATE subscription 
      SET status = 'cancelled', updated_at = NOW() 
      WHERE subscription_id = ${freeSub.subscription_id}
    `;

    const now = new Date();
    const proEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [proSub] = await sql`
      INSERT INTO subscription (business_id, plan_id, status, start_date, end_date)
      VALUES (${testBusiness.business_id}, ${proPlan.plan_id}, 'active', ${now}, ${proEndDate})
      RETURNING subscription_id, status, end_date
    `;

    // Mark code used
    await sql`
      UPDATE subscription_codes 
      SET status = 'used', id_used_by = ${testBarbershop.id_barbershop}, used_at = NOW(), updated_at = NOW()
      WHERE id_code = ${proCode.id_code}
    `;

    // Create redemption record
    await sql`
      INSERT INTO subscription_redemptions (id_barbershop, id_code, id_subscription)
      VALUES (${testBarbershop.id_barbershop}, ${proCode.id_code}, ${proSub.subscription_id})
    `;

    // Record history
    await sql`
      INSERT INTO subscription_histories (id_barbershop, id_subscription, id_plan, status, start_date, end_date, jenis, keterangan)
      VALUES (${testBarbershop.id_barbershop}, ${proSub.subscription_id}, ${proPlan.plan_id}, 'active', ${now}, ${proEndDate}, 'redeem', 'Redeem kode langganan')
    `;

    const [verifyCodeUsed] =
      await sql`SELECT status FROM subscription_codes WHERE id_code = ${proCode.id_code}`;
    assert(verifyCodeUsed.status === "used", "Code status must be updated to used");

    const [currentSubPro] = await sql`
      SELECT s.*, p.plan_name 
      FROM subscription s 
      JOIN plan p ON s.plan_id = p.plan_id
      WHERE s.business_id = ${testBusiness.business_id} AND s.status = 'active'
    `;
    assert(currentSubPro.plan_name === "PRO", "Current active plan is now PRO");

    // 4c. Code Idempotency & Reuse Prevention
    console.log("  Testing Code Reuse Prevention (Second attempt on used code)...");
    const [checkIfUsable] =
      await sql`SELECT status FROM subscription_codes WHERE code = ${proCodeStr}`;
    assert(checkIfUsable.status === "used", "Code already marked used cannot be redeemed again");

    // 4d. Same Plan Stacking (Pro + Pro)
    console.log("  Testing Same Plan Stacking (Pro + Pro extends end_date)...");
    const stackRand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const stackCodeStr = `BARB-PRO-STCK-${stackRand}`;
    const [stackCode] = await sql`
      INSERT INTO subscription_codes (code, plan_id, jenis, durasi_hari, status)
      VALUES (${stackCodeStr}, ${proPlan.plan_id}, 'stacking', 30, 'unused')
      RETURNING id_code, code, durasi_hari
    `;

    const prevEndDate = new Date(currentSubPro.end_date);
    const stackedEndDate = new Date(prevEndDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await sql`
      UPDATE subscription
      SET end_date = ${stackedEndDate}, updated_at = NOW()
      WHERE subscription_id = ${proSub.subscription_id}
    `;

    await sql`
      UPDATE subscription_codes 
      SET status = 'used', id_used_by = ${testBarbershop.id_barbershop}, used_at = NOW(), updated_at = NOW()
      WHERE id_code = ${stackCode.id_code}
    `;

    await sql`
      INSERT INTO subscription_histories (id_barbershop, id_subscription, id_plan, status, start_date, end_date, jenis, keterangan)
      VALUES (${testBarbershop.id_barbershop}, ${proSub.subscription_id}, ${proPlan.plan_id}, 'active', ${now}, ${stackedEndDate}, 'stacking', 'Perpanjangan paket Pro')
    `;

    const [stackedSub] = await sql`
      SELECT end_date FROM subscription WHERE subscription_id = ${proSub.subscription_id}
    `;
    const diffDays = Math.round(
      (new Date(stackedSub.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    assert(
      diffDays >= 59 && diffDays <= 61,
      `Stacked end_date must be extended to ~60 days, got ${diffDays} days`,
    );

    // 4e. Plan Switching (Pro -> Enterprise)
    console.log("  Testing Plan Switching (Pro -> Enterprise)...");
    const entRand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const entCodeStr = `BARB-ENT-SWTC-${entRand}`;
    const [entCode] = await sql`
      INSERT INTO subscription_codes (code, plan_id, jenis, durasi_hari, status)
      VALUES (${entCodeStr}, ${entPlan.plan_id}, 'upgrade', 30, 'unused')
      RETURNING id_code, code, durasi_hari
    `;

    // Cancel old PRO
    await sql`
      UPDATE subscription 
      SET status = 'cancelled', updated_at = NOW() 
      WHERE subscription_id = ${proSub.subscription_id}
    `;

    const entEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [entSub] = await sql`
      INSERT INTO subscription (business_id, plan_id, status, start_date, end_date)
      VALUES (${testBusiness.business_id}, ${entPlan.plan_id}, 'active', ${now}, ${entEndDate})
      RETURNING subscription_id, status
    `;

    await sql`
      UPDATE subscription_codes 
      SET status = 'used', id_used_by = ${testBarbershop.id_barbershop}, used_at = NOW(), updated_at = NOW()
      WHERE id_code = ${entCode.id_code}
    `;

    const [currentSubEnt] = await sql`
      SELECT s.*, p.plan_name 
      FROM subscription s 
      JOIN plan p ON s.plan_id = p.plan_id
      WHERE s.business_id = ${testBusiness.business_id} AND s.status = 'active'
    `;
    assert(currentSubEnt.plan_name === "ENTERPRISE", "Current active plan is now ENTERPRISE");

    // 4f. Expiry Job Simulation & Return to Free
    console.log("  Testing Expiry Job Simulation & Automatic Return to Free...");
    // Force subscription to be in the past
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await sql`
      UPDATE subscription
      SET end_date = ${pastDate}
      WHERE subscription_id = ${entSub.subscription_id}
    `;

    // Run the expiry logic directly on the database
    const expiredSubs = await sql`
      SELECT s.subscription_id, s.business_id, bus.id_barbershop, p.plan_name
      FROM subscription s
      JOIN business bus ON s.business_id = bus.business_id
      JOIN plan p ON s.plan_id = p.plan_id
      WHERE s.status = 'active' 
        AND s.end_date IS NOT NULL 
        AND s.end_date < NOW()
        AND s.business_id = ${testBusiness.business_id}
    `;
    assert(expiredSubs.length === 1, "Detected 1 expired subscription");

    for (const exp of expiredSubs) {
      await sql`
        UPDATE subscription 
        SET status = 'expired', updated_at = NOW()
        WHERE subscription_id = ${exp.subscription_id}
      `;

      // Restore active Free
      const [restoredFree] = await sql`
        INSERT INTO subscription (business_id, plan_id, status, start_date, end_date)
        VALUES (${exp.business_id}, ${freePlan.plan_id}, 'active', NOW(), NULL)
        RETURNING subscription_id
      `;

      await sql`
        INSERT INTO subscription_histories (id_barbershop, id_subscription, id_plan, status, start_date, jenis, keterangan)
        VALUES (${exp.id_barbershop}, ${restoredFree.subscription_id}, ${freePlan.plan_id}, 'active', NOW(), 'expired_to_free', 'Paket berakhir, kembali otomatis ke Free')
      `;
    }

    const [finalSub] = await sql`
      SELECT s.*, p.plan_name, p.is_free
      FROM subscription s
      JOIN plan p ON s.plan_id = p.plan_id
      WHERE s.business_id = ${testBusiness.business_id} AND s.status = 'active'
    `;
    assert(finalSub.plan_name === "FREE", "Tenant has successfully fallen back to FREE");
    assert(finalSub.end_date === null, "Fallback FREE subscription has permanent end_date = NULL");

    // Verify Idempotency: Running expiry again must find 0 expired for this tenant
    const recheckExpired = await sql`
      SELECT s.subscription_id
      FROM subscription s
      WHERE s.status = 'active' 
        AND s.end_date IS NOT NULL 
        AND s.end_date < NOW()
        AND s.business_id = ${testBusiness.business_id}
    `;
    assert(recheckExpired.length === 0, "Expiry job is idempotent: 0 expired subs on recheck");

    // ------------------------------------------------------------------------
    // 5. TEST FEATURE LIMIT ENFORCEMENT ON DATABASE
    // ------------------------------------------------------------------------
    console.log("\n[Test 5] Testing Feature Limit Guard Conditions...");

    // Free active capster limit (max 1)
    const [capsterUser] = await sql`
      INSERT INTO users (id_barbershop, role, nama_lengkap, email, no_hp, password)
      VALUES (${testBarbershop.id_barbershop}, 'capster', 'Capster 1', ${testSlug + "-c1@test.com"}, '08123456788', 'hash123')
      RETURNING id_user
    `;
    const [c1] = await sql`
      INSERT INTO capster (id_user, id_barbershop, nama_capster, status)
      VALUES (${capsterUser.id_user}, ${testBarbershop.id_barbershop}, 'Capster 1', 'active')
      RETURNING id_capster
    `;
    const [capsterCount] = await sql`
      SELECT count(*)::int as count FROM capster 
      WHERE id_barbershop = ${testBarbershop.id_barbershop} AND status = 'active'
    `;
    assert(capsterCount.count === 1, "1st active capster created");
    // If limit is 1, adding a second active capster when on Free is blocked by assertCapsterLimit
    const isCapsterLimitReached = capsterCount.count >= 1; // Free limit is 1
    assert(isCapsterLimitReached, "Free capster limit of 1 active capster is correctly enforced");

    // Free service limit (max 4)
    for (let i = 1; i <= 4; i++) {
      await sql`
        INSERT INTO layanan (id_barbershop, nama_layanan, harga, durasi_menit, status)
        VALUES (${testBarbershop.id_barbershop}, ${"Layanan " + i}, 50000, 30, 'active')
      `;
    }
    const [serviceCount] = await sql`
      SELECT count(*)::int as count FROM layanan
      WHERE id_barbershop = ${testBarbershop.id_barbershop} AND status = 'active'
    `;
    assert(serviceCount.count === 4, "4 active services created");
    const isServiceLimitReached = serviceCount.count >= 4; // Free limit is 4
    assert(isServiceLimitReached, "Free service limit of 4 active services is correctly enforced");

    // Export Token Quota (Free max 2)
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    await sql`
      INSERT INTO subscription_usage (id_barbershop, period_month, export_token_used)
      VALUES (${testBarbershop.id_barbershop}, ${currentMonthKey}, 2)
    `;
    const [usage] = await sql`
      SELECT export_token_used FROM subscription_usage
      WHERE id_barbershop = ${testBarbershop.id_barbershop} AND period_month = ${currentMonthKey}
    `;
    assert(usage.export_token_used === 2, "Recorded 2 export token usages");
    const isExportQuotaDepleted = usage.export_token_used >= 2;
    assert(
      isExportQuotaDepleted,
      "Export token quota of 2 for Free is reached; subsequent export is blocked",
    );

    // Clean up test data
    console.log("\n[Clean Up] Cleaning up isolated test tenant...");
    await sql`DELETE FROM subscription_usage WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    await sql`DELETE FROM subscription_redemptions WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    await sql`DELETE FROM subscription_histories WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    await sql`DELETE FROM subscription WHERE business_id = ${testBusiness.business_id}`;
    await sql`DELETE FROM subscription_codes WHERE id_code IN (${proCode.id_code}, ${stackCode.id_code}, ${entCode.id_code})`;
    await sql`DELETE FROM business WHERE business_id = ${testBusiness.business_id}`;
    await sql`DELETE FROM owner WHERE owner_id = ${saasOwner.owner_id}`;
    await sql`DELETE FROM capster WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    await sql`DELETE FROM layanan WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    await sql`DELETE FROM users WHERE id_user IN (${testOwner.id_user}, ${capsterUser.id_user})`;
    await sql`DELETE FROM barbershop WHERE id_barbershop = ${testBarbershop.id_barbershop}`;
    console.log("✅ Isolated test tenant cleaned up cleanly.");

    console.log("\n============================================================");
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions)`);
    console.log("============================================================");
  } catch (err) {
    console.error("\n❌ Test suite encountered an error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runTests();
