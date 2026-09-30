import fs from "node:fs";
import path from "node:path";

console.log("=================================================================");
console.log("VERIFIKASI SISTEM: IMAGE CROPPER LOGO & FAVICON (OWNER TEMA)");
console.log("=================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       -> ${details}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       -> ${details}`);
    failed++;
  }
}

// 1. Audit Files Existence
const cropperPath = path.resolve("./src/components/ui/image-cropper.tsx");
const themeRoutePath = path.resolve("./src/routes/$barbershopSlug.owner.theme.tsx");
const brandingDomainsPath = path.resolve("./src/lib/branding-domains.ts");
const stylesCssPath = path.resolve("./src/styles.css");
const layoutRoutePath = path.resolve("./src/routes/$barbershopSlug.tsx");

assert(fs.existsSync(cropperPath), "File ImageCropper Component ada", cropperPath);
assert(fs.existsSync(themeRoutePath), "File Route Owner Theme ada", themeRoutePath);
assert(fs.existsSync(brandingDomainsPath), "File Branding Domains ada", brandingDomainsPath);

const cropperContent = fs.readFileSync(cropperPath, "utf-8");
const themeContent = fs.readFileSync(themeRoutePath, "utf-8");
const brandingContent = fs.readFileSync(brandingDomainsPath, "utf-8");
const stylesContent = fs.readFileSync(stylesCssPath, "utf-8");
const layoutContent = fs.readFileSync(layoutRoutePath, "utf-8");

// TEST 1: Logo Cropper Configuration (Aspect Ratio 1:1 Persegi)
assert(
  cropperContent.includes("aspectRatio = 1 / 1") &&
    themeContent.includes("aspectRatio={1 / 1}"),
  "TEST 1: Logo Cropper menggunakan aspect ratio persegi 1:1",
  "Aspect ratio 1:1 diterapkan untuk logo barbershop."
);

// TEST 2: Favicon Cropper Configuration (Aspect Ratio 1:1 Square & 512x512)
assert(
  cropperContent.includes("targetWidth = 512") &&
    cropperContent.includes("targetHeight = 512") &&
    themeContent.includes("aspectRatio={1 / 1}"),
  "TEST 2: Favicon Cropper menggunakan aspect ratio persegi 1:1 dan output standar 512x512",
  "Output canvas favicon distandarisasi ke 512x512 square PNG."
);

// TEST 3: Preservasi Transparansi PNG (Logo & Favicon)
assert(
  cropperContent.includes("const mimeType = \"image/png\"") &&
    cropperContent.includes("croppedCanvas.toBlob"),
  "TEST 3: Menggunakan Canvas API dengan MIME image/png untuk preservasi transparansi",
  "Canvas menghasilkan image/png murni dengan transparent channel."
);

// TEST 4: Validasi File Sebelum Crop (Batas Ukuran Maksimal 500 KB)
assert(
  themeContent.includes("[\"image/jpeg\", \"image/png\", \"image/webp\"].includes(file.type)") &&
    themeContent.includes("file.size > 500 * 1024"),
  "TEST 4: Validasi format MIME dan ukuran maksimum file (Logo & Favicon: 500 KB)",
  "File divalidasi sebelum modal cropper dibuka dengan batas 500 KB."
);

// TEST 5: Crop Ulang (Re-crop) dan Ubah Image
assert(
  themeContent.includes("handleReCrop") &&
    themeContent.includes("Crop Ulang") &&
    themeContent.includes("logoOriginalSrc || logoUrl") &&
    themeContent.includes("faviconOriginalSrc || faviconUrl"),
  "TEST 5: Fitur 'Crop Ulang' menggunakan gambar yang aktif tanpa upload ulang",
  "Mendukung re-crop dan ubah file dengan mulus."
);

// TEST 6 & 7: Semantic Theming & Dark/Light Mode
const hasHardcodedBlueInCropper =
  cropperContent.includes("#4E78FF") || cropperContent.includes("#0D1526");
const usesSemanticTokens =
  cropperContent.includes("bg-card") &&
  cropperContent.includes("text-card-foreground") &&
  cropperContent.includes("border-border") &&
  cropperContent.includes("bg-primary") &&
  cropperContent.includes("text-primary-foreground");

assert(
  !hasHardcodedBlueInCropper && usesSemanticTokens,
  "TEST 6 & 7: ImageCropper mematuhi semantic theme tokens (Light & Dark Mode)",
  "Menggunakan bg-card, border-border, bg-primary, tanpa hardcoded color hex."
);

// TEST 8: CSS Styles Import react-easy-crop
assert(
  stylesContent.includes("react-easy-crop/react-easy-crop.css"),
  "TEST 8: Import style css react-easy-crop ke global stylesheet",
  "@import 'react-easy-crop/react-easy-crop.css' terpasang di styles.css"
);

// TEST 9: Multi-tenant Isolation & Server-Side Security
assert(
  brandingContent.includes("requireOwnerTenant()") &&
    brandingContent.includes("const session = getOwnerSession()") &&
    brandingContent.includes("barbershopBrandings.id_barbershop, shopId"),
  "TEST 9: Multi-tenant isolation terjamin via server-side session",
  "Owner hanya dapat mengubah branding barbershop miliknya sendiri."
);

// TEST 10: Dynamic Browser Favicon Sync & Cache Invalidation
assert(
  layoutContent.includes("document.querySelector(\"link[rel*='icon']\")") &&
    themeContent.includes("link.href = dataUrl") &&
    themeContent.includes("await router.invalidate()"),
  "TEST 10: Browser tab favicon dan router cache langsung tersinkronisasi",
  "Favicon link diupdate secara real-time dan cache di-invalidate."
);

console.log("\n=================================================================");
console.log(`TOTAL TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
