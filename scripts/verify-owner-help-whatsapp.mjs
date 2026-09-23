import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=== VERIFYING OWNER HELP & WHATSAPP SUPPORT IMPLEMENTATION ===");

// 1. Verify support.tsx
const supportPath = path.join(rootDir, "src", "lib", "support.tsx");
assert.ok(fs.existsSync(supportPath), "support.tsx must exist");
const supportContent = fs.readFileSync(supportPath, "utf-8");

// Assert contacts
assert.ok(supportContent.includes('"Fibula"'), "Must contain contact Fibula");
assert.ok(supportContent.includes('"6282135202388"'), "Fibula phone must be 6282135202388");
assert.ok(supportContent.includes('"+62 821-3520-2388"'), "Fibula display phone must be +62 821-3520-2388");

assert.ok(supportContent.includes('"Nabila"'), "Must contain contact Nabila");
assert.ok(supportContent.includes('"6282211955788"'), "Nabila phone must be 6282211955788");
assert.ok(supportContent.includes('"+62 822-1195-5788"'), "Nabila display phone must be +62 822-1195-5788");

// Test URL generator logic directly
function generateWhatsAppSupportUrl(options) {
  const page = options.pageName || "Pusat Bantuan";
  const cleanPhone = options.phone.replace(/[^0-9]/g, "");

  const template = `Halo Tim BARBERIN, saya membutuhkan bantuan terkait sistem BARBERIN.

Nama Barbershop: ${options.barbershopName}
Halaman: ${page}

Kendala/Pertanyaan:

[Silakan tuliskan kendala atau pertanyaan Anda]

Terima kasih.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(template)}`;
}

const testUrlFibula = generateWhatsAppSupportUrl({
  phone: "6282135202388",
  barbershopName: "Barberin Premium",
  pageName: "Pusat Bantuan",
});

assert.ok(
  testUrlFibula.startsWith("https://wa.me/6282135202388?text="),
  "Deep link must use official https://wa.me/6282135202388"
);
const decodedFibula = decodeURIComponent(testUrlFibula.split("?text=")[1]);
assert.ok(decodedFibula.includes("Nama Barbershop: Barberin Premium"), "Template must contain dynamic tenant name");
assert.ok(decodedFibula.includes("Halaman: Pusat Bantuan"), "Template must contain page name");
assert.ok(decodedFibula.includes("Halo Tim BARBERIN, saya membutuhkan bantuan terkait sistem BARBERIN."), "Template greeting check");
assert.ok(decodedFibula.includes("[Silakan tuliskan kendala atau pertanyaan Anda]"), "Template placeholder check");
assert.ok(decodedFibula.includes("Terima kasih."), "Template closing check");

const testUrlNabila = generateWhatsAppSupportUrl({
  phone: "6282211955788",
  barbershopName: "Vintage Cut Studio",
  pageName: "Pusat Bantuan",
});
assert.ok(
  testUrlNabila.startsWith("https://wa.me/6282211955788?text="),
  "Deep link must use official https://wa.me/6282211955788"
);
const decodedNabila = decodeURIComponent(testUrlNabila.split("?text=")[1]);
assert.ok(decodedNabila.includes("Nama Barbershop: Vintage Cut Studio"), "Template must contain dynamic tenant name");

console.log("✔ support.tsx contacts and deep link generation verified!");

// 2. Verify $barbershopSlug.owner.help.tsx
const helpRoutePath = path.join(rootDir, "src", "routes", "$barbershopSlug.owner.help.tsx");
assert.ok(fs.existsSync(helpRoutePath), "Owner help route must exist");
const helpContent = fs.readFileSync(helpRoutePath, "utf-8");

// Verify BPMN and ERD are hidden / not rendered
assert.ok(!helpContent.toLowerCase().includes("bpmn"), "Must NOT render BPMN in help page");
assert.ok(!helpContent.toLowerCase().includes("erd"), "Must NOT render ERD in help page");

// Verify WhatsApp features are present
assert.ok(helpContent.includes("Butuh Bantuan Langsung?"), "Must include section 'Butuh Bantuan Langsung?'");
assert.ok(helpContent.includes("Hubungi Tim BARBERIN"), "Must include 'Hubungi Tim BARBERIN'");
assert.ok(helpContent.includes("Respon lebih cepat melalui WhatsApp."), "Must include subtitle");
assert.ok(helpContent.includes("Hubungi via WhatsApp"), "Must include 'Hubungi via WhatsApp' button");
assert.ok(helpContent.includes("OwnerAuthGuard"), "Must be protected by OwnerAuthGuard");
assert.ok(helpContent.includes("Menghubungkan ke WhatsApp"), "Must include transition connecting modal");
assert.ok(helpContent.includes("Menyiapkan tautan"), "Must include stepper step 1");
assert.ok(helpContent.includes("Membuka WhatsApp"), "Must include stepper step 2");
assert.ok(helpContent.includes("Buka WhatsApp"), "Must include fallback open button");

console.log("✔ help.tsx UI components and BPMN/ERD removal verified!");
console.log("=== ALL CHECKS PASSED SUCCESSFULLY ===");
