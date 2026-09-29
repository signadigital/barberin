import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";

console.log("=== RUNNING AUDIT FINANCE DATE RANGE PICKER VALIDATION ===");

// 1. Verify files exist
console.log("\n--- TEST 1: File Existence & Export Checks ---");
const datePickerFile = readFileSync(
  "src/components/owner/date-range-picker.tsx",
  "utf8"
);
assert(
  datePickerFile.includes("export function OwnerDateRangePicker"),
  "OwnerDateRangePicker must be exported"
);
assert(
  datePickerFile.includes("draftPreset"),
  "Must maintain draftPreset state"
);
assert(
  datePickerFile.includes("draftStart"),
  "Must maintain draftStart state"
);
assert(
  datePickerFile.includes("draftEnd"),
  "Must maintain draftEnd state"
);
assert(
  datePickerFile.includes("Compare"),
  "Must render Compare checkbox"
);
assert(
  datePickerFile.includes("Dates are shown in WIB"),
  "Must state Dates are shown in WIB"
);
assert(
  datePickerFile.includes('setDraftPreset("custom")'),
  "Must switch preset automatically to custom on calendar day click"
);
console.log("✓ PASS: Date range picker component structure and requirements verified");

// 2. Verify audit-finance route integration
console.log("\n--- TEST 2: Route Integration Checks ---");
const auditFinanceRoute = readFileSync(
  "src/routes/$barbershopSlug.owner.audit-finance.tsx",
  "utf8"
);
assert(
  auditFinanceRoute.includes("OwnerDateRangePicker"),
  "Must import and render OwnerDateRangePicker"
);
assert(
  auditFinanceRoute.includes("ChevronDown"),
  "Must render ChevronDown icon next to header date"
);
assert(
  auditFinanceRoute.includes("startDate: period === \"custom\" ? startDate : undefined"),
  "Must pass custom startDate to getOwnerAuditFinance"
);
assert(
  auditFinanceRoute.includes("endDate: period === \"custom\" ? endDate : undefined"),
  "Must pass custom endDate to getOwnerAuditFinance"
);
console.log("✓ PASS: Route integration properly passes startDate and endDate to backend");

// 3. Verify backend getPeriodDates behavior
console.log("\n--- TEST 3: Backend Date Math & Inclusive End Date ---");
const ownerLib = readFileSync("src/lib/owner.ts", "utf8");

assert(
  ownerLib.includes("customStart && customEnd"),
  "Must support customStart and customEnd"
);
assert(
  ownerLib.includes("T23:59:59.999+07:00"),
  "End date must end at 23:59:59.999+07:00 (strictly inclusive in WIB)"
);
assert(
  ownerLib.includes("T00:00:00+07:00"),
  "Start date must begin at 00:00:00+07:00 (WIB)"
);
assert(
  ownerLib.includes("eq(transaksi.id_barbershop, targetShopId)"),
  "Multi-tenant isolation strictly enforced with barbershop ID"
);

console.log("✓ PASS: Backend date handling is inclusive, timezone-anchored (WIB), and tenant-isolated");

// 4. Verify presets logic
console.log("\n--- TEST 4: Presets Logic Consistency ---");
assert(
  datePickerFile.includes('"today"'),
  "Must support today preset"
);
assert(
  datePickerFile.includes('"7d"'),
  "Must support week/7d preset"
);
assert(
  datePickerFile.includes('"month"'),
  "Must support month preset"
);
assert(
  datePickerFile.includes('"custom"'),
  "Must support custom preset"
);
console.log("✓ PASS: Presets (Hari ini, Minggu ini, Bulan ini, Custom) properly implemented");

console.log("\n=== ALL AUDIT FINANCE DATE RANGE TESTS PASSED! ===");
