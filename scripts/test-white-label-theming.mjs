import "dotenv/config";
import { db } from "../src/db/index.ts";
import { barbershop, barbershopBrandings, customDomains } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { PRESET_SEMANTIC_TOKENS, getTenantThemeVariables } from "../src/lib/tenant-theme.ts";
import { COLOR_PRESETS } from "../src/lib/branding-domains.ts";
import { getTenantBarbershop, invalidateTenantCache } from "../src/lib/tenant-resolver.ts";

// Helper to calculate luminance and contrast ratio (WCAG 2.1)
function hexToRgb(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runThemingTests() {
  console.log("============================================================");
  console.log("BARBERIN WHITE LABEL THEMING END-TO-END VERIFICATION");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verify Presets Definition
  console.log("1. AUDITING PRESET DEFINITIONS & WCAG CONTRAST:");
  const presets = ["blue", "emerald", "purple", "rose", "amber", "slate"];
  for (const p of presets) {
    const darkTokens = PRESET_SEMANTIC_TOKENS[p]?.dark;
    const lightTokens = PRESET_SEMANTIC_TOKENS[p]?.light;
    assert(Boolean(darkTokens && lightTokens), `Preset "${p}" has both Dark & Light tokens defined`);

    // Contrast check: primary vs primaryForeground
    const darkBtnRatio = getContrastRatio(darkTokens.primary, darkTokens.primaryForeground);
    assert(
      darkBtnRatio >= 3.0,
      `[${p}-dark] Button text contrast ${darkBtnRatio.toFixed(2)}:1 (>= 3.0:1)`
    );

    const lightBtnRatio = getContrastRatio(lightTokens.primary, lightTokens.primaryForeground);
    assert(
      lightBtnRatio >= 3.0,
      `[${p}-light] Button text contrast ${lightBtnRatio.toFixed(2)}:1 (>= 3.0:1)`
    );

    // Contrast check: background vs foreground
    const darkBodyRatio = getContrastRatio(darkTokens.background, darkTokens.foreground);
    assert(
      darkBodyRatio >= 4.5,
      `[${p}-dark] Body text contrast ${darkBodyRatio.toFixed(2)}:1 (WCAG AA >= 4.5:1)`
    );

    const lightBodyRatio = getContrastRatio(lightTokens.background, lightTokens.foreground);
    assert(
      lightBodyRatio >= 4.5,
      `[${p}-light] Body text contrast ${lightBodyRatio.toFixed(2)}:1 (WCAG AA >= 4.5:1)`
    );
  }

  // 2. Test getTenantThemeVariables mapping
  console.log("\n2. VERIFYING RUNTIME SEMANTIC CSS VARIABLES GENERATION:");
  {
    const purpleDark = getTenantThemeVariables({
      color_preset: "purple",
      display_mode: "dark",
      warna_primary: "#7C3AED",
    });
    assert(purpleDark["--primary"] === "#7C3AED", "Purple Dark produces --primary: #7C3AED");
    assert(purpleDark["--background"] === "#0F0A1F", "Purple Dark produces --background: #0F0A1F");
    assert(purpleDark["--card"] === "#1E1238", "Purple Dark produces --card: #1E1238");
    assert(purpleDark["--color-primary"] === "#7C3AED", "Purple Dark sets --color-primary");

    const purpleLight = getTenantThemeVariables({
      color_preset: "purple",
      display_mode: "light",
      warna_primary: "#7C3AED",
    });
    assert(purpleLight["--primary"] === "#7C3AED", "Purple Light produces --primary: #7C3AED");
    assert(purpleLight["--background"] === "#FAF5FF", "Purple Light produces --background: #FAF5FF (LIGHT)");
    assert(purpleLight["--card"] === "#FFFFFF", "Purple Light produces --card: #FFFFFF");
    assert(purpleLight["--foreground"] === "#2E1065", "Purple Light produces --foreground: #2E1065");
  }

  // 3. Database Persistence & Tenant Resolver Integration Test
  console.log("\n3. TESTING END-TO-END DB -> RESOLVER -> THEME APPLICATION:");
  const testSlug = "barberin-1";
  const [shop] = await db.select().from(barbershop).where(eq(barbershop.slug, testSlug)).limit(1);

  if (!shop) {
    console.error(`Cannot find barbershop "${testSlug}". Aborting DB tests.`);
    return;
  }

  // Test A — Blue + Dark
  console.log("\n  --- TEST A: Blue + Dark ---");
  await db
    .update(barbershopBrandings)
    .set({
      color_preset: "blue",
      display_mode: "dark",
      warna_primary: "#2563EB",
      warna_secondary: "#1E293B",
      warna_background: "#070D18",
      updated_at: new Date(),
    })
    .where(eq(barbershopBrandings.id_barbershop, shop.id_barbershop));
  invalidateTenantCache(testSlug);

  let resolved = await getTenantBarbershop(testSlug);
  let vars = getTenantThemeVariables(resolved?.branding);
  assert(resolved?.branding?.color_preset === "blue", "Database saved & resolver returned color_preset: blue");
  assert(resolved?.branding?.display_mode === "dark", "Database saved & resolver returned display_mode: dark");
  assert(vars["--primary"] === "#2563EB", "Runtime semantic token --primary resolves to Blue");
  assert(vars["--background"] === "#070D18", "Runtime semantic token --background resolves to dark #070D18");

  // Test B — Purple + Dark
  console.log("\n  --- TEST B: Purple + Dark ---");
  await db
    .update(barbershopBrandings)
    .set({
      color_preset: "purple",
      display_mode: "dark",
      warna_primary: "#7C3AED",
      warna_secondary: "#4C1D95",
      warna_background: "#0F0A1F",
      updated_at: new Date(),
    })
    .where(eq(barbershopBrandings.id_barbershop, shop.id_barbershop));
  invalidateTenantCache(testSlug);

  resolved = await getTenantBarbershop(testSlug);
  vars = getTenantThemeVariables(resolved?.branding);
  assert(resolved?.branding?.color_preset === "purple", "Database saved & resolver returned color_preset: purple");
  assert(vars["--primary"] === "#7C3AED", "Runtime semantic token --primary resolves to Purple #7C3AED");
  assert(vars["--background"] === "#0F0A1F", "Runtime semantic token --background resolves to deep purple #0F0A1F");
  assert(vars["--card"] === "#1E1238", "Runtime semantic token --card resolves to purple card #1E1238");

  // Test C — Emerald + Dark
  console.log("\n  --- TEST C: Emerald + Dark ---");
  await db
    .update(barbershopBrandings)
    .set({
      color_preset: "emerald",
      display_mode: "dark",
      warna_primary: "#059669",
      warna_secondary: "#064E3B",
      warna_background: "#022C22",
      updated_at: new Date(),
    })
    .where(eq(barbershopBrandings.id_barbershop, shop.id_barbershop));
  invalidateTenantCache(testSlug);

  resolved = await getTenantBarbershop(testSlug);
  vars = getTenantThemeVariables(resolved?.branding);
  assert(resolved?.branding?.color_preset === "emerald", "Database saved & resolver returned color_preset: emerald");
  assert(vars["--primary"] === "#059669", "Runtime semantic token --primary resolves to Emerald #059669");
  assert(vars["--background"] === "#022C22", "Runtime semantic token --background resolves to emerald night #022C22");
  assert(vars["--card"] === "#063D2F", "Runtime semantic token --card resolves to emerald card #063D2F");

  // Test D — Purple + Light
  console.log("\n  --- TEST D: Purple + Light ---");
  await db
    .update(barbershopBrandings)
    .set({
      color_preset: "purple",
      display_mode: "light",
      warna_primary: "#7C3AED",
      warna_secondary: "#4C1D95",
      warna_background: "#FAF5FF",
      updated_at: new Date(),
    })
    .where(eq(barbershopBrandings.id_barbershop, shop.id_barbershop));
  invalidateTenantCache(testSlug);

  resolved = await getTenantBarbershop(testSlug);
  vars = getTenantThemeVariables(resolved?.branding);
  assert(resolved?.branding?.color_preset === "purple", "Database saved & resolver returned color_preset: purple");
  assert(resolved?.branding?.display_mode === "light", "Database saved & resolver returned display_mode: light");
  assert(vars["--primary"] === "#7C3AED", "Runtime semantic token --primary resolves to Purple #7C3AED");
  assert(vars["--background"] === "#FAF5FF", "Runtime semantic token --background resolves to Light Lilac #FAF5FF (NOT navy!)");
  assert(vars["--card"] === "#FFFFFF", "Runtime semantic token --card resolves to clean white #FFFFFF");
  assert(vars["--foreground"] === "#2E1065", "Runtime semantic token --foreground resolves to readable plum text #2E1065");

  // Test E — Reload Persistence
  console.log("\n  --- TEST E: Hard Reload Persistence ---");
  invalidateTenantCache(); // simulate fresh server process reload
  resolved = await getTenantBarbershop(testSlug);
  vars = getTenantThemeVariables(resolved?.branding);
  assert(resolved?.branding?.display_mode === "light", "Reload still retains display_mode: light");
  assert(resolved?.branding?.color_preset === "purple", "Reload still retains color_preset: purple");
  assert(vars["--background"] === "#FAF5FF", "Reload still delivers light background #FAF5FF");

  console.log("\n============================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runThemingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with exception:", err);
    process.exit(1);
  });
