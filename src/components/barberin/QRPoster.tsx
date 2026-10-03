import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Sparkles } from "lucide-react";
import { TenantLogo } from "@/components/tenant/TenantLogo";
import { cn } from "@/lib/utils";

export interface QRPosterProps {
  barbershopSlug: string;
  barbershopName: string;
  logoUrl?: string | null | undefined;
  customerUrl: string;
  className?: string | undefined;
  id?: string | undefined;
}

export interface GenerateQRPosterOptions {
  barbershopSlug: string;
  barbershopName: string;
  logoUrl?: string | null | undefined;
  customerUrl: string;
}

/**
 * Helper to safely load an image from URL with CORS and fallback to local /barberin-logo.png
 */
async function loadLogoImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return null;

  const tryLoad = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timer = setTimeout(() => reject(new Error("Timeout loading logo")), 3000);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Error loading logo"));
      };
      img.src = src;
    });

  // Try custom tenant logo if provided
  if (url && url.trim()) {
    try {
      return await tryLoad(url.trim());
    } catch {
      // Continue to project fallback
    }
  }

  // Fallback to BARBERIN default logo
  try {
    return await tryLoad("/barberin-logo.png");
  } catch {
    return null;
  }
}

/**
 * Draw a clean rounded rectangle on HTML5 canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth?: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor && lineWidth) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draw a geometric 4-point sparkle star on canvas
 */
function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const outerAngle = (i * Math.PI) / 2 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 4;
    if (i === 0) {
      ctx.moveTo(cx + Math.cos(outerAngle) * radius, cy + Math.sin(outerAngle) * radius);
    } else {
      ctx.lineTo(cx + Math.cos(outerAngle) * radius, cy + Math.sin(outerAngle) * radius);
    }
    ctx.lineTo(
      cx + Math.cos(innerAngle) * (radius * 0.32),
      cy + Math.sin(innerAngle) * (radius * 0.32)
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Generate a complete, high-resolution (1080x1440 px) portrait QR Poster PNG data URL.
 * Strictly adheres to visual specifications:
 * - White background
 * - Logo at top
 * - Dynamic barbershop name
 * - Pill badge "Menu & Pemesanan Mandiri"
 * - Large QR code in rounded white container with subtle shadow & border
 * - Headline "ARAHKAN KAMERA HP KE QR CODE"
 * - Description "Scan langsung menggunakan kamera smartphone..."
 */
export async function generateQRPosterDataUrl({
  barbershopSlug: _barbershopSlug,
  barbershopName,
  logoUrl,
  customerUrl,
}: GenerateQRPosterOptions): Promise<string> {
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gagal menginisialisasi 2D canvas context.");

  // High-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Pure White Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2; // 540

  // 2. Logo at Top
  const logoImg = await loadLogoImage(logoUrl);
  const logoBoxW = 150;
  const logoBoxH = 150;
  const logoBoxY = 110;

  if (logoImg && logoImg.width && logoImg.height) {
    const aspect = logoImg.width / logoImg.height;
    let drawW = logoBoxW;
    let drawH = logoBoxH;
    if (aspect > 1) {
      drawH = logoBoxW / aspect;
    } else {
      drawW = logoBoxH * aspect;
    }
    const drawX = centerX - drawW / 2;
    const drawY = logoBoxY + (logoBoxH - drawH) / 2;

    ctx.save();
    drawRoundedRect(ctx, drawX, drawY, drawW, drawH, 20);
    ctx.clip();
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    // Elegant fallback icon
    const drawX = centerX - logoBoxW / 2;
    const drawY = logoBoxY;
    drawRoundedRect(ctx, drawX, drawY, logoBoxW, logoBoxH, 28, "#0F172A");
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initial = (barbershopName || "B").trim().charAt(0).toUpperCase() || "B";
    ctx.fillText(initial, centerX, logoBoxY + logoBoxH / 2);
  }

  // 3. Dynamic Barbershop Name
  const cleanName = (barbershopName || "BARBERSHOP").trim().toUpperCase();
  let nameFontSize = 46;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
  while (ctx.measureText(cleanName).width > 860 && nameFontSize > 26) {
    nameFontSize -= 2;
    ctx.font = `900 ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
  }
  ctx.fillStyle = "#0F172A";
  ctx.fillText(cleanName, centerX, 320);

  // 4. Pill Badge: "Menu & Pemesanan Mandiri"
  const badgeText = "Menu & Pemesanan Mandiri";
  ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const textWidth = ctx.measureText(badgeText).width;
  const sparkleSize = 10;
  const badgeGap = 10;
  const badgePadX = 24;
  const badgeContentWidth = sparkleSize * 2 + badgeGap + textWidth;
  const badgeWidth = badgeContentWidth + badgePadX * 2;
  const badgeHeight = 48;
  const badgeX = centerX - badgeWidth / 2;
  const badgeY = 352;

  // Background light blue (#EFF6FF) with subtle border (#DBEAFE)
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 24, "#EFF6FF", "#DBEAFE", 1.5);

  // Sparkle icon
  const sparkleCenterX = badgeX + badgePadX + sparkleSize;
  const sparkleCenterY = badgeY + badgeHeight / 2;
  drawSparkle(ctx, sparkleCenterX, sparkleCenterY, sparkleSize, "#2563EB");

  // Badge label text
  ctx.fillStyle = "#2563EB";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, sparkleCenterX + sparkleSize + badgeGap, sparkleCenterY);

  // 5. QR Container Card (White, rounded corners, subtle shadow & border)
  const containerSize = 600;
  const containerX = centerX - containerSize / 2; // 240
  const containerY = 432;
  const containerRadius = 36;

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.07)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, containerX, containerY, containerSize, containerSize, containerRadius, "#FFFFFF");
  ctx.restore();

  drawRoundedRect(ctx, containerX, containerY, containerSize, containerSize, containerRadius, undefined, "#E2E8F0", 2);

  // 6. QR Code inside Container with Quiet Zone
  const qrSize = 500;
  const qrX = containerX + (containerSize - qrSize) / 2;
  const qrY = containerY + (containerSize - qrSize) / 2;
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, customerUrl, {
    width: qrSize,
    margin: 2,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // 7. Headline: "ARAHKAN KAMERA HP KE QR CODE"
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
  ctx.fillText("ARAHKAN KAMERA HP KE QR CODE", centerX, 1120);

  // 8. Description: 2 lines
  ctx.fillStyle = "#64748B";
  ctx.font = "500 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
  ctx.fillText("Scan langsung menggunakan kamera smartphone untuk", centerX, 1175);
  ctx.fillText("melihat layanan dan antrean. Tanpa perlu download aplikasi.", centerX, 1215);

  return canvas.toDataURL("image/png", 1.0);
}

/**
 * Trigger download of the high-res QR Poster as a PNG file
 */
export async function downloadQRPoster({
  barbershopSlug,
  barbershopName,
  logoUrl,
  customerUrl,
}: GenerateQRPosterOptions): Promise<void> {
  const dataUrl = await generateQRPosterDataUrl({
    barbershopSlug,
    barbershopName,
    logoUrl,
    customerUrl,
  });

  const safeSlug =
    barbershopSlug
      ?.toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-") || "barbershop";
  const filename = `${safeSlug}-qr-pelanggan.png`;

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Reusable QRPoster Component
 *
 * Renders the exact poster layout both for screen preview and print.
 * What you see in preview is what is downloaded as PNG and printed.
 */
export function QRPoster({
  barbershopSlug: _barbershopSlug,
  barbershopName,
  logoUrl,
  customerUrl,
  className,
  id = "qr-poster-preview",
}: QRPosterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [_qrReady, setQrReady] = useState(false);

  useEffect(() => {
    if (canvasRef.current && customerUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        customerUrl,
        {
          width: 320,
          margin: 2,
          color: {
            dark: "#0F172A",
            light: "#FFFFFF",
          },
          errorCorrectionLevel: "H",
        },
        (err) => {
          if (err) {
            console.error("[QRPoster] Failed to render QR canvas:", err);
          } else {
            setQrReady(true);
          }
        }
      );
    }
  }, [customerUrl]);

  return (
    <div
      id={id}
      className={cn(
        "w-full max-w-sm sm:max-w-md mx-auto bg-white rounded-3xl sm:rounded-[32px] border border-slate-200/90 shadow-2xl p-6 sm:p-9 text-center text-slate-900 transition-all select-none",
        className
      )}
    >
      {/* 1. Logo at Top */}
      <div className="flex flex-col items-center">
        <TenantLogo
          logoUrl={logoUrl}
          brandName={barbershopName}
          className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-2xl mx-auto shadow-xs"
          fallbackClassName="h-16 w-16 sm:h-20 sm:w-20"
        />

        {/* 2. Barbershop Name */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mt-3.5 px-2 leading-tight">
          {barbershopName}
        </h2>

        {/* 3. Badge "Menu & Pemesanan Mandiri" */}
        <div className="mt-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-100/90 px-3.5 py-1 rounded-full shadow-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <span>Menu & Pemesanan Mandiri</span>
          </span>
        </div>
      </div>

      {/* 4. Large QR Code inside rounded white container */}
      <div className="my-6 p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)] inline-block mx-auto text-center">
        <canvas
          ref={canvasRef}
          className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] max-w-full block mx-auto rounded-xl"
        />
      </div>

      {/* 5. Instruction Headline & Description */}
      <div className="space-y-1.5 pt-1">
        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
          ARAHKAN KAMERA HP KE QR CODE
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 max-w-[280px] sm:max-w-[320px] mx-auto leading-relaxed">
          Scan langsung menggunakan kamera smartphone untuk melihat layanan dan antrean. Tanpa perlu download aplikasi.
        </p>
      </div>
    </div>
  );
}
