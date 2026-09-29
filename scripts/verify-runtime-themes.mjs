import "dotenv/config";
import { db } from "../src/db/index.ts";
import { barbershop, barbershopBrandings } from "../src/db/schema.ts";
import { eq, ne } from "drizzle-orm";
import { invalidateTenantCache } from "../src/lib/tenant-resolver.ts";

async function verifyServerRenderedThemes() {
  console.log("======================================================================");
  console.log("SERVER RUNTIME THEME SWITCHING & HTTP VERIFICATION");
  console.log("======================================================================\n");

  const testSlug = "barberin-1";
  const [shop] = await db.select().from(barbershop).where(eq(barbershop.slug, testSlug)).limit(1);

  if (!shop) {
    console.error(`Cannot find barbershop "${testSlug}".`);
    process.exit(1);
  }

  async function setBranding(preset, displayMode, primary, secondary, bg) {
    await db
      .update(barbershopBrandings)
      .set({
        color_preset: preset,
        display_mode: displayMode,
        warna_primary: primary,
        warna_secondary: secondary,
        warna_background: bg,
        updated_at: new Date(),
      })
      .where(eq(barbershopBrandings.id_barbershop, shop.id_barbershop));
    invalidateTenantCache(testSlug);
  }

  async function checkRoute(url, expectedPreset, expectedMode, expectedPrimary, expectedBg) {
    const res = await fetch(url);
    const html = await res.text();

    const passTenantTheme = html.includes('data-tenant-theme="true"') || html.includes('data-tenant-theme');
    const passPreset = html.includes(`data-color-preset="${expectedPreset}"`);
    const passMode = html.includes(`data-display-mode="${expectedMode}"`);
    const passPrimary = html.includes(`--brand-primary:${expectedPrimary}`);
    const passBg = html.includes(`--brand-background:${expectedBg}`);

    return {
      status: res.status,
      passTenantTheme,
      passPreset,
      passMode,
      passPrimary,
      passBg,
      allPass: passTenantTheme && passPreset && passMode && passPrimary && passBg,
      htmlSnippet: html.substring(0, 500),
    };
  }

  let totalPassed = 0;
  let totalFailed = 0;

  function record(name, result) {
    if (result.allPass) {
      console.log(`  ✓ PASS: ${name}`);
      console.log(`      Status: ${result.status} | TenantTheme: match | Preset: match | Mode: match | Primary: match | Bg: match`);
      totalPassed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`      TenantTheme: ${result.passTenantTheme}, Preset: ${result.passPreset}, Mode: ${result.passMode}, Primary: ${result.passPrimary}, Bg: ${result.passBg}`);
      totalFailed++;
    }
  }

  // 1. Blue + Dark
  console.log("--- TEST 1: Blue + Dark ---");
  await setBranding("blue", "dark", "#2563EB", "#1E293B", "#070D18");
  let resA = await checkRoute("http://localhost:8080/barberin-1/customer/services", "blue", "dark", "#2563EB", "#070D18");
  record("Customer Services (Blue + Dark)", resA);

  // 2. Purple + Dark
  console.log("\n--- TEST 2: Purple + Dark ---");
  await setBranding("purple", "dark", "#7C3AED", "#4C1D95", "#0F0A1F");
  let resB = await checkRoute("http://localhost:8080/barberin-1/customer/services", "purple", "dark", "#7C3AED", "#0F0A1F");
  record("Customer Services (Purple + Dark)", resB);

  // 3. Emerald + Dark
  console.log("\n--- TEST 3: Emerald + Dark ---");
  await setBranding("emerald", "dark", "#059669", "#064E3B", "#022C22");
  let resC = await checkRoute("http://localhost:8080/barberin-1/customer/services", "emerald", "dark", "#059669", "#022C22");
  record("Customer Services (Emerald + Dark)", resC);

  // 4. Rose + Dark
  console.log("\n--- TEST 4: Rose + Dark ---");
  await setBranding("rose", "dark", "#E11D48", "#4C0519", "#1C050B");
  let resRose = await checkRoute("http://localhost:8080/barberin-1/customer/services", "rose", "dark", "#E11D48", "#1C050B");
  record("Customer Services (Rose + Dark)", resRose);

  // 5. Purple + Light
  console.log("\n--- TEST 5: Purple + Light ---");
  await setBranding("purple", "light", "#7C3AED", "#4C1D95", "#FAF5FF");
  let resD = await checkRoute("http://localhost:8080/barberin-1/customer/services", "purple", "light", "#7C3AED", "#FAF5FF");
  record("Customer Services (Purple + Light)", resD);

  // 5. Reload Persistence (simulating cold cache reload)
  console.log("\n--- TEST 5: Reload Persistence ---");
  invalidateTenantCache();
  let resE = await checkRoute("http://localhost:8080/barberin-1/customer/services", "purple", "light", "#7C3AED", "#FAF5FF");
  record("Cold Cache Reload (Purple + Light)", resE);

  // 6. Navigation / Multi-route Consistency
  console.log("\n--- TEST 6: Cross-route Theme Consistency ---");
  let resOwnerTheme = await checkRoute("http://localhost:8080/barberin-1/owner/theme", "purple", "light", "#7C3AED", "#FAF5FF");
  record("Owner Theme Route (Purple + Light)", resOwnerTheme);

  let resOwnerDashboard = await checkRoute("http://localhost:8080/barberin-1/owner/dashboard", "purple", "light", "#7C3AED", "#FAF5FF");
  record("Owner Dashboard Route (Purple + Light)", resOwnerDashboard);

  // 7. Tenant Isolation Test
  console.log("\n--- TEST 7: Tenant Isolation ---");
  let [otherShop] = await db.select().from(barbershop).where(ne(barbershop.slug, testSlug)).limit(1);
  if (otherShop) {
    const [otherBrand] = await db
      .select()
      .from(barbershopBrandings)
      .where(eq(barbershopBrandings.id_barbershop, otherShop.id_barbershop))
      .limit(1);

    const otherPreset = otherBrand?.color_preset || "emerald";
    const otherMode = otherBrand?.display_mode || "light";
    const otherPrimary = otherBrand?.warna_primary || "#059669";
    const otherBg = otherBrand?.warna_background || (otherMode === "light" ? "#F0FDF4" : "#022C22");

    invalidateTenantCache(otherShop.slug);
    let resOther = await checkRoute(
      `http://localhost:8080/${otherShop.slug}/customer/services`,
      otherPreset,
      otherMode,
      otherPrimary,
      otherBg
    );
    record(`Tenant Isolation Check (${otherShop.slug} retains its own theme [${otherPreset}+${otherMode}] and does not leak barberin-1)`, resOther);
  }

  // Verify non-tenant route isolation (e.g. /owner/login should not leak barberin-1's tenant variables)
  const nonTenantRes = await fetch("http://localhost:8080/owner/login");
  const nonTenantHtml = await nonTenantRes.text();
  const nonTenantIsolated = !nonTenantHtml.includes('data-tenant-slug="barberin-1"');
  if (nonTenantIsolated) {
    console.log("  ✓ PASS: Public /owner/login route is properly isolated from tenant theme variables");
    totalPassed++;
  } else {
    console.error("  ✗ FAIL: Public route leaked tenant-slug attribute");
    totalFailed++;
  }

  // 8. Restore default Blue + Dark for barberin-1
  console.log("\n--- RESTORING DEFAULT BARBERIN THEME ---");
  await setBranding("blue", "dark", "#2563EB", "#1E293B", "#070D18");
  let resRestore = await checkRoute("http://localhost:8080/barberin-1/customer/services", "blue", "dark", "#2563EB", "#070D18");
  record("Default Theme Restored (Blue + Dark)", resRestore);

  console.log("\n======================================================================");
  console.log(`SUMMARY: ${totalPassed + totalFailed} TESTS RUN | ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log("======================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

verifyServerRenderedThemes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  });
