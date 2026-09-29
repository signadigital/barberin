import fs from "node:fs";

const css = fs.readFileSync("src/styles.css", "utf8");

const checks = {
  hasTenantThemeSelector: css.includes('[data-tenant-theme="true"]'),
  mapsBrandPrimaryToPrimary: css.includes("--primary: var(--brand-primary);"),
  mapsBrandSecondaryToDeep: css.includes("--deep: var(--brand-secondary);"),
  mapsBrandBackgroundToNavy: css.includes("--navy: var(--brand-background);"),
  hasDarkModeSelector: css.includes('[data-tenant-theme="true"][data-display-mode="dark"]'),
  hasLightModeSelector: css.includes('[data-tenant-theme="true"][data-display-mode="light"]'),
  darkModeBackground: css.includes("--background: var(--brand-background);"),
  lightModeBackground: css.includes("--background: color-mix("),
  darkModeCardDerived: css.includes("--card: color-mix("),
  lightModeCardWhite: css.includes("--card: #FFFFFF;"),
  retainsThemeInline: css.includes("@theme inline {"),
};

console.log("============================================================");
console.log("CSS DESIGN TOKEN BRIDGE VERIFICATION");
console.log("============================================================");

let allPassed = true;
for (const [key, val] of Object.entries(checks)) {
  if (val) {
    console.log(`  ✓ PASS: ${key}`);
  } else {
    console.error(`  ✗ FAIL: ${key}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log("\nALL CSS TOKEN BRIDGE CHECKS PASSED!");
}
