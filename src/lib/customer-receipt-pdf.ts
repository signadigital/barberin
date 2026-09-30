import {
  formatRupiah,
  formatTanggal,
  formatWaktu,
  formatTransactionId,
  formatCustomerId,
} from "@/lib/format";
import { paymentMethodName, type ReceiptData } from "@/lib/barberin-store";

export type CustomerReceiptPdfBranding = {
  nama_brand?: string | null | undefined;
  tagline?: string | null | undefined;
  logo_url?: string | null | undefined;
  warna_primary?: string | null | undefined;
  hide_barberin_brand?: boolean | undefined;
};

export type CustomerReceiptPdfShop = {
  nama_barbershop?: string | null | undefined;
  alamat?: string | null | undefined;
  no_hp?: string | null | undefined;
};

export type GenerateCustomerReceiptPdfOptions = {
  receipt: ReceiptData;
  branding?: CustomerReceiptPdfBranding | null | undefined;
  shop?: CustomerReceiptPdfShop | null | undefined;
};

/**
 * Konversi warna Hex ke RGB secara aman dengan fallback
 */
function hexToRgb(hex?: string | null): [number, number, number] {
  if (!hex) return [37, 99, 235]; // Default primary blue
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0]! + cleanHex[0]!, 16);
    const g = parseInt(cleanHex[1]! + cleanHex[1]!, 16);
    const b = parseInt(cleanHex[2]! + cleanHex[2]!, 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return [37, 99, 235];
}

/**
 * Muat gambar URL secara aman dan konversi ke data URL base64
 * Fail-safe: jika CORS diblokir, network timeout, atau 404, fungsi mengembalikan null tanpa melempar error.
 */
async function loadImageAsDataUrl(
  url?: string | null,
  timeoutMs: number = 3000,
): Promise<{ dataUrl: string; width: number; height: number; format: string } | null> {
  if (!url || typeof window === "undefined") return null;

  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width || 120;
        const h = img.naturalHeight || img.height || 120;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, width: w, height: h, format: "PNG" });
      } catch (err) {
        console.warn("[CustomerReceiptPDF] Image to dataURL conversion warning (handled):", err);
        resolve(null);
      }
    };

    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Gambar pola watermark diagonal 'barberin' berulang di latar belakang seluruh halaman
 * Sesuai visual referensi Audit Keuangan:
 * - Teks berulang 'barberin'
 * - Sudut kemiringan diagonal ~35 derajat
 * - Warna sangat lembut dan elegan ([228, 238, 248]) sehingga tidak mengganggu keterbacaan
 */
function drawReceiptWatermark(
  doc: any,
  pageWidth: number,
  pageHeight: number,
) {
  // Latar belakang putih bersih
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Konfigurasi font watermark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  // Warna soft ice blue / cool grey yang sangat subtle
  doc.setTextColor(226, 237, 248);

  const stepX = 115;
  const stepY = 48;
  const angle = 35;

  let rowIdx = 0;
  for (let y = -40; y < pageHeight + 100; y += stepY) {
    const offsetX = rowIdx % 2 === 0 ? 0 : stepX / 2;
    for (let x = -80; x < pageWidth + 100; x += stepX) {
      doc.text("barberin", x + offsetX, y, { angle });
    }
    rowIdx++;
  }
}

/**
 * Generator utama PDF Struk Transaksi Pelanggan BARBERIN
 */
export async function generateCustomerReceiptPdf({
  receipt,
  branding,
  shop,
}: GenerateCustomerReceiptPdfOptions): Promise<{ doc: any; filename: string }> {
  const { jsPDF } = await import("jspdf");

  // Ukuran standar A4 portrait dalam point (pt)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2; // 515.28 pt

  // Palet warna yang elegan & profesional
  const brandPrimaryRgb = hexToRgb(branding?.warna_primary);
  const slateDark: [number, number, number] = [15, 23, 42];      // #0f172a
  const slateHeading: [number, number, number] = [30, 41, 59];   // #1e293b
  const slateText: [number, number, number] = [51, 65, 85];      // #334155
  const slateMuted: [number, number, number] = [100, 116, 139];  // #64748b
  const borderLight: [number, number, number] = [226, 232, 240]; // #e2e8f0
  const emeraldGreen: [number, number, number] = [16, 185, 129]; // #10b981
  const bgCard: [number, number, number] = [255, 255, 255];

  // 1. Gambar Watermark Halaman Pertama
  drawReceiptWatermark(doc, pageWidth, pageHeight);

  let currentY = 40;

  // 2. Baris Aksen Atas (Branding Primary Color)
  doc.setFillColor(brandPrimaryRgb[0], brandPrimaryRgb[1], brandPrimaryRgb[2]);
  doc.roundedRect(marginX, currentY, contentWidth, 5, 2.5, 2.5, "F");
  currentY += 16;

  // 3. Muat Logo Barbershop (dengan fallback aman ke logo lokal atau teks)
  let logoLoaded = await loadImageAsDataUrl(branding?.logo_url);
  if (!logoLoaded && typeof window !== "undefined") {
    // Coba fallback ke default logo BARBERIN jika logo tenant belum diatur
    logoLoaded = await loadImageAsDataUrl("/barberin-logo.png");
  }

  // Header Box Container (Card semi-transparan / solid putih beraksen)
  const headerBoxY = currentY;
  const headerBoxHeight = 72;
  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(1);
  doc.roundedRect(marginX, headerBoxY, contentWidth, headerBoxHeight, 8, 8, "FD");

  let textStartX = marginX + 16;
  if (logoLoaded) {
    try {
      const maxLogoW = 46;
      const maxLogoH = 46;
      let renderW = maxLogoW;
      let renderH = maxLogoH;
      if (logoLoaded.width && logoLoaded.height) {
        const ratio = logoLoaded.width / logoLoaded.height;
        if (ratio > 1) {
          renderH = maxLogoW / ratio;
        } else {
          renderW = maxLogoH * ratio;
        }
      }
      const logoX = marginX + 16 + (maxLogoW - renderW) / 2;
      const logoY = headerBoxY + (headerBoxHeight - renderH) / 2;
      doc.addImage(logoLoaded.dataUrl, logoLoaded.format, logoX, logoY, renderW, renderH);
      textStartX = marginX + 72;
    } catch (err) {
      console.warn("[CustomerReceiptPDF] Gagal merender logo ke PDF, fallback ke teks:", err);
    }
  }

  // Nama Brand / Barbershop
  const brandName =
    branding?.nama_brand?.trim() ||
    shop?.nama_barbershop?.trim() ||
    "BARBERIN";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(brandName, textStartX, headerBoxY + 28);

  // Tagline / Subtitle
  const tagline =
    branding?.tagline?.trim() ||
    "Modern Barbershop Management System";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(tagline, textStartX, headerBoxY + 42);

  // Alamat & Kontak (jika tersedia)
  const contactText = [shop?.alamat, shop?.no_hp].filter(Boolean).join(" • ");
  if (contactText) {
    doc.setFontSize(7.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    const cleanContact = contactText.length > 60 ? contactText.slice(0, 58) + "…" : contactText;
    doc.text(cleanContact, textStartX, headerBoxY + 55);
  }

  // Judul Dokumen di Sisi Kanan Header Box
  const headerRightX = marginX + contentWidth - 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(brandPrimaryRgb[0], brandPrimaryRgb[1], brandPrimaryRgb[2]);
  doc.text("STRUK TRANSAKSI", headerRightX, headerBoxY + 26, { align: "right" });

  const formattedTxId = formatTransactionId(receipt.transactionId, receipt.createdAt);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(`#${formattedTxId}`, headerRightX, headerBoxY + 42, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text("Bukti Pembayaran Sah", headerRightX, headerBoxY + 55, { align: "right" });

  currentY += headerBoxHeight + 14;

  // 4. Section: Informasi Transaksi (2 Kolom Bersih)
  const infoBoxY = currentY;
  const infoBoxHeight = 84;
  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(marginX, infoBoxY, contentWidth, infoBoxHeight, 8, 8, "FD");

  // Garis Header Kecil pada Info Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text("INFORMASI TRANSAKSI", marginX + 16, infoBoxY + 18);

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX + 16, infoBoxY + 23, marginX + contentWidth - 16, infoBoxY + 23);

  // Data Kolom 1 (Kiri)
  const col1LabelX = marginX + 16;
  const col1ValX = marginX + 105;
  let infoY1 = infoBoxY + 38;

  const drawInfoRow = (label: string, val: string, lx: number, vx: number, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(label, lx, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(val, vx, y);
  };

  const formattedCustomerId = formatCustomerId(receipt.customerId, receipt.createdAt);
  drawInfoRow("ID Transaksi", formattedTxId, col1LabelX, col1ValX, infoY1);
  drawInfoRow("ID Pelanggan", formattedCustomerId, col1LabelX, col1ValX, infoY1 + 14);
  drawInfoRow("Nama Pelanggan", receipt.customerName || "Pelanggan", col1LabelX, col1ValX, infoY1 + 28);

  // Data Kolom 2 (Kanan)
  const col2LabelX = marginX + contentWidth / 2 + 10;
  const col2ValX = col2LabelX + 85;
  let infoY2 = infoBoxY + 38;

  const tanggalStr = formatTanggal(receipt.createdAt);
  const waktuStr = formatWaktu(receipt.createdAt, true);
  const capsterStr = receipt.capster
    ? `${receipt.capster.name} (${receipt.capster.role || "Barber"})`
    : "Capster";

  drawInfoRow("Tanggal", tanggalStr, col2LabelX, col2ValX, infoY2);
  drawInfoRow("Waktu", waktuStr, col2LabelX, col2ValX, infoY2 + 14);
  drawInfoRow("Capster", capsterStr, col2LabelX, col2ValX, infoY2 + 28);

  currentY += infoBoxHeight + 16;

  // 5. Section: Tabel Detail Layanan
  const colW_No = 32;
  const colW_Name = 235;
  const colW_Qty = 44;
  const colW_Price = 102;
  const colW_Subtotal = 102.28;

  const tableColumns = [
    { header: "NO", width: colW_No, align: "center" as const },
    { header: "LAYANAN / PAKET POTONG", width: colW_Name, align: "left" as const },
    { header: "QTY", width: colW_Qty, align: "center" as const },
    { header: "HARGA SATUAN", width: colW_Price, align: "right" as const },
    { header: "SUBTOTAL", width: colW_Subtotal, align: "right" as const },
  ];

  const drawTableHeader = (y: number) => {
    doc.setFillColor(slateHeading[0], slateHeading[1], slateHeading[2]);
    doc.roundedRect(marginX, y, contentWidth, 24, 4, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let curX = marginX;
    tableColumns.forEach((col) => {
      let tx = curX + 8;
      if (col.align === "center") {
        tx = curX + col.width / 2;
      } else if (col.align === "right") {
        tx = curX + col.width - 8;
      }
      doc.text(col.header, tx, y + 15.5, { align: col.align });
      curX += col.width;
    });

    return y + 24;
  };

  currentY = drawTableHeader(currentY);

  const rowHeight = 22;
  const items = receipt.items && receipt.items.length > 0
    ? receipt.items
    : [
        {
          service: { id: "1", name: "Potong Rambut", description: "", price: receipt.total },
          quantity: 1,
        },
      ];

  items.forEach((item, index) => {
    // Multi-page check jika item layanan banyak
    if (currentY + rowHeight > pageHeight - 160) {
      doc.addPage();
      drawReceiptWatermark(doc, pageWidth, pageHeight);
      currentY = 40;
      currentY = drawTableHeader(currentY);
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(marginX, currentY, contentWidth, rowHeight, "F");

    // Garis border bawah per baris
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.5);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    let curX = marginX;

    // 1. No
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(String(index + 1), curX + colW_No / 2, currentY + 14.5, { align: "center" });
    curX += colW_No;

    // 2. Nama Layanan
    doc.setFont("helvetica", "bold");
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    let svcName = item.service.name || "Layanan";
    if (svcName.length > 40) {
      svcName = svcName.slice(0, 38) + "…";
    }
    doc.text(svcName, curX + 8, currentY + 14.5);
    curX += colW_Name;

    // 3. Qty
    doc.setFont("helvetica", "normal");
    doc.setTextColor(slateText[0], slateText[1], slateText[2]);
    doc.text(`${item.quantity}x`, curX + colW_Qty / 2, currentY + 14.5, { align: "center" });
    curX += colW_Qty;

    // 4. Harga Satuan
    doc.text(formatRupiah(item.service.price), curX + colW_Price - 8, currentY + 14.5, { align: "right" });
    curX += colW_Price;

    // 5. Subtotal
    doc.setFont("helvetica", "bold");
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(formatRupiah(item.service.price * item.quantity), curX + colW_Subtotal - 8, currentY + 14.5, { align: "right" });

    currentY += rowHeight;
  });

  currentY += 14;

  // 6. Section: Ringkasan Pembayaran (Card Rapi)
  const summaryBoxWidth = 260;
  const summaryBoxX = marginX + contentWidth - summaryBoxWidth;
  const summaryBoxHeight = 88;

  // Jika posisi mendekati batas bawah, tambahkan halaman baru
  if (currentY + summaryBoxHeight > pageHeight - 120) {
    doc.addPage();
    drawReceiptWatermark(doc, pageWidth, pageHeight);
    currentY = 40;
  }

  // Background Box Pembayaran
  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(1);
  doc.roundedRect(summaryBoxX, currentY, summaryBoxWidth, summaryBoxHeight, 8, 8, "FD");

  let sumY = currentY + 22;

  // Baris Metode Pembayaran
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text("Metode Pembayaran", summaryBoxX + 16, sumY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  const paymentName = paymentMethodName(receipt.paymentMethod) || "Tunai";
  doc.text(paymentName, summaryBoxX + summaryBoxWidth - 16, sumY, { align: "right" });
  sumY += 16;

  // Baris Status Pembayaran
  doc.setFont("helvetica", "normal");
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text("Status Transaksi", summaryBoxX + 16, sumY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text("Berhasil", summaryBoxX + summaryBoxWidth - 16, sumY, { align: "right" });
  sumY += 14;

  // Garis Pembatas Ringkasan
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(summaryBoxX + 16, sumY, summaryBoxX + summaryBoxWidth - 16, sumY);
  sumY += 18;

  // Baris TOTAL BAYAR (Besar & Tegas)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text("TOTAL BAYAR", summaryBoxX + 16, sumY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(brandPrimaryRgb[0], brandPrimaryRgb[1], brandPrimaryRgb[2]);
  doc.text(formatRupiah(receipt.total), summaryBoxX + summaryBoxWidth - 16, sumY, { align: "right" });

  // Note di sebelah kiri Summary Box
  const noteBoxX = marginX;
  const noteBoxWidth = contentWidth - summaryBoxWidth - 20;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(noteBoxX, currentY, noteBoxWidth, summaryBoxHeight, 8, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text("Catatan Struk", noteBoxX + 14, currentY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(
    "• Struk ini adalah bukti pembayaran yang sah.",
    noteBoxX + 14,
    currentY + 38,
  );
  doc.text(
    "• Terima kasih telah mempercayakan layanan rambut Anda.",
    noteBoxX + 14,
    currentY + 52,
  );
  doc.text(
    `• Diterbitkan secara resmi oleh ${brandName}.`,
    noteBoxX + 14,
    currentY + 66,
  );

  currentY += summaryBoxHeight + 24;

  // 7. Footer Halaman
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Garis pemisah footer
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 38, marginX + contentWidth, pageHeight - 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);

    // Footer Kiri: Platform Note
    doc.text(
      "Dokumen digital resmi diterbitkan melalui Platform BARBERIN",
      marginX,
      pageHeight - 25,
    );

    // Footer Kanan: Nomor Halaman
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      marginX + contentWidth,
      pageHeight - 25,
      { align: "right" },
    );
  }

  // Nama file hasil download: Struk-TRX-YYMM-XXXX.pdf
  const filename = `Struk-${formattedTxId}.pdf`;

  return { doc, filename };
}

/**
 * Pemicu langsung download file PDF ke browser pengguna
 */
export async function downloadCustomerReceiptPdf(
  options: GenerateCustomerReceiptPdfOptions,
): Promise<{ success: boolean; filename: string }> {
  try {
    const { doc, filename } = await generateCustomerReceiptPdf(options);
    doc.save(filename);
    return { success: true, filename };
  } catch (error) {
    console.error("[CustomerReceiptPDF] Failed to generate or download PDF:", error);
    throw error;
  }
}
